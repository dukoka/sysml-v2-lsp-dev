import { useState, useEffect, useRef, useCallback } from 'react';
import CodeEditor, { type CodeEditorHandle } from './components/CodeEditor';
import Toolbar from './components/Toolbar';
import TabBar from './components/TabBar';
import Sidebar from './components/Sidebar';
import ProblemsPanel from './components/ProblemsPanel';
import StatusBar from './components/StatusBar';
import { fileStore, type CursorPosition, type DiagnosticItem } from './store/fileStore';
import { useFileStore } from './store/useFileStore';
import { EXAMPLE_FILES } from './store/exampleFiles';
import { SYSMLV2_LANGUAGE_ID } from './languages/sysmlv2';
import './App.css';

interface OutlineSymbol {
  name: string;
  kind: string;
  line: number;
  children?: OutlineSymbol[];
}

function parseOutlineFromContent(content: string): OutlineSymbol[] {
  const symbols: OutlineSymbol[] = [];
  const lines = content.split('\n');
  const stack: { sym: OutlineSymbol; depth: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*')) continue;

    const indent = line.search(/\S/);
    let match: RegExpMatchArray | null;

    if ((match = trimmed.match(/^package\s+(\w+)/))) {
      addSymbol(symbols, stack, { name: match[1], kind: 'package', line: i + 1 }, indent);
    } else if ((match = trimmed.match(/^(part|port|action|state|flow|item|connection|constraint)\s+def\s+(\w+)/))) {
      addSymbol(symbols, stack, { name: match[2], kind: match[1], line: i + 1 }, indent);
    } else if ((match = trimmed.match(/^requirement\s+(?:def\s+)?(\w+)/))) {
      addSymbol(symbols, stack, { name: match[1], kind: 'requirement', line: i + 1 }, indent);
    } else if ((match = trimmed.match(/^enum\s+(\w+)/))) {
      addSymbol(symbols, stack, { name: match[1], kind: 'enum', line: i + 1 }, indent);
    } else if ((match = trimmed.match(/^attribute\s+(\w+)/))) {
      addSymbol(symbols, stack, { name: match[1], kind: 'attribute', line: i + 1 }, indent);
    }
  }

  return symbols;
}

function addSymbol(
  root: OutlineSymbol[],
  stack: { sym: OutlineSymbol; depth: number }[],
  sym: OutlineSymbol,
  depth: number
) {
  sym.children = [];
  while (stack.length > 0 && stack[stack.length - 1].depth >= depth) {
    stack.pop();
  }
  if (stack.length > 0) {
    stack[stack.length - 1].sym.children!.push(sym);
  } else {
    root.push(sym);
  }
  stack.push({ sym, depth });
}

