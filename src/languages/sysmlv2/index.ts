import * as monaco from 'monaco-editor';
import { 
  sysmlv2Language, 
  sysmlv2LanguageConfig 
} from './tokenizer';
import { sysmlv2CompletionProvider } from './completion';
import { 
  parseSymbols, 
  findSymbolAtPosition, 
  findReferences, 
  findDefinition,
  findAllOccurrences 
} from './symbols';
import { provideDocumentSymbols } from './documentSymbols.js';
import { formatSysmlv2Code } from './formatter';
import { sysmlv2SemanticTokensProvider } from './semanticTokens';
import { parseSysML } from '../../grammar/parser.js';
import { isNamespace } from '../../grammar/generated/ast.js';
import { getNodeRange, astRangeToMonaco } from '../../grammar/astUtils.js';
import { buildScopeTree } from './scope.js';
import { getDefinitionAtPosition, findReferencesToDefinition } from './references.js';
import { sysmlv2InlayHintsProvider } from './inlayHints';

// Language ID
export const SYSMLV2_LANGUAGE_ID = 'sysmlv2';

type LspLocation = { uri: string; range: { start: { line: number; character: number }; end: { line: number; character: number } } };
type LspTextEdit = { range: { start: { line: number; character: number }; end: { line: number; character: number } }; newText: string };

type LspClientLike = {
  getDefinition(p: { line: number; character: number }): Promise<LspLocation | LspLocation[] | null>;
  getReferences(p: { line: number; character: number }, includeDeclaration?: boolean): Promise<LspLocation[]>;
  getRename(p: { line: number; character: number }, newName: string): Promise<{ changes: Record<string, LspTextEdit[]> } | null>;
  getCompletion(p: { line: number; character: number }): Promise<any[]>;
  getHover(p: { line: number; character: number }): Promise<{ contents: { kind: string; value: string }; range?: { start: { line: number; character: number }; end: { line: number; character: number } } } | null>;
  getDocumentSymbols(): Promise<any[]>;
  getFoldingRanges(): Promise<Array<{ startLine: number; endLine?: number }>>;
  getSemanticTokens(): Promise<number[]>;
  getSignatureHelp(p: { line: number; character: number }): Promise<{ signatures: Array<{ label: string; documentation?: string; parameters?: Array<{ label: string; documentation?: string }> }>; activeSignature: number; activeParameter: number } | null>;
  getCodeActions(range: { start: { line: number; character: number }; end: { line: number; character: number } }, diagnostics: Array<{ range: { start: { line: number; character: number }; end: { line: number; character: number } }; message: string }>): Promise<Array<{ title: string; kind?: string; edit?: any; command?: any }>>;
  formatDocument(options?: { tabSize?: number; insertSpaces?: boolean }): Promise<LspTextEdit[]>;
  getDocumentHighlights(p: { line: number; character: number }): Promise<Array<{ range: { start: { line: number; character: number }; end: { line: number; character: number } }; kind?: number }>>;
  getTypeDefinition(p: { line: number; character: number }): Promise<{ uri: string; range: { start: { line: number; character: number }; end: { line: number; character: number } } } | null>;
  getCodeLens(): Promise<Array<{ range: { start: { line: number; character: number }; end: { line: number; character: number } }; command?: { title: string; command: string; arguments?: unknown[] } }>>;
  getWorkspaceSymbols(query: string): Promise<Array<{ name: string; kind: number; location: { uri: string; range: { start: { line: number; character: number }; end: { line: number; character: number } } }; containerName?: string }>>;
  getInlayHints(range: { start: { line: number; character: number }; end: { line: number; character: number } }): Promise<Array<{ position: { line: number; character: number }; label: string; kind?: number; paddingLeft?: boolean }>>;
  getOnTypeFormatting(position: { line: number; character: number }, ch: string, options?: { tabSize?: number; insertSpaces?: boolean }): Promise<LspTextEdit[]>;
  formatDocumentRange(range: { start: { line: number; character: number }; end: { line: number; character: number } }, options?: { tabSize?: number; insertSpaces?: boolean }): Promise<LspTextEdit[]>;
  getSelectionRanges(positions: Array<{ line: number; character: number }>): Promise<Array<{ range: { start: { line: number; character: number }; end: { line: number; character: number } }; parent?: any }>>;
  getLinkedEditingRanges(p: { line: number; character: number }): Promise<{ ranges: Array<{ start: { line: number; character: number }; end: { line: number; character: number } }>; wordPattern?: string } | null>;
};
let _lspClientGetter: (() => LspClientLike | null) | null = null;
export function setSysmlv2LspClientGetter(getter: (() => LspClientLike | null) | null) {
  _lspClientGetter = getter;
}

const DEF_PATTERNS_FOR_DUPE: Array<RegExp> = [
  /^\s*(part|port|action|state|flow|item|connection|constraint|actor|behavior)\s+def\s+(\w+)/i,
  /^\s*requirement\s+(\w+)/i,
  /^\s*enum\s+(\w+)/i,
  /^\s*struct\s+(\w+)/i,
  /^\s*datatype\s+(\w+)/i,
  /^\s*package\s+(\w+)/i
];

