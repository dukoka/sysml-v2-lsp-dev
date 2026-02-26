import { describe, it, expect } from 'vitest';
import { parseSysML } from './parser.js';
import { extractAstSymbols } from './astSymbols.js';

describe('extractAstSymbols', () => {
  it('extracts package and part def from valid model', () => {
    const r = parseSysML('package Foo { part def Bar { } }');
    expect(r.parserErrors).toHaveLength(0);
    const sym = extractAstSymbols(r.value);
    expect(sym.packages).toContain('Foo');
    expect(sym.partDefs).toContain('Bar');
    expect(sym.typeNames).toContain('Bar');
  });

  it('extracts symbols from model with part/port usage', () => {
    const r = parseSysML(`package VehicleExample {
      part def Vehicle {
        part engine: Engine;
        part wheels: Wheel[4];
        port fuelIn: FuelPort;
      }
      part def Engine { }
      port def FuelPort { in attribute fuelFlow: Real; }
    }`);
    expect(r.parserErrors).toHaveLength(0);
    const sym = extractAstSymbols(r.value);
    expect(sym.packages).toContain('VehicleExample');
    expect(sym.partDefs).toContain('Vehicle');
    expect(sym.partDefs).toContain('Engine');
    expect(sym.portDefs).toContain('FuelPort');
    expect(sym.attributeNames).toContain('fuelFlow');
    expect(sym.typeNames).toContain('Engine');
    expect(sym.typeNames).toContain('FuelPort');
  });

  it('extracts port def and attribute', () => {
    const r = parseSysML('package P { port def FuelPort { in attribute fuelFlow: Real; } }');
    expect(r.parserErrors).toHaveLength(0);
    const sym = extractAstSymbols(r.value);
    expect(sym.portDefs).toContain('FuelPort');
    expect(sym.attributeNames).toContain('fuelFlow');
    expect(sym.typeNames).toContain('FuelPort');
    expect(sym.typeNames).toContain('Real');
  });

  it('includes built-in types in typeNames', () => {
    const r = parseSysML('package P { }');
    const sym = extractAstSymbols(r.value);
    expect(sym.typeNames).toContain('Integer');
    expect(sym.typeNames).toContain('Boolean');
  });

  it('returns empty when parse fails', () => {
    const sym = extractAstSymbols(null);
    expect(sym.packages).toHaveLength(0);
    expect(sym.partDefs).toHaveLength(0);
    expect(sym.typeNames).toHaveLength(13); // BUILTIN_TYPES only
  });
});
