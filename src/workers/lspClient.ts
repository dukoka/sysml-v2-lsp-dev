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
}

export const createSysmlLSPClient = (options: LSPClientOptions) => {
  return new SysmlLSPClient(options);
};

export default SysmlLSPClient;
