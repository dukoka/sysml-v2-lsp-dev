import * as monaco from 'monaco-editor';

// SysMLv2 keywords
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

// ============ Extract user-defined types from document ============

function extractUserDefinedTypes(text: string): Set<string> {
  const types = new Set<string>();
  const lines = text.split('\n');
  
  // Patterns for user-defined type definitions
  const definitionPatterns = [
    /^\s*(part)\s+def\s+(\w+)/,      // part def Name
    /^\s*(port)\s+def\s+(\w+)/,      // port def Name
    /^\s*(action)\s+def\s+(\w+)/,    // action def Name
    /^\s*(state)\s+def\s+(\w+)/,     // state def Name
    /^\s*(flow)\s+def\s+(\w+)/,      // flow def Name
    /^\s*(item)\s+def\s+(\w+)/,      // item def Name
    /^\s*(connection)\s+def\s+(\w+)/, // connection def Name
    /^\s*(constraint)\s+def\s+(\w+)/, // constraint def Name
    /^\s*(requirement)\s+(\w+)/,       // requirement Name
    /^\s*enum\s+(\w+)/,               // enum Name
    /^\s*struct\s+(\w+)/,             // struct Name
    /^\s*datatype\s+(\w+)/,          // datatype Name
    /^\s*actor\s+def\s+(\w+)/,       // actor def Name
    /^\s*behavior\s+def\s+(\w+)/,    // behavior def Name
    /^\s*package\s+(\w+)/,           // package Name
  ];
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip comments
    if (trimmed.startsWith('//') || trimmed.startsWith('/*')) {
      continue;
    }
    
    for (const pattern of definitionPatterns) {
      const match = trimmed.match(pattern);
      if (match && match[2]) {
        types.add(match[2]);
      }
    }
  }
  
  return types;
}

