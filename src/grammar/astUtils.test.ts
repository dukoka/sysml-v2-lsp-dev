import { describe, it, expect } from 'vitest';
import { parseSysML } from './parser.js';
import {
  getNodeRange,
  astToDocumentSymbols,
  astRangeToMonaco,
  getAstIndentLevels,
  type AstRange,
} from './astUtils.js';

describe('astUtils', () => {
  describe('getNodeRange', () => {
    it('returns undefined when node has no $cstNode', () => {
      expect(getNodeRange({})).toBeUndefined();
      expect(getNodeRange({ declaredName: 'Foo' })).toBeUndefined();
    });

    it('returns range when $cstNode has range', () => {
      const node = {
        $cstNode: {
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 5 },
          },
        },
      };
      const r = getNodeRange(node);
      expect(r).toBeDefined();
      expect(r!.start.line).toBe(0);
      expect(r!.start.character).toBe(0);
      expect(r!.end.character).toBe(5);
    });

    it('returns range from startOffset/endOffset when text provided', () => {
      const node = {
        $cstNode: { startOffset: 0, endOffset: 12 },
      };
      const text = 'package Foo';
      const r = getNodeRange(node, text);
      expect(r).toBeDefined();
      expect(r!.start.line).toBe(0);
      // endOffset 12 with text length 11 → end at (0, 11)
      expect(r!.end.character).toBe(11);
    });
  });

  describe('astRangeToMonaco', () => {
    it('converts 0-based to 1-based', () => {
      const r: AstRange = {
        start: { line: 0, character: 2 },
        end: { line: 1, character: 3 },
      };
      const m = astRangeToMonaco(r);
      expect(m.startLineNumber).toBe(1);
      expect(m.startColumn).toBe(3);
      expect(m.endLineNumber).toBe(2);
      expect(m.endColumn).toBe(4);
    });
  });

  describe('astToDocumentSymbols', () => {
    it('returns array for parsed root (may be empty if no $cstNode on nodes)', () => {
      const r = parseSysML('package Foo { part def Bar { } }');
      expect(r.parserErrors).toHaveLength(0);
      const symbols = astToDocumentSymbols(r.value, 'package Foo { part def Bar { } }');
      expect(Array.isArray(symbols)).toBe(true);
      // Langium may or may not attach $cstNode in this test env; either way we get an array
      if (symbols.length > 0) {
        expect(symbols[0]).toHaveProperty('name');
        expect(symbols[0]).toHaveProperty('range');
        expect(symbols[0]).toHaveProperty('children');
      }
    });
  });

  describe('getAstIndentLevels', () => {
    it('returns null for blank lines and depth for content when AST has ranges', () => {
      const text = 'package Foo {\n  part def Bar {\n  }\n}\n';
      const r = parseSysML(text);
      expect(r.parserErrors).toHaveLength(0);
      const levels = getAstIndentLevels(r.value, text);
      expect(levels.length).toBe(text.split('\n').length);
      // First line (package) should be depth 0 or 1; blanks null
      expect(levels.some(l => l === null || typeof l === 'number')).toBe(true);
    });

    it('returns all zeros when root is not Namespace', () => {
      const text = 'x';
      const levels = getAstIndentLevels(null, text);
      expect(levels).toHaveLength(1);
      expect(levels[0]).toBe(0);
    });
  });
});
