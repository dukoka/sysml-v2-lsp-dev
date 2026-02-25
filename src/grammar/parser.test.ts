import { describe, it, expect } from 'vitest';
import { parseSysML, parseResultToDiagnostics } from './parser.js';

describe('parseSysML', () => {
  it('parses valid package', () => {
    const r = parseSysML('package Foo { }');
    expect(r.parserErrors).toHaveLength(0);
    expect(r.lexerErrors).toHaveLength(0);
    expect(r.value).toBeDefined();
    expect((r.value as { elements?: unknown[] }).elements).toBeDefined();
  });

  it('parses part def', () => {
    const r = parseSysML('part def Bar { }');
    expect(r.parserErrors).toHaveLength(0);
    expect(r.value).toBeDefined();
  });

  it('parses attribute', () => {
    const r = parseSysML('package P { attribute x : Integer; }');
    expect(r.parserErrors).toHaveLength(0);
    expect(r.value).toBeDefined();
  });

  it('reports parser errors for invalid syntax', () => {
    const r = parseSysML('package {');
    expect(r.parserErrors.length).toBeGreaterThan(0);
  });

  it('parseResultToDiagnostics converts errors', () => {
    const r = parseSysML('package {');
    const diags = parseResultToDiagnostics(r);
    expect(diags.length).toBeGreaterThan(0);
    expect(diags[0]).toHaveProperty('message');
    expect(diags[0]).toHaveProperty('range');
    expect(diags[0].range.start).toHaveProperty('line');
    expect(diags[0].range.start).toHaveProperty('character');
  });
});
