# connection.onInitialize()

## 函数签名
```typescript
connection.onInitialize((): InitializeResult => ({
  capabilities: {
    textDocumentSync: TextDocumentSyncKind.Full,
    completionProvider: { triggerCharacters: ['.', ':', '(', '['], resolveProvider: false },
    hoverProvider: true,
    definitionProvider: true,
    referencesProvider: true,
    renameProvider: { prepareProvider: true },
    documentSymbolProvider: true,
    foldingRangeProvider: true,
    semanticTokensProvider: { full: { delta: false }, legend: { tokenTypes: semanticTokensLegendLsp.tokenTypes, tokenModifiers: semanticTokensLegendLsp.tokenModifiers } },
    signatureHelpProvider: { triggerCharacters: ['(', ','] },
    typeDefinitionProvider: true,
    codeLensProvider: { resolveProvider: false },
    codeActionProvider: { codeActionKinds: ['quickfix', 'refactor'] },
    diagnosticProvider: { interFileDependencies: true, workspaceDiagnostics: true },
    documentHighlightProvider: true,
    documentFormattingProvider: true,
    documentRangeFormattingProvider: true,
    documentOnTypeFormattingProvider: { firstTriggerCharacter: '}', moreTriggerCharacter: [';', '\n'] },
    inlayHintProvider: true,
    workspaceSymbolProvider: true,
    selectionRangeProvider: true,
    linkedEditingRangeProvider: true,
    workspace: { workspaceFolders: { supported: true } }
  },
  serverInfo: { name: 'SysMLv2 LSP', version: '1.0.0' }
}));
```

## 位置
src/workers/sysmlLSPWorker.ts:279

## 参数
无（该函数不接受参数，返回 InitializeResult 对象）

## 返回值
- `InitializeResult` - 包含服务器能力集和服务器信息的对象

## 描述
处理来自客户端的 LSP 初始化请求。返回 SysMLv2 语言服务器的能力集，表明其支持哪些功能，以及服务器信息。

## 行为
返回包含以下内容的 InitializeResult 对象：
- **capabilities**：描述语言服务器提供哪些功能的对象：
  - `textDocumentSync`：设置为 Full（服务器发送和接收完整文档内容）
  - `completionProvider`：由 '.'、':'、'('、'[' 字符触发
  - `hoverProvider`：已启用
  - `definitionProvider`：已启用
  - `referencesProvider`：已启用
  - `renameProvider`：已启用并支持准备
  - `documentSymbolProvider`：已启用
  - `foldingRangeProvider`：已启用
  - `semanticTokensProvider`：提供完整语义标记，delta=false 和图例
  - `signatureHelpProvider`：由 '(' 和 ',' 字符触发
  - `typeDefinitionProvider`：已启用
  - `codeLensProvider`：已启用
  - `codeActionProvider`：支持 quickfix 和 refactor 操作
  - `diagnosticProvider`：支持文件间依赖和工作区诊断
  - `documentHighlightProvider`：已启用
  - `documentFormattingProvider`：已启用
  - `documentRangeFormattingProvider`：已启用
  - `documentOnTypeFormattingProvider`：由 '}'、';' 和换行符触发
  - `inlayHintProvider`：已启用
  - `workspaceSymbolProvider`：已启用
  - `selectionRangeProvider`：已启用
  - `linkedEditingRangeProvider`：已启用
  - `workspace`：支持工作区文件夹
- **serverInfo**：包含语言服务器的名称和版本

## 使用示例
此函数由 LSP 连接在客户端初始化连接时自动调用。应用程序代码不会直接调用它。

## 相关函数
- Worker 中的所有其他 LSP 请求/通知处理器
- 发送初始化请求的 LSP 客户端的 `initialize()` 方法