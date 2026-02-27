/**
 * 引用解析：根据 Scope 解析类型引用/特征引用到定义，供跳转定义、查找引用、重命名使用。
 * 计划 §2。
 */
import type { Namespace, Element, Definition, Usage } from '../../grammar/generated/ast.js';
import { isNamespace, isOwningMembership } from '../../grammar/generated/ast.js';
import type { ScopeNode, IndexEntryForLookup } from './scope.js';
import { scopeLookup, buildScopeTree, getScopeAtPosition, scopeLookupInIndex } from './scope.js';
import { getNodeRange, type AstRange } from '../../grammar/astUtils.js';

/** 解析结果：引用指向的定义节点（同文件内）。 */
export interface ResolvedDefinition {
  node: Element;
}

/** 解析结果：引用指向的定义节点（可跨文件），带 uri。 */
export interface ResolvedDefinitionWithUri {
  uri: string;
  node: Element;
}

/**
 * 根据当前 scope 解析名称到定义（类型或成员）。用于类型引用、特征引用等。
 */
export function resolveToDefinition(scope: ScopeNode | null, name: string): Element | undefined {
  return scopeLookup(scope, name);
}

/**
 * 解析名称到定义（类型或成员），支持跨 URI；先当前 scope 再 index 内其他文档根级声明。
 */
export function resolveToDefinitionWithUri(
  scopeRoot: ScopeNode | null,
  name: string,
  currentUri: string,
  index: Map<string, IndexEntryForLookup>
): ResolvedDefinitionWithUri | undefined {
  return scopeLookupInIndex(currentUri, scopeRoot, name, index);
}

/** 判断 AST 节点是否为“对定义的引用”（如 PartUsage 的 type 指向 PartDefinition）。 */
export function isReferenceTo(node: unknown, definition: Element): boolean {
  const defName = (definition as { declaredName?: string }).declaredName ?? (definition as { declaredShortName?: string }).declaredShortName;
  if (!defName) return false;
  const n = node as { declaredName?: string; declaredShortName?: string; type?: { $ref?: { value?: Element } }; typeRelationships?: unknown[] };
  const name = n?.declaredName ?? n?.declaredShortName;
  if (name === defName) return true;
  return false;
}

/** 从 Usage 节点获取其类型引用名称（如 part engine : Engine → "Engine"）。 */
export function getTypeReferenceName(usage: unknown): string | undefined {
  const u = usage as {
    typeRelationships?: Array<{ typeRef?: { parts?: Array<{ value?: { declaredName?: string; declaredShortName?: string } }> } }>;
    type?: { $ref?: { value?: { declaredName?: string; declaredShortName?: string } } };
    heritage?: Array<{ targetRef?: { $ref?: { value?: { declaredName?: string; declaredShortName?: string } } } }>;
  };
  if (u?.type?.$ref?.value) {
    return u.type.$ref.value.declaredName ?? u.type.$ref.value.declaredShortName;
  }
  const firstHeritage = u?.heritage?.[0];
  if (firstHeritage?.targetRef?.$ref?.value) {
    return firstHeritage.targetRef.$ref.value.declaredName ?? firstHeritage.targetRef.$ref.value.declaredShortName;
  }
  const tr = u?.typeRelationships?.[0];
  const firstPart = tr?.typeRef?.parts?.[0]?.value;
  return firstPart?.declaredName ?? firstPart?.declaredShortName;
}

/** 获取 Usage 节点中“类型引用”在文档中的 range（用于判断光标是否在类型名上）。 */
export function getTypeReferenceRange(usage: unknown, text: string): AstRange | undefined {
  const u = usage as {
    type?: unknown;
    heritage?: Array<{ targetRef?: unknown }>;
  };
  if (u?.type) {
    const r = getNodeRange(u.type, text);
    if (r) return r;
  }
  const firstHeritage = u?.heritage?.[0];
  if (firstHeritage?.targetRef) return getNodeRange(firstHeritage.targetRef, text) ?? undefined;
  return undefined;
}

/**
 * 在 AST 中收集所有“引用”给定定义的节点（同文件内）。
 * 包括：同名用法、类型引用指向该定义的 PartUsage/PortUsage/AttributeUsage。
 */
export function findReferencesToDefinition(root: unknown, definition: Element, scopeRoot: ScopeNode | null): Element[] {
  const out: Element[] = [];
  const defName = (definition as { declaredName?: string }).declaredName ?? (definition as { declaredShortName?: string }).declaredShortName;
  if (!defName) return out;

  function visit(ns: Namespace): void {
    if (!ns.children) return;
    for (const child of ns.children) {
      if (!isOwningMembership(child) || !child.target) continue;
      const t = child.target;
      const typeName = getTypeReferenceName(t);
      if (typeName === defName) out.push(t);
      const name = (t as { declaredName?: string }).declaredName ?? (t as { declaredShortName?: string }).declaredShortName;
      if (name === defName && t !== definition) out.push(t);
      if (isNamespace(t)) visit(t);
    }
  }

  if (root && typeof root === 'object' && isNamespace(root)) {
    visit(root);
  }
  return out;
}