function App() {
  const state = useFileStore();
  const editorRef = useRef<CodeEditorHandle>(null);

  const [theme, setTheme] = useState('vs-dark');
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [problemsExpanded, setProblemsExpanded] = useState(false);
  const [outlineSymbols, setOutlineSymbols] = useState<OutlineSymbol[]>([]);

  // Initialize example files on first mount
  useEffect(() => {
    if (fileStore.getAllFiles().length === 0) {
      for (const f of EXAMPLE_FILES) {
        fileStore.addFile(f.name, f.content);
      }
      const firstUri = fileStore.getAllFiles()[0]?.uri;
      if (firstUri) {
        fileStore.openTab(firstUri);
      }
    }
  }, []);

  // Set data-theme on document for CSS variable switching
  useEffect(() => {
    const dataTheme = theme.includes('light') ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', dataTheme);
  }, [theme]);

  // Update outline when active file changes
  useEffect(() => {
    const file = state.activeFileUri ? fileStore.getFile(state.activeFileUri) : null;
    if (file) {
      setOutlineSymbols(parseOutlineFromContent(file.content));
    } else {
      setOutlineSymbols([]);
    }
  }, [state.activeFileUri, state.files]);

  const handleContentChange = useCallback((uri: string, content: string) => {
    fileStore.updateFileContent(uri, content);
  }, []);

  const handleCursorChange = useCallback((pos: CursorPosition) => {
    fileStore.setCursorPosition(pos);
  }, []);

  const handleDiagnosticsChange = useCallback((uri: string, items: DiagnosticItem[]) => {
    fileStore.setDiagnostics(uri, items);
  }, []);

  const handleLspReady = useCallback((ready: boolean) => {
    fileStore.setLspReady(ready);
  }, []);

  const handleNewFile = useCallback(() => {
    fileStore.createNewFile();
  }, []);

  const handleFormat = useCallback(() => {
    editorRef.current?.formatDocument();
  }, []);

  const handleGoToLine = useCallback((line: number, col = 1) => {
    editorRef.current?.goToLine(line, col);
  }, []);

  const handleToggleProblems = useCallback(() => {
    setProblemsExpanded(prev => !prev);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        setSidebarVisible(prev => !prev);
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'M') {
        e.preventDefault();
        setProblemsExpanded(prev => !prev);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        handleNewFile();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (state.activeFileUri) {
          fileStore.saveFile(state.activeFileUri);
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        handleFormat();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [state.activeFileUri, handleNewFile, handleFormat]);

  const activeFile = state.activeFileUri ? fileStore.getFile(state.activeFileUri) : null;
  const currentDiagnostics = state.activeFileUri
    ? fileStore.getDiagnostics(state.activeFileUri)
    : [];
  const { errors, warnings } = fileStore.getDiagnosticCounts();

  return (
    <div className="app-container">
      <Toolbar
        theme={theme}
        onThemeChange={setTheme}
        onNewFile={handleNewFile}
        onFormat={handleFormat}
        onToggleSidebar={() => setSidebarVisible(prev => !prev)}
        onToggleProblems={handleToggleProblems}
        sidebarVisible={sidebarVisible}
        problemsVisible={problemsExpanded}
      />

      <div className="app-body">
        <Sidebar
          files={fileStore.getAllFiles()}
          activeFileUri={state.activeFileUri}
          isFileDirty={(uri) => fileStore.isFileDirty(uri)}
          outlineSymbols={outlineSymbols}
          onGoToLine={handleGoToLine}
          collapsed={!sidebarVisible}
        />

        <div className="editor-main">
          <TabBar
            openTabs={state.openTabs}
            activeFileUri={state.activeFileUri}
            isFileDirty={(uri) => fileStore.isFileDirty(uri)}
            getFileName={(uri) => fileStore.getFile(uri)?.name ?? 'untitled'}
          />

          <div className="editor-area">
            {activeFile ? (
              <CodeEditor
                ref={editorRef}
                fileUri={state.activeFileUri}
                fileContent={activeFile.content}
                language={SYSMLV2_LANGUAGE_ID}
                theme={theme}
                onContentChange={handleContentChange}
                onCursorChange={handleCursorChange}
                onDiagnosticsChange={handleDiagnosticsChange}
                onLspReady={handleLspReady}
              />
            ) : (
              <div className="welcome-overlay">
                <h2>SysMLv2 Editor</h2>
                <p>Open a file from the sidebar or create a new file to get started.</p>
              </div>
            )}
          </div>

          <ProblemsPanel
            diagnostics={currentDiagnostics}
            errorCount={errors}
            warningCount={warnings}
            expanded={problemsExpanded}
            onToggle={handleToggleProblems}
            onGoToProblem={handleGoToLine}
          />
        </div>
      </div>

      <StatusBar
        cursorPosition={state.cursorPosition}
        charCount={activeFile?.content.length ?? 0}
        lspReady={state.lspReady}
        language={SYSMLV2_LANGUAGE_ID}
        errorCount={errors}
        warningCount={warnings}
        onToggleProblems={handleToggleProblems}
      />
    </div>
  );
}

export default App;
