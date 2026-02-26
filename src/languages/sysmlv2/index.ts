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
import { formatSysmlv2Code } from './formatter';
import { sysmlv2SemanticTokensProvider } from './semanticTokens';

// Language ID
export const SYSMLV2_LANGUAGE_ID = 'sysmlv2';

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

  // Semantic tokens (definition names, types)
  monaco.languages.registerDocumentSemanticTokensProvider(
    SYSMLV2_LANGUAGE_ID,
    sysmlv2SemanticTokensProvider
  );

  // Register completion provider
  monaco.languages.registerCompletionItemProvider(
    SYSMLV2_LANGUAGE_ID,
    sysmlv2CompletionProvider
  );

  // Register hover provider (enhanced)
  monaco.languages.registerHoverProvider(SYSMLV2_LANGUAGE_ID, {
    provideHover: (model, position) => {
      const word = model.getWordAtPosition(position);
      if (!word) return null;

      return {
        range: {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn
        },
        contents: [
          { value: `**${word.word}**` },
          { value: 'SysMLv2 identifier' }
        ]
      };
    }
  });

  // Register folding ranges provider
  monaco.languages.registerFoldingRangeProvider(SYSMLV2_LANGUAGE_ID, {
    provideFoldingRanges: (model, context, token) => {
      const text = model.getValue();
      const ranges: monaco.languages.FoldingRange[] = [];
      
      // Find multi-line block comments
      let commentMatch;
      const commentRegex = /\/\*[\s\S]*?\*\//g;
      while ((commentMatch = commentRegex.exec(text)) !== null) {
        const startPos = model.getPositionAt(commentMatch.index);
        const endPos = model.getPositionAt(commentMatch.index + commentMatch[0].length);
        if (startPos.lineNumber < endPos.lineNumber) {
          ranges.push({
            startLineNumber: startPos.lineNumber,
            endLineNumber: endPos.lineNumber,
            kind: monaco.languages.FoldingRangeKind.Comment
          });
        }
      }

      // Find brace blocks
      const lines = text.split('\n');
      const braceStack: { line: number; kind: string }[] = [];
      
      lines.forEach((line, index) => {
        const lineNum = index + 1;
        // Count braces to handle inline braces
        const openBraces = (line.match(/{/g) || []).length;
        const closeBraces = (line.match(/}/g) || []).length;
        
        if (openBraces > 0) {
          for (let i = 0; i < openBraces; i++) {
            braceStack.push({ line: lineNum, kind: 'brace' });
          }
        }
        if (closeBraces > 0) {
          for (let i = 0; i < closeBraces; i++) {
            const lastBrace = braceStack.pop();
            if (lastBrace) {
              ranges.push({
                startLineNumber: lastBrace.line,
                endLineNumber: lineNum,
                kind: monaco.languages.FoldingRangeKind.Region
              });
            }
          }
        }
      });

      // Find keyword-based blocks (part def, action, requirement, etc.)
      const keywordDefs = [
        { keyword: 'part def', indent: false },
        { keyword: 'port def', indent: false },
        { keyword: 'action def', indent: false },
        { keyword: 'state def', indent: false },
        { keyword: 'flow def', indent: false },
        { keyword: 'requirement', indent: false },
        { keyword: 'constraint', indent: false },
        { keyword: 'enum', indent: false },
        { keyword: 'struct', indent: false },
        { keyword: 'package', indent: false },
        { keyword: 'behavior', indent: false },
        { keyword: 'actor', indent: false }
      ];

      const keywordStack: { line: number; keyword: string }[] = [];
      
      lines.forEach((line, index) => {
        const lineNum = index + 1;
        const trimmed = line.trim();
        
        // Check for definition start
        for (const def of keywordDefs) {
          if (trimmed.startsWith(def.keyword) && !trimmed.startsWith('end')) {
            keywordStack.push({ line: lineNum, keyword: def.keyword });
            break;
          }
        }
        
        // Check for end keyword
        if (trimmed.startsWith('end') || trimmed.startsWith('}')) {
          const lastKeyword = keywordStack.pop();
          if (lastKeyword && lastKeyword.line < lineNum - 1) {
            ranges.push({
              startLineNumber: lastKeyword.line,
              endLineNumber: lineNum,
              kind: monaco.languages.FoldingRangeKind.Region
            });
          }
        }
      });

      return ranges;
    }
  });

  // Register definition provider (Go to Definition)
  monaco.languages.registerDefinitionProvider(SYSMLV2_LANGUAGE_ID, {
    provideDefinition: (model, position) => {
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
        // Try to find definition by name
        const def = findDefinition(symbols, word.word);
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

      // Find the definition for this symbol
      const def = findDefinition(symbols, symbolInfo.name);
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

  // Register reference provider (Find References)
  monaco.languages.registerReferenceProvider(SYSMLV2_LANGUAGE_ID, {
    provideReferences: (model, position, context) => {
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
        // Try to find references by name
        const refs = findReferences(symbols, word.word);
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

      const refs = findReferences(symbols, symbolInfo.name);
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

  // Register rename provider (Rename Symbol)
  monaco.languages.registerRenameProvider(SYSMLV2_LANGUAGE_ID, {
    provideRenameEdits: (model, position, newName) => {
      const text = model.getValue();

      const word = model.getWordAtPosition(position);
      if (!word || !word.word) return null;

      const symbolName = word.word;
      
      // Find all occurrences of the symbol in the text
      const occurrences: { line: number; column: number; endLine: number; endColumn: number }[] = [];
      const lines = text.split('\n');
      
      lines.forEach((line, lineIndex) => {
        const lineNum = lineIndex + 1;
        const regex = new RegExp(`\\b${symbolName}\\b`, 'g');
        let match;
        while ((match = regex.exec(line)) !== null) {
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

  // Register formatting provider (Document & Range)
  monaco.languages.registerDocumentFormattingEditProvider(SYSMLV2_LANGUAGE_ID, {
    provideDocumentFormattingEdits: (model, options) => {
      const text = model.getValue();
      const formatted = formatSysmlv2Code(text, options);
      return [{
        range: model.getFullModelRange(),
        text: formatted
      }];
    }
  });

  // TEST: Document Symbol Provider
  monaco.languages.registerDocumentSymbolProvider(SYSMLV2_LANGUAGE_ID, {
    provideDocumentSymbols: (model, token) => {
      const symbols: monaco.languages.DocumentSymbol[] = [];
      const text = model.getValue();
      if (!text) return symbols;
      
      const lines = text.split('\n');
      const symbolKinds: Record<string, monaco.languages.SymbolKind> = {
        'part def': monaco.languages.SymbolKind.Class,
        'port def': monaco.languages.SymbolKind.Interface,
        'action': monaco.languages.SymbolKind.Function,
        'state def': monaco.languages.SymbolKind.Object,
        'requirement': monaco.languages.SymbolKind.Interface,
        'enum': monaco.languages.SymbolKind.Enum,
        'struct': monaco.languages.SymbolKind.Struct,
        'package': monaco.languages.SymbolKind.Package
      };
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        if (!trimmed) continue;
        
        for (const [keyword, kind] of Object.entries(symbolKinds)) {
          if (trimmed.startsWith(keyword)) {
            const match = trimmed.match(/\b(\w+)/);
            if (match && match[1]) {
              symbols.push({
                name: match[1],
                kind: kind,
                range: {
                  startLineNumber: i + 1,
                  startColumn: 1,
                  endLineNumber: i + 1,
                  endColumn: Math.max(1, line.length + 1)
                },
                selectionRange: {
                  startLineNumber: i + 1,
                  startColumn: 1,
                  endLineNumber: i + 1,
                  endColumn: Math.max(1, line.length + 1)
                }
              });
            }
          }
        }
      }
      return symbols;
    }
  });

  // TEST: Signature Help Provider
  monaco.languages.registerSignatureHelpProvider(SYSMLV2_LANGUAGE_ID, {
    provideSignatureHelp: (model, position, token, context) => {
      const line = model.getLineContent(position.lineNumber);
      const beforeCursor = line.substring(0, position.column - 1);
      
      // Only trigger after opening parenthesis
      if (!beforeCursor.includes('(')) return null;
      
      const signatures: monaco.languages.SignatureInformation[] = [
        {
          label: 'println(value: String): void',
          documentation: 'Print a value to the console',
          parameters: [{
            label: 'value',
            documentation: 'The value to print'
          }]
        }
      ];
      
      return {
        signatures: signatures,
        activeSignature: 0,
        activeParameter: 0
      };
    },
    signatureHelpTriggerCharacters: ['(']
  });

  // TEST: Code Action Provider
  monaco.languages.registerCodeActionProvider(SYSMLV2_LANGUAGE_ID, {
    provideCodeActions: (model, range, context, token) => {
      const actions: monaco.languages.CodeAction[] = [];
      return {
        actions: actions,
        dispose: () => {}
      };
    }
  });

  // TEST: Selection Range Provider
  monaco.languages.registerSelectionRangeProvider(SYSMLV2_LANGUAGE_ID, {
    provideSelectionRanges: (model, positions, token) => {
      if (!positions || positions.length === 0) {
        return [];
      }
      
      const text = model.getValue();
      if (!text) {
        return [];
      }
      
      const lines = text.split('\n');
      const position = positions[0];
      if (!position || position.lineNumber <= 0) {
        return [];
      }
      
      const lineNum = position.lineNumber;
      const line = lines[lineNum - 1] || '';
      
      const ranges: monaco.languages.SelectionRange[] = [];
      
      // Basic word selection
      const word = model.getWordAtPosition(position);
      if (word && word.word) {
        ranges.push({
          range: {
            startLineNumber: lineNum,
            startColumn: word.startColumn,
            endLineNumber: lineNum,
            endColumn: word.endColumn
          }
        });
      }
      
      // Line selection
      if (line.length > 0) {
        ranges.push({
          range: {
            startLineNumber: lineNum,
            startColumn: 1,
            endLineNumber: lineNum,
            endColumn: line.length + 1
          }
        });
      }
      
      // Full document
      ranges.push(model.getFullModelRange());
      
      return ranges;
    }
  });

  // TEST: Document Range Formatting Provider
  monaco.languages.registerDocumentRangeFormattingEditProvider(SYSMLV2_LANGUAGE_ID, {
    provideDocumentRangeFormattingEdits: (model, range, options) => {
      const text = model.getValue();
      const formatted = formatSysmlv2Code(text, options);
      return [{
        range: range,
        text: formatted
      }];
    }
  });

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