// Basic SysMLv2 validation rules
export interface ValidationResult {
  severity: monaco.MarkerSeverity;
  message: string;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

// Simple validation patterns
const validateText = (text: string): ValidationResult[] => {
  const results: ValidationResult[] = [];
  const lines = text.split('\n');
  
  // Extract user-defined types from the document
  const userDefinedTypes = extractUserDefinedTypes(text);

  lines.forEach((line, lineIndex) => {
    const lineNum = lineIndex + 1;
    const trimmedLine = line.trim();
    
    // Skip empty lines
    if (trimmedLine === '') {
      return;
    }
    
    // Skip comments
    if (trimmedLine.startsWith('//') || trimmedLine.startsWith('/*')) {
      return;
    }
    
    // Skip lines that are just braces
    if (trimmedLine === '{' || trimmedLine === '}') {
      return;
    }
    
    // Skip 'end' statements
    if (trimmedLine.startsWith('end')) {
      return;
    }
    
    // Skip definition lines that end with {
    if (trimmedLine.endsWith('{')) {
      return;
    }
    
    // ============ Check for incomplete statements ============
    
    // Check if line needs semicolon - more comprehensive patterns
    // 1. attribute/part/port/reference declarations
    // 2. variable assignments and type annotations
    // 3. function calls (println, print, assert)
    // 4. Any word that looks like a statement (not a keyword or type)
    const needsSemicolon = 
      /^\s*(attribute|part|port|reference)\s+\w+/.test(trimmedLine) ||
      /^\s*\w+\s*[=:]/.test(trimmedLine) ||
      /^\s*(println|print|assert)\s*\(/.test(trimmedLine);
    
    // Check if this looks like an expression/statement without semicolon
    // Matches: identifiers, function calls, expressions
    const looksLikeStatement = 
      /^\s*\w+\s*\(/.test(trimmedLine) ||  // function call
      /^\s*\w+\s*[=+\-*/]/.test(trimmedLine) ||  // assignment or expression
      /^\s*\w+\s*:\s*\w+/.test(trimmedLine);  // type annotation
    
    const hasValidEnding = 
      trimmedLine.endsWith(';') || 
      trimmedLine.endsWith(',') ||
      trimmedLine.endsWith('{') ||
      trimmedLine.endsWith('}');
    
    if ((needsSemicolon || looksLikeStatement) && !hasValidEnding) {
      // Check if it's a keyword - if so, might be incomplete
      const firstWord = trimmedLine.split(/\s+/)[0];
      const isKnownKeyword = SYSMLV2_KEYWORDS.includes(firstWord);
      
      // If it's a known keyword that's incomplete, warn about missing semicolon
      // Otherwise, report as unknown identifier
      if (isKnownKeyword) {
        // Known keyword - might be incomplete statement
        results.push({
          severity: monaco.MarkerSeverity.Warning,
          message: 'Missing semicolon',
          startLine: lineNum,
          startColumn: line.length,
          endLine: lineNum,
          endColumn: line.length + 1
        });
      }
    }
    
    // ============ Check for unknown identifiers ============
    
    // Skip comments and strings for keyword checking
    const cleanLine = line.replace(/\/\/.*$/, '').replace(/"[^"]*"/g, '').replace(/'[^']*'/g, '');
    
    // Find all words
    const wordRegex = /\b[a-zA-Z_][a-zA-Z0-9_]*\b/g;
    let match;
    while ((match = wordRegex.exec(cleanLine)) !== null) {
      const word = match[0];
      const startCol = match.index + 1;
      
      // Skip known keywords
      if (SYSMLV2_KEYWORDS.includes(word)) {
        continue;
      }
      
      // Skip user-defined types
      if (userDefinedTypes.has(word)) {
        continue;
      }
      
      // Skip PascalCase identifiers (likely user-defined types)
      if (/^[A-Z][a-zA-Z0-9_]*$/.test(word)) {
        continue;
      }
      
      // Only check for typos in identifiers - don't flag all unknown identifiers as errors
      // Users can define their own attributes, parts, ports, etc.
      
      // Check if this line looks like a statement (not just a type reference)
      // For example: "adfadf" looks like a statement, but "Vehicle" in "part engine: Vehicle" is a type reference
      const isTypeAnnotation = /:\s*\w+/.test(cleanLine);
      const isAssignment = /=\s*\w+/.test(cleanLine);
      const isFunctionCall = /\w+\s*\(/.test(cleanLine);
      const looksLikeStatement = isTypeAnnotation || isAssignment || isFunctionCall;
      
      // Only report unknown identifier if it looks like a standalone statement
      // (not just a type reference in a declaration)
      if (!looksLikeStatement && !isTypeAnnotation) {
        // Check if it's close to a known keyword (typo detection)
        const similar = findSimilarKeyword(word, SYSMLV2_KEYWORDS);
        if (similar) {
          results.push({
            severity: monaco.MarkerSeverity.Error,
            message: `Unknown keyword '${word}'. Did you mean '${similar}'?`,
            startLine: lineNum,
            startColumn: startCol,
            endLine: lineNum,
            endColumn: startCol + word.length
          });
        } else if (trimmedLine === word) {
          // The entire line is just this word - it's likely an error
          results.push({
            severity: monaco.MarkerSeverity.Error,
            message: `Expected a token. Did you forget ';'?`,
            startLine: lineNum,
            startColumn: startCol,
            endLine: lineNum,
            endColumn: startCol + word.length
          });
        }
      }
    }
    
    // Check for unclosed strings
    let inString = false;
    let stringChar = '';
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (!inString && (char === '"' || char === "'")) {
        inString = true;
        stringChar = char;
      } else if (inString && char === stringChar && line[i - 1] !== '\\') {
        inString = false;
      }
    }
    if (inString) {
      results.push({
        severity: monaco.MarkerSeverity.Error,
        message: 'Unclosed string literal',
        startLine: lineNum,
        startColumn: 1,
        endLine: lineNum,
        endColumn: line.length + 1
      });
    }

    // Check for unclosed comments
    if (line.includes('/*') && !line.includes('*/') && !line.includes('//')) {
      results.push({
        severity: monaco.MarkerSeverity.Warning,
        message: 'Potentially unclosed block comment',
        startLine: lineNum,
        startColumn: line.indexOf('/*') + 1,
        endLine: lineNum,
        endColumn: line.length
      });
    }

    // Check for invalid identifier patterns
    let badIdM;
    const badIdRegex = /\b(\d+[a-zA-Z_][a-zA-Z0-9_]*)\b/g;
    while ((badIdM = badIdRegex.exec(line)) !== null) {
      results.push({
        severity: monaco.MarkerSeverity.Error,
        message: 'Invalid identifier: cannot start with a number',
        startLine: lineNum,
        startColumn: badIdM.index + 1,
        endLine: lineNum,
        endColumn: badIdM.index + badIdM[0].length + 1
      });
    }

    // Malformed definition: missing name before {
    if (/^\s*(part|port|action|state|flow|item|connection|constraint|actor|behavior)\s+def\s*\{\s*$/i.test(trimmedLine)) {
      results.push({
        severity: monaco.MarkerSeverity.Error,
        message: 'Definition missing name before opening brace',
        startLine: lineNum,
        startColumn: 1,
        endLine: lineNum,
        endColumn: line.length + 1
      });
    }
    if (/^\s*(part|port|action|state|flow|item|connection|constraint|actor|behavior)\s+def\s*$/.test(trimmedLine)) {
      results.push({
        severity: monaco.MarkerSeverity.Error,
        message: 'Definition missing name and body',
        startLine: lineNum,
        startColumn: 1,
        endLine: lineNum,
        endColumn: line.length + 1
      });
    }

    // Double semicolon
    let semiM;
    const semiRegex = /;;+/g;
    while ((semiM = semiRegex.exec(line)) !== null) {
      results.push({
        severity: monaco.MarkerSeverity.Warning,
        message: 'Redundant semicolons',
        startLine: lineNum,
        startColumn: semiM.index + 1,
        endLine: lineNum,
        endColumn: semiM.index + semiM[0].length + 1
      });
    }

    // Standalone "def" without structural keyword
    if (/^\s*def\s+\w+/i.test(trimmedLine) && !/^\s*(part|port|action|state|flow|item|connection|constraint|actor|behavior)\s+def/i.test(trimmedLine)) {
      const defMatch = line.match(/\bdef\b/i);
      if (defMatch && defMatch.index !== undefined) {
        results.push({
          severity: monaco.MarkerSeverity.Error,
          message: "'def' must follow a structural keyword (part, port, action, etc.)",
          startLine: lineNum,
          startColumn: defMatch.index + 1,
          endLine: lineNum,
          endColumn: defMatch.index + 4
        });
      }
    }
  });

  // Duplicate definition names
  const defNames = new Map<string, number[]>();
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('/*')) return;
    const m = line.match(/^\s*(?:part|port|action|state|flow|item|connection|constraint|actor|behavior)\s+def\s+(\w+)/i)
      || line.match(/^\s*requirement\s+(\w+)/i)
      || line.match(/^\s*enum\s+(\w+)/i)
      || line.match(/^\s*struct\s+(\w+)/i)
      || line.match(/^\s*datatype\s+(\w+)/i)
      || line.match(/^\s*package\s+(\w+)/i);
    if (m && m[1]) {
      const name = m[1];
      if (!defNames.has(name)) defNames.set(name, []);
      defNames.get(name)!.push(idx + 1);
    }
  });
  defNames.forEach((lineNums, name) => {
    if (lineNums.length > 1) {
      lines.forEach((line, idx) => {
        const lineNum = idx + 1;
        if (!lineNums.includes(lineNum)) return;
        const nameMatch = line.match(new RegExp(`\\b${name}\\b`));
        if (nameMatch && nameMatch.index !== undefined) {
          results.push({
            severity: monaco.MarkerSeverity.Warning,
            message: `Duplicate definition '${name}' (also at line ${lineNums.filter((l) => l !== lineNum).join(', ')})`,
            startLine: lineNum,
            startColumn: nameMatch.index + 1,
            endLine: lineNum,
            endColumn: nameMatch.index + name.length + 1
          });
        }
      });
    }
  });

  // Check for unmatched braces
  const openBraces = (text.match(/{/g) || []).length;
  const closeBraces = (text.match(/}/g) || []).length;
  if (openBraces !== closeBraces) {
    results.push({
      severity: monaco.MarkerSeverity.Error,
      message: `Unmatched braces: ${openBraces} open, ${closeBraces} close`,
      startLine: 1,
      startColumn: 1,
      endLine: lines.length,
      endColumn: 1
    });
  }

  return results;
};

// Find similar keyword using Levenshtein distance
function findSimilarKeyword(word: string, keywords: string[]): string | null {
  const maxDistance = 2;
  let similar: string | null = null;
  let minDistance = maxDistance + 1;
  
  for (const keyword of keywords) {
    const distance = levenshteinDistance(word, keyword);
    if (distance <= maxDistance && distance < minDistance) {
      minDistance = distance;
      similar = keyword;
    }
  }
  
  return similar;
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

export const createSysmlv2Validator = () => {
  return {
    validate: (text: string): monaco.editor.IMarkerData[] => {
      const results = validateText(text);
      return results.map(result => ({
        severity: result.severity,
        message: result.message,
        startLineNumber: result.startLine,
        startColumn: result.startColumn,
        endLineNumber: result.endLine,
        endColumn: result.endColumn
      }));
    }
  };
};
