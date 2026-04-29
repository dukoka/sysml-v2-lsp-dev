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
  const tabSize = options.tabSize ?? 2;
  const indentChar = options.insertSpaces !== false ? ' ' : '\t';
  const indent = indentChar.repeat(tabSize);

  // Use formatSysML which has better brace handling
  const baseIndent = options.baseIndent ?? 0;
  let formatted: string;
  if (baseIndent > 0) {
    // For range formatting, add base indent after each newline
    const lines = formatSysML(text, indent).split('\n');
    const result = lines.map(line => indentChar.repeat(baseIndent) + line).join('\n');
    formatted = result;
  } else {
    formatted = formatSysML(text, indent);
  }

  return formatted;
}

export function formatSysML(text: string, indent: string): string {
  const lines = text.split("\n");
  const result: string[] = [];
  let depth = 0;
  let prevBlank = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Remove trailing whitespace
    line = line.trimEnd();

    // Skip processing for empty lines (collapse multiples)
    if (line.trim() === "") {
      if (!prevBlank && result.length > 0) {
        result.push("");
        prevBlank = true;
      }
      continue;
    }
    prevBlank = false;

    const trimmed = line.trim();

    // Handle closing braces — decrease indent before this line
    let leadingCloses = 0;
    for (let c = 0; c < trimmed.length; c++) {
      const ch = trimmed[c];
      if (ch === "}" || ch === "]") leadingCloses++;
      else break;
    }
    if (leadingCloses > 0) {
      depth = Math.max(0, depth - leadingCloses);
    }

    // Check if this line is inside a string or comment
    const isLineComment = trimmed.startsWith("//");
    const isBlockCommentContinuation =
      !trimmed.startsWith("/*") &&
      (trimmed.startsWith("*") || trimmed.startsWith("*/"));

    // Apply indentation
    let indented: string;
    if (isBlockCommentContinuation) {
      // Align block comment continuation with one extra space
      indented = indent.repeat(depth) + " " + trimmed;
    } else if (isLineComment) {
      indented = indent.repeat(depth) + trimmed;
    } else {
      // Normalize spacing in the trimmed line
      const normalized = normalizeSpacing(trimmed);
      indented = indent.repeat(depth) + normalized;
    }

    result.push(indented);

    // Count braces for depth tracking (ignoring those in strings/comments)
    if (!isLineComment) {
      const opens =
        countOutsideStrings(trimmed, "{") +
        countOutsideStrings(trimmed, "[");
      const closes =
        countOutsideStrings(trimmed, "}") +
        countOutsideStrings(trimmed, "]");
      // We already accounted for leading closes above
      depth += opens - closes + leadingCloses;
      depth = Math.max(0, depth);
    }
  }

  // Ensure single trailing newline
  while (result.length > 0 && result[result.length - 1] === "") {
    result.pop();
  }
  result.push("");

  return result.join("\n");
}

/**
 * Normalize spacing around common SysML operators.
 * Preserves spacing inside strings. No regex.
 */
export function normalizeSpacing(line: string): string {
  // Don't modify lines that are primarily strings
  if (line.startsWith('"') || line.startsWith("'")) return line;

  const len = line.length;
  let result = "";
  let inString = false;
  let stringChar = "";

  for (let i = 0; i < len; i++) {
    const ch = line[i];

    // Track string boundaries
    if (inString) {
      result += ch;
      if (ch === stringChar && (i === 0 || line[i - 1] !== "\\")) {
        inString = false;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = true;
      stringChar = ch;
      result += ch;
      continue;
    }

    // Normalize space before opening brace: collapse whitespace before '{'
    if (ch === "{") {
      // Remove trailing whitespace from result, then add single space
      let end = result.length;
      while (
        end > 0 &&
        (result[end - 1] === " " || result[end - 1] === "\t")
      )
        end--;
      result = result.substring(0, end) + " {";
      continue;
    }

    // Ensure space after semicolons (for inline statements)
    if (ch === ";" && i + 1 < len) {
      result += ";";
      // Skip whitespace after semicolon
      let j = i + 1;
      while (j < len && (line[j] === " " || line[j] === "\t")) j++;
      // If there's a non-whitespace character after, add single space
      if (j < len) {
        result += " ";
        i = j - 1; // loop will increment
      }
      continue;
    }

    // Collapse multiple spaces (outside strings)
    if (ch === " " || ch === "\t") {
      // Skip consecutive whitespace
      let j = i + 1;
      while (j < len && (line[j] === " " || line[j] === "\t")) j++;
      result += " ";
      i = j - 1; // loop will increment
      continue;
    }

    result += ch;
  }

  return result;
}

/**
 * Count occurrences of a character outside of string literals.
 */
export function countOutsideStrings(line: string, char: string): number {
  let count = 0;
  let inString = false;
  let stringChar = "";

  for (let i = 0; i < line.length; i++) {
    const c = line[i];

    if (inString) {
      if (c === stringChar && line[i - 1] !== "\\") {
        inString = false;
      }
    } else if (c === '"' || c === "'") {
      inString = true;
      stringChar = c;
    } else if (c === "/" && i + 1 < line.length) {
      if (line[i + 1] === "/") break; // line comment
      if (line[i + 1] === "*") break; // block comment start
    } else if (c === char) {
      count++;
    }
  }

  return count;
}
