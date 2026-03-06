/**
 * AST symbol extraction for completion - collects Package, PartDefinition, PortDefinition,
 * AttributeDefinition, PartUsage, PortUsage, AttributeUsage from Langium AST (sysml-2ls grammar).
 */
import type {
  Namespace,
  Membership,
  OwningMembership,
  Definition,
  Usage,
} from './generated/ast.js';
import {
  isNamespace,
  isPackage,
  isPartDefinition,
  isPortDefinition,
  isAttributeDefinition,
  isPartUsage,
  isPortUsage,
  isAttributeUsage,
  isOwningMembership,
} from './generated/ast.js';

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

function addName(symbols: AstSymbols, name: string | undefined, list: 'packages' | 'partDefs' | 'portDefs' | 'attributeNames'): void {
  if (name && name.trim()) symbols[list].push(name);
}

function collectFromNamespace(ns: Namespace, symbols: AstSymbols): void {
  if (!ns?.children) return;
  for (const child of ns.children) {
    if (!isOwningMembership(child)) continue;
    collectFromMembership(child as OwningMembership, symbols);
  }
}

function collectFromMembership(m: OwningMembership, symbols: AstSymbols): void {
  if (!m.target) return;
  const t = m.target as Definition | Usage;
  collectFromTarget(t, symbols);
}

function collectFromTarget(t: unknown, symbols: AstSymbols): void {
  if (isPackage(t)) {
    addName(symbols, t.declaredName, 'packages');
    collectFromNamespace(t, symbols);
  } else if (isPartDefinition(t)) {
    addName(symbols, t.declaredName, 'partDefs');
    collectFromNamespace(t, symbols);
  } else if (isPortDefinition(t)) {
    addName(symbols, t.declaredName, 'portDefs');
    collectFromNamespace(t, symbols);
  } else if (isAttributeDefinition(t)) {
    addName(symbols, t.declaredName, 'attributeNames');
    collectFromNamespace(t, symbols);
  } else if (isPartUsage(t) || isPortUsage(t)) {
    // PartUsage/PortUsage: type refs handled via partDefs/portDefs
    collectFromNamespace(t, symbols);
  } else if (isAttributeUsage(t)) {
    addName(symbols, t.declaredName, 'attributeNames');
    collectFromNamespace(t, symbols);
  } else if (isNamespace(t)) {
    collectFromNamespace(t, symbols);
  }
}

/**
 * Extract all symbols from a parsed Model AST (Namespace root).
 * typeNames = PartDefinition + PortDefinition names + built-in types (deduplicated).
 */
export function extractAstSymbols(root: unknown): AstSymbols {
  const symbols: AstSymbols = {
    packages: [],
    partDefs: [],
    portDefs: [],
    attributeNames: [],
    typeNames: [...BUILTIN_TYPES]
  };
  if (root && typeof root === 'object' && isNamespace(root)) {
    collectFromNamespace(root, symbols);
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
