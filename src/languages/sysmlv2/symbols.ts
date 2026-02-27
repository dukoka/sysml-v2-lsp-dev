import * as monaco from 'monaco-editor';

// Symbol information
export interface SymbolInfo {
  name: string;
  kind: 'definition' | 'reference' | 'type';
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  container?: string;
}

// Build symbol index from code
export function parseSymbols(text: string): Map<string, SymbolInfo[]> {
  const symbols = new Map<string, SymbolInfo[]>();
  const lines = text.split('\n');

  // Keywords that start definitions
  const definitionKeywords = [
    'part', 'port', 'flow', 'connection', 'action', 'state',
    'def', 'type', 'enum', 'struct', 'requirement', 'constraint',
    'package', 'actor', 'behavior'
  ];

  // Type definitions (PascalCase)
  const typeKeywords = [
    'PartDef', 'PortDef', 'FlowDef', 'ItemDef', 'ActionDef', 'StateDef',
    'Requirement', 'ConstraintDef', 'Interface', 'Connection'
  ];

  lines.forEach((line, lineIndex) => {
    const lineNum = lineIndex + 1;
    
    // Skip comments
    if (line.trim().startsWith('//') || line.trim().startsWith('/*')) return;
    
    // Remove strings
    const cleanLine = line.replace(/"[^"]*"/g, '').replace(/'[^']*'/g, '');

    // Find definitions: keyword name { or keyword name : type
    const defMatch = cleanLine.match(/\b(part|port|flow|connection|action|state|def|type|enum|struct|requirement|constraint|package|actor|behavior)\s+def\s+(\w+)/);
    if (defMatch) {
      const name = defMatch[2];
      const symbol: SymbolInfo = {
        name,
        kind: 'definition',
        line: lineNum,
        column: cleanLine.indexOf(name) + 1,
        endLine: lineNum,
        endColumn: cleanLine.indexOf(name) + name.length + 1,
        container: defMatch[1]
      };
      if (!symbols.has(name)) {
        symbols.set(name, []);
      }
      symbols.get(name)!.push(symbol);
    }

    // Find type definitions: keyword TypeName {
    const typeDefMatch = cleanLine.match(/\b(part|port|action|state)?\s*def\s+([A-Z][a-zA-Z0-9_]*)\s*[{:]/);
    if (typeDefMatch) {
      const name = typeDefMatch[2];
      const symbol: SymbolInfo = {
        name,
        kind: 'type',
        line: lineNum,
        column: cleanLine.indexOf(name) + 1,
        endLine: lineNum,
        endColumn: cleanLine.indexOf(name) + name.length + 1,
        container: typeDefMatch[1] || 'type'
      };
      if (!symbols.has(name)) {
        symbols.set(name, []);
      }
      symbols.get(name)!.push(symbol);
    }

    // Find attribute definitions: attribute name or (in|out) attribute name : type
    const attrMatch = cleanLine.match(/\b(?:in|out)?\s*attribute\s+(\w+)/);
    if (attrMatch) {
      const name = attrMatch[1];
      const col = cleanLine.indexOf(name) + 1;
      const symbol: SymbolInfo = {
        name,
        kind: 'definition',
        line: lineNum,
        column: col,
        endLine: lineNum,
        endColumn: col + name.length,
        container: 'attribute'
      };
      if (!symbols.has(name)) {
        symbols.set(name, []);
      }
      symbols.get(name)!.push(symbol);
    }

    // Find part usages: part name : Type (not part def)
    const partUsageMatch = cleanLine.match(/\bpart\s+(\w+)\s*:\s*\w+/);
    if (partUsageMatch && partUsageMatch[1] !== 'def') {
      const name = partUsageMatch[1];
      const col = cleanLine.indexOf(partUsageMatch[1]) + 1;
      const symbol: SymbolInfo = {
        name,
        kind: 'definition',
        line: lineNum,
        column: col,
        endLine: lineNum,
        endColumn: col + name.length,
        container: 'part'
      };
      if (!symbols.has(name)) {
        symbols.set(name, []);
      }
      symbols.get(name)!.push(symbol);
    }

    // Find port usages: port name : Type (not port def)
    const portUsageMatch = cleanLine.match(/\bport\s+(\w+)\s*:\s*\w+/);
    if (portUsageMatch && portUsageMatch[1] !== 'def') {
      const name = portUsageMatch[1];
      const col = cleanLine.indexOf(portUsageMatch[1]) + 1;
      const symbol: SymbolInfo = {
        name,
        kind: 'definition',
        line: lineNum,
        column: col,
        endLine: lineNum,
        endColumn: col + name.length,
        container: 'port'
      };
      if (!symbols.has(name)) {
        symbols.set(name, []);
      }
      symbols.get(name)!.push(symbol);
    }

    // Find references: usage of defined symbols
    const words = cleanLine.matchAll(/\b(\w+)\b/g);
    for (const wordMatch of words) {
      const word = wordMatch[1];
      const col = wordMatch.index! + 1;
      
      // Skip keywords
      if (definitionKeywords.includes(word) || typeKeywords.includes(word)) continue;
      
      // Check if this word is referenced elsewhere as definition
      if (symbols.has(word)) {
        const existing = symbols.get(word)!;
        const isDefinition = existing.some(s => s.line === lineNum && s.kind === 'definition');
        if (!isDefinition) {
          existing.push({
            name: word,
            kind: 'reference',
            line: lineNum,
            column: col,
            endLine: lineNum,
            endColumn: col + word.length
          });
        }
      }
    }
  });

  return symbols;
}

// Find symbol at position
export function findSymbolAtPosition(
  symbols: Map<string, SymbolInfo[]>,
  line: number,
  column: number
): SymbolInfo | null {
  for (const [, infos] of symbols) {
    for (const info of infos) {
      if (info.line === line && 
          column >= info.column && 
          column <= info.endColumn) {
        return info;
      }
    }
  }
  return null;
}

// Find all references to a symbol
export function findReferences(
  symbols: Map<string, SymbolInfo[]>,
  symbolName: string
): SymbolInfo[] {
  return symbols.get(symbolName) || [];
}

// Find definition for a symbol name
export function findDefinition(
  symbols: Map<string, SymbolInfo[]>,
  symbolName: string
): SymbolInfo | null {
  const infos = symbols.get(symbolName);
  if (!infos) return null;
  return infos.find(i => i.kind === 'definition') || infos[0] || null;
}

// Find all occurrences (definitions + references) for rename
export function findAllOccurrences(
  symbols: Map<string, SymbolInfo[]>,
  symbolName: string
): SymbolInfo[] {
  return symbols.get(symbolName) || [];
}
