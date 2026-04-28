/**
 * LSP 客户端 - SysMLv2 语言服务器协议客户端，与 Web Worker 通信
 * 负责与 LSP Worker 交换 JSON-RPC 消息，提供代码补全、诊断、跳转定义等功能
 */

/**
 * LSP 客户端选项
 */
export interface LSPClientOptions {
  worker: Worker;         // Web Worker 实例
  documentUri: string;   // 当前文档 URI
}

/**
 * LSP 通知消息
 */
export interface LSPNotification {
  method: string;        // 方法名
  params?: any;         // 参数
}

/**
 * SysMLv2 LSP 客户端类
 * 管理与语言服务器的连接，处理请求/响应和通知
 */
class SysmlLSPClient {
  private worker: Worker;                      // LSP Worker 实例
  private documentUri: string;             // 当前文档 URI
  private pendingRequests = new Map<number | string, any>();  // 待处理的请求
  private requestId = 0;                 // 请求 ID 计数器
  private initialized = false;             // 初始化状态
  private openDocuments = new Set<string>();// 已打开的文档集合

  /**
   * 获取当前文档是否已打开
   */
  get documentOpen(): boolean {
    return this.openDocuments.has(this.documentUri);
  }

  /**
   * 构造函数 - 创建 LSP 客户端实例并设置消息监听
   * @param options - LSP 客户端选项
   */
  constructor(options: LSPClientOptions) {
    this.worker = options.worker;
    this.documentUri = options.documentUri;
    
    // 监听来自 Worker 的消息
    this.worker.onmessage = (event: MessageEvent) => {
      const message = event.data;
      this.handleMessage(message);
    };
  }

  /**
   * 处理来自 Worker 的响应消息
   * 根据消息 ID 找到对应的 Promise 并 resolve/reject
   * @param message - JSON-RPC 响应消息
   */
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

  /**
   * 发送 LSP 请求（需要响应）
   * @param method - LSP 方法名
   * @param params - 方法参数
   * @returns Promise 包含响应结果
   */
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

  /**
   * 发送 LSP 通知（不需要响应）
   * @param method - LSP 方法名
   * @param params - 方法参数
   */
  private sendNotification(method: string, params?: any) {
    this.worker.postMessage({
      jsonrpc: '2.0',
      method,
      params
    });
  }

  /**
   * 初始化 LSP 会话
   * 发送 initialize 请求，建立与语言服务器的连接
   * @returns Promise 包含服务器能力
   */
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

  /**
   * 设置当前文档 URI
   * @param uri - 文档 URI
   */
  setDocumentUri(uri: string): void {
    this.documentUri = uri;
  }

  /**
   * 打开文档
   * 发送 textDocument/didOpen 通知，将文档内容加载到语言服务器
   * @param content - 文档内容
   */
  async openDocument(content: string): Promise<void> {
    if (this.openDocuments.has(this.documentUri)) return;

    this.sendNotification('textDocument/didOpen', {
      textDocument: {
        uri: this.documentUri,
        languageId: 'sysmlv2',
        version: 1,
        text: content
      }
    });
    this.openDocuments.add(this.documentUri);
  }