/** 按名称查找所有定义位置，按行号排序，第一处即“第一处定义”。 */
function getDefinitionLinesByName(model: monaco.editor.ITextModel, name: string): Array<{ lineNumber: number; column: number }> {
  const out: Array<{ lineNumber: number; column: number }> = [];
  const lineCount = model.getLineCount();
  for (let i = 1; i <= lineCount; i++) {
    const line = model.getLineContent(i);
    for (const re of DEF_PATTERNS_FOR_DUPE) {
      const m = line.match(re);
      if (!m || m.index === undefined) continue;
      const nameGroup = m[2] ?? m[1];
      if (nameGroup === name) {
        const nameOffsetInMatch = m[0].indexOf(nameGroup);
        const column = (nameOffsetInMatch >= 0 ? m.index + nameOffsetInMatch : m.index) + 1;
        out.push({ lineNumber: i, column });
        break;
      }
    }
  }
  out.sort((a, b) => a.lineNumber - b.lineNumber);
  return out;
}

// Default code for workspace symbol provider
const DEFAULT_CODE = `part def Vehicle {
  port def SpeedPort;
}

action def Move {
  // Actions here
}

requirement SpeedReq {
  // Requirements here
}`;

// Register the SysMLv2 language with Monaco
export const registerSysmlv2Language = () => {
  // Register the language
  monaco.languages.register({ 
    id: SYSMLV2_LANGUAGE_ID,
    extensions: ['.sysml', '.sysmlv2', '.kerml'],
    aliases: ['SysMLv2', 'sysmlv2', 'KerML', 'kerml'],
    mimetypes: ['text/x-sysml', 'text/x-kerml']
  });

  // Set language configuration
  monaco.languages.setLanguageConfiguration(
    SYSMLV2_LANGUAGE_ID,
    sysmlv2LanguageConfig
  );

  // Set tokenizer (Monarch)
  monaco.languages.setMonarchTokensProvider(
    SYSMLV2_LANGUAGE_ID,
    sysmlv2Language as any
  );

  // SemanticTokens — LSP first, then local fallback
  monaco.languages.registerDocumentSemanticTokensProvider(SYSMLV2_LANGUAGE_ID, {
    getLegend: () => sysmlv2SemanticTokensProvider.getLegend(),
    provideDocumentSemanticTokens: async (model) => {
      const client = _lspClientGetter?.() ?? null;
      if (client) {
        try {
          const data = await client.getSemanticTokens();
          if (data?.length) return { data: new Uint32Array(data) };
        } catch { /* fall through */ }
      }
      return sysmlv2SemanticTokensProvider.provideDocumentSemanticTokens(model, null, {} as any);
    },
    releaseDocumentSemanticTokens: () => {}
  });

  // Inlay hints — LSP first, local fallback
  monaco.languages.registerInlayHintsProvider(SYSMLV2_LANGUAGE_ID, {
    provideInlayHints: async (model, range) => {
      const lspRange = {
        start: { line: range.startLineNumber - 1, character: range.startColumn - 1 },
        end: { line: range.endLineNumber - 1, character: range.endColumn - 1 }
      };
      const lsp = _lspClientGetter?.();
      if (lsp) {
        try {
          const lspHints = await lsp.getInlayHints(lspRange);
          if (lspHints.length > 0) {
            return {
              hints: lspHints.map(h => ({
                label: h.label,
                position: new monaco.Position(h.position.line + 1, h.position.character + 1),
                kind: h.kind === 2 ? monaco.languages.InlayHintKind.Parameter : monaco.languages.InlayHintKind.Type,
                paddingLeft: h.paddingLeft ?? false
              })),
              dispose: () => {}
            };
          }
        } catch { /* fall through to local */ }
      }
      return sysmlv2InlayHintsProvider.provideInlayHints(model, range, { isCancellationRequested: false, onCancellationRequested: () => ({ dispose: () => {} }) });
    }
  });

  // Completion provider — LSP first, then local fallback
  monaco.languages.registerCompletionItemProvider(SYSMLV2_LANGUAGE_ID, {
    triggerCharacters: sysmlv2CompletionProvider.triggerCharacters,
    provideCompletionItems: async (model, position, context, token) => {
      const client = _lspClientGetter?.() ?? null;
      if (client) {
        try {
          const items = await client.getCompletion({ line: position.lineNumber - 1, character: position.column - 1 });
          if (items && items.length > 0) {
            const word = model.getWordUntilPosition(position);
            const range = {
              startLineNumber: position.lineNumber, endLineNumber: position.lineNumber,
              startColumn: word.startColumn, endColumn: word.endColumn
            };
            const KIND_MAP: Record<number, monaco.languages.CompletionItemKind> = {
              1: monaco.languages.CompletionItemKind.Text,
              6: monaco.languages.CompletionItemKind.Variable,
              7: monaco.languages.CompletionItemKind.Class,
              9: monaco.languages.CompletionItemKind.Module,
              14: monaco.languages.CompletionItemKind.Keyword,
              15: monaco.languages.CompletionItemKind.Snippet,
              3: monaco.languages.CompletionItemKind.Function
            };
            return {
              suggestions: items.map((item: any, i: number) => ({
                label: item.label,
                kind: KIND_MAP[item.kind] ?? monaco.languages.CompletionItemKind.Text,
                insertText: item.insertText ?? item.label,
                insertTextRules: item.insertTextFormat === 2 ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet : undefined,
                detail: item.detail,
                sortText: String(i).padStart(4, '0'),
                range
              }))
            };
          }
        } catch { /* fall through */ }
      }
      return sysmlv2CompletionProvider.provideCompletionItems(model, position, context, token);
    }
  });

  // Hover provider — LSP first, then local AST/symbols fallback
  monaco.languages.registerHoverProvider(SYSMLV2_LANGUAGE_ID, {
    provideHover: async (model, position) => {
      const word = model.getWordAtPosition(position);
      if (!word) return null;
      const wordRange = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn
      };
      const client = _lspClientGetter?.() ?? null;
      if (client) {
        try {
          const result = await client.getHover({ line: position.lineNumber - 1, character: position.column - 1 });
          if (result?.contents) {
            const range = result.range
              ? { startLineNumber: result.range.start.line + 1, startColumn: result.range.start.character + 1, endLineNumber: result.range.end.line + 1, endColumn: result.range.end.character + 1 }
              : wordRange;
            return { range, contents: [{ value: result.contents.value }] };
          }
        } catch { /* fall through */ }
      }
      const text = model.getValue();
      const symbols = parseSymbols(text);
      const symbolInfo = findSymbolAtPosition(symbols, position.lineNumber, position.column);
      let detail = 'SysMLv2 identifier';
      if (symbolInfo) {
        if (symbolInfo.kind === 'definition') {
          detail = `${(symbolInfo.container ?? 'element').replace(/^./, c => c.toUpperCase())} definition`;
        } else if (symbolInfo.kind === 'reference') {
          const def = findDefinition(symbols, symbolInfo.name);
          detail = def ? `Reference to ${def.container ?? 'definition'}` : 'Reference';
        } else if (symbolInfo.kind === 'type') {
          detail = 'Type';
        }
      }
      return { range: wordRange, contents: [{ value: `**${word.word}**` }, { value: detail }] };
    }
  });

  // FoldingRange — LSP first, then local brace-based fallback
  monaco.languages.registerFoldingRangeProvider(SYSMLV2_LANGUAGE_ID, {
    provideFoldingRanges: async (model) => {
      const client = _lspClientGetter?.() ?? null;
      if (client) {
        try {
          const ranges = await client.getFoldingRanges();
          if (ranges && ranges.length > 0) {
            return ranges.map(r => ({
              start: r.startLine + 1,
              end: (r.endLine ?? r.startLine) + 1,
              kind: monaco.languages.FoldingRangeKind.Region
            }));
          }
        } catch { /* fall through */ }
      }
      const text = model.getValue();
      const ranges: monaco.languages.FoldingRange[] = [];
      const lines = text.split('\n');
      const braceStack: number[] = [];
      lines.forEach((line, index) => {
        const lineNum = index + 1;
        for (const ch of line) {
          if (ch === '{') braceStack.push(lineNum);
          if (ch === '}') {
            const start = braceStack.pop();
            if (start && start < lineNum) {
              ranges.push({ start, end: lineNum, kind: monaco.languages.FoldingRangeKind.Region });
            }
          }
        }
      });
      let cm;
      const cmRegex = /\/\*[\s\S]*?\*\//g;
      while ((cm = cmRegex.exec(text)) !== null) {
        const s = model.getPositionAt(cm.index);
        const e = model.getPositionAt(cm.index + cm[0].length);
        if (s.lineNumber < e.lineNumber) {
          ranges.push({ start: s.lineNumber, end: e.lineNumber, kind: monaco.languages.FoldingRangeKind.Comment });
        }
      }
      return ranges;
    }
  });

  // Register definition provider (Go to Definition) - 优先 LSP，否则 AST+scope / symbols
  monaco.languages.registerDefinitionProvider(SYSMLV2_LANGUAGE_ID, {
    provideDefinition: async (model, position) => {
      const client = _lspClientGetter?.() ?? null;
      if (client) {
        try {
          const pos = { line: position.lineNumber - 1, character: position.column - 1 };
          const result = await client.getDefinition(pos);
          if (result) {
            const locs = Array.isArray(result) ? result : [result];
            return locs.map((loc: { uri: string; range: { start: { line: number; character: number }; end: { line: number; character: number } } }) => ({
              uri: monaco.Uri.parse(loc.uri),
              range: { startLineNumber: loc.range.start.line + 1, startColumn: loc.range.start.character + 1, endLineNumber: loc.range.end.line + 1, endColumn: loc.range.end.character + 1 }
            }));
          }
        } catch {
          // fall through to local
        }
      }
      const text = model.getValue();
      const line = position.lineNumber - 1;
      const character = position.column - 1;
      try {
        const parseResult = parseSysML(text);
        if (parseResult.parserErrors.length === 0 && parseResult.lexerErrors.length === 0 && parseResult.value) {
          const def = getDefinitionAtPosition(parseResult.value, text, line, character);
          if (def) {
            const range = getNodeRange(def, text);
            if (range) {
              const monacoRange = astRangeToMonaco(range);
              return [{ uri: model.uri, range: monacoRange }];
            }
          }
        }
      } catch {
        // fall through
      }
      const symbols = parseSymbols(text);
      const word = model.getWordAtPosition(position);
      if (!word) return null;
      const symbolInfo = findSymbolAtPosition(symbols, position.lineNumber, word.startColumn);
      const def = symbolInfo ? findDefinition(symbols, symbolInfo.name) : findDefinition(symbols, word.word);
      if (def && def.kind === 'definition') {
        return [{
          uri: model.uri,
          range: {
            startLineNumber: def.line,
            startColumn: def.column,
            endLineNumber: def.endLine,
            endColumn: def.endColumn
          }
        }];
      }
      return null;
    }
  });

  // Register reference provider (Find References) - 优先 LSP，否则 AST+scope / symbols
  monaco.languages.registerReferenceProvider(SYSMLV2_LANGUAGE_ID, {
    provideReferences: async (model, position, context) => {
      const client = _lspClientGetter?.() ?? null;
      if (client) {
        try {
          const pos = { line: position.lineNumber - 1, character: position.column - 1 };
          const locations = await client.getReferences(pos, context.includeDeclaration);
          if (locations.length > 0) {
            return locations.map((loc: { uri: string; range: { start: { line: number; character: number }; end: { line: number; character: number } } }) => ({
              uri: monaco.Uri.parse(loc.uri),
              range: { startLineNumber: loc.range.start.line + 1, startColumn: loc.range.start.character + 1, endLineNumber: loc.range.end.line + 1, endColumn: loc.range.end.character + 1 }
            }));
          }
        } catch {
          // fall through
        }
      }
      const text = model.getValue();
      const line = position.lineNumber - 1;
      const character = position.column - 1;
      try {
        const parseResult = parseSysML(text);
        if (parseResult.parserErrors.length === 0 && parseResult.lexerErrors.length === 0 && parseResult.value) {
          const scopeRoot = buildScopeTree(parseResult.value);
          const def = getDefinitionAtPosition(parseResult.value, text, line, character);
          if (def) {
            const refs = findReferencesToDefinition(parseResult.value, def, scopeRoot);
            const locations: monaco.languages.Location[] = [];
            const defRange = getNodeRange(def, text);
            if (defRange && context.includeDeclaration)
              locations.push({ uri: model.uri, range: astRangeToMonaco(defRange) });
            for (const r of refs) {
              const range = getNodeRange(r, text);
              if (range) locations.push({ uri: model.uri, range: astRangeToMonaco(range) });
            }
            if (locations.length > 0) return locations;
          }
        }
      } catch {
        // fall through
      }
      const symbols = parseSymbols(text);
      const word = model.getWordAtPosition(position);
      if (!word) return [];
      const symbolInfo = findSymbolAtPosition(symbols, position.lineNumber, word.startColumn);
      const refs = findReferences(symbols, symbolInfo?.name ?? word.word);
      return refs.map(ref => ({
        uri: model.uri,
        range: {
          startLineNumber: ref.line,
          startColumn: ref.column,
          endLineNumber: ref.endLine,
          endColumn: ref.endColumn
        }
      }));
    }
  });

  // Register rename provider (Rename Symbol) - 优先 LSP，否则 AST+scope / 全文同名
  monaco.languages.registerRenameProvider(SYSMLV2_LANGUAGE_ID, {
    provideRenameEdits: async (model, position, newName) => {
      const client = _lspClientGetter?.() ?? null;
      if (client) {
        try {
          const pos = { line: position.lineNumber - 1, character: position.column - 1 };
          const we = await client.getRename(pos, newName);
          if (we?.changes) {
            const edits: monaco.languages.IWorkspaceTextEdit[] = [];
            for (const [uri, textEdits] of Object.entries(we.changes)) {
              for (const te of textEdits as Array<{ range: { start: { line: number; character: number }; end: { line: number; character: number } }; newText: string }>) {
                edits.push({
                  resource: monaco.Uri.parse(uri),
                  textEdit: {
                    range: { startLineNumber: te.range.start.line + 1, startColumn: te.range.start.character + 1, endLineNumber: te.range.end.line + 1, endColumn: te.range.end.character + 1 },
                    text: te.newText
                  },
                  versionId: undefined
                });
              }
            }
            if (edits.length > 0) return { edits };
          }
        } catch {
          // fall through
        }
      }
      const text = model.getValue();
      const line = position.lineNumber - 1;
      const character = position.column - 1;
      try {
        const parseResult = parseSysML(text);
        if (parseResult.parserErrors.length === 0 && parseResult.lexerErrors.length === 0 && parseResult.value) {
          const scopeRoot = buildScopeTree(parseResult.value);
          const def = getDefinitionAtPosition(parseResult.value, text, line, character);
          if (def) {
            const refs = findReferencesToDefinition(parseResult.value, def, scopeRoot);
            const edits: monaco.languages.IWorkspaceTextEdit[] = [];
            const defRange = getNodeRange(def, text);
            if (defRange) {
              edits.push({
                resource: model.uri,
                textEdit: { range: astRangeToMonaco(defRange), text: newName },
                versionId: undefined
              });
            }
            for (const r of refs) {
              const range = getNodeRange(r, text);
              if (range)
                edits.push({
                  resource: model.uri,
                  textEdit: { range: astRangeToMonaco(range), text: newName },
                  versionId: undefined
                });
            }
            if (edits.length > 0) return { edits };
          }
        }
      } catch {
        // fall through
      }

      const word = model.getWordAtPosition(position);
      if (!word || !word.word) return null;

      const symbolName = word.word;
      const occurrences: { line: number; column: number; endLine: number; endColumn: number }[] = [];
      const lines = text.split('\n');
      lines.forEach((lineIdx, lineIndex) => {
        const lineNum = lineIndex + 1;
        const regex = new RegExp(`\\b${symbolName}\\b`, 'g');
        let match;
        while ((match = regex.exec(lineIdx)) !== null) {
          occurrences.push({
            line: lineNum,
            column: match.index + 1,
            endLine: lineNum,
            endColumn: match.index + symbolName.length + 1
          });
        }
      });

      if (occurrences.length === 0) return null;

      // Sort by position in reverse order (file end first)
      occurrences.sort((a, b) => {
        if (a.line !== b.line) return b.line - a.line;
        return b.column - a.column;
      });

      // Build workspace edit
      const edits: monaco.languages.WorkspaceEdit = {
        edits: occurrences.map(occ => ({
          resource: model.uri,
          versionId: undefined,
          textEdit: {
            range: {
              startLineNumber: occ.line,
              startColumn: occ.column,
              endLineNumber: occ.endLine,
              endColumn: occ.endColumn
            },
            text: newName
          }
        }))
      };

      return edits;
    },
    // Optional: validate rename position
    resolveRenameLocation: (model, position) => {
      const text = model.getValue();
      const symbols = parseSymbols(text);

      const word = model.getWordAtPosition(position);
      if (!word) return null;

      const symbolInfo = findSymbolAtPosition(
        symbols,
        position.lineNumber,
        word.startColumn
      );

      if (!symbolInfo) {
        // Check if word exists in symbols
        if (symbols.has(word.word)) {
          return {
            range: {
              startLineNumber: position.lineNumber,
              endLineNumber: position.lineNumber,
              startColumn: word.startColumn,
              endColumn: word.endColumn
            },
            text: word.word
          };
        }
        return null;
      }

      return {
        range: {
          startLineNumber: symbolInfo.line,
          endLineNumber: symbolInfo.endLine,
          startColumn: symbolInfo.column,
          endColumn: symbolInfo.endColumn
        },
        text: symbolInfo.name
      };
    }
  });

  // Formatting — LSP first, then local fallback
  monaco.languages.registerDocumentFormattingEditProvider(SYSMLV2_LANGUAGE_ID, {
    provideDocumentFormattingEdits: async (model, options) => {
      const client = _lspClientGetter?.() ?? null;
      if (client) {
        try {
          const edits = await client.formatDocument({ tabSize: options.tabSize, insertSpaces: options.insertSpaces });
          if (edits?.length) {
            return edits.map(e => ({
              range: { startLineNumber: e.range.start.line + 1, startColumn: e.range.start.character + 1, endLineNumber: e.range.end.line + 1, endColumn: e.range.end.character + 1 },
              text: e.newText
            }));
          }
        } catch { /* fall through */ }
      }
      const text = model.getValue();
      const parseResult = parseSysML(text);
      const root = parseResult.parserErrors.length === 0 && parseResult.lexerErrors.length === 0 && parseResult.value && isNamespace(parseResult.value) ? parseResult.value : undefined;
      return [{ range: model.getFullModelRange(), text: formatSysmlv2Code(text, options, root) }];
    }
  });

  // DocumentSymbol — LSP first, then local fallback
  monaco.languages.registerDocumentSymbolProvider(SYSMLV2_LANGUAGE_ID, {
    provideDocumentSymbols: async (model) => {
      const client = _lspClientGetter?.() ?? null;
      if (client) {
        try {
          const symbols = await client.getDocumentSymbols();
          if (symbols && symbols.length > 0) {
            const SYMBOL_KIND_MAP: Record<number, monaco.languages.SymbolKind> = {
              2: monaco.languages.SymbolKind.Module,    // Package
              5: monaco.languages.SymbolKind.Class,     // Class
              11: monaco.languages.SymbolKind.Interface, // Interface
              13: monaco.languages.SymbolKind.Variable,  // Variable
              12: monaco.languages.SymbolKind.Function,  // Function
              10: monaco.languages.SymbolKind.Enum,      // Enum
              23: monaco.languages.SymbolKind.Struct,     // Struct
              19: monaco.languages.SymbolKind.Object      // Object
            };
            function mapSymbol(s: any): any {
              return {
                name: s.name,
                detail: s.detail ?? '',
                kind: SYMBOL_KIND_MAP[s.kind] ?? monaco.languages.SymbolKind.Variable,
                range: { startLineNumber: s.range.start.line + 1, startColumn: s.range.start.character + 1, endLineNumber: s.range.end.line + 1, endColumn: s.range.end.character + 1 },
                selectionRange: s.selectionRange
                  ? { startLineNumber: s.selectionRange.start.line + 1, startColumn: s.selectionRange.start.character + 1, endLineNumber: s.selectionRange.end.line + 1, endColumn: s.selectionRange.end.character + 1 }
                  : { startLineNumber: s.range.start.line + 1, startColumn: s.range.start.character + 1, endLineNumber: s.range.end.line + 1, endColumn: s.range.end.character + 1 },
                tags: [],
                children: s.children?.map(mapSymbol) ?? []
              };
            }
            return symbols.map(mapSymbol);
          }
        } catch { /* fall through */ }
      }
      const text = model.getValue();
      if (!text) return [];
      return provideDocumentSymbols(text);
    }
  });

  // Signature Help Provider - println, print, assert
  const BUILTIN_SIGNATURES: Record<string, monaco.languages.SignatureInformation> = {
    println: {
      label: 'println(value: String): void',
      documentation: 'Print a value to the console',
      parameters: [{ label: 'value', documentation: 'The value to print' }]
    },
    print: {
      label: 'print(value: String): void',
      documentation: 'Print a value without newline',
      parameters: [{ label: 'value', documentation: 'The value to print' }]
    },
    assert: {
      label: 'assert(condition: Boolean): void',
      documentation: 'Assert that a condition is true',
      parameters: [{ label: 'condition', documentation: 'The condition to verify' }]
    },
    toInteger: {
      label: 'toInteger(value: Real): Integer',
      documentation: 'Convert to integer',
      parameters: [{ label: 'value', documentation: 'Numeric value' }]
    },
    toReal: {
      label: 'toReal(value: Integer): Real',
      documentation: 'Convert to real',
      parameters: [{ label: 'value', documentation: 'Integer value' }]
    },
    size: {
      label: 'size(collection: Sequence): Natural',
      documentation: 'Return the size of a collection',
      parameters: [{ label: 'collection', documentation: 'A sequence' }]
    },
    empty: {
      label: 'empty(collection: Sequence): Boolean',
      documentation: 'Check if collection is empty',
      parameters: [{ label: 'collection', documentation: 'A sequence' }]
    }
  };

  monaco.languages.registerSignatureHelpProvider(SYSMLV2_LANGUAGE_ID, {
    provideSignatureHelp: async (model, position) => {
      const client = _lspClientGetter?.() ?? null;
      if (client) {
        try {
          const result = await client.getSignatureHelp({ line: position.lineNumber - 1, character: position.column - 1 });
          if (result?.signatures?.length) {
            return {
              value: {
                signatures: result.signatures.map(s => ({
                  label: s.label,
                  documentation: s.documentation,
                  parameters: s.parameters?.map(p => ({ label: p.label, documentation: p.documentation })) ?? []
                })),
                activeSignature: result.activeSignature,
                activeParameter: result.activeParameter
              },
              dispose: () => {}
            };
          }
        } catch { /* fall through */ }
      }
      const line = model.getLineContent(position.lineNumber);
      const beforeCursor = line.substring(0, position.column - 1);
      const lastOpen = beforeCursor.lastIndexOf('(');
      if (lastOpen < 0) return null;
      const commaCount = (beforeCursor.substring(lastOpen + 1).match(/,/g) || []).length;
      const beforeParen = beforeCursor.substring(0, lastOpen);
      const fnMatch = beforeParen.match(/\b(println|print|assert|toInteger|toReal|size|empty)\s*$/);
      const fnName = fnMatch ? fnMatch[1] : 'println';
      const sig = BUILTIN_SIGNATURES[fnName] ?? BUILTIN_SIGNATURES.println;
      return { value: { signatures: [sig], activeSignature: 0, activeParameter: commaCount }, dispose: () => {} };
    },
    signatureHelpTriggerCharacters: ['(', ',']
  });

  // CodeAction — LSP first, then local fallback
  monaco.languages.registerCodeActionProvider(SYSMLV2_LANGUAGE_ID, {
    provideCodeActions: async (model, range, context) => {
      const client = _lspClientGetter?.() ?? null;
      if (client) {
        try {
          const lspRange = { start: { line: range.startLineNumber - 1, character: range.startColumn - 1 }, end: { line: range.endLineNumber - 1, character: range.endColumn - 1 } };
          const lspDiags = (context.markers || []).map(m => ({
            range: { start: { line: m.startLineNumber - 1, character: m.startColumn - 1 }, end: { line: m.endLineNumber - 1, character: m.endColumn - 1 } },
            message: m.message
          }));
          const lspActions = await client.getCodeActions(lspRange, lspDiags);
          if (lspActions?.length) {
            const actions: monaco.languages.CodeAction[] = lspActions.map(a => {
              const action: monaco.languages.CodeAction = {
                title: a.title,
                kind: 'quickfix'
              };
              if (a.edit?.changes) {
                const edits: monaco.languages.IWorkspaceTextEdit[] = [];
                for (const [uri, textEdits] of Object.entries(a.edit.changes)) {
                  for (const te of textEdits as LspTextEdit[]) {
                    edits.push({
                      resource: monaco.Uri.parse(uri),
                      textEdit: {
                        range: { startLineNumber: te.range.start.line + 1, startColumn: te.range.start.character + 1, endLineNumber: te.range.end.line + 1, endColumn: te.range.end.character + 1 },
                        text: te.newText
                      },
                      versionId: undefined
                    });
                  }
                }
                action.edit = { edits };
              }
              if (a.command) {
                action.command = { id: a.command.command ?? a.command.title, title: a.command.title, arguments: a.command.arguments };
              }
              return action;
            });
            return { actions, dispose: () => {} };
          }
        } catch { /* fall through */ }
      }
      const actions: monaco.languages.CodeAction[] = [];
      const markers = context.markers || [];

      for (const marker of markers) {
        const { message, startLineNumber, startColumn, endLineNumber, endColumn } = marker;
        const editRange = { startLineNumber, startColumn, endLineNumber, endColumn };

        if (message === 'Missing semicolon') {
          const lineContent = model.getLineContent(startLineNumber);
          const insertCol = lineContent.length + 1;
          actions.push({
            title: 'Insert ;',
            kind: 'quickfix',
            edit: {
              edits: [{
                resource: model.uri,
                versionId: undefined,
                textEdit: { range: new monaco.Range(startLineNumber, insertCol, startLineNumber, insertCol), text: ';' }
              }]
            }
          });
        } else if (message.startsWith("Unknown keyword '") && message.includes("'. Did you mean '")) {
          const match = message.match(/Unknown keyword '(\w+)'\. Did you mean '(\w+)'\?/);
          if (match) {
            const [, , correct] = match;
            actions.push({
              title: `Replace with '${correct}'`,
              kind: 'quickfix',
              edit: {
                edits: [{
                  resource: model.uri,
                  versionId: undefined,
                  textEdit: { range: new monaco.Range(startLineNumber, startColumn, endLineNumber, endColumn), text: correct! }
                }]
              }
            });
          }
        } else if (message === "Expected a token. Did you forget ';'?") {
          const lineContent = model.getLineContent(startLineNumber);
          const insertCol = lineContent.length + 1;
          actions.push({
            title: "Insert ;",
            kind: 'quickfix',
            edit: {
              edits: [{
                resource: model.uri,
                versionId: undefined,
                textEdit: { range: new monaco.Range(startLineNumber, insertCol, startLineNumber, insertCol), text: ';' }
              }]
            }
          });
        } else if (message === 'Redundant semicolons') {
          const text = model.getValueInRange(editRange);
          const fixed = text.replace(/;+$/, ';');
          if (fixed !== text) {
            actions.push({
              title: 'Remove redundant semicolons',
              kind: 'quickfix',
              edit: {
                edits: [{
                  resource: model.uri,
                  versionId: undefined,
                  textEdit: { range: new monaco.Range(startLineNumber, startColumn, endLineNumber, endColumn), text: fixed }
                }]
              }
            });
          }
        } else if (message.startsWith('Unresolved type reference: \'')) {
          const match = message.match(/Unresolved type reference: '(\w+)'/);
          if (match) {
            const typeName = match[1];
            const lineCount = model.getLineCount();
            const insertLine = lineCount;
            const insertCol = 1;
            const stub = `\npart def ${typeName} {\n\t\n}\n`;
            actions.push({
              title: `Add stub 'part def ${typeName} { }'`,
              kind: 'quickfix',
              edit: {
                edits: [{
                  resource: model.uri,
                  versionId: undefined,
                  textEdit: { range: new monaco.Range(insertLine, insertCol, insertLine, insertCol), text: stub }
                }]
              }
            });
          }
        } else if (message.startsWith('Duplicate definition: \'')) {
          const nameMatch = message.match(/Duplicate definition: '(\w+)'/);
          if (nameMatch) {
            const name = nameMatch[1];
            const defLines = getDefinitionLinesByName(model, name);
            if (defLines.length > 0) {
              const first = defLines[0];
              actions.push({
                title: 'Go to first definition',
                kind: 'quickfix',
                command: {
                  id: 'sysml.goToFirstDefinition',
                  title: 'Go to first definition',
                  arguments: [first.lineNumber, first.column]
                }
              });
            } else {
              actions.push({
                title: 'Go to first definition (see outline)',
                kind: 'quickfix'
              });
            }
          }
        }
      }

      return { actions, dispose: () => {} };
    }
  });

  // Selection Range — LSP first (AST-aware), local fallback
  monaco.languages.registerSelectionRangeProvider(SYSMLV2_LANGUAGE_ID, {
    provideSelectionRanges: async (model, positions) => {
      if (!positions || positions.length === 0) return [];
      const lsp = _lspClientGetter?.();
      if (lsp) {
        try {
          const lspPositions = positions.map(p => ({ line: p.lineNumber - 1, character: p.column - 1 }));
          const results = await lsp.getSelectionRanges(lspPositions);
          if (results && results.length > 0) {
            return results.map(sr => {
              const flat: monaco.languages.SelectionRange[] = [];
              let cur: any = sr;
              while (cur && cur.range) {
                flat.push({
                  range: new monaco.Range(cur.range.start.line + 1, cur.range.start.character + 1, cur.range.end.line + 1, cur.range.end.character + 1)
                });
                cur = cur.parent;
              }
              return flat;
            });
          }
        } catch { /* fall through */ }
      }
      const text = model.getValue();
      if (!text) return [];
      const lines = text.split('\n');
      return positions.map(position => {
        if (!position || position.lineNumber <= 0) return [];
        const lineNum = position.lineNumber;
        const line = lines[lineNum - 1] || '';
        const ranges: monaco.languages.SelectionRange[] = [];
        const word = model.getWordAtPosition(position);
        if (word && word.word) {
          ranges.push({
            range: { startLineNumber: lineNum, startColumn: word.startColumn, endLineNumber: lineNum, endColumn: word.endColumn }
          });
        }
        if (line.length > 0) {
          ranges.push({
            range: { startLineNumber: lineNum, startColumn: 1, endLineNumber: lineNum, endColumn: line.length + 1 }
          });
        }
        ranges.push({ range: model.getFullModelRange() });
        return ranges;
      });
    }
  });

  // Document Range Formatting — LSP first, local fallback
  monaco.languages.registerDocumentRangeFormattingEditProvider(SYSMLV2_LANGUAGE_ID, {
    provideDocumentRangeFormattingEdits: async (model, range, options) => {
      const lsp = _lspClientGetter?.();
      if (lsp) {
        try {
          const edits = await lsp.formatDocumentRange(
            { start: { line: range.startLineNumber - 1, character: range.startColumn - 1 }, end: { line: range.endLineNumber - 1, character: range.endColumn - 1 } },
            { tabSize: options.tabSize, insertSpaces: options.insertSpaces }
          );
          if (edits.length > 0) {
            return edits.map(e => ({
              range: new monaco.Range(e.range.start.line + 1, e.range.start.character + 1, e.range.end.line + 1, e.range.end.character + 1),
              text: e.newText
            }));
          }
        } catch { /* fall through to local */ }
      }
      const rangeText = model.getValueInRange(range);
      const formatted = formatSysmlv2Code(rangeText, options);
      return [{ range, text: formatted }];
    }
  });

  // Document Highlight — LSP first, local fallback via findAllOccurrences
  monaco.languages.registerDocumentHighlightProvider(SYSMLV2_LANGUAGE_ID, {
    provideDocumentHighlights: async (model, position) => {
      const lsp = _lspClientGetter?.();
      if (lsp) {
        try {
          const highlights = await lsp.getDocumentHighlights({ line: position.lineNumber - 1, character: position.column - 1 });
          if (highlights.length > 0) {
            return highlights.map(h => ({
              range: new monaco.Range(h.range.start.line + 1, h.range.start.character + 1, h.range.end.line + 1, h.range.end.character + 1),
              kind: h.kind === 2 ? monaco.languages.DocumentHighlightKind.Write : monaco.languages.DocumentHighlightKind.Read
            }));
          }
        } catch { /* fall through */ }
      }
      const text = model.getValue();
      const word = model.getWordAtPosition(position);
      if (!word) return [];
      const symbols = parseSymbols(text);
      const occurrences = findAllOccurrences(symbols, word.word);
      return occurrences.map(occ => ({
        range: new monaco.Range(occ.line, occ.column, occ.endLine, occ.endColumn),
        kind: monaco.languages.DocumentHighlightKind.Text
      }));
    }
  });

  // Type Definition — LSP first, local fallback
  monaco.languages.registerTypeDefinitionProvider(SYSMLV2_LANGUAGE_ID, {
    provideTypeDefinition: async (model, position) => {
      const lsp = _lspClientGetter?.();
      if (lsp) {
        try {
          const result = await lsp.getTypeDefinition({ line: position.lineNumber - 1, character: position.column - 1 });
          if (result) {
            return {
              uri: monaco.Uri.parse(result.uri),
              range: new monaco.Range(
                result.range.start.line + 1, result.range.start.character + 1,
                result.range.end.line + 1, result.range.end.character + 1
              )
            } as monaco.languages.Location;
          }
        } catch { /* fall through */ }
      }
      return null;
    }
  });

  // Code Lens — reference counts via LSP
  monaco.languages.registerCodeLensProvider(SYSMLV2_LANGUAGE_ID, {
    provideCodeLenses: async (model) => {
      const lsp = _lspClientGetter?.();
      if (!lsp) return { lenses: [], dispose: () => {} };
      try {
        const lenses = await lsp.getCodeLens();
        return {
          lenses: lenses.map(l => ({
            range: new monaco.Range(
              l.range.start.line + 1, l.range.start.character + 1,
              l.range.end.line + 1, l.range.end.character + 1
            ),
            command: l.command ? {
              id: l.command.command,
              title: l.command.title,
              arguments: l.command.arguments
            } : undefined
          })),
          dispose: () => {}
        };
      } catch {
        return { lenses: [], dispose: () => {} };
      }
    }
  });

  // On-Type Formatting — auto-indent on }, ;, newline
  monaco.languages.registerOnTypeFormattingEditProvider(SYSMLV2_LANGUAGE_ID, {
    autoFormatTriggerCharacters: ['}', ';', '\n'],
    provideOnTypeFormattingEdits: async (model, position, ch) => {
      const lsp = _lspClientGetter?.();
      if (!lsp) return [];
      try {
        const edits = await lsp.getOnTypeFormatting(
          { line: position.lineNumber - 1, character: position.column - 1 },
          ch,
          { tabSize: model.getOptions().tabSize, insertSpaces: model.getOptions().insertSpaces }
        );
        return edits.map(e => ({
          range: new monaco.Range(
            e.range.start.line + 1, e.range.start.character + 1,
            e.range.end.line + 1, e.range.end.character + 1
          ),
          text: e.newText
        }));
      } catch {
        return [];
      }
    }
  });

  // Linked Editing Range — sync rename across same-file references
  monaco.languages.registerLinkedEditingRangeProvider(SYSMLV2_LANGUAGE_ID, {
    provideLinkedEditingRanges: async (model, position) => {
      const lsp = _lspClientGetter?.();
      if (!lsp) return undefined;
      try {
        const result = await lsp.getLinkedEditingRanges({ line: position.lineNumber - 1, character: position.column - 1 });
        if (!result || !result.ranges || result.ranges.length === 0) return undefined;
        return {
          ranges: result.ranges.map(r => new monaco.Range(r.start.line + 1, r.start.character + 1, r.end.line + 1, r.end.character + 1)),
          wordPattern: result.wordPattern ? new RegExp(result.wordPattern) : undefined
        };
      } catch {
        return undefined;
      }
    }
  });

  // Workspace Symbol search — exposed as a function for external UI integration
  (window as any).__sysmlWorkspaceSymbolSearch = async (query: string) => {
    const lsp = _lspClientGetter?.();
    if (!lsp) return [];
    try {
      const symbols = await lsp.getWorkspaceSymbols(query);
      return symbols.map(s => ({
        name: s.name,
        kind: s.kind,
        containerName: s.containerName ?? '',
        uri: s.location.uri,
        range: {
          startLine: s.location.range.start.line + 1,
          startColumn: s.location.range.start.character + 1,
          endLine: s.location.range.end.line + 1,
          endColumn: s.location.range.end.character + 1
        }
      }));
    } catch {
      return [];
    }
  };

  console.log('SysMLv2 language registered successfully');
};

