/**
 * 语义校验（ValidationRegistry）：解析成功后运行语义规则，结果并入诊断。
 * 计划 §3。
 */
import type { Namespace, Membership, Definition, Usage } from '../../grammar/generated/ast.js';
import { isNamespace, isOwningMembership } from '../../grammar/generated/ast.js';
import { buildScopeTree, type ScopeNode } from './scope.js';
import { getTypeReferenceName, resolveToDefinition } from './references.js';
import { getNodeRange } from '../../grammar/astUtils.js';

export interface SemanticDiagnostic {
  severity: number;
  range: { start: { line: number; character: number }; end: { line: number; character: number } };
  message: string;
}

const DiagnosticSeverity = { Error: 1, Warning: 2 } as const;

const BUILTIN_TYPES = new Set([
  'Boolean', 'Integer', 'Real', 'String', 'Natural', 'Positive',
  'Magnitude', 'Vector', 'Matrix', 'Array', 'Element', 'Feature', 'Type'
]);

/** 单条校验规则：接收 root、text、scopeRoot，返回违规列表 */
export type ValidationRule = (
  root: Namespace,
  text: string,
  scopeRoot: ScopeNode | null
) => SemanticDiagnostic[];

/** 未解析的类型引用：PartUsage/PortUsage/AttributeUsage 的 type 指向未定义类型 */
const ruleUnresolvedTypeRef: ValidationRule = (root, text, scopeRoot) => {
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

const VALIDATION_RULES: ValidationRule[] = [
  ruleUnresolvedTypeRef,
  ruleDuplicateDefinition
];

/**
 * 运行所有注册的语义校验规则，返回 LSP 风格的 Diagnostic 列表（0-based line/character）。
 */
export function runSemanticValidation(root: unknown, text: string): SemanticDiagnostic[] {
  if (!root || typeof root !== 'object' || !isNamespace(root)) return [];
  const scopeRoot = buildScopeTree(root);
  const out: SemanticDiagnostic[] = [];
  for (const rule of VALIDATION_RULES) {
    out.push(...rule(root, text, scopeRoot));
  }
  return out;
}
