/**
 * SysMLv2 formatter - shared by LSP Worker and Monaco provider.
 * When root (parsed AST Namespace) is provided, uses AST-based indent (phase A); otherwise brace-depth.
 */
import { getAstIndentLevels } from '../../grammar/astUtils.js';

export interface FormattingOptions {
  tabSize?: number;
  insertSpaces?: boolean;
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
    const braceIndents: number[] = [];
    let braceDepth = 0;
    for (let i = 0; i < normalizedLines.length; i++) {
      const line = normalizedLines[i];
      const trimmed = line.trim();
      if (trimmed === '') {
        braceIndents.push(-1);
        continue;
      }
      // 处理行内 brace，计算该行之前的深度
      let depth = braceDepth;
      // 检查行首是否有 }，如果有则先减少深度
      if (trimmed.startsWith('}') || trimmed.startsWith('end')) {
        depth = Math.max(0, depth - 1);
      }
      // 统计行内的 { 和 } 数量来更新深度
      const openBraces = (trimmed.match(/{/g) || []).length;
      const closeBraces = (trimmed.match(/}/g) || []).length;
      // 行内只有 closing brace 时，深度不增加
      if (closeBraces > 0 && openBraces === 0) {
        depth = Math.max(0, depth - closeBraces);
      }
      braceIndents.push(depth);
      // 更新下一行的基础深度（只在行有 opening brace 时增加）
      if (openBraces > 0) braceDepth += openBraces;
      if (closeBraces > 0 && openBraces === 0) braceDepth = Math.max(0, braceDepth - closeBraces);
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
    const indent = indentChar.repeat(level * tabSize);
    result.push(indent + trimmed);
  }

  return result.join('\n');
}
