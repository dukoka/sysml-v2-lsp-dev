// SysMLv2 Language Server Web Worker
// Uses vscode-languageserver createConnection + BrowserMessageReader/Writer

/// <reference lib="webworker" />

import {
  createConnection,
  BrowserMessageReader,
  BrowserMessageWriter,
  TextDocuments,
  ProposedFeatures,
  TextDocumentSyncKind,
  InitializeResult,
  CompletionItem,
  CompletionItemKind,
  DocumentDiagnosticReportKind,
  type DocumentDiagnosticReport,
  DiagnosticSeverity,
  type Diagnostic,
  type TextEdit,
  SymbolKind,
  type DocumentSymbol,
  type FoldingRange
} from 'vscode-languageserver/browser';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { parseSysML, parseResultToDiagnostics } from '../grammar/parser.js';
import { isNamespace } from '../grammar/generated/ast.js';
import { extractAstSymbols } from '../grammar/astSymbols.js';
import { runSemanticValidation } from '../languages/sysmlv2/semanticValidation.js';
import { formatSysmlv2Code } from '../languages/sysmlv2/formatter.js';
import { SYSMLV2_KEYWORDS } from '../languages/sysmlv2/keywords.js';
import { runG4Parse } from '../grammar/g4/g4Runner.js';
import { updateIndex, removeFromIndex, getIndex, getIndexEntry } from './indexManager.js';
import type { IndexEntryForLookup } from '../languages/sysmlv2/scope.js';
import { getDefinitionAtPositionWithUri, findReferencesToDefinitionAcrossIndex } from '../languages/sysmlv2/references.js';
import { getNodeRange, getElementNameRange, astToDocumentSymbols, getFoldingRanges, type AstDocumentSymbol } from '../grammar/astUtils.js';
import { getSemanticTokensDataLsp, semanticTokensLegendLsp } from '../languages/sysmlv2/semanticTokens.js';

// Document store (managed by TextDocuments)
const documents = new TextDocuments(TextDocument);

// G.1: 多文件索引 — 文档打开/变更时更新，关闭时移除
documents.onDidOpen((e) => {
  updateIndex(e.document.uri, e.document.getText());
});
documents.onDidChangeContent((e) => {
  updateIndex(e.document.uri, e.document.getText());
});
documents.onDidClose((e) => {
  removeFromIndex(e.document.uri);
});

const DEFINITION_PATTERNS = [
  /^\s*(part|port|action|state|flow|item|connection|constraint|actor|behavior)\s+def\s+(\w+)/,
  /^\s*(requirement)\s+(\w+)/,
  /^\s*enum\s+(\w+)/,
  /^\s*struct\s+(\w+)/,
  /^\s*datatype\s+(\w+)/,
  /^\s*package\s+(\w+)/
];

function extractUserDefinedTypes(text: string): Set<string> {
  const types = new Set<string>();
  const lines = text.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('/*')) continue;
    for (const pattern of DEFINITION_PATTERNS) {
      const match = trimmed.match(pattern);
      if (match && match[2]) types.add(match[2]);
    }
  }
  return types;
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] = b.charAt(i - 1) === a.charAt(j - 1)
        ? matrix[i - 1][j - 1]
        : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
    }
  }
  return matrix[b.length][a.length];
}

function findSimilarKeyword(word: string): string | null {
  const maxDistance = 2;
  let similar: string | null = null;
  let minDistance = maxDistance + 1;
  for (const keyword of SYSMLV2_KEYWORDS) {
    const d = levenshteinDistance(word, keyword);
    if (d <= maxDistance && d < minDistance) {
      minDistance = d;
      similar = keyword;
    }
  }
  return similar;
}