/** 0-based line/character */
function rangeContains(range: { start: { line: number; character: number }; end: { line: number; character: number } }, line: number, character: number): boolean {
  if (line < range.start.line || line > range.end.line) return false;
  if (line === range.start.line && character < range.start.character) return false;
  if (line === range.end.line && character > range.end.character) return false;
  return true;
}

/** 在 AST 中查找包含 (line, character) 的节点（0-based），返回最内层带 declaredName 的 Element。 */
export function findNodeAtPosition(root: unknown, text: string, line: number, character: number): Element | null {
  let found: Element | null = null;
  function visit(ns: Namespace): void {
    if (!ns.children) return;
    for (const child of ns.children) {
      if (!isOwningMembership(child) || !child.target) continue;
      const t = child.target as Element;
      const range = getNodeRange(t, text);
      if (range && rangeContains(range, line, character)) {
        const name = (t as { declaredName?: string }).declaredName ?? (t as { declaredShortName?: string }).declaredShortName;
        if (name) found = t;
        if (isNamespace(t)) visit(t);
      }
    }
  }
  if (root && typeof root === 'object' && isNamespace(root)) visit(root);
  return found;
}

/** 根据位置得到“当前指向的定义”：若在定义上则返回该定义；若在用法上则 resolve 用法名；若在类型名上则 resolve 类型名。 */
export function getDefinitionAtPosition(root: unknown, text: string, line: number, character: number): Element | null {
  const scopeRoot = buildScopeTree(root);
  const node = findNodeAtPosition(root, text, line, character);
  if (!node) return null;
  const scope = scopeRoot ? getScopeAtPosition(scopeRoot, root, text, line, character) : null;
  const typeRange = getTypeReferenceRange(node, text);
  if (typeRange && rangeContains(typeRange, line, character)) {
    const typeName = getTypeReferenceName(node);
    if (typeName && scope) {
      const typeDef = resolveToDefinition(scope, typeName);
      if (typeDef) return typeDef;
    }
  }
  const name = (node as { declaredName?: string }).declaredName ?? (node as { declaredShortName?: string }).declaredShortName;
  const resolved = name && scope ? resolveToDefinition(scope, name) : null;
  if (resolved) return resolved;
  return node;
}

/**
 * 带 Index 的按位置解析定义，支持跨 URI；返回 { uri, node } 或 null。
 */
export function getDefinitionAtPositionWithUri(
  root: unknown,
  text: string,
  line: number,
  character: number,
  currentUri: string,
  index: Map<string, IndexEntryForLookup>
): ResolvedDefinitionWithUri | null {
  const scopeRoot = buildScopeTree(root);
  const node = findNodeAtPosition(root, text, line, character);
  if (!node) return null;
  const scope = scopeRoot ? getScopeAtPosition(scopeRoot, root, text, line, character) : null;
  const typeRange = getTypeReferenceRange(node, text);
  if (typeRange && rangeContains(typeRange, line, character)) {
    const typeName = getTypeReferenceName(node);
    if (typeName) {
      const resolved = resolveToDefinitionWithUri(scopeRoot, typeName, currentUri, index);
      if (resolved) return resolved;
    }
  }
  const name = (node as { declaredName?: string }).declaredName ?? (node as { declaredShortName?: string }).declaredShortName;
  if (name) {
    const resolved = resolveToDefinitionWithUri(scopeRoot, name, currentUri, index);
    if (resolved) return resolved;
  }
  return { uri: currentUri, node };
}

/**
 * 在多个文档中收集引用给定定义的所有节点，返回带 uri 的列表。
 * index 需包含 root/text，见 IndexEntry（references 不直接依赖 indexManager，由调用方构建 index 视图）。
 */
export function findReferencesToDefinitionAcrossIndex(
  index: Map<string, { root: Namespace | undefined; text: string; scopeRoot: ScopeNode | null }>,
  definitionUri: string,
  definitionNode: Element
): ResolvedDefinitionWithUri[] {
  const out: ResolvedDefinitionWithUri[] = [];
  for (const [uri, entry] of index) {
    if (!entry.root) continue;
    const refs = findReferencesToDefinition(entry.root, definitionNode, entry.scopeRoot);
    for (const node of refs) {
      out.push({ uri, node });
    }
  }
  return out;
}
