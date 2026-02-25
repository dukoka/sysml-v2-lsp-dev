import { useEffect, useRef } from 'react';
import * as monaco from 'monaco-editor';
import { registerSysmlv2Language, registerSysmlv2Theme, SYSMLV2_LANGUAGE_ID } from '../languages/sysmlv2';
import { createSysmlv2Validator } from '../languages/sysmlv2/validator';
import { createSysmlLSPClient } from '../workers/lspClient';

// Configure Monaco workers
self.MonacoEnvironment = {
  getWorker: function (_moduleId: string, label: string) {
    return new Worker(
      new URL('monaco-editor/esm/vs/editor/editor.worker.js', import.meta.url),
      { type: 'module' }
    );
  }
};

const LSP_DOCUMENT_URI = 'file:///sysmlv2/main.sysml';
const DIAGNOSTIC_DEBOUNCE_MS = 300;

// Default SysMLv2 code example
const DEFAULT_SYSMLV2_CODE = `package VehicleExample {
  // Part definitions
  part def Vehicle {
    part engine: Engine;
    part wheels: Wheel[4];
    port fuelIn: FuelPort;
  }

  part def Engine {
    attribute horsepower: Integer;
  }

  // Port definitions
  port def FuelPort {
    in attribute fuelFlow: Real;
  }
}
`;

interface CodeEditorProps {
  language?: string;
  theme?: string;
  initialValue?: string;
  onChange?: (value: string) => void;
}

function CodeEditor({ 
  language = SYSMLV2_LANGUAGE_ID, 
  theme = 'vs-dark',
  initialValue = DEFAULT_SYSMLV2_CODE,
  onChange,
}: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const lspWorkerRef = useRef<Worker | null>(null);
  const lspClientRef = useRef<ReturnType<typeof createSysmlLSPClient> | null>(null);
  const docVersionRef = useRef(1);
  const diagnosticDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let mounted = true;

    const init = async () => {
      try {
        console.log('Initializing SysMLv2 editor...');

        // Register SysMLv2 language
        registerSysmlv2Language();
        registerSysmlv2Theme();

        console.log('Language registered, creating editor...');

        // Create editor
        const editor = monaco.editor.create(containerRef.current!, {
          value: initialValue,
          language: language,
          theme: theme,
          minimap: { enabled: true },
          fontSize: 14,
          lineNumbers: 'on',
          automaticLayout: true,
          tabSize: 2,
          wordWrap: 'on',
          padding: { top: 16 },
          folding: true,
          foldingStrategy: 'indentation',
          showFoldingControls: 'always',
          glyphMargin: true,
          renderLineHighlight: 'all',
          inlayHints: { enabled: true },
          links: true,
          lens: true,
          suggestOnTriggerCharacters: true,
          acceptSuggestionOnEnter: 'on',
          quickSuggestions: true,
          parameterHints: { enabled: true },
        });

        if (!mounted) {
          editor.dispose();
          return;
        }

        editorRef.current = editor;
        const model = editor.getModel();
        console.log('Model language:', model?.getLanguageId());

        // Handle content changes (for parent)
        editor.onDidChangeModelContent(() => {
          if (onChange) {
            onChange(editor.getValue());
          }
        });

        // LSP: create worker and client (fallback to validator-only if LSP fails)
        let useLsp = false;
        try {
          const worker = new Worker(
            new URL('../workers/sysmlLSPWorker.ts', import.meta.url),
            { type: 'module' }
          );
          lspWorkerRef.current = worker;
          const client = createSysmlLSPClient({
            worker,
            documentUri: LSP_DOCUMENT_URI,
          });
          lspClientRef.current = client;
          await client.initialize();
          await client.openDocument(initialValue);
          useLsp = true;
        } catch (e) {
          console.warn('LSP not available, using validator only:', e);
        }

        // Validation: LSP diagnostics or fallback to local validator
        const validator = createSysmlv2Validator();

        const applyDiagnostics = async (content: string, version: number) => {
          if (!model) return;
          const client = lspClientRef.current;
          if (useLsp && client) {
            try {
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
            } catch {
              const fallback = validator.validate(content);
              monaco.editor.setModelMarkers(model, 'sysmlv2-lsp', []);
              monaco.editor.setModelMarkers(model, 'sysmlv2', fallback);
            }
          } else {
            monaco.editor.setModelMarkers(model, 'sysmlv2-lsp', []);
            const fallback = validator.validate(content);
            monaco.editor.setModelMarkers(model, 'sysmlv2', fallback);
          }
        };

        const scheduleLspDiagnostics = () => {
          if (diagnosticDebounceRef.current) clearTimeout(diagnosticDebounceRef.current);
          diagnosticDebounceRef.current = setTimeout(() => {
            if (!mounted || !editorRef.current) return;
            const model = editorRef.current.getModel();
            if (!model) return;
            docVersionRef.current += 1;
            const content = model.getValue();
            applyDiagnostics(content, docVersionRef.current);
          }, DIAGNOSTIC_DEBOUNCE_MS);
        };

        if (model) {
          applyDiagnostics(initialValue, 1);
          model.onDidChangeContent(() => {
            scheduleLspDiagnostics();
          });
        }

        console.log('Editor ready!', useLsp ? '(LSP enabled)' : '(validator only)');
      } catch (error) {
        console.error('Init error:', error);
      }
    };

    init();

    return () => {
      mounted = false;
      if (diagnosticDebounceRef.current) {
        clearTimeout(diagnosticDebounceRef.current);
        diagnosticDebounceRef.current = null;
      }
      const client = lspClientRef.current;
      if (client && 'closeDocument' in client) {
        (client as { closeDocument: () => Promise<void> }).closeDocument().catch(() => {});
      }
      const worker = lspWorkerRef.current;
      if (worker) {
        worker.terminate();
        lspWorkerRef.current = null;
      }
      lspClientRef.current = null;
      if (editorRef.current) {
        editorRef.current.dispose();
        editorRef.current = null;
      }
    };
  }, []);

  return (
    <div 
      ref={containerRef} 
      style={{ 
        width: '100%', 
        height: '100%',
        minHeight: '400px'
      }} 
    />
  );
}

export default CodeEditor;