function validateDocument(text: string): Diagnostic[] {
  const markers: Diagnostic[] = [];

  // AST-based diagnostics from Langium parser (parser/lexer errors)
  try {
    const parseResult = parseSysML(text);
    markers.push(...(parseResultToDiagnostics(parseResult) as Diagnostic[]));
    if (parseResult.parserErrors.length === 0 && parseResult.lexerErrors.length === 0) {
      const semantic = runSemanticValidation(parseResult.value, text);
      for (const d of semantic) {
        markers.push({
          severity: d.severity as DiagnosticSeverity,
          range: d.range,
          message: d.message
        });
      }
      return markers;
    }
  } catch {
    // Parser init or runtime error - continue with regex-based validation
  }

  const lines = text.split('\n');
  const userDefinedTypes = extractUserDefinedTypes(text);

  lines.forEach((line, lineIndex) => {
    const lineNum = lineIndex + 1;
    const trimmedLine = line.trim();

    if (trimmedLine === '') return;
    if (trimmedLine.startsWith('//') || trimmedLine.startsWith('/*')) return;
    if (trimmedLine === '{' || trimmedLine === '}') return;
    if (trimmedLine.startsWith('end')) return;
    if (trimmedLine.endsWith('{')) return;

    const toRange = (startCol: number, endCol: number) => ({
      start: { line: lineNum - 1, character: startCol - 1 },
      end: { line: lineNum - 1, character: endCol - 1 }
    });

    if (!trimmedLine.endsWith(';') && !trimmedLine.endsWith(',') && !trimmedLine.endsWith('{') && !trimmedLine.endsWith('}')) {
      const needsSemicolon = /^\s*(attribute|part|port|reference)\s+\w+/.test(trimmedLine) ||
        /^\s*\w+\s*[=:]/.test(trimmedLine) || /^\s*(println|print|assert)\s*\(/.test(trimmedLine);
      const looksLikeStatement = /^\s*\w+\s*\(/.test(trimmedLine) || /^\s*\w+\s*[=+\-*/]/.test(trimmedLine) || /^\s*\w+\s*:\s*\w+/.test(trimmedLine);
      if ((needsSemicolon || looksLikeStatement)) {
        const firstWord = trimmedLine.split(/\s+/)[0];
        if (SYSMLV2_KEYWORDS.includes(firstWord)) {
          markers.push({ severity: DiagnosticSeverity.Warning, range: toRange(line.length, line.length + 1), message: 'Missing semicolon' });
        }
      }
    }

    const cleanLine = line.replace(/\/\/.*$/, '').replace(/"[^"]*"/g, '').replace(/'[^']*'/g, '');
    const wordRegex = /\b[a-zA-Z_][a-zA-Z0-9_]*\b/g;
    let match;
    while ((match = wordRegex.exec(cleanLine)) !== null) {
      const word = match[0];
      const startCol = match.index + 1;
      if (SYSMLV2_KEYWORDS.includes(word)) continue;
      if (userDefinedTypes.has(word)) continue;
      if (/^[A-Z][a-zA-Z0-9_]*$/.test(word)) continue;
      const isTypeAnnotation = /:\s*\w+/.test(cleanLine);
      const isAssignment = /=\s*\w+/.test(cleanLine);
      const isFunctionCall = /\w+\s*\(/.test(cleanLine);
      const looksLikeStmt = isTypeAnnotation || isAssignment || isFunctionCall;
      if (!looksLikeStmt && !isTypeAnnotation) {
        const similar = findSimilarKeyword(word);
        if (similar) {
          markers.push({ severity: DiagnosticSeverity.Error, range: toRange(startCol, startCol + word.length), message: `Unknown keyword '${word}'. Did you mean '${similar}'?` });
        } else if (trimmedLine === word) {
          markers.push({ severity: DiagnosticSeverity.Error, range: toRange(startCol, startCol + word.length), message: `Expected a token. Did you forget ';'?` });
        }
      }
    }

    let inString = false;
    let stringChar = '';
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (!inString && (char === '"' || char === "'")) { inString = true; stringChar = char; }
      else if (inString && char === stringChar && line[i - 1] !== '\\') inString = false;
    }
    if (inString) {
      markers.push({ severity: DiagnosticSeverity.Error, range: toRange(1, line.length + 1), message: 'Unclosed string literal' });
    }

    if (line.includes('/*') && !line.includes('*/') && !line.includes('//')) {
      const commentStart = line.indexOf('/*');
      markers.push({ severity: DiagnosticSeverity.Warning, range: toRange(commentStart + 1, line.length), message: 'Potentially unclosed block comment' });
    }

    let badIdM;
    const badIdRegex = /\b(\d+[a-zA-Z_][a-zA-Z0-9_]*)\b/g;
    while ((badIdM = badIdRegex.exec(line)) !== null) {
      markers.push({ severity: DiagnosticSeverity.Error, range: toRange(badIdM.index + 1, badIdM.index + badIdM[0].length + 1), message: 'Invalid identifier: cannot start with a number' });
    }

    if (/^\s*(part|port|action|state|flow|item|connection|constraint|actor|behavior)\s+def\s*\{\s*$/i.test(trimmedLine)) {
      markers.push({ severity: DiagnosticSeverity.Error, range: toRange(1, trimmedLine.length + 1), message: 'Definition missing name before opening brace' });
    }
    if (/^\s*(part|port|action|state|flow|item|connection|constraint|actor|behavior)\s+def\s*$/.test(trimmedLine)) {
      markers.push({ severity: DiagnosticSeverity.Error, range: toRange(1, trimmedLine.length + 1), message: 'Definition missing name and body' });
    }

    let semiM;
    const semiRegex = /;;+/g;
    while ((semiM = semiRegex.exec(line)) !== null) {
      markers.push({ severity: DiagnosticSeverity.Warning, range: toRange(semiM.index + 1, semiM.index + semiM[0].length + 1), message: 'Redundant semicolons' });
    }

    if (/^\s*def\s+\w+/i.test(trimmedLine) && !/^\s*(part|port|action|state|flow|item|connection|constraint|actor|behavior)\s+def/i.test(trimmedLine)) {
      const defMatch = line.match(/\bdef\b/i);
      if (defMatch && defMatch.index !== undefined) {
        markers.push({ severity: DiagnosticSeverity.Error, range: toRange(defMatch.index + 1, defMatch.index + 4), message: "'def' must follow a structural keyword (part, port, action, etc.)" });
      }
    }
  });

  const defNames = new Map<string, number[]>();
  lines.forEach((line, idx) => {
    const m = line.match(/^\s*(?:part|port|action|state|flow|item|connection|constraint|actor|behavior)\s+def\s+(\w+)/i)
      || line.match(/^\s*requirement\s+(\w+)/i)
      || line.match(/^\s*enum\s+(\w+)/i)
      || line.match(/^\s*struct\s+(\w+)/i)
      || line.match(/^\s*datatype\s+(\w+)/i)
      || line.match(/^\s*package\s+(\w+)/i);
    if (m && m[1]) {
      const name = m[1];
      if (!defNames.has(name)) defNames.set(name, []);
      defNames.get(name)!.push(idx + 1);
    }
  });
  defNames.forEach((lineNums, name) => {
    if (lineNums.length > 1) {
      lineNums.forEach((ln) => {
        const line = lines[ln - 1];
        const col = (line.match(new RegExp(`\\b${name}\\b`))?.index ?? 0) + 1;
        markers.push({ severity: DiagnosticSeverity.Warning, range: { start: { line: ln - 1, character: col - 1 }, end: { line: ln - 1, character: col + name.length - 1 } }, message: `Duplicate definition '${name}' (also at line ${lineNums.filter((l) => l !== ln).join(', ')})` });
      });
    }
  });

  const openBraces = (text.match(/{/g) || []).length;
  const closeBraces = (text.match(/}/g) || []).length;
  if (openBraces !== closeBraces) {
    markers.push({ severity: DiagnosticSeverity.Error, range: { start: { line: 0, character: 0 }, end: { line: lines.length - 1, character: 0 } }, message: `Unmatched braces: ${openBraces} open, ${closeBraces} close` });
  }

  return markers;
}

// Create connection with Browser transport
const reader = new BrowserMessageReader(self as any);
const writer = new BrowserMessageWriter(self as any);
const connection = createConnection(ProposedFeatures.all, reader, writer);

connection.onInitialize((): InitializeResult => ({
  capabilities: {
    textDocumentSync: TextDocumentSyncKind.Full,
    completionProvider: { triggerCharacters: ['.', ':', '(', '['] },
    hoverProvider: true,
    definitionProvider: true,
    referencesProvider: true,
    renameProvider: { prepareProvider: false },
    documentSymbolProvider: true,
    foldingRangeProvider: true,
    semanticTokensProvider: { full: { delta: false }, legend: { tokenTypes: semanticTokensLegendLsp.tokenTypes, tokenModifiers: semanticTokensLegendLsp.tokenModifiers } },
    signatureHelpProvider: { triggerCharacters: ['(', ','] },
    codeActionProvider: { codeActionKinds: ['quickfix'] },
    diagnosticProvider: { interFileDependencies: false, workspaceDiagnostics: false },
    documentFormattingProvider: true,
    documentRangeFormattingProvider: true,
    workspace: { workspaceFolders: { supported: true } }
  },
  serverInfo: { name: 'SysMLv2 LSP', version: '1.0.0' }
}));

/** 从 Index 构建 scopeLookupInIndex 所需的 Map<uri, IndexEntryForLookup> */
function indexForLookup(): Map<string, IndexEntryForLookup> {
  const map = new Map<string, IndexEntryForLookup>();
  for (const [uri, entry] of getIndex()) {
    map.set(uri, { scopeRoot: entry.scopeRoot });
  }
  return map;
}

const CONTAINER_TO_SYMBOL_KIND: Record<string, SymbolKind> = {
  package: SymbolKind.Package,
  part: SymbolKind.Class,
  port: SymbolKind.Interface,
  attribute: SymbolKind.Variable,
  usage: SymbolKind.Variable,
  action: SymbolKind.Function,
  state: SymbolKind.Object,
  flow: SymbolKind.Function,
  requirement: SymbolKind.Interface,
  constraint: SymbolKind.Interface,
  enum: SymbolKind.Enum,
  struct: SymbolKind.Struct,
  type: SymbolKind.Class,
  actor: SymbolKind.Class,
  behavior: SymbolKind.Function,
  other: SymbolKind.Variable
};

function astSymbolToLsp(a: AstDocumentSymbol): DocumentSymbol {
  return {
    name: a.name,
    detail: a.detail,
    kind: CONTAINER_TO_SYMBOL_KIND[a.kind] ?? SymbolKind.Variable,
    range: { start: a.range.start, end: a.range.end },
    selectionRange: { start: a.selectionRange.start, end: a.selectionRange.end },
    children: a.children.map(astSymbolToLsp)
  };
}


connection.onRequest('sysml/g4Diagnostics', (params: { textDocument: { uri: string } }): Diagnostic[] => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return [];
  const items = runG4Parse(doc.getText());
  return items.map(d => ({ range: d.range, message: d.message, severity: d.severity ?? DiagnosticSeverity.Error, source: 'G4' }));
});

connection.onRequest('textDocument/formatting', (params: { textDocument: { uri: string }; options?: { tabSize?: number; insertSpaces?: boolean } }): TextEdit[] => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return [];
  const text = doc.getText();
  const parseResult = parseSysML(text);
  const root =
    parseResult.parserErrors.length === 0 &&
    parseResult.lexerErrors.length === 0 &&
    parseResult.value &&
    isNamespace(parseResult.value)
      ? parseResult.value
      : undefined;
  const formatted = formatSysmlv2Code(text, {
    tabSize: params.options?.tabSize ?? 2,
    insertSpaces: params.options?.insertSpaces ?? true
  }, root);
  return [{ range: { start: { line: 0, character: 0 }, end: doc.positionAt(text.length) }, newText: formatted }];
});

connection.onRequest('textDocument/rangeFormatting', (params: { textDocument: { uri: string }; range: { start: { line: number; character: number }; end: { line: number; character: number } }; options?: { tabSize?: number; insertSpaces?: boolean } }): TextEdit[] => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return [];
  const fullText = doc.getText();
  const startOffset = doc.offsetAt(params.range.start);
  const endOffset = doc.offsetAt(params.range.end);
  const rangeText = fullText.substring(startOffset, endOffset);
  // Range formatting uses brace-depth only (AST ranges refer to full document)
  const formatted = formatSysmlv2Code(rangeText, {
    tabSize: params.options?.tabSize ?? 2,
    insertSpaces: params.options?.insertSpaces ?? true
  });
  return [{ range: params.range, newText: formatted }];
});

