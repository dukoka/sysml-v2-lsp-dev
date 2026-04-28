/**
 * SysMLv2 语言服务器 Web Worker
 * 使用 vscode-languageserver 的 createConnection + BrowserMessageReader/Writer
 * 实现 Language Server Protocol (LSP) 的服务器端
 */

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
  InsertTextFormat,
  DocumentDiagnosticReportKind,
  type DocumentDiagnosticReport,
  DiagnosticSeverity,
  type Diagnostic,
  type TextEdit,
  SymbolKind,
  type DocumentSymbol,
  type FoldingRange,
  DocumentHighlightKind,
  type SymbolInformation
} from 'vscode-languageserver/browser';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { parseSysML, parseResultToDiagnostics } from '../grammar/parser.js';
import { isNamespace, isOwningMembership, isActionDefinition, isSysMLFunction, isFeature } from '../grammar/generated/ast.js';
import type { Namespace, Usage as UsageNode, Feature } from '../grammar/generated/ast.js';
import { extractAstSymbols } from '../grammar/astSymbols.js';
import { runSemanticValidation } from '../languages/sysmlv2/semanticValidation.js';
import { formatSysmlv2Code } from '../languages/sysmlv2/formatter.js';
import { SYSMLV2_KEYWORDS } from '../languages/sysmlv2/keywords.js';
import { runG4Parse } from '../grammar/g4/g4Runner.js';
import { updateIndex, removeFromIndex, getIndex, getIndexEntry } from './indexManager.js';
import type { IndexEntryForLookup } from '../languages/sysmlv2/scope.js';
import { getDefinitionAtPositionWithUri, findReferencesToDefinitionAcrossIndex, findReferencesToDefinition, findNodeAtPosition, getTypeReferenceName, resolveToDefinition, resolveToDefinitionWithUri } from '../languages/sysmlv2/references.js';
import { isDefinition } from '../grammar/generated/ast.js';
import { buildScopeTree } from '../languages/sysmlv2/scope.js';
import { getNodeRange, getElementNameRange, astToDocumentSymbols, getFoldingRanges, type AstDocumentSymbol } from '../grammar/astUtils.js';
import { getSemanticTokensDataLsp, semanticTokensLegendLsp } from '../languages/sysmlv2/semanticTokens.js';

/**
 * 文档存储（由 TextDocuments 管理）
 * 使用 vscode-languageserver 的 TextDocuments 管理打开的文档
 */
const documents = new TextDocuments(TextDocument);

/**
 * 多文件索引管理
 * 文档打开时添加到索引，变更时更新索引，关闭时从索引移除
 */
let pendingDocumentCount = 0;
let processingQueueSize = 0;
let pendingNotificationCount = 0;

documents.onDidOpen((e) => {
  processingQueueSize++;
  pendingDocumentCount++;
  updateIndex(e.document.uri, e.document.getText());
  pendingDocumentCount--;
  pendingNotificationCount++;
  setTimeout(() => {
    pendingNotificationCount--;
    processingQueueSize--;
  }, 10);
});
documents.onDidChangeContent((e) => {
  processingQueueSize++;
  pendingDocumentCount++;
  updateIndex(e.document.uri, e.document.getText());
  pendingDocumentCount--;
  pendingNotificationCount++;
  setTimeout(() => {
    pendingNotificationCount--;
    processingQueueSize--;
  }, 10);
});
documents.onDidClose((e) => {
  removeFromIndex(e.document.uri);
});

/**
 * 用户定义类型的正则表达式模式
 * 用于从代码中提取用户定义的类型名
 */
const DEFINITION_PATTERNS = [
  /^\s*(part|port|action|state|flow|item|connection|constraint|actor|behavior)\s+def\s+(\w+)/,
  /^\s*(requirement)\s+(\w+)/,
  /^\s*enum\s+(\w+)/,
  /^\s*struct\s+(\w+)/,
  /^\s*datatype\s+(\w+)/,
  /^\s*package\s+(\w+)/
];

/**
 * 提取用户定义的类型
 * 扫描代码文本，使用正则表达式提取用户定义的类型名
 * @param text - 源代码文本
 * @returns 类型名集合
 */
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

/**
 * 计算两个字符串之间的 Levenshtein 距离
 * 用于拼写检查和相似关键字查找
 * @param a - 第一个字符串
 * @param b - 第二个字符串
 * @returns 编辑距离
 */
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

/**
 * 查找相似的关键字
 * 计算输入单词与关键字列表的距离，返回最相似的关键字
 * @param word - 输入的单词
 * @returns 最相似的关键字，如果没有则返回 null
 */
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

/**
 * 验证文档
 * 使用 Langium 解析器进行 AST 诊断，并进行语义验证
 * @param text - 源代码文本
 * @param uri - 文档 URI（可选，用于跨文件引用）
 * @returns 诊断信息数组
 */
