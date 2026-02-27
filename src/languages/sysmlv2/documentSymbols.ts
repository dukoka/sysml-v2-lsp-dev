/**
 * Document symbols (outline) - AST 层级或 parseSymbols 回退。
 */
import * as monaco from 'monaco-editor';
import { parseSymbols } from './symbols.js';
import { astToDocumentSymbols, astRangeToMonaco, type AstDocumentSymbol } from '../../grammar/astUtils.js';
import { parseSysML } from '../../grammar/parser.js';
import { isNamespace } from '../../grammar/generated/ast.js';

const CONTAINER_TO_KIND: Record<string, monaco.languages.SymbolKind> = {
  package: monaco.languages.SymbolKind.Package,
  part: monaco.languages.SymbolKind.Class,
  port: monaco.languages.SymbolKind.Interface,
  attribute: monaco.languages.SymbolKind.Variable,
  usage: monaco.languages.SymbolKind.Variable,
  action: monaco.languages.SymbolKind.Function,
  state: monaco.languages.SymbolKind.Object,
  flow: monaco.languages.SymbolKind.Function,
  requirement: monaco.languages.SymbolKind.Interface,
  constraint: monaco.languages.SymbolKind.Interface,
  enum: monaco.languages.SymbolKind.Enum,
  struct: monaco.languages.SymbolKind.Struct,
  type: monaco.languages.SymbolKind.Class,
  actor: monaco.languages.SymbolKind.Class,
  behavior: monaco.languages.SymbolKind.Function,
  other: monaco.languages.SymbolKind.Variable
};

function astSymbolToMonaco(a: AstDocumentSymbol): monaco.languages.DocumentSymbol {
  const range = astRangeToMonaco(a.range);
  return {
    name: a.name,
    detail: a.detail,
    kind: CONTAINER_TO_KIND[a.kind] ?? monaco.languages.SymbolKind.Variable,
    range,
    selectionRange: range,
    children: a.children.map(astSymbolToMonaco)
  };
}

/** 解析成功时用 AST 生成层级大纲；否则用 parseSymbols 扁平列表。 */
export function provideDocumentSymbols(text: string): monaco.languages.DocumentSymbol[] {
  try {
    const parseResult = parseSysML(text);
    if (parseResult.parserErrors.length === 0 && parseResult.lexerErrors.length === 0 && parseResult.value && isNamespace(parseResult.value)) {
      const astSymbols = astToDocumentSymbols(parseResult.value, text);
      if (astSymbols.length > 0) return astSymbols.map(astSymbolToMonaco);
    }
  } catch {
    // fall through to parseSymbols
  }

  const symbols = parseSymbols(text);
  const result: monaco.languages.DocumentSymbol[] = [];
  const seen = new Set<string>();

  for (const [, infos] of symbols) {
    for (const def of infos.filter(i => i.kind === 'definition')) {
      const key = `${def.line}:${def.column}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const kind = CONTAINER_TO_KIND[def.container ?? ''] ?? monaco.languages.SymbolKind.Variable;
      result.push({
        name: def.name,
        detail: def.container ? `${def.container} definition` : '',
        kind,
        range: {
          startLineNumber: def.line,
          startColumn: def.column,
          endLineNumber: def.endLine,
          endColumn: def.endColumn
        },
        selectionRange: {
          startLineNumber: def.line,
          startColumn: def.column,
          endLineNumber: def.endLine,
          endColumn: def.endColumn
        },
        children: []
      });
    }
  }

  result.sort((a, b) => {
    if (a.range.startLineNumber !== b.range.startLineNumber) {
      return a.range.startLineNumber - b.range.startLineNumber;
    }
    return a.range.startColumn - b.range.startColumn;
  });

  return result;
}
