import { describe, it, expect, vi } from 'vitest';

// Mock Monaco editor
vi.mock('monaco-editor', () => ({}));

import { sysmlv2Language, sysmlv2LanguageConfig } from './tokenizer';

describe('SysMLv2 Tokenizer', () => {
  describe('Language Configuration', () => {
    it('should have valid language configuration', () => {
      expect(sysmlv2LanguageConfig).toBeDefined();
      expect(sysmlv2LanguageConfig).toHaveProperty('comments');
      expect(sysmlv2LanguageConfig).toHaveProperty('brackets');
      expect(sysmlv2LanguageConfig).toHaveProperty('indentationRules');
      expect(sysmlv2LanguageConfig).toHaveProperty('autoClosingPairs');
    });

    it('should have correct comment configuration', () => {
      expect(sysmlv2LanguageConfig.comments).toEqual({
        lineComment: '//',
        blockComment: ['/*', '*/']
      });
    });

    it('should have bracket pairs', () => {
      expect(sysmlv2LanguageConfig.brackets).toBeDefined();
      expect(sysmlv2LanguageConfig.brackets.length).toBeGreaterThan(0);
    });

    it('should have indentation rules', () => {
      expect(sysmlv2LanguageConfig.indentationRules).toBeDefined();
      expect(sysmlv2LanguageConfig.indentationRules).toHaveProperty('increaseIndentPattern');
      expect(sysmlv2LanguageConfig.indentationRules).toHaveProperty('decreaseIndentPattern');
    });
  });

  describe('Monarch Language Definition', () => {
    it('should have valid language definition', () => {
      expect(sysmlv2Language).toBeDefined();
      expect(sysmlv2Language).toHaveProperty('tokenizer');
      expect(sysmlv2Language).toHaveProperty('keywords');
      expect(sysmlv2Language).toHaveProperty('typeKeywords');
    });

    it('should have keywords defined', () => {
      expect(sysmlv2Language.keywords).toBeDefined();
      expect(Array.isArray(sysmlv2Language.keywords)).toBe(true);
      expect(sysmlv2Language.keywords.length).toBeGreaterThan(0);
    });

    it('should have type keywords defined', () => {
      expect(sysmlv2Language.typeKeywords).toBeDefined();
      expect(Array.isArray(sysmlv2Language.typeKeywords)).toBe(true);
      expect(sysmlv2Language.typeKeywords.length).toBeGreaterThan(0);
    });

    it('should include common keywords', () => {
      expect(sysmlv2Language.keywords).toContain('part');
      expect(sysmlv2Language.keywords).toContain('def');
      expect(sysmlv2Language.keywords).toContain('if');
      expect(sysmlv2Language.keywords).toContain('while');
      expect(sysmlv2Language.keywords).toContain('else');
      expect(sysmlv2Language.keywords).toContain('return');
    });

    it('should include common type keywords', () => {
      expect(sysmlv2Language.typeKeywords).toContain('Integer');
      expect(sysmlv2Language.typeKeywords).toContain('String');
      expect(sysmlv2Language.typeKeywords).toContain('Real');
      expect(sysmlv2Language.typeKeywords).toContain('Boolean');
    });

    it('should have tokenizer root state', () => {
      expect(sysmlv2Language.tokenizer).toBeDefined();
      expect(sysmlv2Language.tokenizer).toHaveProperty('root');
      expect(Array.isArray(sysmlv2Language.tokenizer.root)).toBe(true);
    });

    it('should handle operators', () => {
      expect(sysmlv2Language).toHaveProperty('operators');
      expect(Array.isArray(sysmlv2Language.operators)).toBe(true);
      // Common operators
      expect(sysmlv2Language.operators).toContain('=');
      expect(sysmlv2Language.operators).toContain('==');
      expect(sysmlv2Language.operators).toContain('::');
    });

    it('should have tokenPostfix defined', () => {
      expect(sysmlv2Language).toHaveProperty('tokenPostfix');
    });

    it('should have defaultToken defined', () => {
      expect(sysmlv2Language).toHaveProperty('defaultToken');
    });

    it('should have symbols regex defined', () => {
      expect(sysmlv2Language).toHaveProperty('symbols');
    });

    it('should have comments configuration', () => {
      expect(sysmlv2Language).toHaveProperty('comments');
      expect(sysmlv2Language.comments).toHaveProperty('lineComment');
      expect(sysmlv2Language.comments).toHaveProperty('blockComment');
    });

    it('should have brackets configuration', () => {
      expect(sysmlv2Language).toHaveProperty('brackets');
      expect(Array.isArray(sysmlv2Language.brackets)).toBe(true);
    });

    it('should have autoClosingPairs configuration', () => {
      expect(sysmlv2Language).toHaveProperty('autoClosingPairs');
      expect(Array.isArray(sysmlv2Language.autoClosingPairs)).toBe(true);
    });
  });

  describe('Token Rules', () => {
    it('should have root tokenizer rules', () => {
      const rootRules = sysmlv2Language.tokenizer.root;
      expect(rootRules.length).toBeGreaterThan(0);
    });

    it('should include string rules in root', () => {
      const rootRules = sysmlv2Language.tokenizer.root;
      // Check if there's a rule for strings
      const hasStringRule = rootRules.some((rule: any) => {
        if (Array.isArray(rule[0])) return false;
        return String(rule[0]).includes('"');
      });
      expect(hasStringRule).toBe(true);
    });

    it('should include number rules in root', () => {
      const rootRules = sysmlv2Language.tokenizer.root;
      // Check if there's a rule for numbers
      const hasNumberRule = rootRules.some((rule: any) => {
        if (Array.isArray(rule[0])) return false;
        return String(rule[0]).includes('\\d');
      });
      expect(hasNumberRule).toBe(true);
    });

    it('should include identifier rules in root', () => {
      const rootRules = sysmlv2Language.tokenizer.root;
      // Check if there's a rule for identifiers
      const hasIdentifierRule = rootRules.some((rule: any) => {
        if (Array.isArray(rule[0])) return false;
        return String(rule[0]).includes('[a-z');
      });
      expect(hasIdentifierRule).toBe(true);
    });
  });
});
