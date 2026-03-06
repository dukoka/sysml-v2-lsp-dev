/**
 * 语义校验（ValidationRegistry）：解析成功后运行语义规则，结果并入诊断。
 * 计划 §3。
 */
import type { Namespace, Membership, Definition, Usage } from '../../grammar/generated/ast.js';
import { isNamespace, isOwningMembership, isDefinition } from '../../grammar/generated/ast.js';
import { buildScopeTree, type ScopeNode, type IndexEntryForLookup, scopeLookupInIndex } from './scope.js';
import { getTypeReferenceName, resolveToDefinition } from './references.js';
import { getNodeRange } from '../../grammar/astUtils.js';

export interface SemanticDiagnostic {
  severity: number;
  range: { start: { line: number; character: number }; end: { line: number; character: number } };
  message: string;
  tags?: number[];
}

const DiagnosticSeverity = { Error: 1, Warning: 2, Information: 3, Hint: 4 } as const;

const BUILTIN_TYPES = new Set([
  'Boolean', 'Integer', 'Real', 'String', 'Natural', 'Positive',
  'Magnitude', 'Vector', 'Matrix', 'Array', 'Element', 'Feature', 'Type'
]);

export interface CrossFileContext {
  currentUri: string;
  index: Map<string, IndexEntryForLookup>;
}

/** 单条校验规则：接收 root、text、scopeRoot 及可选跨文件上下文 */
export type ValidationRule = (
  root: Namespace,
  text: string,
  scopeRoot: ScopeNode | null,
  crossFile?: CrossFileContext
) => SemanticDiagnostic[];

/** 未解析的类型引用：PartUsage/PortUsage/AttributeUsage 的 type 指向未定义类型 */
const ruleUnresolvedTypeRef: ValidationRule = (root, text, scopeRoot, crossFile) => {
  const out: SemanticDiagnostic[] = [];
  const scope = scopeRoot ?? buildScopeTree(root);
  if (!scope) return out;

  function visit(ns: Namespace, currentScope: ScopeNode): void {
    if (!ns.children) return;
    for (const child of ns.children) {
      if (!isOwningMembership(child) || !child.target) continue;
      const t = child.target as Definition | Usage;
      const typeName = getTypeReferenceName(t);
      if (typeName && !BUILTIN_TYPES.has(typeName)) {
        const resolved = resolveToDefinition(currentScope, typeName);
        if (!resolved) {
          // Cross-file lookup: check other documents in the index
          if (crossFile) {
            const crossResolved = scopeLookupInIndex(crossFile.currentUri, scope, typeName, crossFile.index);
            if (crossResolved) continue;
          }
          const range = getNodeRange(t, text);
          if (range) {
            out.push({
              severity: DiagnosticSeverity.Error,
              range,
              message: `Unresolved type reference: '${typeName}'`
            });
          }
        }
      }
      const childScope = currentScope.children.find(c => c.namespace === t);
      if (isNamespace(t)) visit(t, childScope ?? currentScope);
    }
  }

  visit(root, scope);
  return out;
};

/** 同 scope 内重复定义：同一名称在同一层声明多次 */
const ruleDuplicateDefinition: ValidationRule = (root, text, _scopeRoot) => {
  const out: SemanticDiagnostic[] = [];

  function checkScope(ns: Namespace): void {
    const seen = new Map<string, unknown>();
    if (!ns.children) return;
    for (const child of ns.children) {
      if (!isOwningMembership(child) || !child.target) continue;
      const t = child.target;
      const name = (t as { declaredName?: string }).declaredName ?? (t as { declaredShortName?: string }).declaredShortName;
      if (!name?.trim()) continue;
      if (seen.has(name)) {
        const range = getNodeRange(t, text);
        if (range) {
          out.push({
            severity: DiagnosticSeverity.Error,
            range,
            message: `Duplicate definition: '${name}'`
          });
        }
      } else {
        seen.set(name, t);
      }
      if (isNamespace(t)) checkScope(t);
    }
  }

  checkScope(root);
  return out;
};

