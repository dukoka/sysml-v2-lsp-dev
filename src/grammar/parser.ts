/**
 * SysMLv2 parser using Langium - parses text to AST.
 * Used for AST-based validation and completion (Phase 2/3).
 */
import {
  inject,
  createDefaultSharedCoreModule,
  createDefaultCoreModule,
  EmptyFileSystem,
} from 'langium';
import {
  SysMLv2GeneratedSharedModule,
  SysMLGeneratedModule,
} from './generated/module.js';

const _shared = inject(
  createDefaultSharedCoreModule(EmptyFileSystem),
  SysMLv2GeneratedSharedModule
);

const _sysml = inject(
  createDefaultCoreModule({ shared: _shared }),
  SysMLGeneratedModule
);

export function parseSysML(text: string, _uri = 'memory://model.sysml') {
  const parser = _sysml.parser.LangiumParser;
  return parser.parse(text);
}

/** Convert Langium parse result errors to LSP diagnostics (0-based line/character). */
export function parseResultToDiagnostics(parseResult: {
  parserErrors: Array<{ token?: { startLine?: number; startColumn?: number; endLine?: number; endColumn?: number; startOffset?: number }; previousToken?: { endLine?: number; endColumn?: number; startOffset?: number }; message: string }>;
  lexerErrors?: Array<{ line?: number; column?: number; length?: number; message?: string }>;
}): Array<{ severity: number; range: { start: { line: number; character: number }; end: { line: number; character: number } }; message: string }> {
  const diagnostics: Array<{ severity: number; range: { start: { line: number; character: number }; end: { line: number; character: number } }; message: string }> = [];
  const Error = 1; // DiagnosticSeverity.Error

  for (const e of parseResult.lexerErrors ?? []) {
    const line = (e.line ?? 1) - 1;
    const col = (e.column ?? 1) - 1;
    const len = e.length ?? 1;
    diagnostics.push({
      severity: Error,
      range: { start: { line, character: col }, end: { line, character: col + len } },
      message: e.message ?? 'Lexer error'
    });
  }

  for (const e of parseResult.parserErrors) {
    let range: { start: { line: number; character: number }; end: { line: number; character: number } } | undefined;
    const tok = e.token;
    const prev = 'previousToken' in e ? (e as { previousToken?: { endLine?: number; endColumn?: number; startOffset?: number } }).previousToken : undefined;
    if (tok && typeof tok.startOffset === 'number' && !Number.isNaN(tok.startOffset)) {
      range = {
        start: { line: (tok.startLine ?? 1) - 1, character: (tok.startColumn ?? 1) - 1 },
        end: { line: (tok.endLine ?? 1) - 1, character: tok.endColumn ?? 1 }
      };
    } else if (prev && typeof prev.startOffset === 'number' && !Number.isNaN(prev.startOffset)) {
      const line = (prev.endLine ?? 1) - 1;
      const char = prev.endColumn ?? 0;
      range = { start: { line, character: char }, end: { line, character: char } };
    } else if (prev) {
      range = { start: { line: (prev.endLine ?? 1) - 1, character: prev.endColumn ?? 0 }, end: { line: (prev.endLine ?? 1) - 1, character: prev.endColumn ?? 0 } };
    } else {
      range = { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } };
    }
    diagnostics.push({ severity: Error, range, message: e.message });
  }

  return diagnostics;
}