connection.languages.diagnostics.on(async (params) => {
  const document = documents.get(params.textDocument.uri);
  if (document) {
    return { kind: DocumentDiagnosticReportKind.Full, items: validateDocument(document.getText()) } satisfies DocumentDiagnosticReport;
  }
  return { kind: DocumentDiagnosticReportKind.Full, items: [] } satisfies DocumentDiagnosticReport;
});

function detectCompletionContextLsp(line: string, char: number): string {
  const beforeCursor = line.substring(0, char);
  const trimmed = beforeCursor.trim();
  if (beforeCursor.endsWith(':') && !beforeCursor.endsWith('::')) return 'type';
  if (/^(package)\s*$/i.test(trimmed)) return 'packageName';
  if (/\b(part|port)\s+def\s*$/i.test(trimmed)) return 'defName';
  if (/\battribute\s*$/i.test(trimmed)) return 'attrName';
  return 'general';
}

connection.onCompletion((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return [];

  const text = document.getText();
  const lines = text.split('\n');
  const line = lines[params.position.line] ?? '';
  const ctx = detectCompletionContextLsp(line, params.position.character);

  let astSymbols: ReturnType<typeof extractAstSymbols> | null = null;
  try {
    const parseResult = parseSysML(text);
    if (parseResult.parserErrors.length === 0 && parseResult.lexerErrors.length === 0) {
      astSymbols = extractAstSymbols(parseResult.value);
    }
  } catch {
    // Parse failed
  }

  const keywords = ['package', 'import', 'part', 'port', 'flow', 'connection', 'action', 'state', 'transition', 'requirement', 'constraint', 'def', 'definition', 'type', 'enum', 'struct', 'actor', 'behavior', 'public', 'private', 'protected', 'true', 'false', 'null'];
  const staticTypes = ['Boolean', 'Integer', 'Real', 'String', 'Natural', 'Positive', 'PartDef', 'PortDef', 'FlowDef', 'ItemDef', 'ActionDef', 'StateDef', 'Requirement', 'Element', 'Feature', 'Type', 'Classifier'];

  let items: CompletionItem[] = [];
  if (ctx === 'type') {
    const typeNames = astSymbols?.typeNames?.length ? astSymbols.typeNames : staticTypes;
    items = typeNames.map(t => ({ label: t, kind: CompletionItemKind.Class, detail: 'type' }));
  } else if (ctx === 'packageName') {
    const pkgNames = astSymbols?.packages?.length ? astSymbols.packages : ['MyPackage', 'Library', 'Utilities', 'Models'];
    items = pkgNames.map(p => ({ label: p, kind: CompletionItemKind.Module, detail: 'package' }));
  } else if (ctx === 'defName') {
    const defNames = astSymbols
      ? [...new Set([...astSymbols.partDefs, ...astSymbols.portDefs, 'Vehicle', 'Engine', 'Port', 'Action', 'State'])]
      : ['Vehicle', 'Engine', 'Port', 'Action', 'State', 'Item', 'Connection', 'Flow'];
    items = defNames.map(n => ({ label: n, kind: CompletionItemKind.Class, detail: 'definition' }));
  } else if (ctx === 'attrName') {
    const attrNames = astSymbols?.attributeNames?.length ? astSymbols.attributeNames : ['name', 'id', 'value', 'description', 'owner'];
    items = attrNames.map(a => ({ label: a, kind: CompletionItemKind.Variable, detail: 'attribute' }));
  } else {
    items = [
      ...keywords.map(k => ({ label: k, kind: CompletionItemKind.Keyword, detail: 'keyword' })),
      ...(astSymbols?.typeNames?.length ? astSymbols.typeNames : staticTypes).map(t => ({ label: t, kind: CompletionItemKind.Class, detail: 'type' }))
    ];
  }
  return items;
});

