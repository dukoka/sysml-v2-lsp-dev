/**
 * SysMLv2 formatter - shared by LSP Worker and Monaco provider.
 */
export interface FormattingOptions {
  tabSize?: number;
  insertSpaces?: boolean;
}

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

export function formatSysmlv2Code(text: string, options: FormattingOptions = {}): string {
  const lines = text.split('\n');
  const result: string[] = [];
  const tabSize = options.tabSize ?? 2;
  const indentChar = options.insertSpaces !== false ? ' ' : '\t';

  const normalizedLines = lines.map(line => normalizeBracketSpacing(line));
  const baseIndents: number[] = [];
  let braceDepth = 0;

  for (let i = 0; i < normalizedLines.length; i++) {
    const line = normalizedLines[i];
    const trimmed = line.trim();

    if (trimmed === '') {
      baseIndents.push(-1);
      continue;
    }

    const openBraces = (trimmed.match(/{/g) || []).length;
    const closeBraces = (trimmed.match(/}/g) || []).length;

    if (trimmed.startsWith('}') || trimmed.startsWith('end')) {
      braceDepth = Math.max(0, braceDepth - 1);
    }

    baseIndents.push(braceDepth);

    if (openBraces > 0) {
      braceDepth += openBraces;
    }
  }

  for (let i = 0; i < normalizedLines.length; i++) {
    const line = normalizedLines[i];
    const trimmed = line.trim();

    if (trimmed === '') {
      result.push('');
      continue;
    }

    const indent = indentChar.repeat(baseIndents[i] * tabSize);
    result.push(indent + trimmed);
  }

  return result.join('\n');
}
