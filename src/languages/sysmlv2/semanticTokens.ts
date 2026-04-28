/**
 * SysMLv2 semantic tokens - AST-driven when parse succeeds, else pattern-based.
 */
import type * as monaco from 'monaco-editor';
import type { Namespace, Membership } from '../../grammar/generated/ast.js';
import { isNamespace, isOwningMembership, isPackage, isPartDefinition, isPortDefinition, isAttributeDefinition, isPartUsage, isPortUsage, isAttributeUsage } from '../../grammar/generated/ast.js';
import { getNodeRange } from '../../grammar/astUtils.js';
import { parseSysML } from '../../grammar/parser.js';

const TOKEN_TYPES = ['namespace', 'type', 'class', 'property', 'keyword'] as const;
const TOKEN_MODIFIERS = ['definition', 'defaultLibrary'] as const;

export const semanticTokensLegend: monaco.languages.SemanticTokensLegend = {
  tokenTypes: [...TOKEN_TYPES],
  tokenModifiers: [...TOKEN_MODIFIERS]
};

const typeIdx = (t: string) => Math.max(0, TOKEN_TYPES.indexOf(t as typeof TOKEN_TYPES[number]));
const defMod = 1 << TOKEN_MODIFIERS.indexOf('definition');

function collectTokensFromAst(root: unknown, text: string): number[] {
  const data: number[] = [];
  let prevLine = 0;
  let prevChar = 0;
  const push = (line: number, char: number, length: number, typeIndex: number, modMask: number) => {
    data.push(line - prevLine, line === prevLine ? char - prevChar : char, length, typeIndex, modMask);
    prevLine = line;
    prevChar = char;
  };

  function visit(ns: Namespace): void {
    if (!ns.children) return;
    for (const child of ns.children) {
      if (!isOwningMembership(child) || !child.target) continue;
      const t = child.target;
      const name = (t as { declaredName?: string }).declaredName ?? (t as { declaredShortName?: string }).declaredShortName;
      const range = getNodeRange(t, text);
      if (range && name) {
        const line = range.start.line + 1;
        const char = range.start.character + 1;
        const len = range.end.character - range.start.character;
        if (isPackage(t)) push(line, char, len, typeIdx('namespace'), defMod);
        else if (isPartDefinition(t) || isPortDefinition(t)) push(line, char, len, typeIdx('class'), defMod);
        else if (isAttributeDefinition(t)) push(line, char, len, typeIdx('property'), defMod);
        else if (isPartUsage(t) || isPortUsage(t) || isAttributeUsage(t)) push(line, char, len, typeIdx('property'), 0);
      }
      if (isNamespace(t)) visit(t);
    }
  }

  if (root && typeof root === 'object' && isNamespace(root)) visit(root);
  return data;
}

/** LSP 用：0-based line/character 的 AST 语义 token 数据。 */
function collectTokensFromAstLsp(root: unknown, text: string): number[] {
  const data: number[] = [];
  let prevLine = 0;
  let prevChar = 0;
  const push = (line: number, char: number, length: number, typeIndex: number, modMask: number) => {
    data.push(line - prevLine, line === prevLine ? char - prevChar : char, length, typeIndex, modMask);
    prevLine = line;
    prevChar = char;
  };
  function visit(ns: Namespace): void {
    if (!ns.children) return;
    for (const child of ns.children) {
      if (!isOwningMembership(child) || !child.target) continue;
      const t = child.target;
      const name = (t as { declaredName?: string }).declaredName ?? (t as { declaredShortName?: string }).declaredShortName;
      const range = getNodeRange(t, text);
      if (range && name) {
        const line = range.start.line;
        const char = range.start.character;
        const len = range.end.character - range.start.character;
        if (isPackage(t)) push(line, char, len, typeIdx('namespace'), defMod);
        else if (isPartDefinition(t) || isPortDefinition(t)) push(line, char, len, typeIdx('class'), defMod);
        else if (isAttributeDefinition(t)) push(line, char, len, typeIdx('property'), defMod);
        else if (isPartUsage(t) || isPortUsage(t) || isAttributeUsage(t)) push(line, char, len, typeIdx('property'), 0);
      }
      if (isNamespace(t)) visit(t);
    }
  }
  if (root && typeof root === 'object' && isNamespace(root)) visit(root);
  return data;
}