connection.onHover((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return null;
  const line = document.getText().split('\n')[params.position.line] || '';
  const wordMatch = line.match(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/);
  if (wordMatch) {
    return { contents: { kind: 'markdown', value: `**${wordMatch[0]}**\n\nSysMLv2 identifier` } };
  }
  return null;
});

// G.3: definition / references / rename 返回多 URI
connection.onDefinition((params) => {
  const uri = params.textDocument.uri;
  const entry = getIndexEntry(uri);
  if (!entry?.root) return null;
  const { line, character } = params.position;
  const resolved = getDefinitionAtPositionWithUri(entry.root, entry.text, line, character, uri, indexForLookup());
  if (!resolved) return null;
  const targetEntry = getIndexEntry(resolved.uri);
  const text = targetEntry?.text ?? entry.text;
  const range = getNodeRange(resolved.node, text) ?? { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } };
  return { uri: resolved.uri, range };
});

connection.onReferences((params) => {
  const uri = params.textDocument.uri;
  const entry = getIndexEntry(uri);
  if (!entry?.root) return [];
  const { line, character } = params.position;
  const resolved = getDefinitionAtPositionWithUri(entry.root, entry.text, line, character, uri, indexForLookup());
  if (!resolved) return [];
  const locations: { uri: string; range: { start: { line: number; character: number }; end: { line: number; character: number } } }[] = [];
  if (params.context.includeDeclaration) {
    const defEntry = getIndexEntry(resolved.uri);
    const defText = defEntry?.text ?? '';
    const defRange = getElementNameRange(resolved.node, defText) ?? getNodeRange(resolved.node, defText);
    if (defRange) locations.push({ uri: resolved.uri, range: defRange });
  }
  const refs = findReferencesToDefinitionAcrossIndex(getIndex(), resolved.uri, resolved.node);
  for (const { uri: refUri, node } of refs) {
    const refEntry = getIndexEntry(refUri);
    const refText = refEntry?.text ?? '';
    const range = getElementNameRange(node, refText) ?? getNodeRange(node, refText);
    if (range) locations.push({ uri: refUri, range });
  }
  return locations;
});

