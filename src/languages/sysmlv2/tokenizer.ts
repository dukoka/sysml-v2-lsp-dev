import * as monaco from 'monaco-editor';

// Keywords as arrays for Monarch tokenizer
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
  'metadata', 'snapshot', 'stage',
  'attribute', 'in', 'out'
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

// Monaco tokenizer configuration for SysMLv2
export const sysmlv2Language: monaco.languages.IMonarchLanguage = {
  defaultToken: 'invalid',
  tokenPostfix: '.sysmlv2',
  
  // Keywords as arrays (required by Monarch)
  keywords: SYSMLV2_KEYWORDS,
  typeKeywords: SYSMLV2_TYPES,
  
  // Operators
  operators: [
    '=', '>', '<', '!', '~', '?', ':',
    '==', '<=', '>=', '!=', '&&', '||', 
    '++', '--', '+', '-', '*', '/', '&', '|', '^', '%',
    '->', '<-', '>>', '<<', '::'
  ],

  // Symbols for tokenizer
  symbols: /[=><!~?:&|+\-*\/\^%]+/,

  // Tokenizer rules - root state
  tokenizer: {
    root: [
      // Comments
      [/\/\/.*$/, 'comment'],
      [/\/\*/, 'comment', '@comment'],

      // Strings
      [/"[^"]*"/, 'string'],
      [/'[^']*'/, 'string'],

      // Numbers
      [/\d+(\.\d+)?([eE][\-+]?\d+)?/, 'number'],
      [/0x[0-9a-fA-F]+/, 'number.hex'],

      // Identifiers and Keywords (lowercase)
      [/[a-z_$][\w$]*/, {
        cases: {
          '@keywords': 'keyword',
          '@default': 'identifier'
        }
      }],

      // Type Identifiers (PascalCase)
      [/[A-Z][\w$]*/, {
        cases: {
          '@typeKeywords': 'type',
          '@default': 'identifier.type'
        }
      }],

      // Delimiters
      [/[{}()\[\]]/, '@brackets'],
      [/[;,.]/, 'delimiter'],

      // Operators
      [/@symbols/, {
        cases: {
          '@operators': 'operator',
          '@default': ''
        }
      }],

      // Whitespace
      [/\s+/, 'white'],

      // Anything else
      [/./, 'invalid']
    ],

    // Comment state for block comments
    comment: [
      [/[^/*]+/, 'comment'],
      [/\*\//, 'comment', '@pop'],
      [/[/*]/, 'comment']
    ],

    // String state for double-quoted strings
    string: [
      [/[^\\"$]+/, 'string'],
      [/\\./, 'string.escape'],
      ["/", 'string', '@pop']
    ]
  },

  // Comment configuration
  comments: {
    lineComment: '//',
    blockComment: ['/*', '*/']
  },

  // Bracket matching
  brackets: [
    ['{', '}', 'delimiter.curly'],
    ['[', ']', 'delimiter.square'],
    ['(', ')', 'delimiter.parenthesis']
  ],

  // Auto-closing pairs
  autoClosingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"', notIn: ['string'] },
    { open: "'", close: "'", notIn: ['string'] }
  ],

  // Surrounding pairs
  surroundingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"' },
    { open: "'", close: "'" }
  ]
};

// Language configuration
export const sysmlv2LanguageConfig: monaco.languages.LanguageConfiguration = {
  comments: {
    lineComment: '//',
    blockComment: ['/*', '*/']
  },
  brackets: [
    ['{', '}'],
    ['[', ']'],
    ['(', ')']
  ],
  autoClosingBeforeNewLine: 'none',
  autoClosingQuotes: 'always',
  surroundingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"' },
    { open: "'", close: "'" }
  ],
  autoClosingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"' },
    { open: "'", close: "'" }
  ],
  indentationRules: {
    increaseIndentPattern: /^\s*(def|part|port|action|state|requirement|package|actor|behavior|if|while|for)\b.*\{\s*$/,
    decreaseIndentPattern: /^\s*\}/
  },
  wordPattern: /(-?\d*\.\d\w*)|([^\`\~\!\@\#\%\^\&\*\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)/g
};
