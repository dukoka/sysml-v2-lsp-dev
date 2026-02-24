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

// Request counter
let requestId = 0;

// Response handler
let responseHandler: ((response: LSPResponse) => void) | null = null;

// Initialize response handler
self.onmessage = (event: MessageEvent) => {
  const { type, handler } = event.data;
  
  if (type === 'init' && handler) {
    responseHandler = handler;
  }
};

// Send response back to main thread
const sendResponse = (response: LSPResponse) => {
  if (responseHandler) {
    responseHandler(response);
  }
};

// Validation logic
const validateDocument = (doc: DocumentState): any[] => {
  const markers: any[] = [];
  const lines = doc.content.split('\n');

  lines.forEach((line, lineIndex) => {
    const lineNum = lineIndex + 1;
    
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