connection.onRenameRequest((params) => {
  const uri = params.textDocument.uri;
  const entry = getIndexEntry(uri);
  if (!entry?.root) return null;
  const { line, character } = params.position;
  const resolved = getDefinitionAtPositionWithUri(entry.root, entry.text, line, character, uri, indexForLookup());
  if (!resolved) return null;
  const changes: Record<string, TextEdit[]> = {};
  function addEdit(refUri: string, node: unknown) {
    const refEntry = getIndexEntry(refUri);
    const refText = refEntry?.text ?? '';
    const range = getElementNameRange(node, refText) ?? getNodeRange(node, refText);
    if (!range) return;
    if (!changes[refUri]) changes[refUri] = [];
    changes[refUri].push({ range, newText: params.newName });
  }
  addEdit(resolved.uri, resolved.node);
  const refs = findReferencesToDefinitionAcrossIndex(getIndex(), resolved.uri, resolved.node);
  for (const { uri: refUri, node } of refs) addEdit(refUri, node);
  return { changes };
});

// H.1: documentSymbol / foldingRange
connection.onDocumentSymbol((params) => {
  const entry = getIndexEntry(params.textDocument.uri);
  if (!entry?.root) return [];
  const astSymbols = astToDocumentSymbols(entry.root, entry.text);
  return astSymbols.map(astSymbolToLsp);
});

