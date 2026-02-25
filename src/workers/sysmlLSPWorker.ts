// SysMLv2 Language Server Web Worker
// This worker handles LSP requests in a background thread

// Import types (will be handled by TypeScript during build)
/// <reference lib="webworker" />

interface LSPMessage {
  jsonrpc: string;
  id?: number | string;
  method?: string;
  params?: any;
}

interface LSPResponse {
  jsonrpc: string;
  id?: number | string;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

// Simple document state
interface DocumentState {
  uri: string;
  content: string;
  version: number;
}

// Document store
const documents = new Map<string, DocumentState>();

// Handle all messages: init (optional) or JSON-RPC request/notification
self.onmessage = (event: MessageEvent) => {
  const data = event.data;

  // Optional init for config (e.g. documentUri); no response
  if (data && data.type === 'init') {
    return;
  }

  // LSP JSON-RPC: method + optional id (request) or notification
  if (data && typeof data.method === 'string') {
    const response = handleRequest(data as LSPMessage);
    // Only send response for requests (with id); notifications have id undefined
    if (response.id !== undefined) {
      self.postMessage(response);
    }
  }
};

// SysMLv2 keywords (aligned with validator.ts)
const SYSMLV2_KEYWORDS = [
  'import', 'package', 'library', 'alias',
  'def', 'definition', 'abstract', 'specialization',
  'part', 'port', 'flow', 'connection', 'item',
  'action', 'state', 'transition', 'event',
  'type', 'enum', 'struct', 'datatype',
  'actor', 'behavior', 'constraint',
  'requirement', 'assumption', 'verification',
  'generalization', 'reduction', 'feature',
  'end', 'binding', 'succession', 'participation',
  'if', 'else', 'while', 'for', 'return',
  'true', 'false', 'null',
  'public', 'private', 'protected', 'readonly',
  'owned', 'exhibits', 'subject', 'comment',
  'metadata', 'snapshot', 'stage',
  'attribute', 'in', 'out'
];

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

// Validation logic
const validateDocument = (doc: DocumentState): any[] => {
  const markers: any[] = [];
  const lines = doc.content.split('\n');
  const userDefinedTypes = extractUserDefinedTypes(doc.content);

  lines.forEach((line, lineIndex) => {
    const lineNum = lineIndex + 1;
    const trimmedLine = line.trim();

    // Skip empty lines
    if (trimmedLine === '') return;
    if (trimmedLine.startsWith('//') || trimmedLine.startsWith('/*')) return;
    if (trimmedLine === '{' || trimmedLine === '}') return;
    if (trimmedLine.startsWith('end')) return;
    if (trimmedLine.endsWith('{')) return;

    // Missing semicolon
    const needsSemicolon =
      /^\s*(attribute|part|port|reference)\s+\w+/.test(trimmedLine) ||
      /^\s*\w+\s*[=:]/.test(trimmedLine) ||
      /^\s*(println|print|assert)\s*\(/.test(trimmedLine);
    const looksLikeStatement =
      /^\s*\w+\s*\(/.test(trimmedLine) ||
      /^\s*\w+\s*[=+\-*/]/.test(trimmedLine) ||
      /^\s*\w+\s*:\s*\w+/.test(trimmedLine);
    const hasValidEnding =
      trimmedLine.endsWith(';') || trimmedLine.endsWith(',') ||
      trimmedLine.endsWith('{') || trimmedLine.endsWith('}');
    if ((needsSemicolon || looksLikeStatement) && !hasValidEnding) {
      const firstWord = trimmedLine.split(/\s+/)[0];
      if (SYSMLV2_KEYWORDS.includes(firstWord)) {
        markers.push({
          severity: 4,
          message: 'Missing semicolon',
          startLine: lineNum,
          startColumn: line.length,
          endLine: lineNum,
          endColumn: line.length + 1
        });
      }
    }

    // Unknown identifiers (standalone word on line)
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
          markers.push({
            severity: 8,
            message: `Unknown keyword '${word}'. Did you mean '${similar}'?`,
            startLine: lineNum,
            startColumn: startCol,
            endLine: lineNum,
            endColumn: startCol + word.length
          });
        } else if (trimmedLine === word) {
          markers.push({
            severity: 8,
            message: `Expected a token. Did you forget ';'?`,
            startLine: lineNum,
            startColumn: startCol,
            endLine: lineNum,
            endColumn: startCol + word.length
          });
        }
      }
    }

    // Check for unclosed strings
    let inString = false;
    let stringChar = '';
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (!inString && (char === '"' || char === "'")) {
        inString = true;
        stringChar = char;
      } else if (inString && char === stringChar && line[i - 1] !== '\\') {
        inString = false;
      }
    }
    if (inString) {
      markers.push({
        severity: 8, // Error
        message: 'Unclosed string literal',
        startLine: lineNum,
        startColumn: 1,
        endLine: lineNum,
        endColumn: line.length + 1
      });
    }

    // Check for unclosed comments
    if (line.includes('/*') && !line.includes('*/') && !line.includes('//')) {
      const commentStart = line.indexOf('/*');
      markers.push({
        severity: 4, // Warning
        message: 'Potentially unclosed block comment',
        startLine: lineNum,
        startColumn: commentStart + 1,
        endLine: lineNum,
        endColumn: line.length
      });
    }

    // Invalid identifier: cannot start with number
    let badIdM;
    const badIdRegex = /\b(\d+[a-zA-Z_][a-zA-Z0-9_]*)\b/g;
    while ((badIdM = badIdRegex.exec(line)) !== null) {
      markers.push({
        severity: 8,
        message: 'Invalid identifier: cannot start with a number',
        startLine: lineNum,
        startColumn: badIdM.index + 1,
        endLine: lineNum,
        endColumn: badIdM.index + badIdM[0].length + 1
      });
    }

    // Malformed definition: "part def {" or "part def" at end without name
    if (/^\s*(part|port|action|state|flow|item|connection|constraint|actor|behavior)\s+def\s*\{\s*$/i.test(trimmedLine)) {
      markers.push({
        severity: 8,
        message: 'Definition missing name before opening brace',
        startLine: lineNum,
        startColumn: 1,
        endLine: lineNum,
        endColumn: trimmedLine.length + 1
      });
    }
    if (/^\s*(part|port|action|state|flow|item|connection|constraint|actor|behavior)\s+def\s*$/.test(trimmedLine)) {
      markers.push({
        severity: 8,
        message: 'Definition missing name and body',
        startLine: lineNum,
        startColumn: 1,
        endLine: lineNum,
        endColumn: trimmedLine.length + 1
      });
    }

    // Double semicolon
    let semiM;
    const semiRegex = /;;+/g;
    while ((semiM = semiRegex.exec(line)) !== null) {
      markers.push({
        severity: 4,
        message: 'Redundant semicolons',
        startLine: lineNum,
        startColumn: semiM.index + 1,
        endLine: lineNum,
        endColumn: semiM.index + semiM[0].length + 1
      });
    }

    // Standalone "def" without structural keyword
    if (/^\s*def\s+\w+/i.test(trimmedLine) && !/^\s*(part|port|action|state|flow|item|connection|constraint|actor|behavior)\s+def/i.test(trimmedLine)) {
      const defMatch = line.match(/\bdef\b/i);
      if (defMatch && defMatch.index !== undefined) {
        markers.push({
          severity: 8,
          message: "'def' must follow a structural keyword (part, port, action, etc.)",
          startLine: lineNum,
          startColumn: defMatch.index + 1,
          endLine: lineNum,
          endColumn: defMatch.index + 4
        });
      }
    }
  });