function validateDocument(text: string, uri?: string): Diagnostic[] {
  const markers: Diagnostic[] = [];

  // 基于 AST 的诊断（来自 Langium 解析器的解析/词法错误）
  try {
    const parseResult = parseSysML(text);
    markers.push(...(parseResultToDiagnostics(parseResult) as Diagnostic[]));
    if (parseResult.parserErrors.length === 0 && parseResult.lexerErrors.length === 0) {
      const crossFile = uri ? { currentUri: uri, index: indexForLookup() } : undefined;
      const semantic = runSemanticValidation(parseResult.value, text, crossFile);
      for (const d of semantic) {
        const diag: Diagnostic = {
          severity: d.severity as DiagnosticSeverity,
          range: d.range,
          message: d.message
        };
        // 注意：vscode-languageserver/browser 的 Diagnostic 类型不公开 tags 属性
        // 这是浏览器版本的已知限制
        if (d.tags?.length) {
          (diag as any).tags = d.tags;
        }
        markers.push(diag);
      }
      return markers;
    }
  } catch {
    // 解析器初始化或运行时错误 - 使用正则表达式验证继续
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

/**
 * 创建与浏览器传输的连接
 * 使用 BrowserMessageReader/Writer 在 Web Worker 环境中通信
 */
// 注意：BrowserMessageReader/Writer 需要将 self 转换为 any 以适应 WebWorker 上下文
const reader = new BrowserMessageReader(self as any);
const writer = new BrowserMessageWriter(self as any);
const connection = createConnection(ProposedFeatures.all, reader, writer);

/**
 * 直接加载库文件到索引
 * 用于加载标准库文件而不经过 TextDocuments 开销
 */
connection.onNotification('sysml/indexLibraryFile', (params: { uri: string; content: string }) => {
  processingQueueSize++;
  pendingDocumentCount++;
  pendingNotificationCount++;
  updateIndex(params.uri, params.content);
  pendingDocumentCount--;
  setTimeout(() => {
    pendingNotificationCount--;
    processingQueueSize--;
  }, 10);
});

/**
 * Ping 请求
 * 返回服务就绪状态（当没有待处理文档时返回 true）
 */
connection.onRequest('sysml/ping', (): boolean => pendingNotificationCount === 0);

/**
 * 初始化 LSP 连接
 * 返回服务器能力，声明支持的 LSP 功能
 */
connection.onInitialize((): InitializeResult => ({
  capabilities: {
    textDocumentSync: TextDocumentSyncKind.Full,
    completionProvider: { triggerCharacters: ['.', ':', '(', '['], resolveProvider: false },
    hoverProvider: true,
    definitionProvider: true,
    referencesProvider: true,
    renameProvider: { prepareProvider: true },
    documentSymbolProvider: true,
    foldingRangeProvider: true,
    semanticTokensProvider: { full: { delta: false }, legend: { tokenTypes: semanticTokensLegendLsp.tokenTypes, tokenModifiers: semanticTokensLegendLsp.tokenModifiers } },
    signatureHelpProvider: { triggerCharacters: ['(', ','] },
    typeDefinitionProvider: true,
    codeLensProvider: { resolveProvider: false },
    codeActionProvider: { codeActionKinds: ['quickfix', 'refactor'] },
    diagnosticProvider: { interFileDependencies: true, workspaceDiagnostics: true },
    documentHighlightProvider: true,
    documentFormattingProvider: true,
    documentRangeFormattingProvider: true,
    documentOnTypeFormattingProvider: { firstTriggerCharacter: '}', moreTriggerCharacter: [';', '\n'] },
    inlayHintProvider: true,
    workspaceSymbolProvider: true,
    selectionRangeProvider: true,
    linkedEditingRangeProvider: true,
    workspace: { workspaceFolders: { supported: true } }
  },
  serverInfo: { name: 'SysMLv2 LSP', version: '1.0.0' }
}));

/**
 * 类型定义正则表达式
 * 用于从文本中提取用户定义的类型名
 */
const TYPEDEF_RE = /\b(?:abstract\s+)?(?:part|port|action|state|item|connection|attribute|datatype|struct|classifier|enum\s+def|requirement|constraint|calc|occurrence|metadata)\s+def\s+(\w+)/g;
const KERML_TYPE_RE = /\b(?:abstract\s+)?(?:datatype|classifier|struct|class|metaclass)\s+(\w+)(?:\s+specializes|\s+\{|;)/g;

/**
 * 从文本中提取类型名
 * 使用正则表达式扫描文本，将匹配的类型名添加到集合
 * @param text - 源代码文本
 * @param names - 类型名集合（输出参数）
 */
function extractNamesFromText(text: string, names: Set<string>): void {
  for (const re of [TYPEDEF_RE, KERML_TYPE_RE]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (m[1]) names.add(m[1]);
    }
  }
}

/**
 * 从所有索引文件中收集类型名
 * 用户文件使用 AST，标准库使用正则表达式
 * @returns 类型名数组
 */
function getIndexTypeNames(): string[] {
  const names = new Set<string>();
  for (const [, entry] of getIndex()) {
    if (entry.text) extractNamesFromText(entry.text, names);
    if (!entry.root) continue;
    function visit(ns: any): void {
      if (!ns?.children) return;
      for (const child of ns.children) {
        if (!isOwningMembership(child) || !child.target) continue;
        const t = child.target;
        if (isDefinition(t)) {
          const name = (t as { declaredName?: string }).declaredName;
          if (name) names.add(name);
        }
        if (isNamespace(t)) visit(t);
      }
    }
    visit(entry.root);
  }
  return Array.from(names);
}

/**
 * 构建用于 scopeLookupInIndex 的索引
 * @returns URI 到索引项的映射
 */
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


connection.onRequest('sysml/debugIndexTypes', (): { count: number; uris: string[]; names: string[] } => {
  const names = getIndexTypeNames();
  const uris = Array.from(getIndex().keys());
  return { count: names.length, uris, names };
});

connection.onRequest('sysml/g4Diagnostics', (params: { textDocument: { uri: string } }): Diagnostic[] => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return [];
  const items = runG4Parse(doc.getText());
  return items.map(d => ({ range: d.range, message: d.message, severity: (d.severity ?? DiagnosticSeverity.Error) as DiagnosticSeverity, source: 'G4' }));
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
  });
  const lines = text.split('\n');
  const endLine = lines.length - 1;
  const endChar = lines[endLine]?.length ?? 0;
  return [{ range: { start: { line: 0, character: 0 }, end: { line: endLine, character: endChar } }, newText: formatted }];
});

connection.onRequest('textDocument/rangeFormatting', (params: { textDocument: { uri: string }; range: { start: { line: number; character: number }; end: { line: number; character: number } }; options?: { tabSize?: number; insertSpaces?: boolean } }): TextEdit[] => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return [];
  const fullText = doc.getText();
  const startOffset = doc.offsetAt(params.range.start);
  const endOffset = doc.offsetAt(params.range.end);
  const rangeText = fullText.substring(startOffset, endOffset);

  // 计算选中范围之前的 base indent
  let baseIndent = 0;
  const beforeText = fullText.substring(0, startOffset);
  for (const c of beforeText) {
    if (c === '{') baseIndent++;
    else if (c === '}') baseIndent = Math.max(0, baseIndent - 1);
  }

  const formatted = formatSysmlv2Code(rangeText, {
    tabSize: params.options?.tabSize ?? 2,
    insertSpaces: params.options?.insertSpaces ?? true,
    baseIndent
  });
  return [{ range: params.range, newText: formatted }];
});

