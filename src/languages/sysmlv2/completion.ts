import * as monaco from 'monaco-editor';

// ============ Keyword Categories ============

// Structural keywords - start definitions
const STRUCTURAL_KEYWORDS = [
  'part', 'port', 'action', 'state', 'flow', 'item', 'connection', 
  'constraint', 'requirement', 'actor', 'behavior', 'interface'
];

// Flow control keywords - only in behavior blocks
const FLOW_CONTROL_KEYWORDS = ['if', 'else', 'while', 'for', 'return', 'switch', 'case'];

// Type keywords
const TYPE_KEYWORDS = ['enum', 'struct', 'datatype', 'union'];

// Modifier keywords
const MODIFIER_KEYWORDS = ['abstract', 'specialization', 'readonly', 'public', 'private', 'protected'];

// Membership keywords - inside definitions
const MEMBERSHIP_KEYWORDS = ['owned', 'exhibits', 'subject', 'redefines', 'references', 'subsets', 'specializes'];

// Relationship operators (like :, :>, ::>, etc.)
const RELATIONSHIP_TOKENS = [':', ':>>', ':>', '::>', '::', 'specializes', 'subsets', 'redefines', 'references', 'by', 'conjugates', 'unions', 'intersects', 'differences', 'chains', 'of'];

// Other keywords
const OTHER_KEYWORDS = [
  'import', 'package', 'library', 'alias', 'def', 'definition',
  'end', 'binding', 'succession', 'participation',
  'metadata', 'snapshot', 'stage', 'feature', 'in', 'out'
];

// Types
const SYSMLV2_TYPES = [
  'Boolean', 'Integer', 'Real', 'String', 'Natural', 'Positive',
  'Magnitude', 'Vector', 'Matrix', 'Array',
  'Element', 'Feature', 'Type', 'ElementType',
  'Classifier', 'StructuredType', 'DataType',
  'ObjectType', 'Participation', 'FeatureMembership',
  'PartUsage', 'PartDef', 'PortUsage', 'PortDef', 
  'FlowUsage', 'FlowDef', 'ItemUsage', 'ItemDef',
  'ActionUsage', 'ActionDef', 'StateUsage', 'StateDef', 'Transition',
  'RequirementUsage', 'RequirementDef', 'ConstraintUsage', 'ConstraintDef',
  'Interface', 'Connection', 'BindingConnector',
  'ActorUsage', 'ActorDef', 'UseCase', 'AnalysisCase',
  'Variant', 'Configuration', 'SysMLPackage'
];

// Built-in functions
const BUILTIN_FUNCTIONS = [
  'assert', 'println', 'print', 'toString',
  'toInteger', 'toReal', 'toBoolean', 'size', 'empty',
  'isEmpty', 'first', 'last', 'append', 'prepend'
];

const CompletionItemKind = monaco.languages.CompletionItemKind;

// ============ Improved Context Detection ============

interface CompletionContext {
  type: string;
  currentWord: string;
  braceDepth: number;
}

function getLastWord(text: string): string {
  // Handle quoted strings
  const lastQuote = Math.max(text.lastIndexOf('"'), text.lastIndexOf("'"));
  if (lastQuote > 0 && lastQuote === text.length - 1) {
    return '';
  }
  const match = text.match(/(\w+)$/);
  return match ? match[1] : '';
}