function collectTokens(text: string): number[] {
  const data: number[] = [];
  let prevLine = 0;
  let prevChar = 0;
  const lines = text.split('\n');

  const push = (line: number, char: number, length: number, typeIdxVal: number, modMask: number) => {
    data.push(line - prevLine, line === prevLine ? char - prevChar : char, length, typeIdxVal, modMask);
    prevLine = line;
    prevChar = char;
  };

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

    // part usage: part name : Type (not part def)
    const partUsageMatch = line.match(/\bpart\s+([_a-zA-Z][\w]*)\s*:\s*([_a-zA-Z][\w]*)/);
    if (partUsageMatch && partUsageMatch[1] !== 'def') {
      const nameCol = line.indexOf(partUsageMatch[1]) + 1;
      push(lineNum, nameCol, partUsageMatch[1].length, typeIdx('property'), 0);
      const typeCol = line.indexOf(partUsageMatch[2]) + 1;
      push(lineNum, typeCol, partUsageMatch[2].length, typeIdx('type'), 0);
    }

    // port usage: port name : Type (not port def)
    const portUsageMatch = line.match(/\bport\s+([_a-zA-Z][\w]*)\s*:\s*([_a-zA-Z][\w]*)/);
    if (portUsageMatch && portUsageMatch[1] !== 'def') {
      const nameCol = line.indexOf(portUsageMatch[1]) + 1;
      push(lineNum, nameCol, portUsageMatch[1].length, typeIdx('property'), 0);
      const typeCol = line.indexOf(portUsageMatch[2]) + 1;
      push(lineNum, typeCol, portUsageMatch[2].length, typeIdx('type'), 0);
    }

    // in/out attribute name : Type
    const inOutAttrMatch = line.match(/\b(?:in|out)\s+attribute\s+([_a-zA-Z][\w]*)\s*:\s*([_a-zA-Z][\w]*)/);
    if (inOutAttrMatch && inOutAttrMatch.index !== undefined) {
      const attrCol = line.indexOf(inOutAttrMatch[1]) + 1;
      push(lineNum, attrCol, inOutAttrMatch[1].length, typeIdx('property'), 0);
      const typeCol = line.indexOf(inOutAttrMatch[2]) + 1;
      push(lineNum, typeCol, inOutAttrMatch[2].length, typeIdx('type'), 0);
    } else {
      // attribute name : Type (simple, no in/out)
      const attrMatch = line.match(/\battribute\s+([_a-zA-Z][\w]*)\s*:\s*([_a-zA-Z][\w]*)/);
      if (attrMatch && attrMatch.index !== undefined) {
        const attrCol = line.indexOf(attrMatch[1]) + 1;
        push(lineNum, attrCol, attrMatch[1].length, typeIdx('property'), 0);
        const typeCol = line.indexOf(attrMatch[2]) + 1;
        push(lineNum, typeCol, attrMatch[2].length, typeIdx('type'), 0);
      }
    }
  });

  return data;
}