connection.onRequest('textDocument/onTypeFormatting', (params: {
  textDocument: { uri: string };
  position: { line: number; character: number };
  ch: string;
  options?: { tabSize?: number; insertSpaces?: boolean };
}): TextEdit[] => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return [];
  const text = doc.getText();
  const lines = text.split('\n');
  const line = params.position.line;
  const lineText = lines[line] ?? '';
  const tabSize = params.options?.tabSize ?? 2;
  const insertSpaces = params.options?.insertSpaces ?? true;
  const indent = insertSpaces ? ' '.repeat(tabSize) : '\t';

  let depth = 0;
  for (let i = 0; i < line; i++) {
    const l = lines[i];
    for (const c of l) {
      if (c === '{') depth++;
      else if (c === '}') depth = Math.max(0, depth - 1);
    }
  }
  if (params.ch === '}') depth = Math.max(0, depth - 1);
  for (const c of lineText) {
    if (c === '}') break;
    if (c === '{') { depth++; break; }
  }

  const expectedIndent = indent.repeat(depth);
  const currentIndent = lineText.match(/^(\s*)/)?.[1] ?? '';
  if (currentIndent === expectedIndent) return [];

  return [{
    range: { start: { line, character: 0 }, end: { line, character: currentIndent.length } },
    newText: expectedIndent
  }];
});

connection.languages.diagnostics.on(async (params) => {
  const document = documents.get(params.textDocument.uri);
  if (document) {
    return { kind: DocumentDiagnosticReportKind.Full, items: validateDocument(document.getText(), params.textDocument.uri) } satisfies DocumentDiagnosticReport;
  }
  return { kind: DocumentDiagnosticReportKind.Full, items: [] } satisfies DocumentDiagnosticReport;
});

const WORKSPACE_DIAG_BATCH_SIZE = 20;
connection.languages.diagnostics.onWorkspace(async () => {
  const index = getIndex();
  const items: Array<{ uri: string; version: number | null; kind: typeof DocumentDiagnosticReportKind.Full; items: Diagnostic[] }> = [];
  let count = 0;
  for (const [, entry] of index) {
    if (count >= WORKSPACE_DIAG_BATCH_SIZE) break;
    const diagnostics = validateDocument(entry.text, entry.uri);
    items.push({ uri: entry.uri, version: null, kind: DocumentDiagnosticReportKind.Full, items: diagnostics });
    count++;
  }
  return { items };
});

const STRUCTURAL_KEYWORDS_LSP = [
  'part', 'port', 'action', 'state', 'flow', 'item', 'connection',
  'constraint', 'requirement', 'actor', 'behavior', 'interface'
];
const RELATIONSHIP_TOKENS_LSP = [':', ':>>', ':>', '::>', '::', 'specializes', 'subsets', 'redefines', 'references'];
const STATIC_TYPES = ['Boolean', 'Integer', 'Real', 'String', 'Natural', 'Positive', 'PartDef', 'PortDef', 'FlowDef', 'ItemDef', 'ActionDef', 'StateDef', 'Requirement', 'Element', 'Feature', 'Type', 'Classifier'];
const BUILTIN_FUNCTIONS_LSP = ['assert', 'println', 'print', 'toString', 'toInteger', 'toReal', 'toBoolean', 'size', 'empty', 'isEmpty', 'first', 'last', 'append', 'prepend'];
const COMPLETION_KEYWORDS = ['package', 'import', 'part', 'port', 'flow', 'connection', 'action', 'state', 'transition', 'requirement', 'constraint', 'def', 'type', 'enum', 'struct', 'actor', 'behavior', 'public', 'private', 'protected', 'attribute', 'feature', 'reference', 'in', 'out', 'abstract', 'specialization', 'readonly', 'end', 'binding', 'succession', 'metadata', 'snapshot', 'true', 'false', 'null'];

function detectCompletionContextLsp(line: string, char: number): string {
  const beforeCursor = line.substring(0, char);
  const trimmed = beforeCursor.trim();

  if (beforeCursor.endsWith('.')) return 'member';
  for (const token of RELATIONSHIP_TOKENS_LSP) {
    if (beforeCursor.endsWith(token) || trimmed.endsWith(token)) return 'type';
  }
  if (beforeCursor.endsWith(':') && !beforeCursor.endsWith('::')) return 'type';

  // Handle partial word after trigger: "attribute x : Sc" → strip "Sc" → "attribute x : " → detect ":"
  const stripped = beforeCursor.replace(/\w+$/, '');
  if (stripped !== beforeCursor) {
    const strEnd = stripped.trimEnd();
    for (const token of RELATIONSHIP_TOKENS_LSP) {
      if (strEnd.endsWith(token)) return 'type';
    }
  }

  if (/\bimport\s*$/i.test(trimmed)) return 'importName';
  if (/\battribute\s*$/i.test(trimmed)) return 'attrName';
  if (/^(enum)\s*$/i.test(trimmed)) return 'enumName';
  if (/^(struct|datatype)\s*$/i.test(trimmed)) return 'structName';
  if (/^(package)\s*$/i.test(trimmed)) return 'packageName';
  if (/\b(in|out)\s*$/i.test(trimmed)) return 'direction';
  const structPattern = STRUCTURAL_KEYWORDS_LSP.join('|');
  if (new RegExp(`^(${structPattern})\\s*$`, 'i').test(trimmed)) return 'definitionStart';
  if (new RegExp(`^(${structPattern})\\s+$`, 'i').test(trimmed)) return 'definitionStart';
  if (new RegExp(`^(${structPattern})\\s+def\\s*`, 'i').test(trimmed)) return 'defName';

  let braceDepth = 0;
  const fullBefore = line.substring(0, char);
  for (const ch of fullBefore) { if (ch === '{') braceDepth++; if (ch === '}') braceDepth--; }
  if (braceDepth > 0) return 'definitionBody';

  return 'general';
}


