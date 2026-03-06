export interface VirtualFile {
  name: string;
  uri: string;
  content: string;
  savedContent: string;
  language: string;
}

export interface CursorPosition {
  lineNumber: number;
  column: number;
}

export interface DiagnosticItem {
  severity: 'error' | 'warning' | 'info';
  message: string;
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
  source?: string;
}

export interface FileStoreState {
  files: Map<string, VirtualFile>;
  openTabs: string[];
  activeFileUri: string | null;
  cursorPosition: CursorPosition;
  diagnostics: Map<string, DiagnosticItem[]>;
  lspReady: boolean;
}

export type FileStoreListener = (state: FileStoreState) => void;

function makeUri(name: string): string {
  return `file:///sysmlv2/${name}`;
}

class FileStore {
  private state: FileStoreState = {
    files: new Map(),
    openTabs: [],
    activeFileUri: null,
    cursorPosition: { lineNumber: 1, column: 1 },
    diagnostics: new Map(),
    lspReady: false,
  };

  private listeners = new Set<FileStoreListener>();

  private notify() {
    this.state = { ...this.state };
    for (const fn of this.listeners) fn(this.state);
  }

  subscribe(fn: FileStoreListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  getState(): FileStoreState {
    return this.state;
  }

  addFile(name: string, content: string, language = 'sysmlv2'): string {
    const uri = makeUri(name);
    this.state.files.set(uri, { name, uri, content, savedContent: content, language });
    this.notify();
    return uri;
  }

  removeFile(uri: string) {
    this.state.files.delete(uri);
    this.state.openTabs = this.state.openTabs.filter(u => u !== uri);
    this.state.diagnostics.delete(uri);
    if (this.state.activeFileUri === uri) {
      this.state.activeFileUri = this.state.openTabs[0] ?? null;
    }
    this.notify();
  }

  openTab(uri: string) {
    if (!this.state.openTabs.includes(uri)) {
      this.state.openTabs.push(uri);
    }
    this.state.activeFileUri = uri;
    this.notify();
  }

  closeTab(uri: string) {
    const idx = this.state.openTabs.indexOf(uri);
    if (idx < 0) return;
    this.state.openTabs.splice(idx, 1);
    if (this.state.activeFileUri === uri) {
      const newIdx = Math.min(idx, this.state.openTabs.length - 1);
      this.state.activeFileUri = newIdx >= 0 ? this.state.openTabs[newIdx] : null;
    }
    this.notify();
  }

  setActiveFile(uri: string) {
    if (this.state.files.has(uri)) {
      if (!this.state.openTabs.includes(uri)) {
        this.state.openTabs.push(uri);
      }
      this.state.activeFileUri = uri;
      this.notify();
    }
  }

  updateFileContent(uri: string, content: string) {
    const file = this.state.files.get(uri);
    if (file) {
      file.content = content;
      this.notify();
    }
  }

  saveFile(uri: string) {
    const file = this.state.files.get(uri);
    if (file) {
      file.savedContent = file.content;
      this.notify();
    }
  }

  isFileDirty(uri: string): boolean {
    const file = this.state.files.get(uri);
    return file ? file.content !== file.savedContent : false;
  }

  setCursorPosition(pos: CursorPosition) {
    this.state.cursorPosition = pos;
    this.notify();
  }

  setDiagnostics(uri: string, items: DiagnosticItem[]) {
    this.state.diagnostics.set(uri, items);
    this.notify();
  }

  getDiagnostics(uri: string): DiagnosticItem[] {
    return this.state.diagnostics.get(uri) ?? [];
  }

  getAllDiagnostics(): DiagnosticItem[] {
    const all: DiagnosticItem[] = [];
    for (const items of this.state.diagnostics.values()) {
      all.push(...items);
    }
    return all;
  }

  getDiagnosticCounts(): { errors: number; warnings: number } {
    let errors = 0;
    let warnings = 0;
    for (const items of this.state.diagnostics.values()) {
      for (const item of items) {
        if (item.severity === 'error') errors++;
        else if (item.severity === 'warning') warnings++;
      }
    }
    return { errors, warnings };
  }

  setLspReady(ready: boolean) {
    this.state.lspReady = ready;
    this.notify();
  }

  getActiveFile(): VirtualFile | null {
    if (!this.state.activeFileUri) return null;
    return this.state.files.get(this.state.activeFileUri) ?? null;
  }

  getFile(uri: string): VirtualFile | null {
    return this.state.files.get(uri) ?? null;
  }

  getAllFiles(): VirtualFile[] {
    return Array.from(this.state.files.values());
  }

  createNewFile(): string {
    let counter = 1;
    let name = `untitled-${counter}.sysml`;
    while (this.state.files.has(makeUri(name))) {
      counter++;
      name = `untitled-${counter}.sysml`;
    }
    const content = `package Untitled${counter} {\n  \n}\n`;
    const uri = this.addFile(name, content);
    this.openTab(uri);
    return uri;
  }
}

export const fileStore = new FileStore();
