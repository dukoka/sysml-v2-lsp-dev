import * as monaco from 'monaco-editor';

// Inline keywords for completion
const SYSMLV2_KEYWORDS = [
  'import', 'package', 'library', 'alias',
  'def', 'definition', 'abstract', 'specialization',
  'part', 'port', 'flow', 'connection', 'item',
  'action', 'state', 'transition', 'event',
  'type', 'enum', 'struct', 'datatype',
  'actor', 'behavior', 'constraint',
  'requirement', 'assumption', 'verification',
  'generalization', 'reduction', 'feature',
  'end', 'binding', 'succession', 'participation',
  'if', 'else', 'while', 'for', 'return',
  'true', 'false', 'null',
  'public', 'private', 'protected', 'readonly',
  'owned', 'exhibits', 'subject', 'comment',
  'metadata', 'snapshot', 'stage'
];

const SYSMLV2_TYPES = [
  'Boolean', 'Integer', 'Real', 'String', 'Natural', 'Positive',
  'Magnitude', 'Vector', 'Matrix',
  'Element', 'Feature', 'Type', 'ElementType',
  'Classifier', 'StructuredType', 'DataType',
  'ObjectType', 'Participation', 'FeatureMembership',
  'PartDef', 'PortDef', 'FlowDef', 'ItemDef',
  'ActionDef', 'StateDef', 'Transition',
  'Requirement', 'ConstraintDef',
  'Interface', 'Connection',
  'Actor', 'UseCase', 'AnalysisCase',
  'RequirementUsage', 'RequirementConstraint',
  'SysMLPackage', 'Variant', 'Configuration'
];

const SYSMLV2_BUILTINS = [
  'assert', 'println', 'print', 'toString',
  'toInteger', 'toReal', 'size', 'empty',
  'ownedElement', 'member', 'featuring',
  'type', 'superclassifier', 'isSpecializationOf'
];

// Completion item kinds
const CompletionItemKind = monaco.languages.CompletionItemKind;

export const sysmlv2CompletionProvider: monaco.languages.CompletionItemProvider = {
  triggerCharacters: ['.', ':', '(', '[', ' '],
  
  provideCompletionItems: (model, position) => {
    console.log('Completion triggered at', position);
    const word = model.getWordUntilPosition(position);
    const range = {
      startLineNumber: position.lineNumber,
      endLineNumber: position.lineNumber,
      startColumn: word.startColumn,
      endColumn: word.endColumn
    };

    const suggestions: monaco.languages.CompletionItem[] = [];

    // Add keywords
    SYSMLV2_KEYWORDS.forEach(keyword => {
      suggestions.push({
        label: keyword,
        kind: CompletionItemKind.Keyword,
        insertText: keyword,
        range,
        detail: 'keyword',
        documentation: `SysMLv2 keyword: ${keyword}`
      });
    });

    // Add types
    SYSMLV2_TYPES.forEach(type => {
      suggestions.push({
        label: type,
        kind: CompletionItemKind.Class,
        insertText: type,
        range,
        detail: 'type',
        documentation: `SysMLv2 type: ${type}`
      });
    });

    // Add builtins
    SYSMLV2_BUILTINS.forEach(builtin => {
      suggestions.push({
        label: builtin,
        kind: CompletionItemKind.Function,
        insertText: builtin,
        range,
        detail: 'builtin function',
        documentation: `SysMLv2 builtin: ${builtin}`
      });
    });

    // Add common snippets
    suggestions.push(
      {
        label: 'package',
        kind: CompletionItemKind.Snippet,
        insertText: 'package ${1:PackageName} {\n\t$0\n}',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        range,
        detail: 'Package definition',
        documentation: 'Create a SysMLv2 package'
      },
      {
        label: 'part def',
        kind: CompletionItemKind.Snippet,
        insertText: 'part def ${1:PartName} {\n\t$0\n}',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        range,
        detail: 'Part definition',
        documentation: 'Create a SysMLv2 part definition'
      },
      {
        label: 'port def',
        kind: CompletionItemKind.Snippet,
        insertText: 'port def ${1:PortName} {\n\t$0\n}',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        range,
        detail: 'Port definition',
        documentation: 'Create a SysMLv2 port definition'
      },
      {
        label: 'action',
        kind: CompletionItemKind.Snippet,
        insertText: 'action ${1:ActionName} {\n\t$0\n}',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        range,
        detail: 'Action definition',
        documentation: 'Create a SysMLv2 action'
      },
      {
        label: 'requirement',
        kind: CompletionItemKind.Snippet,
        insertText: 'requirement ${1:ReqName} {\n\tsubject $0\n\tcondition ${2:condition}\n}',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        range,
        detail: 'Requirement',
        documentation: 'Create a SysMLv2 requirement'
      },
      {
        label: 'import',
        kind: CompletionItemKind.Snippet,
        insertText: 'import ${1:packageName}::*;\n$0',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        range,
        detail: 'Import statement',
        documentation: 'Import from a package'
      },
      {
        label: 'connection',
        kind: CompletionItemKind.Snippet,
        insertText: 'connect ${1:source} -> ${2:target};\n$0',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        range,
        detail: 'Connection',
        documentation: 'Create a connection'
      },
      {
        label: 'flow',
        kind: CompletionItemKind.Snippet,
        insertText: 'flow ${1:flowName} : ${2:ItemDef} from ${3:source} to ${4:target};\n$0',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        range,
        detail: 'Flow',
        documentation: 'Define a flow'
      },
      {
        label: 'state def',
        kind: CompletionItemKind.Snippet,
        insertText: 'state def ${1:StateName} {\n\tentry ${2:entryAction};\n\texit ${3:exitAction};\n\t$0\n}',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        range,
        detail: 'State definition',
        documentation: 'Create a state definition'
      },
      {
        label: 'attribute',
        kind: CompletionItemKind.Snippet,
        insertText: '${1:attributeName} : ${2:Type} = ${3:value};',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        range,
        detail: 'Attribute',
        documentation: 'Define an attribute'
      }
    );

    return { suggestions };
  }
};