connection.onFoldingRange((params) => {
  const entry = getIndexEntry(params.textDocument.uri);
  if (!entry?.root) return [];
  const ranges = getFoldingRanges(entry.root, entry.text);
  return ranges.map((r): FoldingRange => ({ startLine: r.startLine, endLine: r.endLine }));
});

// H.1: semanticTokens / signatureHelp / codeAction
connection.onRequest('textDocument/semanticTokens/full', (params: { textDocument: { uri: string } }) => {
  const entry = getIndexEntry(params.textDocument.uri);
  const text = entry?.text ?? documents.get(params.textDocument.uri)?.getText() ?? '';
  const data = getSemanticTokensDataLsp(text, entry?.root);
  return { data };
});

const BUILTIN_SIGNATURES: Record<string, { label: string; documentation?: string; parameters?: Array<{ label: string; documentation?: string }> }> = {
  println: { label: 'println(value: String): void', documentation: 'Print a value to the console', parameters: [{ label: 'value', documentation: 'The value to print' }] },
  print: { label: 'print(value: String): void', documentation: 'Print without newline', parameters: [{ label: 'value' }] },
  assert: { label: 'assert(condition: Boolean): void', documentation: 'Assert condition is true', parameters: [{ label: 'condition' }] },
  toInteger: { label: 'toInteger(value: Real): Integer', parameters: [{ label: 'value' }] },
  toReal: { label: 'toReal(value: Integer): Real', parameters: [{ label: 'value' }] },
  size: { label: 'size(collection: Sequence): Natural', parameters: [{ label: 'collection' }] },
  empty: { label: 'empty(collection: Sequence): Boolean', parameters: [{ label: 'collection' }] }
};