connection.onCompletion((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return [];

  const text = document.getText();
  const lines = text.split('\n');
  const line = lines[params.position.line] ?? '';
  const ctx = detectCompletionContextLsp(line, params.position.character);

  // Extract the word prefix being typed for filtering and range replacement
  const beforeCursor = line.substring(0, params.position.character);
  const prefixMatch = beforeCursor.match(/[a-zA-Z_]\w*$/);
  const prefix = prefixMatch ? prefixMatch[0].toLowerCase() : '';
  const prefixLen = prefixMatch ? prefixMatch[0].length : 0;

  // The range that will be replaced when a completion item is accepted
  const replaceRange = {
    start: { line: params.position.line, character: params.position.character - prefixLen },
    end: { line: params.position.line, character: params.position.character }
  };

  let astSymbols: ReturnType<typeof extractAstSymbols> | null = null;
  try {
    const parseResult = parseSysML(text);
    if (parseResult.parserErrors.length === 0 && parseResult.lexerErrors.length === 0) {
      astSymbols = extractAstSymbols(parseResult.value);
    }
  } catch { /* parse failed */ }

  let items: CompletionItem[] = [];

  const indexTypes = getIndexTypeNames();
  const mergeTypes = (base: string[]): string[] => {
    const seen = new Set(base);
    const merged = [...base];
    for (const n of indexTypes) { if (!seen.has(n)) { seen.add(n); merged.push(n); } }
    return merged;
  };

   // Filter items based on prefix match (use filterText when available, else first word of label)
   const filterItems = (items: CompletionItem[]): CompletionItem[] => {
     if (!prefix) return items;
     return items.filter(item => {
       const filterKey = item.filterText
         ?? (typeof item.label === 'string' ? item.label : (item.label as { label: string }).label);
       // match against the first word of the filter key (handles multi-word labels)
       const firstWord = filterKey.split(/\s+/)[0].toLowerCase();
       return firstWord.startsWith(prefix) || filterKey.toLowerCase().startsWith(prefix);
     });
   };

   // Attach a textEdit to each item so Monaco replaces exactly the typed prefix,
   // preventing cursor-jump caused by Monaco's own word-boundary guessing.
   const withTextEdit = (item: CompletionItem): CompletionItem => {
     if (item.textEdit) return item;  // already set, leave as-is
     const newText = item.insertText ?? (typeof item.label === 'string' ? item.label : (item.label as { label: string }).label);
     return { ...item, textEdit: { range: replaceRange, newText } };
   };

  switch (ctx) {
    case 'type': {
      const base = astSymbols?.typeNames?.length ? astSymbols.typeNames : STATIC_TYPES;
      const typeNames = mergeTypes(base);
      items = typeNames.map(t => ({ label: t, kind: CompletionItemKind.Class, detail: 'type' }));
      break;
    }
    case 'member': {
      items = [
        ...BUILTIN_FUNCTIONS_LSP.map(f => ({ label: f, kind: CompletionItemKind.Function, detail: 'function' })),
        ...['ownedElement', 'member', 'featuring', 'type', 'superclassifier'].map(m => ({ label: m, kind: CompletionItemKind.Property, detail: 'member' }))
      ];
      break;
    }
    case 'importName': {
      items = ['KernelLibrary', 'BaseLibrary', 'SysMLLibrary', 'standard::StandardLibrary'].map(i => ({ label: i, kind: CompletionItemKind.Module, detail: 'package' }));
      break;
    }
    case 'enumName': {
      items = ['Status', 'State', 'Type', 'Category', 'Priority', 'Color', 'Kind', 'Mode'].map(e => ({ label: e, kind: CompletionItemKind.Enum, detail: 'enum' }));
      break;
    }
    case 'structName': {
      items = ['Data', 'Config', 'Record', 'Info', 'Result', 'Response', 'Settings'].map(s => ({ label: s, kind: CompletionItemKind.Struct, detail: 'struct' }));
      break;
    }
    case 'direction': {
      items = ['in', 'out', 'inout'].map(d => ({ label: d, kind: CompletionItemKind.Keyword, detail: 'direction' }));
      break;
    }
    case 'packageName': {
      const pkgNames = astSymbols?.packages?.length ? astSymbols.packages : ['MyPackage', 'Library', 'Utilities', 'Models'];
      items = pkgNames.map(p => ({ label: p, kind: CompletionItemKind.Module, detail: 'package' }));
      break;
    }
    case 'defName': {
      const defNames = astSymbols
        ? [...new Set([...astSymbols.partDefs, ...astSymbols.portDefs])]
        : ['Vehicle', 'Engine', 'Port', 'Action', 'State', 'Item', 'Connection', 'Flow'];
      items = defNames.map(n => ({ label: n, kind: CompletionItemKind.Class, detail: 'definition' }));
      break;
    }
    case 'attrName': {
      const attrNames = astSymbols?.attributeNames?.length ? astSymbols.attributeNames : ['name', 'id', 'value', 'description', 'owner'];
      items = attrNames.map(a => ({ label: a, kind: CompletionItemKind.Variable, detail: 'attribute' }));
      break;
    }
    case 'definitionStart': {
      items = [
        { label: 'def', kind: CompletionItemKind.Keyword, detail: 'definition' }
      ];
      break;
    }
    case 'definitionBody': {
      const bodyKw = [...STRUCTURAL_KEYWORDS_LSP, 'end', 'attribute', 'feature', 'reference', 'owned', 'exhibits', 'comment', 'enum', 'struct'];
      items = [
        ...bodyKw.map(kw => ({ label: kw, kind: CompletionItemKind.Keyword, detail: 'keyword' })),
        ...mergeTypes(astSymbols?.typeNames?.length ? astSymbols.typeNames : STATIC_TYPES).map(t => ({ label: t, kind: CompletionItemKind.Class, detail: 'type' }))
      ];
      if (astSymbols) {
        const members = [...astSymbols.partDefs, ...astSymbols.portDefs, ...astSymbols.attributeNames];
        items.push(...members.map(m => ({ label: m, kind: CompletionItemKind.Property, detail: 'member' })));
      }
      break;
    }
    case 'general':
    default: {
      items = [
        ...COMPLETION_KEYWORDS.map(k => ({ label: k, kind: CompletionItemKind.Keyword, detail: 'keyword' })),
        ...mergeTypes(astSymbols?.typeNames?.length ? astSymbols.typeNames : STATIC_TYPES).map(t => ({ label: t, kind: CompletionItemKind.Class, detail: 'type' })),
        { label: 'part def', filterText: 'part', kind: CompletionItemKind.Snippet, detail: 'Part definition', insertText: 'part def ${1:Name} {\n\t$0\n}', insertTextFormat: InsertTextFormat.Snippet },
        { label: 'port def', filterText: 'port', kind: CompletionItemKind.Snippet, detail: 'Port definition', insertText: 'port def ${1:Name} {\n\t$0\n}', insertTextFormat: InsertTextFormat.Snippet },
        { label: 'action def', filterText: 'action', kind: CompletionItemKind.Snippet, detail: 'Action definition', insertText: 'action def ${1:Name} {\n\t$0\n}', insertTextFormat: InsertTextFormat.Snippet },
        { label: 'requirement', filterText: 'requirement', kind: CompletionItemKind.Snippet, detail: 'Requirement', insertText: 'requirement ${1:Name} {\n\tdoc /* $2 */\n\tsubject $0;\n}', insertTextFormat: InsertTextFormat.Snippet },
        { label: 'package', filterText: 'package', kind: CompletionItemKind.Snippet, detail: 'Package', insertText: 'package ${1:Name} {\n\t$0\n}', insertTextFormat: InsertTextFormat.Snippet },
        { label: 'enum', filterText: 'enum', kind: CompletionItemKind.Snippet, detail: 'Enumeration', insertText: 'enum ${1:Name} {\n\t${2:value1};\n\t${3:value2};\n}', insertTextFormat: InsertTextFormat.Snippet },
        { label: 'attribute', filterText: 'attribute', kind: CompletionItemKind.Snippet, detail: 'Attribute', insertText: '${1:name} : ${2:Type};', insertTextFormat: InsertTextFormat.Snippet }
      ];
      break;
    }
  }
  return filterItems(items).map(withTextEdit);
});