  /**
   * 更新文档内容
   * 发送 textDocument/didChange 通知
   * @param content - 新文档内容
   * @param version - 文档版本号
   */
  async updateDocument(content: string, version: number): Promise<void> {
    if (!this.openDocuments.has(this.documentUri)) {
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

  /**
   * 获取调试索引类型
   * 请求语言服务器返回当前索引的类型信息
   * @returns 包含类型数量的调试信息
   */
  async getDebugIndexTypes(): Promise<{ count: number; uris: string[]; names: string[] }> {
    try {
      return await this.sendRequest('sysml/debugIndexTypes', {});
    } catch (e) {
      console.error('获取调试索引类型失败:', e);
      return { count: 0, uris: [], names: [] };
    }
  }

  /**
   * 加载库文件
   * 加载标准库文件到索引（不跟踪到 openDocuments）
   * @param uri - 库文件 URI
   * @param content - 库文件内容
   */
  loadLibraryFile(uri: string, content: string): void {
    this.sendNotification('textDocument/didOpen', {
      textDocument: { uri, languageId: 'sysmlv2', version: 1, text: content }
    });
    // 同时发送自定义方法确保立即索引（绕过 TextDocuments 计时）
    this.sendNotification('sysml/indexLibraryFile', { uri, content });
  }

  /**
   * 关闭文档
   * 发送 textDocument/didClose 通知
   */
  async closeDocument(): Promise<void> {
    if (!this.openDocuments.has(this.documentUri)) return;

    this.sendNotification('textDocument/didClose', {
      textDocument: { uri: this.documentUri }
    });
    this.openDocuments.delete(this.documentUri);
  }

  /**
   * 获取诊断信息
   * 请求语言服务器返回当前文档的诊断消息（错误、警告、信息等）
   * @returns 诊断项数组
   */
  async getDiagnostics(): Promise<any[]> {
    try {
      const result = await this.sendRequest('textDocument/diagnostic', {
        textDocument: { uri: this.documentUri }
      });
      return result?.items || [];
    } catch (e) {
      console.error('获取诊断信息失败:', e);
      return [];
    }
  }

  /**
   * 获取 G4 解析诊断
   * G4 独立严格模式：仅 G4 解析诊断，不合并进主诊断
   * 需配置 g4Validation 为 true 时调用
   * @returns G4 诊断项数组
   */
  async getG4Diagnostics(): Promise<any[]> {
    try {
      const result = await this.sendRequest('sysml/g4Diagnostics', {
        textDocument: { uri: this.documentUri }
      });
      return Array.isArray(result) ? result : [];
    } catch (e) {
      console.warn('G4 诊断不可用:', e);
      return [];
    }
  }

  /**
   * 获取代码补全建议
   * 请求语言服务器返回指定位置的补全候选列表
   * @param position - 光标位置（0-based 行/列）
   * @returns 补全项数组
   */
  async getCompletion(position: { line: number; character: number }): Promise<any[]> {
    try {
      const result = await this.sendRequest('textDocument/completion', {
        textDocument: { uri: this.documentUri },
        position
      });
      if (Array.isArray(result)) return result;
      return result?.items || [];
    } catch (e) {
      console.error('获取补全建议失败:', e);
      return [];
    }
  }

  /**
   * 获取悬停信息
   * 请求语言服务器返回指定位置的悬停提示（类型信息、文档）
   * @param position - 光标位置（0-based 行/列）
   * @returns 悬停信息对象
   */
  async getHover(position: { line: number; character: number }): Promise<any> {
    try {
      return await this.sendRequest('textDocument/hover', {
        textDocument: { uri: this.documentUri },
        position
      });
    } catch (e) {
      console.error('获取悬停信息失败:', e);
      return null;
    }
  }

  /**
   * 跳转到定义
   * 请求语言服务器返回符号的定义位置
   * @param position - 光标位置（0-based 行/列）
   * @returns Location 或 Location[]（定义位置）
   */
  async getDefinition(position: { line: number; character: number }): Promise<{ uri: string; range: { start: { line: number; character: number }; end: { line: number; character: number } } } | { uri: string; range: { start: { line: number; character: number }; end: { line: number; character: number } } }[] | null> {
    try {
      return await this.sendRequest('textDocument/definition', {
        textDocument: { uri: this.documentUri },
        position
      });
    } catch (e) {
      console.error('获取定义位置失败:', e);
      return null;
    }
  }

  /**
   * 查找引用
   * 请求语言服务器返回符号的所有引用位置
   * @param position - 光标位置（0-based 行/列）
   * @param includeDeclaration - 是否包含定义处
   * @returns 引用位置数组
   */
  async getReferences(position: { line: number; character: number }, includeDeclaration = false): Promise<Array<{ uri: string; range: { start: { line: number; character: number }; end: { line: number; character: number } } }>> {
    try {
      const result = await this.sendRequest('textDocument/references', {
        textDocument: { uri: this.documentUri },
        position,
        context: { includeDeclaration }
      });
      return Array.isArray(result) ? result : [];
    } catch (e) {
      console.error('获取引用位置失败:', e);
      return [];
    }
  }

  /**
   * 重命名符号
   * 请求语言服务器返回重命名的编辑结果
   * @param position - 光标位置（0-based 行/列）
   * @param newName - 新符号名称
   * @returns WorkspaceEdit（需要应用的更改）
   */
  async getRename(position: { line: number; character: number }, newName: string): Promise<{ changes: Record<string, Array<{ range: { start: { line: number; character: number }; end: { line: number; character: number } }; newText: string }>> } | null> {
    try {
      return await this.sendRequest('textDocument/rename', {
        textDocument: { uri: this.documentUri },
        position,
        newName
      });
    } catch (e) {
      console.error('重命名失败:', e);
      return null;
    }
  }

  /**
   * 获取文档符号（大纲视图）
   * 请求语言服务器返回文档中的所有符号
   * @returns 符号信息数组
   */
  async getDocumentSymbols(): Promise<Array<{ name: string; detail?: string; kind: number; range: { start: { line: number; character: number }; end: { line: number; character: number } }; selectionRange?: { start: { line: number; character: number }; end: { line: number; character: number } }; children?: any[] }>> {
    try {
      const result = await this.sendRequest('textDocument/documentSymbol', { textDocument: { uri: this.documentUri } });
      return Array.isArray(result) ? result : [];
    } catch (e) {
      console.error('获取文档符号失败:', e);
      return [];
    }
  }

  /**
   * 获取折叠区间
   * 请求语言服务器返回可折叠的代码区域
   * @returns 折叠区间数组
   */
  async getFoldingRanges(): Promise<Array<{ startLine: number; endLine?: number }>> {
    try {
      const result = await this.sendRequest('textDocument/foldingRange', { textDocument: { uri: this.documentUri } });
      return Array.isArray(result) ? result : [];
    } catch (e) {
      console.error('获取折叠区间失败:', e);
      return [];
    }
  }

  /**
   * 获取语义标记数据
   * 请求语言服务器返回语义的标记数据（用于语法高亮）
   * @returns delta 编码的标记数组
   */
  async getSemanticTokens(): Promise<number[]> {
    try {
      const result = await this.sendRequest('textDocument/semanticTokens/full', { textDocument: { uri: this.documentUri } });
      return result?.data ?? [];
    } catch (e) {
      console.error('获取语义标记失败:', e);
      return [];
    }
  }

  /**
   * 获取签名帮助
   * 请求语言服务器返回函数调用的签名信息
   * @param position - 光标位置（0-based 行/列）
   * @returns 签名帮助对象
   */
  async getSignatureHelp(position: { line: number; character: number }): Promise<{ signatures: Array<{ label: string; documentation?: string; parameters?: Array<{ label: string }> }>; activeSignature: number; activeParameter: number } | null> {
    try {
      return await this.sendRequest('textDocument/signatureHelp', {
        textDocument: { uri: this.documentUri },
        position
      });
    } catch (e) {
      console.error('获取签名帮助失败:', e);
      return null;
    }
  }

  /**
   * 获取代码操作
   * 请求语言服务器返回可执行的代码操作（快速修复等）
   * @param range - 代码范围
   * @param diagnostics - 诊断信息
   * @returns 代码操作数组
   */
  async getCodeActions(range: { start: { line: number; character: number }; end: { line: number; character: number } }, diagnostics: Array<{ range: { start: { line: number; character: number }; end: { line: number; character: number } }; message: string }>): Promise<Array<{ title: string; kind?: string; edit?: any; command?: any }>> {
    try {
      const result = await this.sendRequest('textDocument/codeAction', {
        textDocument: { uri: this.documentUri },
        range,
        context: { diagnostics }
      });
      return Array.isArray(result) ? result : [];
    } catch (e) {
      console.error('获取代码操作失败:', e);
      return [];
    }
  }

  /**
   * 格式化整个文档
   * @param options - 格式化选项（tabSize, insertSpaces）
   * @returns 文本编辑数组
   */
  async formatDocument(options?: { tabSize?: number; insertSpaces?: boolean }): Promise<Array<{ range: { start: { line: number; character: number }; end: { line: number; character: number } }; newText: string }>> {
    try {
      const edits = await this.sendRequest('textDocument/formatting', {
        textDocument: { uri: this.documentUri },
        options: { tabSize: options?.tabSize ?? 2, insertSpaces: options?.insertSpaces ?? true }
      });
      return edits ?? [];
    } catch (e) {
      console.error('格式化文档失败:', e);
      return [];
    }
  }

  /**
   * 跳转到类型定义
   * @param position - 光标位置（0-based 行/列）
   * @returns 类型定义位置
   */
  async getTypeDefinition(position: { line: number; character: number }): Promise<{ uri: string; range: { start: { line: number; character: number }; end: { line: number; character: number } } } | null> {
    try {
      return await this.sendRequest('textDocument/typeDefinition', {
        textDocument: { uri: this.documentUri },
        position
      });
    } catch (e) {
      console.error('获取类型定义失败:', e);
      return null;
    }
  }

  /**
   * 获取代码镜头
   * 请求代码引用计数等信息
   * @returns 代码镜头数组
   */
  async getCodeLens(): Promise<Array<{ range: { start: { line: number; character: number }; end: { line: number; character: number } }; command?: { title: string; command: string; arguments?: unknown[] } }>> {
    try {
      const result = await this.sendRequest('textDocument/codeLens', {
        textDocument: { uri: this.documentUri }
      });
      return Array.isArray(result) ? result : [];
    } catch (e) {
      console.error('获取代码镜头失败:', e);
      return [];
    }
  }

  /**
   * 获取文档高亮
   * @param position - 光标位置
   * @returns 文档高亮区域数组
   */
  async getDocumentHighlights(position: { line: number; character: number }): Promise<Array<{ range: { start: { line: number; character: number }; end: { line: number; character: number } }; kind?: number }>> {
    try {
      const result = await this.sendRequest('textDocument/documentHighlight', {
        textDocument: { uri: this.documentUri },
        position
      });
      return Array.isArray(result) ? result : [];
    } catch (e) {
      console.error('获取文档高亮失败:', e);
      return [];
    }
  }

  /**
   * 获取工作区符号
   * @param query - 搜索查询
   * @returns 工作区符号数组
   */
  async getWorkspaceSymbols(query: string): Promise<Array<{ name: string; kind: number; location: { uri: string; range: { start: { line: number; character: number }; end: { line: number; character: number } } }; containerName?: string }>> {
    try {
      const result = await this.sendRequest('workspace/symbol', { query });
      return Array.isArray(result) ? result : [];
    } catch (e) {
      console.error('获取工作区符号失败:', e);
      return [];
    }
  }

  /**
   * 获取内联提示
   * @param range - 目标范围
   * @returns 内联提示数组
   */
  async getInlayHints(range: { start: { line: number; character: number }; end: { line: number; character: number } }): Promise<Array<{ position: { line: number; character: number }; label: string; kind?: number; paddingLeft?: boolean }>> {
    try {
      const result = await this.sendRequest('textDocument/inlayHint', {
        textDocument: { uri: this.documentUri },
        range
      });
      return Array.isArray(result) ? result : [];
    } catch (e) {
      console.error('获取内联提示失败:', e);
      return [];
    }
  }

  /**
   * 按字符格式化
   * @param position - 光标位置
   * @param ch - 输入的字符
   * @param options - 格式化选项
   * @returns 文本编辑数组
   */
  async getOnTypeFormatting(position: { line: number; character: number }, ch: string, options?: { tabSize?: number; insertSpaces?: boolean }): Promise<Array<{ range: { start: { line: number; character: number }; end: { line: number; character: number } }; newText: string }>> {
    try {
      const result = await this.sendRequest('textDocument/onTypeFormatting', {
        textDocument: { uri: this.documentUri },
        position,
        ch,
        options: options ?? { tabSize: 2, insertSpaces: true }
      });
      return Array.isArray(result) ? result : [];
    } catch (e) {
      console.error('获取按字符格式化失败:', e);
      return [];
    }
  }

  /**
   * 格式化文档区域
   * @param range - 目标范围
   * @param options - 格式化选项
   * @returns 文本编辑数组
   */
  async formatDocumentRange(range: { start: { line: number; character: number }; end: { line: number; character: number } }, options?: { tabSize?: number; insertSpaces?: boolean }): Promise<Array<{ range: { start: { line: number; character: number }; end: { line: number; character: number } }; newText: string }>> {
    try {
      const result = await this.sendRequest('textDocument/rangeFormatting', {
        textDocument: { uri: this.documentUri },
        range,
        options: options ?? { tabSize: 2, insertSpaces: true }
      });
      return Array.isArray(result) ? result : [];
    } catch (e) {
      console.error('格式化文档区域失败:', e);
      return [];
    }
  }

  /**
   * 获取选择范围
   * @param positions - 光标位置数组
   * @returns 选择范围数组（含父子关系）
   */
  async getSelectionRanges(positions: Array<{ line: number; character: number }>): Promise<Array<{ range: { start: { line: number; character: number }; end: { line: number; character: number } }; parent?: any }>> {
    try {
      const result = await this.sendRequest('textDocument/selectionRange', {
        textDocument: { uri: this.documentUri },
        positions
      });
      return Array.isArray(result) ? result : [];
    } catch (e) {
      console.error('获取选择范围失败:', e);
      return [];
    }
  }

  /**
   * 获取链接编辑范围
   * @param position - 光标位置
   * @returns 链接编辑范围
   */
  async getLinkedEditingRanges(position: { line: number; character: number }): Promise<{ ranges: Array<{ start: { line: number; character: number }; end: { line: number; character: number } }>; wordPattern?: string } | null> {
    try {
      const result = await this.sendRequest('textDocument/linkedEditingRange', {
        textDocument: { uri: this.documentUri },
        position
      });
// TODO: 调查 LSP linkedEditingRange 的正确返回类型
        return result as any ?? null;
    } catch (e) {
      console.error('获取链接编辑范围失败:', e);
      return null;
    }
  }
}

/**
 * 创建 SysMLv2 LSP 客户端实例
 * @param options - LSP 客户端选项
 * @returns SysMLv2 LSP 客户端实例
 */
export const createSysmlLSPClient = (options: LSPClientOptions) => {
  return new SysmlLSPClient(options);
};

/**
 * SysMLv2 LSP 客户端类（默认导出）
 */
export default SysmlLSPClient;
