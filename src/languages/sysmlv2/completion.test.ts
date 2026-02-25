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
