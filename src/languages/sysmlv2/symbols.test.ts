import { describe, it, expect, vi } from 'vitest';

// Mock Monaco editor
vi.mock('monaco-editor', () => ({}));

import { 
  parseSymbols, 
  findSymbolAtPosition, 
  findReferences, 
  findDefinition 
} from './symbols';

describe('SysMLv2 Symbols', () => {
  describe('parseSymbols', () => {
    it('should parse part definitions', () => {
      const code = `part def Vehicle {
        part engine: Engine;
      }`;
      const symbols = parseSymbols(code);
      
      expect(symbols.has('Vehicle')).toBe(true);
      const vehicleSymbols = symbols.get('Vehicle');
      expect(vehicleSymbols?.length).toBeGreaterThan(0);
      expect(vehicleSymbols?.[0].kind).toBe('definition');
    });

    it('should parse port definitions', () => {
      const code = `port def FuelPort {
        in attribute fuelFlow: Real;
      }`;
      const symbols = parseSymbols(code);
      
      expect(symbols.has('FuelPort')).toBe(true);
    });

    it('should parse attribute definitions', () => {
      const code = `part def Engine {
        attribute horsepower: Integer;
      }`;
      const symbols = parseSymbols(code);
      
      expect(symbols.has('horsepower')).toBe(true);
      const attrSymbols = symbols.get('horsepower');
      expect(attrSymbols?.[0].kind).toBe('definition');
    });

    it('should parse multiple definitions', () => {
      const code = `part def Vehicle {
        part engine: Engine;
        part wheels: Wheel[4];
      }
      part def Engine {
        attribute horsepower: Integer;
      }
      part def Wheel {
      }`;
      const symbols = parseSymbols(code);
      
      expect(symbols.has('Vehicle')).toBe(true);
      expect(symbols.has('Engine')).toBe(true);
      expect(symbols.has('Wheel')).toBe(true);
      expect(symbols.has('horsepower')).toBe(true);
    });

    it('should parse enum definitions with def keyword', () => {
      const code = `enum def Color {
        Red,
        Green,
        Blue
      }`;
      const symbols = parseSymbols(code);
      
      expect(symbols.has('Color')).toBe(true);
    });

    it('should parse struct definitions with def keyword', () => {
      const code = `struct def Point {
        attribute x: Real;
        attribute y: Real;
      }`;
      const symbols = parseSymbols(code);
      
      expect(symbols.has('Point')).toBe(true);
    });

    it('should parse package definitions with def', () => {
      const code = `package def MyPackage {
        part def Vehicle;
      }`;
      const symbols = parseSymbols(code);
      
      expect(symbols.has('MyPackage')).toBe(true);
    });

    it('should return empty Map for empty code', () => {
      const code = '';
      const symbols = parseSymbols(code);
      
      expect(symbols.size).toBe(0);
    });

    it('should skip comments', () => {
      const code = `// This is a comment
      part def Vehicle;`;
      const symbols = parseSymbols(code);
      
      // Should not have comment content as symbol
      expect(symbols.has('This')).toBe(false);
      expect(symbols.has('comment')).toBe(false);
    });
  });

  describe('findSymbolAtPosition', () => {
    it('should find symbol at given position', () => {
      const code = `part def Vehicle {
        part engine: Engine;
      }`;
      const symbols = parseSymbols(code);
      
      // Line 1, column after "part def "
      const result = findSymbolAtPosition(symbols, 1, 10);
      
      expect(result).not.toBeNull();
      expect(result?.name).toBe('Vehicle');
    });

    it('should return null when no symbol at position', () => {
      const code = `part def Vehicle {}`;
      const symbols = parseSymbols(code);
      
      // Line 1, column 1 (start of line)
      const result = findSymbolAtPosition(symbols, 1, 1);
      
      // No symbol at column 1
      expect(result).toBeNull();
    });
  });

  describe('findReferences', () => {
    it('should find all references to a symbol', () => {
      const code = `part def Vehicle {
        part engine: Engine;
      }
      part def Engine {
      }
      part anotherPart: Vehicle;`;
      const symbols = parseSymbols(code);
      
      const vehicleRefs = findReferences(symbols, 'Vehicle');
      
      expect(vehicleRefs.length).toBeGreaterThanOrEqual(1);
    });

    it('should return empty array for unknown symbol', () => {
      const code = `part def Vehicle {}`;
      const symbols = parseSymbols(code);
      
      const unknownRefs = findReferences(symbols, 'UnknownSymbol');
      
      expect(unknownRefs).toHaveLength(0);
    });
  });

  describe('findDefinition', () => {
    it('should find definition for a symbol', () => {
      const code = `part def Vehicle {
        part engine: Engine;
      }`;
      const symbols = parseSymbols(code);
      
      const def = findDefinition(symbols, 'Vehicle');
      
      expect(def).not.toBeNull();
      expect(def?.name).toBe('Vehicle');
      expect(def?.kind).toBe('definition');
    });

    it('should return null for undefined symbol', () => {
      const code = `part def Vehicle {}`;
      const symbols = parseSymbols(code);
      
      const def = findDefinition(symbols, 'Unknown');
      
      expect(def).toBeNull();
    });
  });
});
