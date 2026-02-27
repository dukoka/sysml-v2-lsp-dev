/**
 * AST 范围基础设施：从 Langium AST 取结构 + 取 range，供文档符号、折叠、语义高亮、格式化等复用。
 * 计划 §1 交付：单一入口 getNodeRange / astToDocumentSymbols。
 */
import type { Namespace, Membership, Definition, Usage } from './generated/ast.js';
import {
  isNamespace,
  isPackage,
  isPartDefinition,
  isPortDefinition,
  isAttributeDefinition,
  isPartUsage,
  isPortUsage,
  isAttributeUsage,
  isOwningMembership,
} from './generated/ast.js';

/** LSP 风格 range（0-based line, character） */
export interface AstRange {
  start: { line: number; character: number };
  end: { line: number; character: number };
}

/** 带 range 的文档符号项（可转为 Monaco DocumentSymbol） */
export interface AstDocumentSymbol {
  name: string;
  detail: string;
  kind: 'package' | 'part' | 'port' | 'attribute' | 'usage' | 'other';
  range: AstRange;
  selectionRange: AstRange;
  children: AstDocumentSymbol[];
}

/** Langium AST 节点在运行时可能带有 $cstNode（CST 节点含位置） */
interface AstNodeWithCst {
  $cstNode?: {
    range?: { start: { line: number; character: number }; end: { line: number; character: number } };
    startOffset?: number;
    endOffset?: number;
  };
}

function offsetToLineCharacter(text: string, offset: number): { line: number; character: number } {
  let line = 0;
  let character = 0;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text[i] === '\n') {
      line++;
      character = 0;
    } else {
      character++;
    }
  }
  return { line, character };
}

/**
 * 从 AST 节点获取在文档中的 range。
 * 若 Langium 解析结果中节点带 $cstNode（含 range 或 startOffset/endOffset），则使用；
 * 否则返回 undefined，调用方可采用混合方案（如 parseSymbols 按行/列）。
 */
export function getNodeRange(node: unknown, text?: string): AstRange | undefined {
  const n = node as AstNodeWithCst | undefined;
  if (!n?.$cstNode) return undefined;

  const cst = n.$cstNode;
  if (cst.range?.start && cst.range?.end) {
    return {
      start: { line: cst.range.start.line, character: cst.range.start.character },
      end: { line: cst.range.end.line, character: cst.range.end.character },
    };
  }
  if (typeof cst.startOffset === 'number' && typeof cst.endOffset === 'number' && text != null) {
    return {
      start: offsetToLineCharacter(text, cst.startOffset),
      end: offsetToLineCharacter(text, cst.endOffset),
    };
  }
  return undefined;
}

/** 将 AstRange（0-based）转为 Monaco 1-based range */
export function astRangeToMonaco(range: AstRange): {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
} {
  return {
    startLineNumber: range.start.line + 1,
    startColumn: range.start.character + 1,
    endLineNumber: range.end.line + 1,
    endColumn: range.end.character + 1,
  };
}

function kindFor(s: string): AstDocumentSymbol['kind'] {
  if (s === 'package') return 'package';
  if (s === 'part') return 'part';
  if (s === 'port') return 'port';
  if (s === 'attribute') return 'attribute';
  if (s === 'usage') return 'usage';
  return 'other';
}

function oneSymbol(
  name: string,
  container: string,
  range: AstRange,
  children: AstDocumentSymbol[]
): AstDocumentSymbol {
  return {
    name: name || '(anonymous)',
    detail: container ? `${container} definition` : '',
    kind: kindFor(container),
    range,
    selectionRange: range,
    children,
  };
}

function collectDocumentSymbols(
  ns: Namespace,
  text: string | undefined,
  out: AstDocumentSymbol[]
): void {
  if (!ns?.children) return;
  for (const child of ns.children) {
    if (!isOwningMembership(child) || !child.target) continue;
    const t = child.target;
    const name = (t as { declaredName?: string }).declaredName ?? (t as { declaredShortName?: string }).declaredShortName;
    const range = getNodeRange(t, text);
    if (!range) continue; // 无 range 则跳过该节点（后续可接混合方案）
    const children: AstDocumentSymbol[] = [];
    if (isNamespace(t)) {
      collectDocumentSymbols(t, text, children);
    }
    let container = 'other';
    if (isPackage(t)) container = 'package';
    else if (isPartDefinition(t)) container = 'part';
    else if (isPortDefinition(t)) container = 'port';
    else if (isAttributeDefinition(t)) container = 'attribute';
    else if (isPartUsage(t) || isPortUsage(t) || isAttributeUsage(t)) container = 'usage';
    out.push(oneSymbol(name ?? '', container, range, children));
  }
}

/**
 * 从 AST 根（Namespace，即 Model 的根）生成层级文档符号，与 AST 一致。
 * 供 documentSymbols 解析成功时调用；若节点无 range 则跳过该节点（可回退到 parseSymbols）。
 */
export function astToDocumentSymbols(root: unknown, text?: string): AstDocumentSymbol[] {
  const symbols: AstDocumentSymbol[] = [];
  if (root && typeof root === 'object' && isNamespace(root)) {
    collectDocumentSymbols(root, text, symbols);
  }
  return symbols;
}

/** 用于缩进计算的区间：行范围 + 嵌套深度 */
interface IndentSpan {
  startLine: number;
  endLine: number;
  depth: number;
}

function collectIndentSpans(
  ns: Namespace,
  text: string | undefined,
  depth: number,
  out: IndentSpan[]
): void {
  if (!ns?.children) return;
  for (const child of ns.children) {
    if (!isOwningMembership(child) || !child.target) continue;
    const t = child.target;
    const range = getNodeRange(t, text);
    if (!range) continue;
    const startLine = range.start.line;
    const endLine = range.end.line;
    if (startLine <= endLine) out.push({ startLine, endLine, depth });
    if (isNamespace(t)) collectIndentSpans(t, text, depth + 1, out);
  }
}

/**
 * 按 AST 块结构计算每行缩进等级（与文档符号/折叠一致）。
 * 返回数组长度为 text 的行数；空行为 -1，调用方可用上一行缩进或 0。
 */
export function getAstIndentLevels(root: unknown, text: string): (number | null)[] {
  const lines = text.split('\n');
  const result: (number | null)[] = new Array(lines.length);
  if (!root || typeof root !== 'object' || !isNamespace(root)) {
    for (let i = 0; i < lines.length; i++) result[i] = lines[i].trim() === '' ? null : 0;
    return result;
  }
  const spans: IndentSpan[] = [];
  const rootRange = getNodeRange(root, text);
  if (rootRange) spans.push({ startLine: rootRange.start.line, endLine: rootRange.end.line, depth: 0 });
  collectIndentSpans(root, text, 1, spans);

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '') {
      result[i] = null;
      continue;
    }
    let maxDepth = 0;
    for (const s of spans) {
      if (s.startLine <= i && i <= s.endLine && s.depth > maxDepth) maxDepth = s.depth;
    }
    result[i] = maxDepth;
  }
  return result;
}