// Theme definition for SysMLv2
export const registerSysmlv2Theme = () => {
  monaco.editor.defineTheme('sysmlv2-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: '569CD6', fontStyle: 'bold' },
      { token: 'type', foreground: '4EC9B0' },
      { token: 'support.function', foreground: 'DCDCAA' },
      { token: 'string', foreground: 'CE9178' },
      { token: 'number', foreground: 'B5CEA8' },
      { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
      { token: 'operator', foreground: 'D4D4D4' },
      { token: 'identifier', foreground: '9CDCFE' },
      { token: 'identifier.type', foreground: 'D7BA8D' },
      { token: 'identifier.definition', foreground: 'FFD700', fontStyle: 'bold' },
      { token: 'delimiter', foreground: 'D4D4D4' },
      // Semantic token types
      { token: 'namespace', foreground: '4EC9B0' },
      { token: 'class', foreground: 'FFD700', fontStyle: 'bold' },
      { token: 'property', foreground: '9CDCFE' }
    ],
    colors: {
      'editor.background': '#1E1E1E',
      'editor.foreground': '#D4D4D4',
      'editor.lineHighlightBackground': '#2D2D30',
      'editorCursor.foreground': '#AEAFAD',
      'editor.selectionBackground': '#264F78',
      'editor.inactiveSelectionBackground': '#3A3D41'
    }
  });
};
