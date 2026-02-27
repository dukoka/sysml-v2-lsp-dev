/**
 * 语义层：Scope（可见符号表）。为每个 Namespace 构建 scope，供引用解析、补全、跳转使用。
 * 计划 §2。
 */
import type { Namespace, Membership, Definition, Usage, Element } from './../../grammar/generated/ast.js';
import {
  isNamespace,
  isPackage,
  isPartDefinition,
  isPortDefinition,
  isAttributeDefinition,
  isOwningMembership,
  isPartUsage,
  isPortUsage,
  isAttributeUsage,
} from '../../grammar/generated/ast.js';
import { getNodeRange } from '../../grammar/astUtils.js';

export interface ScopeNode {
  /** 对应 AST 的 Namespace 节点 */
  namespace: Namespace;
  /** 父 scope（外层命名空间） */
  parent: ScopeNode | null;
  /** 本层声明的名称 → 定义/用法节点 */
  declarations: Map<string, Element>;
  /** 子 scope（内层命名空间），顺序与 AST 一致 */
  children: ScopeNode[];
}

const BUILTIN_TYPES = new Set([
  'Boolean', 'Integer', 'Real', 'String', 'Natural', 'Positive',
  'Magnitude', 'Vector', 'Matrix', 'Array', 'Element', 'Feature', 'Type'
]);

function addDeclaration(declarations: Map<string, Element>, name: string | undefined, node: Element): void {
  if (name && name.trim()) {
    declarations.set(name.trim(), node);
  }
}

function buildScopeRec(ns: Namespace, parent: ScopeNode | null): ScopeNode {
  const declarations = new Map<string, Element>();
  const children: ScopeNode[] = [];

  if (ns.children) {
    for (const child of ns.children) {
      if (!isOwningMembership(child) || !child.target) continue;
      const t = child.target as Definition | Usage;
      const name = (t as { declaredName?: string }).declaredName ?? (t as { declaredShortName?: string }).declaredShortName;
      addDeclaration(declarations, name, t);
      if (isNamespace(t)) {
        children.push(buildScopeRec(t, null));
      }
    }
  }

  const node: ScopeNode = { namespace: ns, parent, declarations, children };
  for (const c of children) {
    (c as { parent: ScopeNode }).parent = node;
  }
  return node;
}

/**
 * 从 AST 根（Namespace）构建 Scope 树。每个 Namespace 对应一个 ScopeNode，内含其声明的名称。
 */
export function buildScopeTree(root: unknown): ScopeNode | null {
  if (!root || typeof root !== 'object' || !isNamespace(root)) return null;
  return buildScopeRec(root, null);
}

/**
 * 在 scope 链上按名称查找定义/用法，先当前层再父层。
 */
export function scopeLookup(scope: ScopeNode | null, name: string): Element | undefined {
  for (let s: ScopeNode | null = scope; s; s = s.parent) {
    const found = s.declarations.get(name);
    if (found) return found;
  }
  return BUILTIN_TYPES.has(name) ? undefined : undefined;
}

/** 供跨 URI 查找使用的索引项（仅需 scopeRoot，避免 scope 依赖 indexManager）。 */
export interface IndexEntryForLookup {
  scopeRoot: ScopeNode | null;
}

/**
 * 先当前文档 scope 查找，未命中时在 index 其他文档的根级声明中按 name 查找。
 * 返回 { uri, node } 或 undefined。
 */
export function scopeLookupInIndex(
  currentUri: string,
  scopeRoot: ScopeNode | null,
  name: string,
  index: Map<string, IndexEntryForLookup>
): { uri: string; node: Element } | undefined {
  const local = scopeLookup(scopeRoot, name);
  if (local) return { uri: currentUri, node: local };
  for (const [uri, entry] of index) {
    if (uri === currentUri) continue;
    if (entry.scopeRoot) {
      const node = entry.scopeRoot.declarations.get(name);
      if (node) return { uri, node };
    }
  }
  return undefined;
}

/** 收集所有在给定 range 内包含 (line, character) 的 Namespace 节点（由外到内）。 */
function namespacesContaining(
  ns: Namespace,
  text: string,
  line: number,
  character: number,
  out: Namespace[]
): void {
  const range = getNodeRange(ns, text);
  if (range && range.start.line <= line && line <= range.end.line) {
    if (range.start.line === line && character < range.start.character) return;
    if (range.end.line === line && character > range.end.character) return;
    out.push(ns);
  }
  if (!ns.children) return;
  for (const child of ns.children) {
    if (!isOwningMembership(child) || !child.target) continue;
    const t = child.target;
    if (isNamespace(t)) {
      namespacesContaining(t, text, line, character, out);
    }
  }
}

/** 由 Scope 树根和 AST 根，根据 (line, character) 找到最内层包含该位置的 ScopeNode。 */
function findScopeNodeByPosition(
  scopeRoot: ScopeNode,
  ns: Namespace,
  text: string,
  line: number,
  character: number
): ScopeNode | null {
  const innermost: Namespace[] = [];
  namespacesContaining(ns, text, line, character, innermost);
  if (innermost.length === 0) return scopeRoot;
  let smallest: Namespace | null = null;
  let smallestRange: { start: { line: number; character: number }; end: { line: number; character: number } } | null = null;
  for (const n of innermost) {
    const r = getNodeRange(n, text);
    if (!r) continue;
    if (!smallest || (r.end.line - r.start.line < (smallestRange!.end.line - smallestRange!.start.line))) {
      smallest = n;
      smallestRange = r;
    }
  }
  if (!smallest) return scopeRoot;
  function findScope(s: ScopeNode): ScopeNode | null {
    if (s.namespace === smallest) return s;
    for (const c of s.children) {
      const found = findScope(c);
      if (found) return found;
    }
    return null;
  }
  return findScope(scopeRoot) ?? scopeRoot;
}

/**
 * 根据文档位置 (0-based line, character) 得到该处的当前 Scope。
 * 需传入 buildScopeTree 的返回值与 AST 根及全文，以便用 getNodeRange 做位置包含判断。
 */
export function getScopeAtPosition(
  scopeRoot: ScopeNode | null,
  astRoot: unknown,
  text: string,
  line: number,
  character: number
): ScopeNode | null {
  if (!scopeRoot || !astRoot || typeof astRoot !== 'object' || !isNamespace(astRoot)) return null;
  return findScopeNodeByPosition(scopeRoot, astRoot, text, line, character);
}
