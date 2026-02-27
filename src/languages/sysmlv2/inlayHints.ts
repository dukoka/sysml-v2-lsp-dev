/**
 * SysMLv2 Inlay Hints - type hints for declarations without explicit type.
 */
import * as monaco from 'monaco-editor';

const InlayHintKindType = monaco.languages.InlayHintKind?.Type ?? 1;

export const sysmlv2InlayHintsProvider: monaco.languages.InlayHintsProvider = {
  provideInlayHints: (model, range, token) => {
    try {
      if (token?.isCancellationRequested) return { hints: [] };

      const hints: monaco.languages.InlayHint[] = [];

      for (let lineNum = range.startLineNumber; lineNum <= range.endLineNumber; lineNum++) {
        const line = model.getLineContent(lineNum);
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('/*')) continue;

        // attribute name without type - suggest : Type (only when line ends with attribute name)
        const attrNoType = line.match(/\battribute\s+(\w+)\s*;?\s*$/);
        if (attrNoType && attrNoType.index !== undefined) {
          const insertCol = line.length + 1;
          hints.push({
            kind: InlayHintKindType,
            position: { lineNumber: lineNum, column: insertCol },
            label: ': Type',
            paddingLeft: true
          });
        }
      }

      return { hints };
    } catch {
      return { hints: [] };
    }
  }
};
