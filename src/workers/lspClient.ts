// LSP Client for SysMLv2 - communicates with Web Worker

export interface LSPClientOptions {
  worker: Worker;
  documentUri: string;
}

export interface LSPNotification {
  method: string;
  params?: any;
}

class SysmlLSPClient {
  private worker: Worker;
  private documentUri: string;
  private pendingRequests = new Map<number | string, any>();
  private requestId = 0;
  private initialized = false;
  private documentOpen = false;

  constructor(options: LSPClientOptions) {
    this.worker = options.worker;
    this.documentUri = options.documentUri;
    
    // Listen for messages from worker
    this.worker.onmessage = (event: MessageEvent) => {
      const message = event.data;
      this.handleMessage(message);
    };
  }

  private handleMessage(message: any) {
    if (message.id !== undefined) {
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        this.pendingRequests.delete(message.id);
        if (message.error) {
          pending.reject(message.error);
        } else {
          pending.resolve(message.result);
        }
      }
    }
  }

  private async sendRequest(method: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = ++this.requestId;
      this.pendingRequests.set(id, { resolve, reject });
      
      this.worker.postMessage({
        jsonrpc: '2.0',
        id,
        method,
        params
      });
    });
  }

  private sendNotification(method: string, params?: any) {
    this.worker.postMessage({
      jsonrpc: '2.0',
      method,
      params
    });
  }

  async initialize(): Promise<any> {
    if (this.initialized) return;
    
    const result = await this.sendRequest('initialize', {
      processId: null,
      rootUri: null,
      capabilities: {},
      workspaceFolders: null
    });
    
    this.sendNotification('initialized', {});
    this.initialized = true;
    return result;
  }

  async openDocument(content: string): Promise<void> {
    if (this.documentOpen) return;

    this.sendNotification('textDocument/didOpen', {
      textDocument: {
        uri: this.documentUri,
        languageId: 'sysmlv2',
        version: 1,
        text: content
      }
    });
    this.documentOpen = true;
  }

  async updateDocument(content: string, version: number): Promise<void> {
    if (!this.documentOpen) {
      await this.openDocument(content);
      return;
    }

    this.sendNotification('textDocument/didChange', {
      textDocument: {
        uri: this.documentUri,
        version
      },
      contentChanges: [{ text: content }]
    });
  }

  async closeDocument(): Promise<void> {
    if (!this.documentOpen) return;

    this.sendNotification('textDocument/didClose', {
      textDocument: { uri: this.documentUri }
    });
    this.documentOpen = false;
  }

  async getDiagnostics(): Promise<any[]> {
    try {
      const result = await this.sendRequest('textDocument/diagnostic', {
        textDocument: { uri: this.documentUri }
      });
      return result?.items || [];
    } catch (e) {
      console.error('Failed to get diagnostics:', e);
      return [];
    }
  }

  /** G4 独立严格模式：仅 G4 解析诊断，不合并进主诊断。需配置 g4Validation 为 true 时调用。 */
  async getG4Diagnostics(): Promise<any[]> {
    try {
      const result = await this.sendRequest('sysml/g4Diagnostics', {
        textDocument: { uri: this.documentUri }
      });
      return Array.isArray(result) ? result : [];
    } catch (e) {
      console.warn('G4 diagnostics not available:', e);
      return [];
    }
  }

  async getCompletion(position: { line: number; character: number }): Promise<any[]> {
    try {
      const result = await this.sendRequest('textDocument/completion', {
        textDocument: { uri: this.documentUri },
        position
      });
      return result?.items || [];
    } catch (e) {
      console.error('Failed to get completion:', e);
      return [];
    }
  }

  async getHover(position: { line: number; character: number }): Promise<any> {
    try {
      return await this.sendRequest('textDocument/hover', {
        textDocument: { uri: this.documentUri },
        position
      });
    } catch (e) {
      console.error('Failed to get hover:', e);
      return null;
    }
  }

  /** 阶段 G：跳转定义。position 为 LSP 0-based line/character。返回 Location 或 Location[]。 */
  async getDefinition(position: { line: number; character: number }): Promise<{ uri: string; range: { start: { line: number; character: number }; end: { line: number; character: number } } } | { uri: string; range: { start: { line: number; character: number }; end: { line: number; character: number } } }[] | null> {
    try {
      return await this.sendRequest('textDocument/definition', {
        textDocument: { uri: this.documentUri },
        position
      });
    } catch (e) {
      console.error('Failed to get definition:', e);
      return null;
    }
  }

  /** 阶段 G：查找引用。position 为 LSP 0-based；includeDeclaration 是否包含定义处。 */
  async getReferences(position: { line: number; character: number }, includeDeclaration = false): Promise<Array<{ uri: string; range: { start: { line: number; character: number }; end: { line: number; character: number } } }>> {
    try {
      const result = await this.sendRequest('textDocument/references', {
        textDocument: { uri: this.documentUri },
        position,
        context: { includeDeclaration }
      });
      return Array.isArray(result) ? result : [];
    } catch (e) {
      console.error('Failed to get references:', e);
      return [];
    }
  }

  /** 阶段 G：重命名。position 为 LSP 0-based；返回 WorkspaceEdit { changes }。 */
  async getRename(position: { line: number; character: number }, newName: string): Promise<{ changes: Record<string, Array<{ range: { start: { line: number; character: number }; end: { line: number; character: number } }; newText: string }>> } | null> {
    try {
      return await this.sendRequest('textDocument/rename', {
        textDocument: { uri: this.documentUri },
        position,
        newName
      });
    } catch (e) {
      console.error('Failed to rename:', e);
      return null;
    }
  }

  /** 阶段 H：文档符号（大纲）。 */
  async getDocumentSymbols(): Promise<Array<{ name: string; detail?: string; kind: number; range: { start: { line: number; character: number }; end: { line: number; character: number } }; selectionRange?: { start: { line: number; character: number }; end: { line: number; character: number } }; children?: any[] }>> {
    try {
      const result = await this.sendRequest('textDocument/documentSymbol', { textDocument: { uri: this.documentUri } });
      return Array.isArray(result) ? result : [];
    } catch (e) {
      console.error('Failed to get document symbols:', e);
      return [];
    }
  }

  /** 阶段 H：折叠区间。 */
  async getFoldingRanges(): Promise<Array<{ startLine: number; endLine?: number }>> {
    try {
      const result = await this.sendRequest('textDocument/foldingRange', { textDocument: { uri: this.documentUri } });
      return Array.isArray(result) ? result : [];
    } catch (e) {
      console.error('Failed to get folding ranges:', e);
      return [];
    }
  }

  /** 阶段 H：语义 token 数据（delta 编码数组）。 */
  async getSemanticTokens(): Promise<number[]> {
    try {
      const result = await this.sendRequest('textDocument/semanticTokens/full', { textDocument: { uri: this.documentUri } });
      return result?.data ?? [];
    } catch (e) {
      console.error('Failed to get semantic tokens:', e);
      return [];
    }
  }

  /** 阶段 H：签名帮助。position 为 LSP 0-based。 */
  async getSignatureHelp(position: { line: number; character: number }): Promise<{ signatures: Array<{ label: string; documentation?: string; parameters?: Array<{ label: string }> }>; activeSignature: number; activeParameter: number } | null> {
    try {
      return await this.sendRequest('textDocument/signatureHelp', {
        textDocument: { uri: this.documentUri },
        position
      });
    } catch (e) {
      console.error('Failed to get signature help:', e);
      return null;
    }
  }

  /** 阶段 H：代码操作。range 与 diagnostics 为 LSP 格式。 */
  async getCodeActions(range: { start: { line: number; character: number }; end: { line: number; character: number } }, diagnostics: Array<{ range: { start: { line: number; character: number }; end: { line: number; character: number } }; message: string }>): Promise<Array<{ title: string; kind?: string; edit?: any; command?: any }>> {
    try {
      const result = await this.sendRequest('textDocument/codeAction', {
        textDocument: { uri: this.documentUri },
        range,
        context: { diagnostics }
      });
      return Array.isArray(result) ? result : [];
    } catch (e) {
      console.error('Failed to get code actions:', e);
      return [];
    }
  }

  async formatDocument(options?: { tabSize?: number; insertSpaces?: boolean }): Promise<Array<{ range: { start: { line: number; character: number }; end: { line: number; character: number } }; newText: string }>> {
    try {
      const edits = await this.sendRequest('textDocument/formatting', {
        textDocument: { uri: this.documentUri },
        options: { tabSize: options?.tabSize ?? 2, insertSpaces: options?.insertSpaces ?? true }
      });
      return edits ?? [];
    } catch (e) {
      console.error('Failed to format:', e);
      return [];
    }
  }
}

export const createSysmlLSPClient = (options: LSPClientOptions) => {
  return new SysmlLSPClient(options);
};

export default SysmlLSPClient;