connection.onHover((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return null;
  const text = document.getText();
  const { line, character } = params.position;

  // Find the word at cursor position for range calculation
  const lines = text.split('\n');
  const lineText = lines[line] ?? '';
  const wordRegex = /[a-zA-Z_][a-zA-Z0-9_]*/g;
  let wordMatch: RegExpExecArray | null;
  let wordStart = character;
  let wordEnd = character;
  let wordText = '';
  while ((wordMatch = wordRegex.exec(lineText)) !== null) {
    const wStart = wordMatch.index;
    const wEnd = wStart + wordMatch[0].length;
    if (character >= wStart && character <= wEnd) {
      wordStart = wStart;
      wordEnd = wEnd;
      wordText = wordMatch[0];
      break;
    }
  }
  if (!wordText) return null;

  const hoverRange = {
    start: { line, character: wordStart },
    end: { line, character: wordEnd }
  };

  // Try AST-driven hover via index
  const entry = getIndexEntry(params.textDocument.uri);
  if (entry?.root) {
    const node = findNodeAtPosition(entry.root, entry.text, line, character);
    if (node) {
      const typeName = (node as { $type?: string }).$type ?? 'Element';
      const name = (node as { declaredName?: string }).declaredName
        ?? (node as { declaredShortName?: string }).declaredShortName
        ?? wordText;
      const typeRefName = getTypeReferenceName(node);

      // Build SysML-style signature
      let signature = '';
      const containerKind = typeName.replace(/Definition$/, ' def').replace(/Usage$/, '').replace(/Package$/, 'package');
      if (typeName.endsWith('Definition')) {
        signature = `${containerKind} ${name}`;
      } else if (typeName.endsWith('Usage')) {
        signature = typeRefName ? `${containerKind} ${name} : ${typeRefName}` : `${containerKind} ${name}`;
      } else if (typeName === 'Package') {
        signature = `package ${name}`;
      } else {
        signature = `${containerKind} ${name}`;
      }

      // Extract doc comment (line above the node)
      const nodeRange = getNodeRange(node, entry.text);
      let docComment = '';
      if (nodeRange && nodeRange.start.line > 0) {
        for (let i = nodeRange.start.line - 1; i >= 0 && i >= nodeRange.start.line - 5; i--) {
          const prevLine = lines[i]?.trim() ?? '';
          if (prevLine.startsWith('/*') || prevLine.startsWith('*') || prevLine.startsWith('doc')) {
            const cleaned = prevLine
              .replace(/^\/\*\*?\s*/, '')
              .replace(/^\*\/?\s*/, '')
              .replace(/^\*\s?/, '')
              .replace(/\*\/\s*$/, '')
              .replace(/^doc\s*\/\*\s*/, '')
              .trim();
            if (cleaned) docComment = cleaned + (docComment ? '\n' + docComment : '');
          } else if (prevLine.startsWith('//')) {
            const cleaned = prevLine.replace(/^\/\/\s?/, '').trim();
            if (cleaned) docComment = cleaned;
            break;
          } else if (prevLine !== '') {
            break;
          }
        }
      }

      const parts: string[] = [];
      parts.push('```sysml\n' + signature + '\n```');
      parts.push(`**(${typeName})**`);
      if (docComment) parts.push('---\n' + docComment);

      // Heritage / specialization info
      const heritage = (node as { heritage?: Array<{ kind?: string; reference?: { target?: { declaredName?: string } } }> }).heritage;
      if (heritage && heritage.length > 0) {
        const heritageStrs: string[] = [];
        for (const h of heritage) {
          const refName = h.reference?.target?.declaredName;
          if (refName) {
            const kind = h.kind ?? 'specializes';
            heritageStrs.push(`${kind} **${refName}**`);
          }
        }
        if (heritageStrs.length > 0) {
          parts.push('**Specializes:** ' + heritageStrs.join(', '));
        }
      }

      // Child members list (for Namespace nodes)
      if (isNamespace(node) && (node as Namespace).children) {
        const memberNames: string[] = [];
        for (const child of (node as Namespace).children) {
          if (!isOwningMembership(child) || !child.target) continue;
          const mName = (child.target as { declaredName?: string }).declaredName;
          if (mName) memberNames.push(mName);
          if (memberNames.length >= 8) break;
        }
        if (memberNames.length > 0) {
          const suffix = (node as Namespace).children.length > 8 ? ', ...' : '';
          parts.push('**Members:** ' + memberNames.join(', ') + suffix);
        }
      }

      // Reference count across all files
      try {
        const refs = findReferencesToDefinitionAcrossIndex(getIndex(), params.textDocument.uri, node);
        if (refs.length > 0) {
          parts.push(`**References:** ${refs.length}`);
        }
      } catch { /* ignore ref lookup failures */ }

      return {
        contents: { kind: 'markdown' as const, value: parts.join('\n\n') },
        range: hoverRange
      };
    }
  }

  // Regex fallback: check if word is a keyword
  if (SYSMLV2_KEYWORDS.includes(wordText)) {
    return {
      contents: { kind: 'markdown' as const, value: `**${wordText}**\n\nSysMLv2 keyword` },
      range: hoverRange
    };
  }

  return {
    contents: { kind: 'markdown' as const, value: `**${wordText}**\n\nSysMLv2 identifier` },
    range: hoverRange
  };
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

// Type Definition: jump to the type of a Usage (e.g. `part engine : Engine` -> go to `Engine`)
connection.onRequest('textDocument/typeDefinition', (params: { textDocument: { uri: string }; position: { line: number; character: number } }) => {
  const uri = params.textDocument.uri;
  const entry = getIndexEntry(uri);
  if (!entry?.root) return null;
  const { line, character } = params.position;
  const node = findNodeAtPosition(entry.root, entry.text, line, character);
  if (!node) return null;
  const typeRefName = getTypeReferenceName(node);
  if (!typeRefName) return null;
  const scope = buildScopeTree(entry.root);
  const resolved = resolveToDefinitionWithUri(scope, typeRefName, uri, indexForLookup());
  if (!resolved) return null;
  const targetEntry = getIndexEntry(resolved.uri);
  const targetText = targetEntry?.text ?? entry.text;
  const range = getNodeRange(resolved.node, targetText) ?? { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } };
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

connection.onPrepareRename((params) => {
  const uri = params.textDocument.uri;
  const entry = getIndexEntry(uri);
  if (!entry?.root) return null;
  const { line, character } = params.position;
  const node = findNodeAtPosition(entry.root, entry.text, line, character);
  if (!node) return null;
  const name = (node as { declaredName?: string }).declaredName
    ?? (node as { declaredShortName?: string }).declaredShortName;
  if (!name) return null;
  const nameRange = getElementNameRange(node, entry.text);
  if (!nameRange) return null;
  return { range: nameRange, placeholder: name };
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

// Document Highlight: highlight all same-symbol occurrences in the current file
connection.onDocumentHighlight((params) => {
  const uri = params.textDocument.uri;
  const entry = getIndexEntry(uri);
  if (!entry?.root) return [];
  const { line, character } = params.position;
  const node = findNodeAtPosition(entry.root, entry.text, line, character);
  if (!node) return [];
  const defName = (node as { declaredName?: string }).declaredName
    ?? (node as { declaredShortName?: string }).declaredShortName;
  if (!defName) return [];

  const scope = buildScopeTree(entry.root);
  const highlights: Array<{ range: { start: { line: number; character: number }; end: { line: number; character: number } }; kind: typeof DocumentHighlightKind.Write | typeof DocumentHighlightKind.Read }> = [];

  const defNameRange = getElementNameRange(node, entry.text) ?? getNodeRange(node, entry.text);
  if (defNameRange) {
    highlights.push({ range: defNameRange, kind: DocumentHighlightKind.Write });
  }

  const refNodes = findReferencesToDefinition(entry.root, node, scope);
  for (const ref of refNodes) {
    if (ref === node) continue;
    const refRange = getElementNameRange(ref, entry.text) ?? getNodeRange(ref, entry.text);
    if (refRange) {
      highlights.push({ range: refRange, kind: DocumentHighlightKind.Read });
    }
  }
  return highlights;
});

// Workspace Symbol: search across all indexed files
connection.onWorkspaceSymbol((params) => {
  const query = (params.query ?? '').toLowerCase();
  const results: SymbolInformation[] = [];
  for (const [uri, entry] of getIndex()) {
    if (!entry.root) continue;
    const symbols = astToDocumentSymbols(entry.root, entry.text);
    function collectSymbols(syms: AstDocumentSymbol[], containerName?: string) {
      for (const s of syms) {
        if (query === '' || s.name.toLowerCase().includes(query)) {
          results.push({
            name: s.name,
            kind: CONTAINER_TO_SYMBOL_KIND[s.kind] ?? SymbolKind.Variable,
            location: { uri, range: { start: s.range.start, end: s.range.end } },
            containerName
          });
        }
        if (s.children.length) collectSymbols(s.children, s.name);
      }
    }
    collectSymbols(symbols);
  }
  return results;
});

// Code Lens: show reference count above each Definition
connection.onCodeLens((params) => {
  const entry = getIndexEntry(params.textDocument.uri);
  if (!entry?.root) return [];
  const uri = params.textDocument.uri;
  const lenses: Array<{ range: { start: { line: number; character: number }; end: { line: number; character: number } }; command?: { title: string; command: string; arguments?: unknown[] } }> = [];

  function collectDefs(ns: import('../grammar/generated/ast.js').Namespace): void {
    if (!ns.children) return;
    for (const child of ns.children) {
      if (!isOwningMembership(child) || !child.target) continue;
      const t = child.target;
      if (isDefinition(t)) {
        const name = (t as { declaredName?: string }).declaredName;
        if (name) {
          const nameRange = getElementNameRange(t, entry!.text);
          if (nameRange) {
            const refs = findReferencesToDefinitionAcrossIndex(getIndex(), uri, t);
            const count = refs.length;
            lenses.push({
              range: { start: { line: nameRange.start.line, character: 0 }, end: { line: nameRange.start.line, character: 0 } },
              command: {
                title: count === 0 ? 'no references' : count === 1 ? '1 reference' : `${count} references`,
                command: 'sysml.showReferences',
                arguments: [uri, nameRange.start]
              }
            });
          }
        }
        if (isNamespace(t)) collectDefs(t);
      }
    }
  }
  collectDefs(entry.root);
  return lenses;
});

// H.1: documentSymbol / foldingRange
connection.onDocumentSymbol((params) => {
  const entry = getIndexEntry(params.textDocument.uri);
  if (!entry?.root) return [];
  const astSymbols = astToDocumentSymbols(entry.root, entry.text);
  return astSymbols.map(astSymbolToLsp);
});

connection.onFoldingRanges((params) => {
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
  println: { label: 'println(value: String): void', documentation: 'Print a value to the console with newline', parameters: [{ label: 'value', documentation: 'The value to print' }] },
  print: { label: 'print(value: String): void', documentation: 'Print a value without newline', parameters: [{ label: 'value' }] },
  assert: { label: 'assert(condition: Boolean): void', documentation: 'Assert condition is true', parameters: [{ label: 'condition' }] },
  toInteger: { label: 'toInteger(value: Real): Integer', documentation: 'Convert value to Integer', parameters: [{ label: 'value' }] },
  toReal: { label: 'toReal(value: Integer): Real', documentation: 'Convert value to Real', parameters: [{ label: 'value' }] },
  size: { label: 'size(collection: Sequence): Natural', documentation: 'Return collection size', parameters: [{ label: 'collection' }] },
  empty: { label: 'empty(collection: Sequence): Boolean', documentation: 'Check if collection is empty', parameters: [{ label: 'collection' }] },
  toString: { label: 'toString(value: any): String', documentation: 'Convert value to String', parameters: [{ label: 'value' }] },
  toBoolean: { label: 'toBoolean(value: any): Boolean', documentation: 'Convert value to Boolean', parameters: [{ label: 'value' }] },
  isEmpty: { label: 'isEmpty(collection: Sequence): Boolean', documentation: 'Check if collection is empty', parameters: [{ label: 'collection' }] },
  first: { label: 'first(collection: Sequence): any', documentation: 'Return first element of collection', parameters: [{ label: 'collection' }] },
  last: { label: 'last(collection: Sequence): any', documentation: 'Return last element of collection', parameters: [{ label: 'collection' }] },
  append: { label: 'append(collection: Sequence, element: any): Sequence', documentation: 'Append element to collection', parameters: [{ label: 'collection' }, { label: 'element' }] },
  prepend: { label: 'prepend(collection: Sequence, element: any): Sequence', documentation: 'Prepend element to collection', parameters: [{ label: 'collection' }, { label: 'element' }] }
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
  const fnMatch = beforeParen.match(/\b(println|print|assert|toInteger|toReal|toString|toBoolean|size|empty|isEmpty|first|last|append|prepend)\s*$/);
  const fnName = fnMatch ? fnMatch[1] : null;
  if (fnName) {
    const sig = BUILTIN_SIGNATURES[fnName];
    return {
      signatures: [{ label: sig.label, documentation: sig.documentation, parameters: sig.parameters ?? [] }],
      activeSignature: 0,
      activeParameter: commaCount
    };
  }

  const userFnMatch = beforeParen.match(/\b(\w+)\s*$/);
  if (!userFnMatch) return null;
  const userFnName = userFnMatch[1];

  const entry = getIndexEntry(params.textDocument.uri);
  if (!entry?.root) return null;

  function findDefinitionByName(ns: any, name: string): any | null {
    if (!ns?.children) return null;
    for (const child of ns.children) {
      if (!isOwningMembership(child) || !child.target) continue;
      const t = child.target as any;
      if (t.declaredName === name && (isActionDefinition(t) || isSysMLFunction(t))) return t;
      if (isNamespace(t)) {
        const found = findDefinitionByName(t, name);
        if (found) return found;
      }
    }
    return null;
  }

  let defNode = findDefinitionByName(entry.root, userFnName);
  if (!defNode) {
    for (const [, ie] of getIndex()) {
      if (ie.uri === params.textDocument.uri) continue;
      if (ie.root) {
        defNode = findDefinitionByName(ie.root, userFnName);
        if (defNode) break;
      }
    }
  }
  if (!defNode) return null;

  const params_list: Array<{ label: string; documentation?: string }> = [];
  if (defNode.children) {
    for (const child of defNode.children) {
      if (!isOwningMembership(child) || !child.target) continue;
      const feat = child.target;
      if (!isFeature(feat)) continue;
      const dir = (feat as Feature).direction;
      if (!dir || dir === 'in' || dir === 'inout') {
        const pName = (feat as any).declaredName ?? 'param';
        const typeName = getTypeReferenceName(feat as any) ?? 'any';
        params_list.push({ label: pName, documentation: `${dir ?? 'in'} ${pName}: ${typeName}` });
      }
    }
  }

  const paramLabels = params_list.map(p => p.label).join(', ');
  const label = `${userFnName}(${paramLabels})`;
  const defType = isActionDefinition(defNode) ? 'action' : 'function';

  return {
    signatures: [{ label, documentation: `User-defined ${defType} \`${userFnName}\``, parameters: params_list }],
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
    } else if (msg.match(/^Definition '(\w+)' has an empty body$/)) {
      const nameMatch = msg.match(/^Definition '(\w+)' has an empty body$/);
      if (nameMatch) {
        const defName = nameMatch[1];
        const insertLine = end.line;
        const insertChar = end.character;
        const stub = `\n\tattribute name : Type;\n`;
        actions.push({
          title: `Add template content to '${defName}'`,
          kind: 'quickfix',
          edit: { changes: { [params.textDocument.uri]: [{ range: { start: { line: insertLine, character: insertChar - 1 }, end: { line: insertLine, character: insertChar - 1 } }, newText: stub }] } }
        });
      }
    } else if (msg.match(/^Definition '(\w+)' at package level lacks a doc comment$/)) {
      const nameMatch = msg.match(/^Definition '(\w+)' at package level lacks a doc comment$/);
      if (nameMatch) {
        const defName = nameMatch[1];
        const docStub = `doc /* Description of ${defName} */\n`;
        actions.push({
          title: `Add doc comment for '${defName}'`,
          kind: 'quickfix',
          edit: { changes: { [params.textDocument.uri]: [{ range: { start: { line: start.line, character: 0 }, end: { line: start.line, character: 0 } }, newText: docStub }] } }
        });
      }
    } else if (msg.match(/^Definition '(\w+)' is declared but not used in this file$/)) {
      actions.push({
        title: 'Remove unused definition',
        kind: 'refactor',
        edit: { changes: { [params.textDocument.uri]: [{ range: { start: { line: start.line, character: 0 }, end: { line: end.line + 1, character: 0 } }, newText: '' }] } }
      });
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

const USAGE_TYPE_NAMES = new Set([
  'PartUsage', 'PortUsage', 'AttributeUsage', 'ItemUsage',
  'ConnectionUsage', 'FlowConnectionUsage', 'ActionUsage',
  'StateUsage', 'ConstraintUsage', 'RequirementUsage',
  'AllocationUsage', 'EnumerationUsage', 'OccurrenceUsage',
  'ReferenceUsage', 'MetadataUsage'
]);
const USAGE_GENERIC_LABELS: Record<string, string> = {
  PartUsage: 'Part', PortUsage: 'Port', AttributeUsage: 'Type',
  ItemUsage: 'Item', ConnectionUsage: 'Connection',
  FlowConnectionUsage: 'Flow', ActionUsage: 'Action',
  StateUsage: 'State', ConstraintUsage: 'Constraint',
  RequirementUsage: 'Requirement', AllocationUsage: 'Allocation',
  EnumerationUsage: 'Enum', OccurrenceUsage: 'Occurrence',
  ReferenceUsage: 'Reference', MetadataUsage: 'Metadata'
};

function collectInlayHints(
  ns: Namespace,
  text: string,
  scope: ReturnType<typeof buildScopeTree>,
  startLine: number,
  endLine: number,
  hints: Array<{ position: { line: number; character: number }; label: string; kind: number; paddingLeft?: boolean }>
): void {
  if (!ns.children) return;
  for (const child of ns.children) {
    if (!isOwningMembership(child) || !child.target) continue;
    const t = child.target as UsageNode;
    const nodeType = (t as { $type?: string }).$type ?? '';
    if (USAGE_TYPE_NAMES.has(nodeType)) {
      const name = (t as { declaredName?: string }).declaredName;
      if (!name) { if (isNamespace(t)) collectInlayHints(t, text, scope, startLine, endLine, hints); continue; }
      const hasExplicitType = !!getTypeReferenceName(t);
      if (!hasExplicitType) {
        const nameRange = getElementNameRange(t, text);
        if (nameRange && nameRange.end.line >= startLine && nameRange.start.line <= endLine) {
          const def = resolveToDefinition(scope, name);
          const defName = def ? ((def as { declaredName?: string }).declaredName ?? null) : null;
          const label = defName ? `: ${defName}` : `: ${USAGE_GENERIC_LABELS[nodeType] ?? 'Type'}`;
          hints.push({
            position: { line: nameRange.end.line, character: nameRange.end.character },
            label,
            kind: 1,
            paddingLeft: true
          });
        }
      }
    }
    if (isNamespace(t)) collectInlayHints(t, text, scope, startLine, endLine, hints);
  }
}

// Inlay Hints — AST-driven type hints for usages without explicit type
connection.onRequest('textDocument/inlayHint', (params: { textDocument: { uri: string }; range: { start: { line: number; character: number }; end: { line: number; character: number } } }) => {
  const entry = getIndexEntry(params.textDocument.uri);
  if (!entry) return [];
  const text = entry.text;
  const hints: Array<{ position: { line: number; character: number }; label: string; kind: number; paddingLeft?: boolean }> = [];
  const startLine = params.range.start.line;
  const endLine = params.range.end.line;

  if (entry.root) {
    try {
      const scope = buildScopeTree(entry.root);
      collectInlayHints(entry.root, text, scope, startLine, endLine, hints);
      return hints;
    } catch { /* AST traversal failed — fall through to regex fallback */ }
  }

  // Regex fallback
  const lines = text.split('\n');
  const endLineClamped = Math.min(endLine, lines.length - 1);
  for (let i = startLine; i <= endLineClamped; i++) {
    const line = lines[i];
    if (!line) continue;
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('/*')) continue;
    const attrNoType = line.match(/\battribute\s+(\w+)\s*;?\s*$/);
    if (attrNoType) {
      hints.push({ position: { line: i, character: line.length }, label: ': Type', kind: 1, paddingLeft: true });
      continue;
    }
    const usageNoType = line.match(/\b(part|port)\s+(\w+)\s*;?\s*$/);
    if (usageNoType && !line.includes(':') && !line.includes('def')) {
      const kind = usageNoType[1];
      hints.push({ position: { line: i, character: line.length }, label: `: ${kind === 'part' ? 'Part' : 'Port'}`, kind: 1, paddingLeft: true });
    }
  }
  return hints;
});

// Selection Range — walk up AST parent chain to provide expanding selections
connection.onRequest('textDocument/selectionRange', (params: { textDocument: { uri: string }; positions: Array<{ line: number; character: number }> }) => {
  const entry = getIndexEntry(params.textDocument.uri);
  if (!entry?.root) return null;
  const text = entry.text;

  function findDeepestNode(ns: unknown, line: number, character: number): unknown | null {
    let best: unknown | null = null;
    function visit(node: any): void {
      if (!node) return;
      const range = getNodeRange(node, text);
      if (range && rangeContainsPos(range, line, character)) {
        best = node;
        if (node.children) {
          for (const child of node.children) {
            if (isOwningMembership(child) && child.target) {
              visit(child.target);
            }
          }
        }
      }
    }
    visit(ns);
    return best;
  }

  function rangeContainsPos(range: { start: { line: number; character: number }; end: { line: number; character: number } }, line: number, character: number): boolean {
    if (line < range.start.line || line > range.end.line) return false;
    if (line === range.start.line && character < range.start.character) return false;
    if (line === range.end.line && character > range.end.character) return false;
    return true;
  }

  return params.positions.map(pos => {
    const deepest = findDeepestNode(entry!.root, pos.line, pos.character);
    if (!deepest) {
      const lines = text.split('\n');
      const lineLen = lines[pos.line]?.length ?? 0;
      return { range: { start: { line: pos.line, character: 0 }, end: { line: pos.line, character: lineLen } } };
    }

    type SelRange = { range: { start: { line: number; character: number }; end: { line: number; character: number } }; parent?: SelRange };
    const chain: Array<{ start: { line: number; character: number }; end: { line: number; character: number } }> = [];
    let cur: any = deepest;
    while (cur) {
      const r = getNodeRange(cur, text);
      if (r) {
        const last = chain[chain.length - 1];
        if (!last || r.start.line !== last.start.line || r.start.character !== last.start.character || r.end.line !== last.end.line || r.end.character !== last.end.character) {
          chain.push(r);
        }
      }
      cur = cur.$container;
    }

    const fullRange = getNodeRange(entry!.root, text);
    if (fullRange) {
      const last = chain[chain.length - 1];
      if (!last || fullRange.start.line !== last.start.line || fullRange.end.line !== last.end.line) {
        chain.push(fullRange);
      }
    }

    if (chain.length === 0) {
      const lines = text.split('\n');
      const lineLen = lines[pos.line]?.length ?? 0;
      return { range: { start: { line: pos.line, character: 0 }, end: { line: pos.line, character: lineLen } } };
    }

    let result: SelRange = { range: chain[chain.length - 1] };
    for (let i = chain.length - 2; i >= 0; i--) {
      result = { range: chain[i], parent: result };
    }
    return result;
  });
});

// Linked Editing Range — same-file references for in-place rename
connection.onRequest('textDocument/linkedEditingRange', (params: { textDocument: { uri: string }; position: { line: number; character: number } }) => {
  const uri = params.textDocument.uri;
  const entry = getIndexEntry(uri);
  if (!entry?.root) return null;
  const text = entry.text;
  const { line, character } = params.position;

  const node = findNodeAtPosition(entry.root, text, line, character);
  if (!node) return null;

  const def = getDefinitionAtPositionWithUri(entry.root, text, line, character, uri, indexForLookup());
  const targetNode = def ? def.node : node;
  const scope = buildScopeTree(entry.root);
  const refs = findReferencesToDefinition(entry.root, targetNode, scope);
  const nameRange = getElementNameRange(targetNode, text);

  const ranges: Array<{ start: { line: number; character: number }; end: { line: number; character: number } }> = [];
  if (nameRange) ranges.push(nameRange);

  for (const ref of refs) {
    const refRange = getElementNameRange(ref, text);
    if (refRange) {
      const dup = ranges.some(r => r.start.line === refRange.start.line && r.start.character === refRange.start.character);
      if (!dup) ranges.push(refRange);
    }
  }

  if (ranges.length <= 1) return null;
  return { ranges };
});

documents.listen(connection);
connection.listen();