function detectCompletionContext(model: monaco.editor.ITextModel, position: monaco.Position): CompletionContext {
  const lineContent = model.getLineContent(position.lineNumber);
  const beforeCursor = lineContent.substring(0, position.column - 1);
  const currentWord = getLastWord(beforeCursor);
  
  // Count brace depth
  const text = model.getValue();
  const beforeOffset = model.getOffsetAt(position);
  let braceDepth = 0;
  for (let i = 0; i < beforeOffset; i++) {
    if (text[i] === '{') braceDepth++;
    if (text[i] === '}') braceDepth--;
  }
  
  const trimmed = beforeCursor.trim();
  
  // ============ Check trigger characters (most specific first) ============
  
  // After dot - member/feature access
  if (beforeCursor.endsWith('.')) {
    return { type: 'member', currentWord, braceDepth };
  }
  
  // After relationship operators - type references
  for (const token of RELATIONSHIP_TOKENS) {
    if (beforeCursor.endsWith(token) || trimmed.endsWith(token)) {
      return { type: 'type', currentWord, braceDepth };
    }
  }
  
  // After colon (type annotation)
  if (beforeCursor.endsWith(':') && !beforeCursor.endsWith('::')) {
    return { type: 'type', currentWord, braceDepth };
  }
  
  // After 'import ' - package names
  if (/\bimport\s*$/i.test(trimmed)) {
    return { type: 'importName', currentWord, braceDepth };
  }
  
  // After 'attribute ' - attribute names
  if (/\battribute\s*$/i.test(trimmed)) {
    return { type: 'attrName', currentWord, braceDepth };
  }
  
  // After 'enum ' - enum names
  if (/^(enum)\s*$/i.test(trimmed)) {
    return { type: 'enumName', currentWord, braceDepth };
  }
  
  // After 'struct ' or 'datatype ' - names
  if (/^(struct|datatype)\s*$/i.test(trimmed)) {
    return { type: 'structName', currentWord, braceDepth };
  }
  
  // After 'package ' - package names
  if (/^(package)\s*$/i.test(trimmed)) {
    return { type: 'packageName', currentWord, braceDepth };
  }
  
  // After 'in ' or 'out ' - port directions
  if (/\b(in|out)\s*$/i.test(trimmed)) {
    return { type: 'direction', currentWord, braceDepth };
  }
  
  // ============ Check structural keyword patterns ============
  
  const structuralPattern = STRUCTURAL_KEYWORDS.join('|');
  
  // After structural keyword alone (e.g., "part")
  if (new RegExp(`^(${structuralPattern})$`, 'i').test(trimmed)) {
    return { type: 'definitionStart', currentWord, braceDepth };
  }
  
  // After structural keyword with space (e.g., "part ")
  if (new RegExp(`^(${structuralPattern})\\s+$`, 'i').test(trimmed)) {
    return { type: 'definitionStart', currentWord, braceDepth };
  }
  
  // After keyword + def (e.g., "part def " or "part def")
  if (new RegExp(`^(${structuralPattern})\\s+def\\s*`, 'i').test(trimmed)) {
    return { type: 'defName', currentWord, braceDepth };
  }
  
  // ============ Check brace context ============
  
  // Inside braces - definition body
  if (braceDepth > 0) {
    return { type: 'definitionBody', currentWord, braceDepth };
  }
  
  // Default - general context
  return { type: 'general', currentWord, braceDepth };
}

// Filter items by prefix
function filterByPrefix<T extends { label: string }>(items: T[], prefix: string): T[] {
  if (!prefix) return items;
  const lowerPrefix = prefix.toLowerCase();
  return items.filter(item => item.label.toLowerCase().startsWith(lowerPrefix));
}

// Create completion item
function createItem(label: string, kind: monaco.languages.CompletionItemKind, detail: string, sort: string) {
  return { label, kind, insertText: label, detail, sortText: sort };
}

