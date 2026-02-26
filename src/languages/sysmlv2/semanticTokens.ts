/**
 * SysMLv2 semantic tokens - pattern-based highlighting.
 * Complements Monarch syntax highlighting with semantic info (definition names, types, etc.)
 */
import * as monaco from 'monaco-editor';

const TOKEN_TYPES = ['namespace', 'type', 'class', 'property', 'keyword'] as const;
const TOKEN_MODIFIERS = ['definition', 'defaultLibrary'] as const;

export const semanticTokensLegend: monaco.languages.SemanticTokensLegend = {
  tokenTypes: [...TOKEN_TYPES],
  tokenModifiers: [...TOKEN_MODIFIERS]
};

function collectTokens(text: string): number[] {
  const data: number[] = [];
  let prevLine = 0;
  let prevChar = 0;
  const lines = text.split('\n');

  const push = (line: number, char: number, length: number, typeIdx: number, modMask: number) => {
    data.push(line - prevLine, line === prevLine ? char - prevChar : char, length, typeIdx, modMask);
    prevLine = line;
    prevChar = char;
  };

  const typeIdx = (t: string) => Math.max(0, TOKEN_TYPES.indexOf(t as typeof TOKEN_TYPES[number]));
  const defMod = 1 << TOKEN_MODIFIERS.indexOf('definition');

  lines.forEach((line, lineIndex) => {
    const lineNum = lineIndex + 1;
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('/*')) return;

    // package Name
    const pkgMatch = line.match(/\bpackage\s+([_a-zA-Z][\w]*)/);
    if (pkgMatch && pkgMatch.index !== undefined) {
      const col = line.indexOf(pkgMatch[1]) + 1;
      push(lineNum, col, pkgMatch[1].length, typeIdx('namespace'), defMod);
    }

    // part def Name
    const partMatch = line.match(/\bpart\s+def\s+([_a-zA-Z][\w]*)/);
    if (partMatch && partMatch.index !== undefined) {
      const col = line.indexOf(partMatch[1]) + 1;
      push(lineNum, col, partMatch[1].length, typeIdx('class'), defMod);
    }

    // port def Name
    const portMatch = line.match(/\bport\s+def\s+([_a-zA-Z][\w]*)/);
    if (portMatch && portMatch.index !== undefined) {
      const col = line.indexOf(portMatch[1]) + 1;
      push(lineNum, col, portMatch[1].length, typeIdx('class'), defMod);
    }

    // attribute name : Type
    const attrMatch = line.match(/\battribute\s+([_a-zA-Z][\w]*)\s*:\s*([_a-zA-Z][\w]*)/);
    if (attrMatch && attrMatch.index !== undefined) {
      const attrCol = line.indexOf(attrMatch[1]) + 1;
      push(lineNum, attrCol, attrMatch[1].length, typeIdx('property'), 0);
      const typeCol = line.indexOf(attrMatch[2]) + 1;
      push(lineNum, typeCol, attrMatch[2].length, typeIdx('type'), 0);
    }
  });

  return data;
}

export const sysmlv2SemanticTokensProvider: monaco.languages.DocumentSemanticTokensProvider = {
  getLegend: () => semanticTokensLegend,
  provideDocumentSemanticTokens: (model) => {
    const data = collectTokens(model.getValue());
    return { data };
  }
};