/** Definition with no children — likely an unfinished stub */
const ruleEmptyDefinitionBody: ValidationRule = (root, text, _scopeRoot) => {
  const out: SemanticDiagnostic[] = [];
  function visit(ns: Namespace): void {
    if (!ns.children) return;
    for (const child of ns.children) {
      if (!isOwningMembership(child) || !child.target) continue;
      const t = child.target;
      if (isDefinition(t)) {
        const name = (t as { declaredName?: string }).declaredName;
        if (name) {
          const innerNs = t as Namespace;
          const hasBody = innerNs.children && innerNs.children.some(c =>
            isOwningMembership(c) && c.target != null
          );
          if (!hasBody) {
            const range = getNodeRange(t, text);
            if (range) {
              out.push({
                severity: DiagnosticSeverity.Warning,
                range,
                message: `Definition '${name}' has an empty body`
              });
            }
          }
        }
        if (isNamespace(t)) visit(t);
      }
    }
  }
  visit(root);
  return out;
};

/** Definition not referenced by any Usage in the same file */
const ruleUnusedDefinition: ValidationRule = (root, text, _scopeRoot) => {
  const out: SemanticDiagnostic[] = [];
  const defNames = new Map<string, unknown>();
  const usedNames = new Set<string>();

  function collectDefs(ns: Namespace): void {
    if (!ns.children) return;
    for (const child of ns.children) {
      if (!isOwningMembership(child) || !child.target) continue;
      const t = child.target;
      if (isDefinition(t)) {
        const name = (t as { declaredName?: string }).declaredName;
        if (name) defNames.set(name, t);
      }
      if (isNamespace(t)) collectDefs(t);
    }
  }

  function collectUsages(ns: Namespace): void {
    if (!ns.children) return;
    for (const child of ns.children) {
      if (!isOwningMembership(child) || !child.target) continue;
      const t = child.target;
      const typeRef = getTypeReferenceName(t);
      if (typeRef) usedNames.add(typeRef);
      if (isNamespace(t)) collectUsages(t);
    }
  }

  collectDefs(root);
  collectUsages(root);

  for (const [name, node] of defNames) {
    if (!usedNames.has(name)) {
      const range = getNodeRange(node, text);
      if (range) {
        out.push({
          severity: DiagnosticSeverity.Hint,
          range,
          message: `Definition '${name}' is declared but not used in this file`,
          tags: [1] // DiagnosticTag.Unnecessary
        });
      }
    }
  }
  return out;
};

/** Package-level Definition without a doc comment */
const ruleMissingDocComment: ValidationRule = (root, text, _scopeRoot) => {
  const out: SemanticDiagnostic[] = [];
  if (!root.children) return out;
  const lines = text.split('\n');
  for (const child of root.children) {
    if (!isOwningMembership(child) || !child.target) continue;
    const t = child.target;
    if (!isDefinition(t)) continue;
    const name = (t as { declaredName?: string }).declaredName;
    if (!name) continue;
    const range = getNodeRange(t, text);
    if (!range) continue;

    let hasDoc = false;
    for (let i = range.start.line - 1; i >= 0 && i >= range.start.line - 5; i--) {
      const prev = (lines[i] ?? '').trim();
      if (prev.startsWith('/*') || prev.startsWith('*') || prev.endsWith('*/') || prev.startsWith('doc') || prev.startsWith('//')) {
        hasDoc = true;
        break;
      }
      if (prev !== '') break;
    }

    // Also check for inline doc child
    const innerNs = t as Namespace;
    if (!hasDoc && innerNs.children) {
      for (const m of innerNs.children) {
        if (isOwningMembership(m) && m.target) {
          const mType = (m.target as { $type?: string }).$type;
          if (mType === 'Documentation' || mType === 'Comment') {
            hasDoc = true;
            break;
          }
        }
      }
    }

    if (!hasDoc) {
      out.push({
        severity: DiagnosticSeverity.Hint,
        range,
        message: `Definition '${name}' at package level lacks a doc comment`
      });
    }
  }
  return out;
};

const VALIDATION_RULES: ValidationRule[] = [
  ruleUnresolvedTypeRef,
  ruleDuplicateDefinition,
  ruleEmptyDefinitionBody,
  ruleUnusedDefinition,
  ruleMissingDocComment
];

/**
 * 运行所有注册的语义校验规则，返回 LSP 风格的 Diagnostic 列表（0-based line/character）。
 * 可选 crossFile 参数启用跨文件类型引用解析。
 */
export function runSemanticValidation(root: unknown, text: string, crossFile?: CrossFileContext): SemanticDiagnostic[] {
  if (!root || typeof root !== 'object' || !isNamespace(root)) return [];
  const scopeRoot = buildScopeTree(root);
  const out: SemanticDiagnostic[] = [];
  for (const rule of VALIDATION_RULES) {
    out.push(...rule(root, text, scopeRoot, crossFile));
  }
  return out;
}
