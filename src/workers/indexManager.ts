/**
 * 多文件工作区：每文档索引（解析结果 + Scope），供跨 URI 引用解析与 LSP 使用。
 * 阶段 G.1。
 */
import type { Namespace } from '../grammar/generated/ast.js';
import { isNamespace } from '../grammar/generated/ast.js';
import { parseSysML } from '../grammar/parser.js';
import { buildScopeTree, type ScopeNode } from '../languages/sysmlv2/scope.js';

export interface IndexEntry {
  uri: string;
  text: string;
  /** 解析根（Namespace 或无效时的 undefined） */
  root: Namespace | undefined;
  /** 解析错误数 > 0 时 root 可能仍可用 */
  parseErrors: number;
  scopeRoot: ScopeNode | null;
}

const index = new Map<string, IndexEntry>();

/**
 * 更新指定 URI 的索引：解析 text，构建 scopeRoot。
 */
export function updateIndex(uri: string, text: string): IndexEntry {
  const parseResult = parseSysML(text, uri);
  const parseErrors = (parseResult.parserErrors?.length ?? 0) + (parseResult.lexerErrors?.length ?? 0);
  const root =
    parseResult.value && isNamespace(parseResult.value) ? (parseResult.value as Namespace) : undefined;
  const scopeRoot = root ? buildScopeTree(root) : null;
  const entry: IndexEntry = { uri, text, root, parseErrors, scopeRoot };
  index.set(uri, entry);
  return entry;
}

/**
 * 移除 URI 的索引（文档关闭时调用）。
 */
export function removeFromIndex(uri: string): void {
  index.delete(uri);
}

/**
 * 获取 URI 对应的索引项。
 */
export function getIndexEntry(uri: string): IndexEntry | undefined {
  return index.get(uri);
}

/**
 * 获取当前所有已索引的 URI。
 */
export function getIndexedUris(): string[] {
  return Array.from(index.keys());
}

/**
 * 全局 Index（Map<uri, IndexEntry>），供 scope/references 跨 URI 查找使用。
 */
export function getIndex(): Map<string, IndexEntry> {
  return index;
}
