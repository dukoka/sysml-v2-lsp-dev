import * as monaco from 'monaco-editor';
import { 
  sysmlv2Language, 
  sysmlv2LanguageConfig 
} from './tokenizer';
import { sysmlv2CompletionProvider } from './completion';

// Language ID
export const SYSMLV2_LANGUAGE_ID = 'sysmlv2';

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

  // Register completion provider
  monaco.languages.registerCompletionItemProvider(
    SYSMLV2_LANGUAGE_ID,
    sysmlv2CompletionProvider
  );

  // Register hover provider
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
      
      // Find block comments
      let commentMatch;
      const commentRegex = /\/\*[\s\S]*?\*\//g;
      while ((commentMatch = commentRegex.exec(text)) !== null) {
        const startPos = model.getPositionAt(commentMatch.index);
        const endPos = model.getPositionAt(commentMatch.index + commentMatch[0].length);
        ranges.push({
          startLineNumber: startPos.lineNumber,
          endLineNumber: endPos.lineNumber,
          kind: monaco.languages.FoldingRangeKind.Comment
        });
      }

      // Find brace blocks
      const lines = text.split('\n');
      const stack: { line: number; kind: string }[] = [];
      
      lines.forEach((line, index) => {
        const lineNum = index + 1;
        if (line.includes('{')) {
          stack.push({ line: lineNum, kind: 'brace' });
        }
        if (line.includes('}')) {
          const lastBrace = stack.pop();
          if (lastBrace && lastBrace.kind === 'brace') {
            ranges.push({
              startLineNumber: lastBrace.line,
              endLineNumber: lineNum,
              kind: monaco.languages.FoldingRangeKind.Region
            });
          }
        }
      });

      return ranges;
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
      { token: 'delimiter', foreground: 'D4D4D4' }
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
