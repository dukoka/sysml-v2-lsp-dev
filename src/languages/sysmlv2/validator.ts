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

  lines.forEach((line, lineIndex) => {
    const lineNum = lineIndex + 1;
    
    // Skip comments and strings for keyword checking
    const cleanLine = line.replace(/\/\/.*$/, '').replace(/"[^"]*"/g, '').replace(/'[^']*'/g, '');
    
    // Check for unknown identifiers that look like keywords (typo detection)
    const wordRegex = /\b[a-zA-Z_][a-zA-Z0-9_]*\b/g;
    let match;
    while ((match = wordRegex.exec(cleanLine)) !== null) {
      const word = match[0];
      const startCol = match.index + 1;
      
      // Check if it's close to a known keyword (typo)
      if (!SYSMLV2_KEYWORDS.includes(word)) {
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
    const identifierMatch = line.match(/(\d+)([a-zA-Z_][a-zA-Z0-9_]*)/g);
    if (identifierMatch) {
      identifierMatch.forEach(match => {
        const startIndex = line.indexOf(match);
        results.push({
          severity: monaco.MarkerSeverity.Error,
          message: `Invalid identifier: cannot start with a number`,
          startLine: lineNum,
          startColumn: startIndex + 1,
          endLine: lineNum,
          endColumn: startIndex + match.length + 1
        });
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
