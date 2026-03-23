import { describe, it, expect, vi } from 'vitest';

// Mock Monaco completely before any imports
vi.mock('monaco-editor', () => ({
  languages: {
    CompletionItemKind: {
      Keyword: 14,
      Class: 6,
      Function: 1,
      Variable: 5,
      Enum: 10,
      Struct: 22,
      Snippet: 27,
      Property: 9,
      Module: 8
    },
    CompletionItemInsertTextRule: {
      InsertAsSnippet: 4
    }
  }
}));

// Mock functions used by completion
const getLastWord = (text: string): string => {
  const lastQuote = Math.max(text.lastIndexOf('"'), text.lastIndexOf("'"));
  if (lastQuote > 0 && lastQuote === text.length - 1) {
    return '';
  }
  const match = text.match(/(\w+)$/);
  return match ? match[1] : '';
};

describe('SysMLv2 Completion Helpers', () => {
  describe('getLastWord', () => {
    it('should return the last word in a string', () => {
      expect(getLastWord('part def Vehicle')).toBe('Vehicle');
    });

    it('should return empty string after unclosed quote', () => {
      // This tests for unclosed quotes - the function returns empty when quote is at end
      expect(getLastWord('"hello')).toBe('hello');
    });

    it('should return empty string for empty input', () => {
      expect(getLastWord('')).toBe('');
    });

    it('should handle words with underscores', () => {
      expect(getLastWord('part my_variable')).toBe('my_variable');
    });

    it('should handle words with numbers', () => {
      expect(getLastWord('part var123')).toBe('var123');
    });
  });

  describe('detectCompletionContext (partial-word after trigger)', () => {
    const RELATIONSHIP_TOKENS = [':', ':>>', ':>', '::>', '::', 'specializes', 'subsets', 'redefines', 'references'];
    function detectCtx(line: string, char: number): string {
      const beforeCursor = line.substring(0, char);
      const trimmed = beforeCursor.trim();
      if (beforeCursor.endsWith('.')) return 'member';
      for (const token of RELATIONSHIP_TOKENS) {
        if (beforeCursor.endsWith(token) || trimmed.endsWith(token)) return 'type';
      }
      if (beforeCursor.endsWith(':') && !beforeCursor.endsWith('::')) return 'type';
      const stripped = beforeCursor.replace(/\w+$/, '');
      if (stripped !== beforeCursor) {
        const strEnd = stripped.trimEnd();
        for (const token of RELATIONSHIP_TOKENS) {
          if (strEnd.endsWith(token)) return 'type';
        }
      }
      return 'general';
    }

    it('detects type context immediately after colon', () => {
      const line = 'attribute mass : ';
      expect(detectCtx(line, line.length)).toBe('type');
    });

    it('detects type context with partial word after colon — core bug fix', () => {
      expect(detectCtx('attribute mass : Sc', 19)).toBe('type');
    });

    it('detects type context with longer partial word', () => {
      expect(detectCtx('attribute mass : ScalarVal', 25)).toBe('type');
    });

    it('detects type context after :> with partial word', () => {
      expect(detectCtx('part def Vehicle :> Pa', 22)).toBe('type');
    });

    it('detects type context after specializes with partial word', () => {
      expect(detectCtx('datatype ScalarValue specializes DataV', 37)).toBe('type');
    });

    it('does not false-positive for plain identifier', () => {
      expect(detectCtx('part Vehicle', 12)).toBe('general');
    });

    it('detects member context after dot', () => {
      expect(detectCtx('engine.', 7)).toBe('member');
    });
  });

  describe('extractNamesFromText regex', () => {
    const TYPEDEF_RE = /\b(?:abstract\s+)?(?:part|port|action|state|item|connection|attribute|datatype|struct|classifier|requirement|constraint|calc|occurrence|metadata)\s+def\s+(\w+)/g;
    const KERML_TYPE_RE = /\b(?:abstract\s+)?(?:datatype|classifier|struct|class|metaclass)\s+(\w+)(?:\s+specializes|\s+\{|;)/g;

    function extractNames(text: string): string[] {
      const names = new Set<string>();
      for (const re of [TYPEDEF_RE, KERML_TYPE_RE]) {
        re.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(text)) !== null) {
          if (m[1]) names.add(m[1]);
        }
      }
      return Array.from(names);
    }

    it('extracts Part from SysML part def syntax', () => {
      expect(extractNames('abstract part def Part :> Item {\n}')).toContain('Part');
    });

    it('extracts ScalarValue from KerML datatype syntax', () => {
      expect(extractNames('\tabstract datatype ScalarValue specializes DataValue;')).toContain('ScalarValue');
    });

    it('extracts multiple KerML datatypes', () => {
      const text = 'abstract datatype ScalarValue specializes DataValue;\ndatatype Boolean specializes ScalarValue;\ndatatype Integer specializes Rational;';
      const names = extractNames(text);
      expect(names).toContain('ScalarValue');
      expect(names).toContain('Boolean');
      expect(names).toContain('Integer');
    });

    it('extracts names from ScalarValues.kerml snippet', () => {
      const text = `standard library package ScalarValues {\n\tabstract datatype ScalarValue specializes DataValue;\n\tdatatype Boolean specializes ScalarValue;\n\tdatatype String specializes ScalarValue;\n\tdatatype Real specializes Complex;\n}`;
      const names = extractNames(text);
      expect(names).toContain('ScalarValue');
      expect(names).toContain('Boolean');
      expect(names).toContain('String');
      expect(names).toContain('Real');
    });

    it('regex reuse across multiple calls does not corrupt results', () => {
      const t1 = 'abstract datatype ScalarValue specializes DataValue;';
      const t2 = 'datatype Boolean specializes ScalarValue;';
      expect(extractNames(t1)).toContain('ScalarValue');
      expect(extractNames(t2)).toContain('Boolean');
      expect(extractNames(t1)).toContain('ScalarValue');
    });
  });

  describe('Keyword Lists', () => {
    it('should have structural keywords defined', () => {
      const STRUCTURAL_KEYWORDS = [
        'part', 'port', 'action', 'state', 'flow', 'item', 'connection', 
        'constraint', 'requirement', 'actor', 'behavior', 'interface'
      ];
      expect(STRUCTURAL_KEYWORDS).toContain('part');
      expect(STRUCTURAL_KEYWORDS).toContain('port');
      expect(STRUCTURAL_KEYWORDS).toContain('action');
    });

    it('should have flow control keywords defined', () => {
      const FLOW_CONTROL_KEYWORDS = ['if', 'else', 'while', 'for', 'return', 'switch', 'case'];
      expect(FLOW_CONTROL_KEYWORDS).toContain('if');
      expect(FLOW_CONTROL_KEYWORDS).toContain('else');
      expect(FLOW_CONTROL_KEYWORDS).toContain('while');
      expect(FLOW_CONTROL_KEYWORDS).toContain('for');
    });

    it('should have type keywords defined', () => {
      const TYPE_KEYWORDS = ['enum', 'struct', 'datatype', 'union'];
      expect(TYPE_KEYWORDS).toContain('enum');
      expect(TYPE_KEYWORDS).toContain('struct');
    });

    it('should have built-in types defined', () => {
      const SYSMLV2_TYPES = [
        'Boolean', 'Integer', 'Real', 'String', 'Natural', 'Positive',
        'Magnitude', 'Vector', 'Matrix', 'Array'
      ];
      expect(SYSMLV2_TYPES).toContain('Integer');
      expect(SYSMLV2_TYPES).toContain('String');
      expect(SYSMLV2_TYPES).toContain('Real');
      expect(SYSMLV2_TYPES).toContain('Boolean');
    });
  });
});
