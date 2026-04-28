import { useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import * as monaco from 'monaco-editor';
import { registerSysmlv2Language, registerSysmlv2Theme, setSysmlv2LspClientGetter, SYSMLV2_LANGUAGE_ID } from '../languages/sysmlv2';
import { createSysmlv2Validator } from '../languages/sysmlv2/validator';
import { createSysmlLSPClient } from '../workers/lspClient';
import { loadStandardLibrary } from '../workers/stdlibLoader';
import { isG4ValidationEnabled } from '../grammar/config';
import type { DiagnosticItem, CursorPosition } from '../store/fileStore';

self.MonacoEnvironment = {
  getWorker: function (_moduleId: string, _label: string) {
    return new Worker(
      new URL('monaco-editor/esm/vs/editor/editor.worker.js', import.meta.url),
      { type: 'module' }
    );
  }
};

const DIAGNOSTIC_DEBOUNCE_MS = 300;

interface CodeEditorProps {
  fileUri: string | null;
  fileContent: string;
  language?: string;
  theme?: string;
  onContentChange?: (uri: string, content: string) => void;
  onCursorChange?: (pos: CursorPosition) => void;
  onDiagnosticsChange?: (uri: string, items: DiagnosticItem[]) => void;
  onLspReady?: (ready: boolean) => void;
}

export interface CodeEditorHandle {
  formatDocument: () => void;
  goToLine: (line: number, column?: number) => void;
  getEditor: () => monaco.editor.IStandaloneCodeEditor | null;
}

const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(function CodeEditor(
  {
    fileUri,
    fileContent,
    language = SYSMLV2_LANGUAGE_ID,
    theme = 'vs-dark',
    onContentChange,
    onCursorChange,
    onDiagnosticsChange,
    onLspReady,
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const lspWorkerRef = useRef<Worker | null>(null);
  const lspClientRef = useRef<ReturnType<typeof createSysmlLSPClient> | null>(null);
  const docVersionRef = useRef<Map<string, number>>(new Map());
  const diagnosticDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modelsRef = useRef<Map<string, monaco.editor.ITextModel>>(new Map());
  const useLspRef = useRef(false);
  const validatorRef = useRef(createSysmlv2Validator());
  const mountedRef = useRef(true);
  const currentUriRef = useRef<string | null>(null);
  const contentChangeDisposableRef = useRef<monaco.IDisposable | null>(null);

  const onContentChangeRef = useRef(onContentChange);
  onContentChangeRef.current = onContentChange;
  const onCursorChangeRef = useRef(onCursorChange);
  onCursorChangeRef.current = onCursorChange;
  const onDiagnosticsChangeRef = useRef(onDiagnosticsChange);
  onDiagnosticsChangeRef.current = onDiagnosticsChange;
  const onLspReadyRef = useRef(onLspReady);
  onLspReadyRef.current = onLspReady;

  const convertMarkersToDiagnostics = useCallback((markers: monaco.editor.IMarkerData[]): DiagnosticItem[] => {
    return markers.map(m => ({
      severity: m.severity === monaco.MarkerSeverity.Error ? 'error' as const :
                m.severity === monaco.MarkerSeverity.Warning ? 'warning' as const : 'info' as const,
      message: m.message,
      startLineNumber: m.startLineNumber,
      startColumn: m.startColumn,
      endLineNumber: m.endLineNumber,
      endColumn: m.endColumn,
      source: m.source,
    }));
  }, []);

  const applyDiagnostics = useCallback(async (uri: string, content: string, version: number) => {
    const model = modelsRef.current.get(uri);
    if (!model) return;
    const client = lspClientRef.current;
    const useLsp = useLspRef.current;

    if (useLsp && client) {
      try {
        client.setDocumentUri(uri);
        await client.updateDocument(content, version);
        const items = await client.getDiagnostics();
        const markers: monaco.editor.IMarkerData[] = (items || []).map(
          (item: {
            range: { start?: { line: number; character: number }; end?: { line: number; character: number }; startLine?: number; startColumn?: number; endLine?: number; endColumn?: number };
            severity?: number;
            message: string;
          }) => {
            const r = item.range;
            const start = r.start !== undefined ? { line: r.start.line + 1, col: r.start.character + 1 } : { line: r.startLine!, col: r.startColumn! };
            const end = r.end !== undefined ? { line: r.end.line + 1, col: r.end.character + 1 } : { line: r.endLine!, col: r.endColumn! };
            return {
              startLineNumber: start.line,
              startColumn: start.col,
              endLineNumber: end.line,
              endColumn: end.col,
              message: item.message,
              severity: (item.severity === 1 || item.severity === 8) ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning,
            };
          }
        );
        monaco.editor.setModelMarkers(model, 'sysmlv2', []);
        monaco.editor.setModelMarkers(model, 'sysmlv2-lsp', markers);

        if (isG4ValidationEnabled()) {
          const g4Items = await client.getG4Diagnostics();
          const g4Markers: monaco.editor.IMarkerData[] = g4Items.map(
            (item: { range?: { start?: { line: number; character: number }; end?: { line: number; character: number } }; severity?: number; message: string }) => {
              const r = item.range ?? {};
              const start = r.start ?? { line: 0, character: 0 };
              const end = r.end ?? { line: 0, character: 0 };
              return {
                startLineNumber: start.line + 1,
                startColumn: start.character + 1,
                endLineNumber: end.line + 1,
                endColumn: end.character + 1,
                message: item.message,
                severity: (item.severity === 1 || item.severity === 8) ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning,
              };
            }
          );
          monaco.editor.setModelMarkers(model, 'sysmlv2-g4', g4Markers);
        } else {
          monaco.editor.setModelMarkers(model, 'sysmlv2-g4', []);
        }

        const allMarkers = monaco.editor.getModelMarkers({ resource: model.uri });
        onDiagnosticsChangeRef.current?.(uri, convertMarkersToDiagnostics(allMarkers));
      } catch {
        const fallback = validatorRef.current.validate(content);
        monaco.editor.setModelMarkers(model, 'sysmlv2-lsp', []);
        monaco.editor.setModelMarkers(model, 'sysmlv2', fallback);
        onDiagnosticsChangeRef.current?.(uri, convertMarkersToDiagnostics(fallback));
      }
    } else {
      monaco.editor.setModelMarkers(model, 'sysmlv2-lsp', []);
      monaco.editor.setModelMarkers(model, 'sysmlv2-g4', []);
      const fallback = validatorRef.current.validate(content);
      monaco.editor.setModelMarkers(model, 'sysmlv2', fallback);
      onDiagnosticsChangeRef.current?.(uri, convertMarkersToDiagnostics(fallback));
    }
  }, [convertMarkersToDiagnostics]);

  const scheduleDiagnostics = useCallback((uri: string) => {
    if (diagnosticDebounceRef.current) clearTimeout(diagnosticDebounceRef.current);
    diagnosticDebounceRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      const model = modelsRef.current.get(uri);
      if (!model) return;
      const ver = (docVersionRef.current.get(uri) ?? 0) + 1;
      docVersionRef.current.set(uri, ver);
      applyDiagnostics(uri, model.getValue(), ver);
    }, DIAGNOSTIC_DEBOUNCE_MS);
  }, [applyDiagnostics]);

  useImperativeHandle(ref, () => ({
    formatDocument: () => {
      const editor = editorRef.current;
      if (editor) {
        editor.getAction('editor.action.formatDocument')?.run();
      }
    },
    goToLine: (line: number, column = 1) => {
      const editor = editorRef.current;
      if (editor) {
        editor.setPosition({ lineNumber: line, column });
        editor.revealLineInCenter(line);
        editor.focus();
      }
    },
    getEditor: () => editorRef.current,
  }));

  // Initialize editor once
  useEffect(() => {
    if (!containerRef.current) return;
    mountedRef.current = true;

    registerSysmlv2Language();
    registerSysmlv2Theme();

    const editor = monaco.editor.create(containerRef.current, {
      language,
      theme,
      minimap: { enabled: true },
      fontSize: 14,
      lineNumbers: 'on',
      automaticLayout: true,
      tabSize: 2,
      wordWrap: 'on',
      padding: { top: 8 },
      folding: true,
      foldingStrategy: 'indentation',
      showFoldingControls: 'always',
      glyphMargin: true,
      renderLineHighlight: 'all',
      inlayHints: { enabled: 'on' as const },
      links: true,
      suggestOnTriggerCharacters: true,
      acceptSuggestionOnEnter: 'on',
      quickSuggestions: true,
      parameterHints: { enabled: true },
    });

    editorRef.current = editor;
// Justified: Attaching to window for debugging purposes only. Not used in production.
    (window as any).__monacoEditorInstance = editor;
// Justified: Attaching to window for debugging purposes only. Not used in production.
    (window as any).__monaco = monaco;

     // Justified: Monaco editor extension API uses 'any' for command callback until proper types are available.
     (monaco.editor as any).registerCommand?.('sysml.goToFirstDefinition', (_: any, lineNumber: number, column: number) => {
      const ed = editorRef.current;
      if (ed && typeof lineNumber === 'number' && typeof column === 'number') {
        ed.setPosition({ lineNumber, column });
        ed.revealLineInCenter(lineNumber);
      }
    });

     // Justified: Monaco editor extension API uses 'any' for command callback until proper types are available.
     (monaco.editor as any).registerCommand?.('sysml.showReferences', (_: any, uri: string, position: { line: number; character: number }) => {
      const ed = editorRef.current;
      if (ed && position) {
        const monacoPos = { lineNumber: position.line + 1, column: position.character + 1 };
        ed.setPosition(monacoPos);
        ed.revealLineInCenter(monacoPos.lineNumber);
        ed.focus();
        ed.trigger('codeLens', 'editor.action.goToReferences', null);
      }
    });

    editor.onDidChangeCursorPosition((e) => {
      onCursorChangeRef.current?.({
        lineNumber: e.position.lineNumber,
        column: e.position.column,
      });
    });

    // LSP init
    (async () => {
      try {
        const worker = new Worker(
          new URL('../workers/sysmlLSPWorker.ts', import.meta.url),
          { type: 'module' }
        );
        lspWorkerRef.current = worker;
        const client = createSysmlLSPClient({
          worker,
          documentUri: 'file:///sysmlv2/init.sysml',
        });
        lspClientRef.current = client;
        setSysmlv2LspClientGetter(() => lspClientRef.current);
        await client.initialize();
        useLspRef.current = true;
        onLspReadyRef.current?.(true);
        // Load standard library in background (non-blocking)
        loadStandardLibrary(client).then(async ({ loaded, failed }) => {
          if (failed > 0) console.warn(`SysMLv2 stdlib: ${loaded} loaded, ${failed} failed`);
          else console.log(`SysMLv2 stdlib: ${loaded} files loaded`);
          const debug = await client.getDebugIndexTypes();
          console.log(`[debug] index: ${debug.count} type names across ${debug.uris.length} files`);
          console.log('[debug] sample types:', debug.names.slice(0, 20));
          if (!debug.names.includes('ScalarValue') && !debug.names.includes('Part')) {
            console.warn('[debug] stdlib types NOT found in index — regex extraction may have failed');
            console.log('[debug] all indexed URIs:', debug.uris);
          }
        });
      } catch (e) {
        console.warn('LSP not available:', e);
        onLspReadyRef.current?.(false);
      }
    })();

    return () => {
      mountedRef.current = false;
      setSysmlv2LspClientGetter(null);
      if (diagnosticDebounceRef.current) clearTimeout(diagnosticDebounceRef.current);
      contentChangeDisposableRef.current?.dispose();

      const client = lspClientRef.current;
      if (client) {
        for (const uri of modelsRef.current.keys()) {
          client.setDocumentUri(uri);
          client.closeDocument().catch(() => {});
        }
      }

      lspWorkerRef.current?.terminate();
      lspWorkerRef.current = null;
      lspClientRef.current = null;

      for (const model of modelsRef.current.values()) {
        model.dispose();
      }
      modelsRef.current.clear();

      editor.dispose();
      editorRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Switch theme
  useEffect(() => {
    if (editorRef.current) {
      monaco.editor.setTheme(theme);
    }
  }, [theme]);

  // Switch file (model)
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !fileUri) return;

    const prevUri = currentUriRef.current;
    currentUriRef.current = fileUri;

    contentChangeDisposableRef.current?.dispose();

    let model = modelsRef.current.get(fileUri);
    if (!model) {
      const monacoUri = monaco.Uri.parse(fileUri);
      model = monaco.editor.createModel(fileContent, language, monacoUri);
      modelsRef.current.set(fileUri, model);

      // Open document in LSP
      const client = lspClientRef.current;
      if (client && useLspRef.current) {
        client.setDocumentUri(fileUri);
        client.openDocument(fileContent).catch(() => {});
      }
    }

    if (editor.getModel() !== model) {
      editor.setModel(model);
    }

    // Update LSP client's active document
    if (lspClientRef.current && useLspRef.current) {
      lspClientRef.current.setDocumentUri(fileUri);
    }

    contentChangeDisposableRef.current = model.onDidChangeContent(() => {
      const val = model!.getValue();
      onContentChangeRef.current?.(fileUri, val);
      scheduleDiagnostics(fileUri);
    });

    // Initial diagnostics
    if (prevUri !== fileUri) {
      scheduleDiagnostics(fileUri);
    }
  }, [fileUri, fileContent, language, scheduleDiagnostics]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', minHeight: '200px' }}
    />
  );
});

export default CodeEditor;