connection.onSignatureHelp((params) => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return null;
  const text = doc.getText();
  const lines = text.split('\n');
  const line = lines[params.position.line] ?? '';
  const beforeCursor = line.substring(0, params.position.character);
  const lastOpen = beforeCursor.lastIndexOf('(');
  if (lastOpen < 0) return null;
  const afterOpen = beforeCursor.substring(lastOpen + 1);
  const commaCount = (afterOpen.match(/,/g) || []).length;
  const beforeParen = beforeCursor.substring(0, lastOpen);
  const fnMatch = beforeParen.match(/\b(println|print|assert|toInteger|toReal|size|empty)\s*$/);
  const fnName = fnMatch ? fnMatch[1] : 'println';
  const sig = BUILTIN_SIGNATURES[fnName] ?? BUILTIN_SIGNATURES.println;
  return {
    signatures: [{ label: sig.label, documentation: sig.documentation, parameters: sig.parameters ?? [] }],
    activeSignature: 0,
    activeParameter: commaCount
  };
});

connection.onCodeAction((params) => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return [];
  const text = doc.getText();
  const actions: import('vscode-languageserver/browser').CodeAction[] = [];
  const diagnostics = params.context.diagnostics || [];
  for (const d of diagnostics) {
    const msg = d.message;
    const range = d.range;
    const start = range.start;
    const end = range.end;
    if (msg === 'Missing semicolon') {
      const lines = text.split('\n');
      const lineContent = lines[start.line] ?? '';
      const insertCol = lineContent.length;
      actions.push({
        title: 'Insert ;',
        kind: 'quickfix',
        edit: { changes: { [params.textDocument.uri]: [{ range: { start: { line: start.line, character: insertCol }, end: { line: start.line, character: insertCol } }, newText: ';' }] } }
      });
    } else if (msg.startsWith("Unknown keyword '") && msg.includes("'. Did you mean '")) {
      const match = msg.match(/Unknown keyword '(\w+)'\. Did you mean '(\w+)'\?/);
      if (match) {
        const [, , correct] = match;
        actions.push({
          title: `Replace with '${correct}'`,
          kind: 'quickfix',
          edit: { changes: { [params.textDocument.uri]: [{ range, newText: correct! }] } }
        });
      }
    } else if (msg.startsWith('Unresolved type reference: \'')) {
      const match = msg.match(/Unresolved type reference: '(\w+)'/);
      if (match) {
        const typeName = match[1];
        const lines = text.split('\n');
        const insertLine = lines.length;
        const stub = `\npart def ${typeName} {\n\t\n}\n`;
        actions.push({
          title: `Add stub 'part def ${typeName} { }'`,
          kind: 'quickfix',
          edit: { changes: { [params.textDocument.uri]: [{ range: { start: { line: insertLine, character: 0 }, end: { line: insertLine, character: 0 } }, newText: stub }] } }
        });
      }
    } else if (msg.startsWith('Duplicate definition: \'')) {
      const nameMatch = msg.match(/Duplicate definition: '(\w+)'/);
      if (nameMatch) {
        const name = nameMatch[1];
        const defLines = getDefinitionLinesByName(text, name);
        if (defLines.length > 0) {
          const first = defLines[0];
          actions.push({
            title: 'Go to first definition',
            kind: 'quickfix',
            command: { title: 'Go to first definition', command: 'sysml.goToFirstDefinition', arguments: [first.line, first.character] }
          });
        }
      }
    }
  }
  return actions;
});

function getDefinitionLinesByName(text: string, name: string): Array<{ line: number; character: number }> {
  const out: Array<{ line: number; character: number }> = [];
  const lines = text.split('\n');
  const defPatterns = [/^\s*(part|port|action|state|flow|item|connection|constraint|actor|behavior)\s+def\s+(\w+)/i, /^\s*requirement\s+(\w+)/i, /^\s*enum\s+(\w+)/i, /^\s*struct\s+(\w+)/i, /^\s*datatype\s+(\w+)/i, /^\s*package\s+(\w+)/i];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const re of defPatterns) {
      const m = line.match(re);
      if (!m || m.index === undefined) continue;
      const nameGroup = m[2] ?? m[1];
      if (nameGroup === name) {
        const nameOffsetInMatch = m[0].indexOf(nameGroup);
        const character = nameOffsetInMatch >= 0 ? m.index + nameOffsetInMatch : m.index;
        out.push({ line: i, character });
        break;
      }
    }
  }
  return out;
}

documents.listen(connection);
connection.listen();