export const sysmlv2CompletionProvider: monaco.languages.CompletionItemProvider = {
  // Trigger on . : [ and space - but not always show suggestions
  triggerCharacters: ['.', ':', '[', ' ', '::'],
  
  provideCompletionItems: (model, position) => {
    const word = model.getWordUntilPosition(position);
    const range = {
      startLineNumber: position.lineNumber,
      endLineNumber: position.lineNumber,
      startColumn: word.startColumn,
      endColumn: word.endColumn
    };

    const ctx = detectCompletionContext(model, position);

    const suggestions: monaco.languages.CompletionItem[] = [];
    let sortPriority = 0;

    // ============ Context-specific completions ============
    
    switch (ctx.type) {
      // Type references (after :, :>, ::>, etc.)
      case 'type':
        filterByPrefix(SYSMLV2_TYPES.map(t => 
          createItem(t, CompletionItemKind.Class, 'type', String(sortPriority++))
        ), ctx.currentWord).forEach(item => suggestions.push({ ...item, range }));
        return { suggestions };
        
      // Member access (after .)
      case 'member':
        filterByPrefix(BUILTIN_FUNCTIONS.map(f => 
          createItem(f, CompletionItemKind.Function, 'function', String(sortPriority++))
        ), ctx.currentWord).forEach(item => suggestions.push({ ...item, range }));
        // Also add common members
        const memberSuggestions = ['ownedElement', 'member', 'featuring', 'type', 'superclassifier'];
        filterByPrefix(memberSuggestions.map(m => 
          createItem(m, CompletionItemKind.Property, 'member', String(sortPriority++))
        ), ctx.currentWord).forEach(item => suggestions.push({ ...item, range }));
        return { suggestions };
        
      // Import names
      case 'importName':
        const importItems = ['KernelLibrary', 'BaseLibrary', 'SysMLLibrary', 'standard::StandardLibrary'];
        filterByPrefix(importItems.map(i => 
          createItem(i, CompletionItemKind.Module, 'package', String(sortPriority++))
        ), ctx.currentWord).forEach(item => suggestions.push({ ...item, range }));
        return { suggestions };
        
      // Package names
      case 'packageName':
        const pkgItems = ['MyPackage', 'Library', 'Utilities', 'Models'];
        filterByPrefix(pkgItems.map(p => 
          createItem(p, CompletionItemKind.Module, 'package', String(sortPriority++))
        ), ctx.currentWord).forEach(item => suggestions.push({ ...item, range }));
        return { suggestions };
        
      // Attribute names
      case 'attrName':
        const attrItems = ['name', 'id', 'value', 'description', 'owner', 'version', 'status', 'type'];
        filterByPrefix(attrItems.map(a => 
          createItem(a, CompletionItemKind.Variable, 'attribute', String(sortPriority++))
        ), ctx.currentWord).forEach(item => suggestions.push({ ...item, range }));
        return { suggestions };
        
      // Enum names
      case 'enumName':
        const enumItems = ['Status', 'State', 'Type', 'Category', 'Priority', 'Color', 'Kind', 'Mode'];
        filterByPrefix(enumItems.map(e => 
          createItem(e, CompletionItemKind.Enum, 'enum', String(sortPriority++))
        ), ctx.currentWord).forEach(item => suggestions.push({ ...item, range }));
        return { suggestions };
        
      // Struct/datatype names
      case 'structName':
        const structItems = ['Data', 'Config', 'Record', 'Info', 'Result', 'Response', 'Settings'];
        filterByPrefix(structItems.map(s => 
          createItem(s, CompletionItemKind.Struct, 'struct', String(sortPriority++))
        ), ctx.currentWord).forEach(item => suggestions.push({ ...item, range }));
        return { suggestions };
        
      // Port directions
      case 'direction':
        const dirItems = ['in', 'out', 'inout'];
        filterByPrefix(dirItems.map(d => 
          createItem(d, CompletionItemKind.Keyword, 'direction', String(sortPriority++))
        ), ctx.currentWord).forEach(item => suggestions.push({ ...item, range }));
        return { suggestions };
        
      // After structural keyword (part, port, action, etc.) - suggest 'def'
      case 'definitionStart':
        // Always suggest 'def'
        if (!ctx.currentWord || 'def'.startsWith(ctx.currentWord.toLowerCase())) {
          suggestions.push({
            label: 'def',
            kind: CompletionItemKind.Keyword,
            insertText: 'def ',
            detail: 'definition',
            range,
            sortText: '001'
          });
        }
        // Suggest snippets when no current word
        if (!ctx.currentWord) {
          const snippets = [
            { label: 'part def', snippet: 'part def ${1:Name} {\n\t$0\n}', detail: 'Part definition' },
            { label: 'port def', snippet: 'port def ${1:Name} {\n\t$0\n}', detail: 'Port definition' },
            { label: 'action', snippet: 'action ${1:Name} {\n\t$0\n}', detail: 'Action' },
            { label: 'requirement', snippet: 'requirement ${1:Name} {\n\tsubject $0\n\tcondition ${2:condition}\n}', detail: 'Requirement' },
            { label: 'enum', snippet: 'enum ${1:Name} {\n\t${2:value1},\n\t${3:value2}\n}', detail: 'Enumeration' },
            { label: 'struct', snippet: 'struct ${1:Name} {\n\t$0\n}', detail: 'Structure' },
          ];
          snippets.forEach(s => {
            suggestions.push({
              label: s.label,
              kind: CompletionItemKind.Snippet,
              insertText: s.snippet,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              detail: s.detail,
              range,
              sortText: '099'
            });
          });
        }
        return { suggestions };
      
      // After 'part def ' - definition names
      case 'defName':
        const defSuggestions = ['Vehicle', 'Engine', 'Port', 'Action', 'State', 'Item', 'Connection', 'Flow', 'Constraint', 'Requirement', 'Data', 'Config'];
        filterByPrefix(defSuggestions.map(name => 
          createItem(name, CompletionItemKind.Variable, 'definition', String(sortPriority++))
        ), ctx.currentWord).forEach(item => suggestions.push({ ...item, range }));
        return { suggestions };
        
      // Inside definition body (after {)
      case 'definitionBody':
        // Keywords for structure
        const bodyKeywords = [
          ...STRUCTURAL_KEYWORDS, ...TYPE_KEYWORDS, ...MODIFIER_KEYWORDS,
          ...MEMBERSHIP_KEYWORDS,
          'end', 'attribute', 'feature', 'reference', 'part', 'port',
          'connection', 'binding', 'succession', 'owned', 'exhibits', 'comment'
        ];
        filterByPrefix(bodyKeywords.map(kw => 
          createItem(kw, CompletionItemKind.Keyword, 'keyword', String(sortPriority++))
        ), ctx.currentWord).forEach(item => suggestions.push({ ...item, range }));
        
        // Types
        filterByPrefix(SYSMLV2_TYPES.map(t => 
          createItem(t, CompletionItemKind.Class, 'type', String(sortPriority++))
        ), ctx.currentWord).forEach(item => suggestions.push({ ...item, range }));
        return { suggestions };
        
      // General context (at start of line or after whitespace)
      case 'general':
      default:
        // Structural keywords first
        filterByPrefix(STRUCTURAL_KEYWORDS.map(kw => 
          createItem(kw, CompletionItemKind.Keyword, 'structural', String(sortPriority++))
        ), ctx.currentWord).forEach(item => suggestions.push({ ...item, range }));
        
        // Flow control only at top level (braceDepth === 0)
        if (ctx.braceDepth === 0) {
          filterByPrefix(FLOW_CONTROL_KEYWORDS.map(kw => 
            createItem(kw, CompletionItemKind.Keyword, 'flow control', String(sortPriority++))
          ), ctx.currentWord).forEach(item => suggestions.push({ ...item, range }));
        }
        
        // Types
        filterByPrefix(SYSMLV2_TYPES.map(t => 
          createItem(t, CompletionItemKind.Class, 'type', String(sortPriority++))
        ), ctx.currentWord).forEach(item => suggestions.push({ ...item, range }));
        
        // Modifiers
        filterByPrefix(MODIFIER_KEYWORDS.map(m => 
          createItem(m, CompletionItemKind.Keyword, 'modifier', String(sortPriority++))
        ), ctx.currentWord).forEach(item => suggestions.push({ ...item, range }));
        
        // Other keywords
        filterByPrefix(OTHER_KEYWORDS.map(k => 
          createItem(k, CompletionItemKind.Keyword, 'keyword', String(sortPriority++))
        ), ctx.currentWord).forEach(item => suggestions.push({ ...item, range }));
        
        // Snippets
        if (!ctx.currentWord) {
          const snippets = [
            { label: 'part def', snippet: 'part def ${1:Name} {\n\t$0\n}', detail: 'Part definition' },
            { label: 'port def', snippet: 'port def ${1:Name} {\n\t$0\n}', detail: 'Port definition' },
            { label: 'action', snippet: 'action ${1:Name} {\n\t$0\n}', detail: 'Action' },
            { label: 'requirement', snippet: 'requirement ${1:Name} {\n\tsubject $0\n\tcondition ${2:condition}\n}', detail: 'Requirement' },
            { label: 'enum', snippet: 'enum ${1:Name} {\n\t${2:value1},\n\t${3:value2}\n}', detail: 'Enumeration' },
            { label: 'struct', snippet: 'struct ${1:Name} {\n\t$0\n}', detail: 'Structure' },
            { label: 'attribute', snippet: '${1:name} : ${2:Type}', detail: 'Attribute' },
          ];
          snippets.forEach(s => {
            suggestions.push({
              label: s.label,
              kind: CompletionItemKind.Snippet,
              insertText: s.snippet,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              detail: s.detail,
              range,
              sortText: '099'
            });
          });
        }
        
        return { suggestions };
    }
  }
};
