// SysMLv2 Language Keywords and Token Definitions

export const SYSMLV2_KEYWORDS = [
  // Package and Import
  'import', 'package', 'library', 'alias',
  
  // Definitions
  'def', 'definition', 'abstract', 'specialization',
  
  // Usages
  'part', 'port', 'flow', 'connection', 'item',
  'action', 'state', 'transition', 'event',
  
  // Types
  'type', 'enum', 'struct', 'datatype',
  
  // Behavior
  'actor', 'behavior', 'constraint',
  'requirement', 'assumption', 'verification',
  
  // Relationships
  'generalization', 'reduction', 'feature',
  'end', 'binding', 'succession', 'participation',
  
  // Control
  'if', 'else', 'while', 'for', 'return',
  'true', 'false', 'null',
  
  // Visibility
  'public', 'private', 'protected', 'readonly',
  
  // Other
  'owned', 'exhibits', 'subject', 'comment',
  'metadata', 'snapshot', 'stage',
  'attribute', 'in', 'out'
];

export const SYSMLV2_TYPES = [
  // Base Types
  'Boolean', 'Integer', 'Real', 'String', 'Natural', 'Positive',
  'Magnitude', 'Vector', 'Matrix',
  
  // KerML Base
  'Element', 'Feature', 'Type', 'ElementType',
  'Classifier', 'StructuredType', 'DataType',
  'ObjectType', 'Participation', 'FeatureMembership',
  
  // SysMLv2 Specific
  'PartDef', 'PortDef', 'FlowDef', 'ItemDef',
  'ActionDef', 'StateDef', 'Transition',
  'Requirement', 'ConstraintDef',
  'Interface', 'Connection',
  'Actor', 'UseCase', 'AnalysisCase',
  'RequirementUsage', 'RequirementConstraint',
  'SysMLPackage', 'Variant', 'Configuration'
];

export const SYSMLV2_BUILTINS = [
  // Standard Library Functions
  'assert', 'println', 'print', 'toString',
  'toInteger', 'toReal', 'size', 'empty',
  'ownedElement', 'member', 'featuring',
  'type', 'superclassifier', 'isSpecializationOf'
];

export const SYSMLV2_OPERATORS = [
  // Arithmetic
  '+', '-', '*', '/', '%', '**',
  // Comparison  
  '==', '!=', '<', '>', '<=', '>=',
  // Logical
  '&&', '||', '!',
  // Assignment
  '=', '+=', '-=', '*=', '/=',
  // Other
  '?', ':', '::', '->', '<-', '>>', '<<',
  // Brackets
  '(', ')', '[', ']', '{', '}'
];

export const SYSMLV2_TOKEN = {
  keyword: 'keyword',
  type: 'type',
  builtin: 'support.function',
  string: 'string',
  number: 'number',
  comment: 'comment',
  operator: 'operator',
  identifier: 'identifier',
  punctuation: 'delimiter'
};
