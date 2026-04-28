/**
 * SysMLv2 formatter - shared by LSP Worker and Monaco provider.
 * When root (parsed AST Namespace) is provided, uses AST-based indent (phase A); otherwise brace-depth.
 */
import { getAstIndentLevels } from '../../grammar/astUtils.js';

export interface FormattingOptions {
  tabSize?: number;
  insertSpaces?: boolean;
  baseIndent?: number;
}

/** Optional AST root (Namespace) for AST-aware formatting; when set, indent matches document symbols/folding. */
export type FormatAstRoot = unknown;

function normalizeBracketSpacing(line: string): string {
  let out = '';
  let i = 0;
  let inString = false;
  let stringChar = '';
  let inBlockComment = false;
  while (i < line.length) {
    if (inBlockComment) {
      if (line.substring(i, i + 2) === '*/') {
        inBlockComment = false;
        out += '*/';
        i += 2;
        continue;
      }
      out += line[i++];
      continue;
    }
    if (line.substring(i, i + 2) === '/*') {
      inBlockComment = true;
      out += '/*';
      i += 2;
      continue;
    }
    if (!inString && line.substring(i, i + 2) === '//') {
      out += line.substring(i);
      break;
    }
    if (!inString && (line[i] === '"' || line[i] === "'")) {
      inString = true;
      stringChar = line[i];
      out += line[i++];
      continue;
    }
    if (inString) {
      if (line[i] === '\\' && i + 1 < line.length) {
        out += line[i++] + line[i++];
        continue;
      }
      if (line[i] === stringChar) inString = false;
      out += line[i++];
      continue;
    }
    if (line[i] === '{' && out.length > 0 && /\w$/.test(out)) {
      out += ' {';
      i++;
      continue;
    }
    if (out.length > 0 && out.endsWith('}') && /\w/.test(line[i])) {
      out += ' ';
    }
    if (line[i] === '}' && i + 1 < line.length && line[i + 1] === '{') {
      out += '} {';
      i += 2;
      continue;
    }
    out += line[i++];
  }
  return out;
}

export function formatSysmlv2Code(
  text: string,
  options: FormattingOptions = {},
  root?: FormatAstRoot
): string {
  const lines = text.split('\n');
  const result: string[] = [];
  const tabSize = options.tabSize ?? 2;
  const indentChar = options.insertSpaces !== false ? ' ' : '\t';

  const normalizedLines = lines.map(line => normalizeBracketSpacing(line));

  let baseIndents: (number | null)[];
  if (root != null) {
    baseIndents = getAstIndentLevels(root, text);
  } else {
    // 基于原始缩进的格式化 - 保留并规范化原始缩进
    const braceIndents: number[] = [];
    let braceDepth = 0;
    for (let i = 0; i < normalizedLines.length; i++) {
      const line = normalizedLines[i];
      const trimmed = line.trim();
      if (trimmed === '') {
        braceIndents.push(-1);
        continue;
      }
      // 先处理 closing brace（在当前行扣减深度）
      if (trimmed.startsWith('}') || trimmed.startsWith('end')) {
        braceDepth = Math.max(0, braceDepth - 1);
      }
      braceIndents.push(braceDepth);
      // 再处理 opening brace（从下一行开始增加深度）
      const openBraces = (trimmed.match(/{/g) || []).length;
      const closeBraces = (trimmed.match(/}/g) || []).length;
      if (closeBraces > 0) braceDepth = Math.max(0, braceDepth - closeBraces);
      if (openBraces > 0) braceDepth += openBraces;
    }
    baseIndents = braceIndents.map(d => (d < 0 ? null : d));
  }

  let lastIndent = 0;
  for (let i = 0; i < normalizedLines.length; i++) {
    const line = normalizedLines[i];
    const trimmed = line.trim();

    if (trimmed === '') {
      result.push('');
      continue;
    }

    let level: number;
    const raw = baseIndents[i];
    if (raw === null || raw === undefined) {
      level = lastIndent;
    } else {
      level = raw;
      lastIndent = level;
    }
    if (level < 0) level = 0;
    const baseIndent = options.baseIndent ?? 0;
    level += baseIndent;
    const indent = indentChar.repeat(level * tabSize);
    result.push(indent + trimmed);
  }

  return result.join('\n');
}
