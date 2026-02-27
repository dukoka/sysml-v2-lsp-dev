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
  type TextEdit
} from 'vscode-languageserver/browser';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { parseSysML, parseResultToDiagnostics } from '../grammar/parser.js';
import { isNamespace } from '../grammar/generated/ast.js';
import { extractAstSymbols } from '../grammar/astSymbols.js';
import { runSemanticValidation } from '../languages/sysmlv2/semanticValidation.js';
import { formatSysmlv2Code } from '../languages/sysmlv2/formatter.js';
import { SYSMLV2_KEYWORDS } from '../languages/sysmlv2/keywords.js';
import { runG4Parse } from '../grammar/g4/g4Runner.js';

// Document store (managed by TextDocuments)
const documents = new TextDocuments(TextDocument);

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
    diagnosticProvider: { interFileDependencies: false, workspaceDiagnostics: false },
    documentFormattingProvider: true,
    documentRangeFormattingProvider: true,
    workspace: { workspaceFolders: { supported: true } }
  },
  serverInfo: { name: 'SysMLv2 LSP', version: '1.0.0' }
}));

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

documents.listen(connection);
connection.listen();