/** LSP 用：0-based line/character 的 pattern 回退。 */
function collectTokensLsp(text: string): number[] {
  const data: number[] = [];
  let prevLine = 0;
  let prevChar = 0;
  const push = (line: number, char: number, length: number, typeIdxVal: number, modMask: number) => {
    data.push(line - prevLine, line === prevLine ? char - prevChar : char, length, typeIdxVal, modMask);
    prevLine = line;
    prevChar = char;
  };
  const lines = text.split('\n');
  lines.forEach((line, lineIndex) => {
    const lineNum = lineIndex;
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('/*')) return;
    const pkgMatch = line.match(/\bpackage\s+([_a-zA-Z][\w]*)/);
    if (pkgMatch && pkgMatch.index !== undefined) {
      const col = line.indexOf(pkgMatch[1]);
      push(lineNum, col, pkgMatch[1].length, typeIdx('namespace'), defMod);
    }
    const partMatch = line.match(/\bpart\s+def\s+([_a-zA-Z][\w]*)/);
    if (partMatch && partMatch.index !== undefined) {
      const col = line.indexOf(partMatch[1]);
      push(lineNum, col, partMatch[1].length, typeIdx('class'), defMod);
    }
    const portMatch = line.match(/\bport\s+def\s+([_a-zA-Z][\w]*)/);
    if (portMatch && portMatch.index !== undefined) {
      const col = line.indexOf(portMatch[1]);
      push(lineNum, col, portMatch[1].length, typeIdx('class'), defMod);
    }
    const partUsageMatch = line.match(/\bpart\s+([_a-zA-Z][\w]*)\s*:\s*([_a-zA-Z][\w]*)/);
    if (partUsageMatch && partUsageMatch[1] !== 'def') {
      const nameCol = line.indexOf(partUsageMatch[1]);
      push(lineNum, nameCol, partUsageMatch[1].length, typeIdx('property'), 0);
      const typeCol = line.indexOf(partUsageMatch[2]);
      push(lineNum, typeCol, partUsageMatch[2].length, typeIdx('type'), 0);
    }
    const portUsageMatch = line.match(/\bport\s+([_a-zA-Z][\w]*)\s*:\s*([_a-zA-Z][\w]*)/);
    if (portUsageMatch && portUsageMatch[1] !== 'def') {
      const nameCol = line.indexOf(portUsageMatch[1]);
      push(lineNum, nameCol, portUsageMatch[1].length, typeIdx('property'), 0);
      const typeCol = line.indexOf(portUsageMatch[2]);
      push(lineNum, typeCol, portUsageMatch[2].length, typeIdx('type'), 0);
    }
    const inOutAttrMatch = line.match(/\b(?:in|out)\s+attribute\s+([_a-zA-Z][\w]*)\s*:\s*([_a-zA-Z][\w]*)/);
    if (inOutAttrMatch && inOutAttrMatch.index !== undefined) {
      const attrCol = line.indexOf(inOutAttrMatch[1]);
      push(lineNum, attrCol, inOutAttrMatch[1].length, typeIdx('property'), 0);
      const typeCol = line.indexOf(inOutAttrMatch[2]);
      push(lineNum, typeCol, inOutAttrMatch[2].length, typeIdx('type'), 0);
    } else {
      const attrMatch = line.match(/\battribute\s+([_a-zA-Z][\w]*)\s*:\s*([_a-zA-Z][\w]*)/);
      if (attrMatch && attrMatch.index !== undefined) {
        const attrCol = line.indexOf(attrMatch[1]);
        push(lineNum, attrCol, attrMatch[1].length, typeIdx('property'), 0);
        const typeCol = line.indexOf(attrMatch[2]);
        push(lineNum, typeCol, attrMatch[2].length, typeIdx('type'), 0);
      }
    }
  });
  return data;
}

/** LSP Worker 用：返回 0-based 编码的 semantic tokens 数据。 */
export function getSemanticTokensDataLsp(text: string, root?: unknown): number[] {
  try {
    if (root && typeof root === 'object' && isNamespace(root)) {
      const astData = collectTokensFromAstLsp(root, text);
      if (astData.length > 0) return astData;
    }
  } catch {
    // fall through
  }
  return collectTokensLsp(text);
}

export const semanticTokensLegendLsp = {
  tokenTypes: [...TOKEN_TYPES],
  tokenModifiers: [...TOKEN_MODIFIERS]
};

export const sysmlv2SemanticTokensProvider: monaco.languages.DocumentSemanticTokensProvider = {
  getLegend: () => semanticTokensLegend,
  releaseDocumentSemanticTokens: () => {},
  provideDocumentSemanticTokens: (model) => {
    const text = model.getValue();
    try {
      const parseResult = parseSysML(text);
      if (parseResult.parserErrors.length === 0 && parseResult.lexerErrors.length === 0 && parseResult.value) {
        const astData = collectTokensFromAst(parseResult.value, text);
        if (astData.length > 0) return { data: new Uint32Array(astData) };
      }
    } catch {
      // fall through
    }
    return { data: new Uint32Array(collectTokens(text)) };
  }
};
