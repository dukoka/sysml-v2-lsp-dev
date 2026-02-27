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
import { getDefinitionAtPosition, findReferencesToDefinition, findNodeAtPosition } from './references.js';

// Language ID
export const SYSMLV2_LANGUAGE_ID = 'sysmlv2';

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

  // Semantic tokens (definition names, types)
  monaco.languages.registerDocumentSemanticTokensProvider(
    SYSMLV2_LANGUAGE_ID,
    sysmlv2SemanticTokensProvider
  );

  // Inlay hints: currently disabled due to instability with Monaco's InlayHints lifecycle.
  // The provider implementation is kept in `inlayHints.ts` for future use, but not registered here.

  // Register completion provider
  monaco.languages.registerCompletionItemProvider(
    SYSMLV2_LANGUAGE_ID,
    sysmlv2CompletionProvider
  );

  // Hover provider - AST node info when parse succeeds, else symbols
  monaco.languages.registerHoverProvider(SYSMLV2_LANGUAGE_ID, {
    provideHover: (model, position) => {
      const word = model.getWordAtPosition(position);
      if (!word) return null;
      const text = model.getValue();
      const line = position.lineNumber - 1;
      const character = position.column - 1;
      try {
        const parseResult = parseSysML(text);
        if (parseResult.parserErrors.length === 0 && parseResult.lexerErrors.length === 0 && parseResult.value) {
          const node = findNodeAtPosition(parseResult.value, text, line, character);
          if (node) {
            const typeName = (node as { $type?: string }).$type ?? 'Element';
            const name = (node as { declaredName?: string }).declaredName ?? (node as { declaredShortName?: string }).declaredShortName ?? word.word;
            const detail = `${typeName}${name ? ` **${name}**` : ''}`;
            return {
              range: {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: word.startColumn,
                endColumn: word.endColumn
              },
              contents: [
                { value: `**${word.word}**` },
                { value: detail }
              ]
            };
          }
        }
      } catch {
        // fall through
      }
      const symbols = parseSymbols(text);
      const symbolInfo = findSymbolAtPosition(symbols, position.lineNumber, position.column);
      let detail = 'SysMLv2 identifier';
      if (symbolInfo) {
        if (symbolInfo.kind === 'definition') {
          const container = symbolInfo.container ?? 'element';
          detail = `${container.charAt(0).toUpperCase() + container.slice(1)} definition`;
        } else if (symbolInfo.kind === 'reference') {
          const def = findDefinition(symbols, symbolInfo.name);
          detail = def ? `Reference to ${def.container ?? 'definition'}` : 'Reference';
        } else if (symbolInfo.kind === 'type') {
          detail = 'Type';
        }
      }
      return {
        range: {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn
        },
        contents: [
          { value: `**${word.word}**` },
          { value: detail }
        ]
      };
    }
  });

  // Register folding ranges provider (AST when parse succeeds, else brace+keyword)
  monaco.languages.registerFoldingRangeProvider(SYSMLV2_LANGUAGE_ID, {
    provideFoldingRanges: (model, context, token) => {
      const text = model.getValue();
      const ranges: monaco.languages.FoldingRange[] = [];
      try {
        const parseResult = parseSysML(text);
        if (parseResult.parserErrors.length === 0 && parseResult.lexerErrors.length === 0 && parseResult.value && isNamespace(parseResult.value)) {
          function collectFromNs(ns: { children?: Array<{ target?: unknown }> }): void {
            if (!ns.children) return;
            for (const child of ns.children) {
              const t = child.target;
              if (t && typeof t === 'object' && isNamespace(t)) {
                const r = getNodeRange(t, text);
                if (r && r.end.line > r.start.line) {
                  ranges.push({
                    startLineNumber: r.start.line + 1,
                    endLineNumber: r.end.line + 1,
                    kind: monaco.languages.FoldingRangeKind.Region
                  });
                }
                collectFromNs(t);
              }
            }
          }
          collectFromNs(parseResult.value);
        }
      } catch {
        // fall through
      }
      if (ranges.length > 0) {
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
        return ranges;
      }

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

  // Register definition provider (Go to Definition) - AST+scope when parse succeeds
  monaco.languages.registerDefinitionProvider(SYSMLV2_LANGUAGE_ID, {
    provideDefinition: (model, position) => {
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

  // Register reference provider (Find References) - AST+scope when parse succeeds
  monaco.languages.registerReferenceProvider(SYSMLV2_LANGUAGE_ID, {
    provideReferences: (model, position, context) => {
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
      if (!word) return null;
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

  // Register rename provider (Rename Symbol) - AST+scope when parse succeeds
  monaco.languages.registerRenameProvider(SYSMLV2_LANGUAGE_ID, {
    provideRenameEdits: (model, position, newName) => {
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

  // Register formatting provider (Document & Range) - AST-aware when parse succeeds
  monaco.languages.registerDocumentFormattingEditProvider(SYSMLV2_LANGUAGE_ID, {
    provideDocumentFormattingEdits: (model, options) => {
      const text = model.getValue();
      const parseResult = parseSysML(text);
      const root =
        parseResult.parserErrors.length === 0 &&
        parseResult.lexerErrors.length === 0 &&
        parseResult.value &&
        isNamespace(parseResult.value)
          ? parseResult.value
          : undefined;
      const formatted = formatSysmlv2Code(text, options, root);
      return [{
        range: model.getFullModelRange(),
        text: formatted
      }];
    }
  });

  // Document Symbol Provider (uses parseSymbols - definitions + part/port usages)
  monaco.languages.registerDocumentSymbolProvider(SYSMLV2_LANGUAGE_ID, {
    provideDocumentSymbols: (model, token) => {
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
    provideSignatureHelp: (model, position, token, context) => {
      const line = model.getLineContent(position.lineNumber);
      const beforeCursor = line.substring(0, position.column - 1);
      const lastOpen = beforeCursor.lastIndexOf('(');
      if (lastOpen < 0) return null;

      const afterOpen = beforeCursor.substring(lastOpen + 1);
      const commaCount = (afterOpen.match(/,/g) || []).length;
      const activeParameter = commaCount;

      const beforeParen = beforeCursor.substring(0, lastOpen);
      const fnMatch = beforeParen.match(/\b(println|print|assert|toInteger|toReal|size|empty)\s*$/);
      const fnName = fnMatch ? fnMatch[1] : 'println';
      const sig = BUILTIN_SIGNATURES[fnName] ?? BUILTIN_SIGNATURES.println;

      return {
        signatures: [sig],
        activeSignature: 0,
        activeParameter
      };
    },
    signatureHelpTriggerCharacters: ['(', ',']
  });

  // Code Action Provider - quick fixes for diagnostics
  monaco.languages.registerCodeActionProvider(SYSMLV2_LANGUAGE_ID, {
    provideCodeActions: (model, range, context, token) => {
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
            ...(monaco.languages.CodeActionKind?.QuickFix && { kind: monaco.languages.CodeActionKind.QuickFix }),
            edit: {
              edits: [{
                resource: model.uri,
                edit: { range: new monaco.Range(startLineNumber, insertCol, startLineNumber, insertCol), text: ';' }
              }]
            }
          });
        } else if (message.startsWith("Unknown keyword '") && message.includes("'. Did you mean '")) {
          const match = message.match(/Unknown keyword '(\w+)'\. Did you mean '(\w+)'\?/);
          if (match) {
            const [, , correct] = match;
            actions.push({
              title: `Replace with '${correct}'`,
              ...(monaco.languages.CodeActionKind?.QuickFix && { kind: monaco.languages.CodeActionKind.QuickFix }),
              edit: {
                edits: [{
                  resource: model.uri,
                  edit: { range: new monaco.Range(startLineNumber, startColumn, endLineNumber, endColumn), text: correct! }
                }]
              }
            });
          }
        } else if (message === "Expected a token. Did you forget ';'?") {
          const lineContent = model.getLineContent(startLineNumber);
          const insertCol = lineContent.length + 1;
          actions.push({
            title: "Insert ;",
            ...(monaco.languages.CodeActionKind?.QuickFix && { kind: monaco.languages.CodeActionKind.QuickFix }),
            edit: {
              edits: [{
                resource: model.uri,
                edit: { range: new monaco.Range(startLineNumber, insertCol, startLineNumber, insertCol), text: ';' }
              }]
            }
          });
        } else if (message === 'Redundant semicolons') {
          const text = model.getValueInRange(editRange);
          const fixed = text.replace(/;+$/, ';');
          if (fixed !== text) {
            actions.push({
              title: 'Remove redundant semicolons',
              ...(monaco.languages.CodeActionKind?.QuickFix && { kind: monaco.languages.CodeActionKind.QuickFix }),
              edit: {
                edits: [{
                  resource: model.uri,
                  edit: { range: new monaco.Range(startLineNumber, startColumn, endLineNumber, endColumn), text: fixed }
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
              ...(monaco.languages.CodeActionKind?.QuickFix && { kind: monaco.languages.CodeActionKind.QuickFix }),
              edit: {
                edits: [{
                  resource: model.uri,
                  edit: { range: new monaco.Range(insertLine, insertCol, insertLine, insertCol), text: stub }
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
                ...(monaco.languages.CodeActionKind?.QuickFix && { kind: monaco.languages.CodeActionKind.QuickFix }),
                command: {
                  id: 'sysml.goToFirstDefinition',
                  title: 'Go to first definition',
                  arguments: [first.lineNumber, first.column]
                }
              });
            } else {
              actions.push({
                title: 'Go to first definition (see outline)',
                ...(monaco.languages.CodeActionKind?.QuickFix && { kind: monaco.languages.CodeActionKind.QuickFix })
              });
            }
          }
        }
      }

      return { actions, dispose: () => {} };
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

  // Document Range Formatting Provider - formats only the range (brace-depth; AST used for full-doc only)
  monaco.languages.registerDocumentRangeFormattingEditProvider(SYSMLV2_LANGUAGE_ID, {
    provideDocumentRangeFormattingEdits: (model, range, options) => {
      const rangeText = model.getValueInRange(range);
      const formatted = formatSysmlv2Code(rangeText, options);
      return [{ range, text: formatted }];
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
