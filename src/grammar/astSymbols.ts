/**
 * AST symbol extraction for completion - collects Package, PartDef, PortDef, AttributeDef from Langium AST.
 */
import type { Model, Package, PartDef, PortDef, PartUsage, PortUsage, AttributeDef, ModelElement, Member } from './generated/ast.js';
import { isPackage, isPartDef, isPortDef, isPartUsage, isPortUsage, isAttributeDef } from './generated/ast.js';

export interface AstSymbols {
  packages: string[];
  partDefs: string[];
  portDefs: string[];
  attributeNames: string[];
  typeNames: string[];
}

const BUILTIN_TYPES = [
  'Boolean', 'Integer', 'Real', 'String', 'Natural', 'Positive',
  'Magnitude', 'Vector', 'Matrix', 'Array', 'Element', 'Feature', 'Type'
];

function collectFromModel(root: Model, symbols: AstSymbols): void {
  if (!root?.elements) return;
  for (const el of root.elements) {
    collectFromElement(el, symbols);
  }
}

function collectFromElement(el: ModelElement, symbols: AstSymbols): void {
  if (isPackage(el)) {
    if (el.name) symbols.packages.push(el.name);
    if (el.elements) {
      for (const child of el.elements) collectFromElement(child, symbols);
    }
  } else if (isPartDef(el)) {
    if (el.name) symbols.partDefs.push(el.name);
    if (el.members) {
      for (const m of el.members) collectFromMember(m, symbols);
    }
  } else if (isPortDef(el)) {
    if (el.name) symbols.portDefs.push(el.name);
    if (el.members) {
      for (const m of el.members) collectFromMember(m, symbols);
    }
  } else if (isAttributeDef(el)) {
    if (el.name) symbols.attributeNames.push(el.name);
  }
}

function collectFromMember(m: Member, symbols: AstSymbols): void {
  if (isPartDef(m)) {
    if (m.name) symbols.partDefs.push(m.name);
    if (m.members) for (const c of m.members) collectFromMember(c, symbols);
  } else if (isPortDef(m)) {
    if (m.name) symbols.portDefs.push(m.name);
    if (m.members) for (const c of m.members) collectFromMember(c, symbols);
  } else if (isPartUsage(m) || isPortUsage(m)) {
    // PartUsage/PortUsage: no nested members, type refs already in partDefs/portDefs
  } else if (isAttributeDef(m)) {
    if (m.name) symbols.attributeNames.push(m.name);
  }
}

/**
 * Extract all symbols from a parsed Model AST.
 * typeNames = PartDef + PortDef names + built-in types (deduplicated).
 */
export function extractAstSymbols(root: unknown): AstSymbols {
  const symbols: AstSymbols = {
    packages: [],
    partDefs: [],
    portDefs: [],
    attributeNames: [],
    typeNames: [...BUILTIN_TYPES]
  };
  if (root && typeof root === 'object' && (root as Model).$type === 'Model') {
    collectFromModel(root as Model, symbols);
    const seen = new Set(BUILTIN_TYPES);
    symbols.typeNames = [...BUILTIN_TYPES];
    for (const n of symbols.partDefs) {
      if (!seen.has(n)) { seen.add(n); symbols.typeNames.push(n); }
    }
    for (const n of symbols.portDefs) {
      if (!seen.has(n)) { seen.add(n); symbols.typeNames.push(n); }
    }
  }
  return symbols;
}