  // Duplicate definition names
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
        markers.push({
          severity: 4,
          message: `Duplicate definition '${name}' (also at line ${lineNums.filter((l) => l !== ln).join(', ')})`,
          startLine: ln,
          startColumn: col,
          endLine: ln,
          endColumn: col + name.length
        });
      });
    }
  });

  // Check for unmatched braces
  const openBraces = (doc.content.match(/{/g) || []).length;
  const closeBraces = (doc.content.match(/}/g) || []).length;
  if (openBraces !== closeBraces) {
    markers.push({
      severity: 8,
      message: `Unmatched braces: ${openBraces} open, ${closeBraces} close`,
      startLine: 1,
      startColumn: 1,
      endLine: lines.length,
      endColumn: 1
    });
  }

  return markers;
};

// Handle LSP requests
const handleRequest = (message: LSPMessage): LSPResponse => {
  const { method, params, id } = message;

  try {
    switch (method) {
      case 'initialize': {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            capabilities: {
              textDocumentSync: 1, // Full document sync
              completionProvider: {
                triggerCharacters: ['.', ':', '(', '['],
                resolveProvider: false
              },
              hoverProvider: true,
              foldingRangeProvider: true,
              diagnosticProvider: {
                interFileDependencies: false,
                workspaceDiagnostics: false
              }
            },
            serverInfo: {
              name: 'SysMLv2 LSP',
              version: '1.0.0'
            }
          }
        };
      }

      case 'initialized': {
        return {
          jsonrpc: '2.0',
          id: undefined
        };
      }

      case 'textDocument/didOpen': {
        const { textDocument } = params;
        documents.set(textDocument.uri, {
          uri: textDocument.uri,
          content: textDocument.text,
          version: textDocument.version
        });
        return {
          jsonrpc: '2.0',
          id: undefined
        };
      }

      case 'textDocument/didChange': {
        const { textDocument, contentChanges } = params;
        const doc = documents.get(textDocument.uri);
        if (doc) {
          doc.content = contentChanges[0].text;
          doc.version = textDocument.version;
        }
        return {
          jsonrpc: '2.0',
          id: undefined
        };
      }

      case 'textDocument/didClose': {
        const { textDocument } = params;
        documents.delete(textDocument.uri);
        return {
          jsonrpc: '2.0',
          id: undefined
        };
      }

      case 'textDocument/hover': {
        const { textDocument, position } = params;
        const doc = documents.get(textDocument.uri);
        if (!doc) {
          return {
            jsonrpc: '2.0',
            id,
            result: null
          };
        }

        const lines = doc.content.split('\n');
        const line = lines[position.line] || '';
        const wordMatch = line.match(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/);
        
        if (wordMatch) {
          const word = wordMatch[0];
          return {
            jsonrpc: '2.0',
            id,
            result: {
              contents: {
                kind: 'markdown',
                value: `**${word}**\n\nSysMLv2 identifier`
              }
            }
          };
        }

        return {
          jsonrpc: '2.0',
          id,
          result: null
        };
      }

      case 'textDocument/completion': {
        const { textDocument, position } = params;
        const doc = documents.get(textDocument.uri);
        if (!doc) {
          return {
            jsonrpc: '2.0',
            id,
            result: { isIncomplete: false, items: [] }
          };
        }

        // Basic completion suggestions
        const keywords = [
          'package', 'import', 'part', 'port', 'flow', 'connection',
          'action', 'state', 'transition', 'requirement', 'constraint',
          'def', 'definition', 'type', 'enum', 'struct', 'actor', 'behavior',
          'public', 'private', 'protected', 'true', 'false', 'null'
        ];

        const types = [
          'Boolean', 'Integer', 'Real', 'String', 'Natural', 'Positive',
          'PartDef', 'PortDef', 'FlowDef', 'ItemDef', 'ActionDef', 'StateDef',
          'Requirement', 'Element', 'Feature', 'Type', 'Classifier'
        ];

        const items = [
          ...keywords.map(k => ({
            label: k,
            kind: 14, // Keyword
            detail: 'keyword'
          })),
          ...types.map(t => ({
            label: t,
            kind: 7, // Class
            detail: 'type'
          }))
        ];

        return {
          jsonrpc: '2.0',
          id,
          result: {
            isIncomplete: false,
            items
          }
        };
      }

      case 'textDocument/diagnostic': {
        const { textDocument } = params;
        const doc = documents.get(textDocument.uri);
        if (!doc) {
          return {
            jsonrpc: '2.0',
            id,
            result: { items: [] }
          };
        }

        const markers = validateDocument(doc);
        return {
          jsonrpc: '2.0',
          id,
          result: {
            items: markers.map(m => ({
              range: {
                startLine: m.startLine,
                startColumn: m.startColumn,
                endLine: m.endLine,
                endColumn: m.endColumn
              },
              severity: m.severity,
              message: m.message
            }))
          }
        };
      }

      default:
        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32601, // Method not found
            message: `Method not found: ${method}`
          }
        };
    }
  } catch (error: any) {
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: -32603, // Internal error
        message: error.message || 'Internal error'
      }
    };
  }
};

// Export for worker
export {};
