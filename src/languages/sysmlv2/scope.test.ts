import { describe, it, expect } from 'vitest';
import { parseSysML } from '../../grammar/parser.js';
import { buildScopeTree, getScopeAtPosition, scopeLookup } from './scope.js';

describe('scope', () => {
  it('buildScopeTree returns null for non-Namespace root', () => {
    expect(buildScopeTree(null)).toBeNull();
    expect(buildScopeTree(undefined)).toBeNull();
    expect(buildScopeTree({})).toBeNull();
  });

  it('buildScopeTree returns scope for parsed package', () => {
    const r = parseSysML('package Foo { part def Bar { } }');
    expect(r.parserErrors).toHaveLength(0);
    const root = buildScopeTree(r.value);
    expect(root).not.toBeNull();
    expect(root!.namespace).toBe(r.value);
    expect(root!.declarations.has('Foo')).toBe(true);
    expect(root!.children.length).toBeGreaterThanOrEqual(1);
    const inner = root!.children.find(c => c.declarations.has('Bar'));
    expect(inner).toBeDefined();
  });

  it('scopeLookup finds name in scope chain', () => {
    const r = parseSysML('package P { part def X { } }');
    const root = buildScopeTree(r.value);
    expect(root).not.toBeNull();
    const inner = root!.children[0];
    expect(inner?.declarations.has('X')).toBe(true);
    const found = scopeLookup(inner ?? root, 'X');
    expect(found).toBeDefined();
  });

  it('getScopeAtPosition returns scope when text and position given', () => {
    const text = 'package P { part def X { } }';
    const r = parseSysML(text);
    const root = buildScopeTree(r.value);
    expect(root).not.toBeNull();
    const scope = getScopeAtPosition(root, r.value, text, 0, 0);
    expect(scope).not.toBeNull();
  });
});
