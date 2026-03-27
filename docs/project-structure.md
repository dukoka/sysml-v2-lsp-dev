# sysmlv2-lsp-demo1 项目结构说明

本文档描述本仓库的目录、模块结构及 LSP 功能方法，适用于开发与二次集成。当前结构包含阶段 A～H（格式化、G4、配置、代码操作、grammar-mapping、类型引用、多文件索引、LSP 唯一源）的完整实现。

---

## 1. 仓库概览

- **技术栈**：React 19、Vite 7、Monaco Editor、vscode-languageserver（Browser）、Langium 4、Vitest
- **运行环境**：纯浏览器；LSP 运行在 Web Worker 中，无需 Node 后端
- **语言**：SysML v2 文本语法（基于 KerML 核心概念）

---

## 2. 根目录结构

```
sysmlv2-lsp-demo1/
├── index.html              # 应用入口 HTML
├── package.json            # 依赖与脚本
├── vite.config.js          # Vite 构建配置
├── vitest.config.ts        # 单元测试配置
├── eslint.config.js
├── langium-config.json     # Langium 语法生成配置
│
├── src/                    # 应用与语言服务源码（见 §3）
├── scripts/                # 构建/生成脚本（见 §7）
├── plan/                   # 计划与验收文档（见 §8）
└── docs/                   # 项目文档（见 §9）
```

### 2.1 根 package.json 主要脚本

| 脚本 | 说明 |
|------|------|
| `npm run dev` / `pnpm dev` | 启动 Vite 开发服务器（热更新） |
| `npm run build` | 生产构建（输出到 `dist/`） |
| `npm run preview` | 预览生产构建 |
| `npm run test` | 启动 Vitest 测试（watch） |
| `npm run test:run` | 单次运行测试 |
| `npm run lint` | ESLint 检查 |
| `npm run langium:generate` | 根据 Langium 语法生成 AST/解析器（`src/grammar/generated/`） |
| `npm run g4:generate` | 根据 G4 语法生成 Lexer/Parser（`src/grammar/g4/`） |

---

## 3. src/ 详细结构

```
src/
├── main.jsx                     # React 入口（挂载 <App>）
├── App.tsx                      # 根组件：布局、键盘快捷键、大纲解析
├── App.css
├── index.css
│
├── components/
│   ├── CodeEditor.tsx           # Monaco 编辑器封装：LSP 生命周期、模型管理、诊断
│   ├── ProblemsPanel.tsx        # 错误/警告面板
│   ├── Sidebar.tsx              # 文件树 + 文档大纲侧边栏
│   ├── StatusBar.tsx            # 底部状态栏（光标位置、LSP 状态）
│   ├── TabBar.tsx               # 文件 Tab 栏
│   └── Toolbar.tsx              # 顶部工具栏（主题切换、新建文件、格式化）
│
├── store/
│   ├── fileStore.ts             # 全局文件状态单例（FileStore 类）
│   ├── useFileStore.ts          # React hook：useSyncExternalStore 封装
│   └── exampleFiles.ts          # 预置示例 SysMLv2 文件
│
├── workers/
│   ├── sysmlLSPWorker.ts        # LSP 服务端（Web Worker，~1350 行）
│   ├── indexManager.ts          # 多文件工作区索引（阶段 G）
│   └── lspClient.ts             # LSP 客户端（主线程，JSON-RPC over postMessage）
│
├── languages/
│   └── sysmlv2/
│       ├── index.ts             # 语言注册入口：registerSysmlv2Language()，所有 Monaco Provider
│       ├── tokenizer.ts         # Monarch 词法（sysmlv2Language、sysmlv2LanguageConfig）
│       ├── keywords.ts          # SYSMLV2_KEYWORDS 关键字列表
│       ├── completion.ts        # 本地补全 Provider（LSP 回退）
│       ├── validator.ts         # 本地校验器（LSP 不可用时回退）
│       ├── scope.ts             # ScopeNode：buildScopeTree、scopeLookupInIndex（跨 URI）
│       ├── references.ts        # 引用解析：getDefinitionAtPositionWithUri、findReferencesToDefinitionAcrossIndex
│       ├── documentSymbols.ts   # 文档符号大纲：astToDocumentSymbols、parseSymbols 回退
│       ├── semanticTokens.ts    # 语义高亮：AST 驱动 / 正则回退；getSemanticTokensDataLsp
│       ├── semanticValidation.ts # 语义校验（未解析类型、重复定义等）
│       ├── formatter.ts         # 格式化（AST 感知缩进）
│       ├── inlayHints.ts        # Inlay 提示（本地 fallback）
│       ├── symbols.ts           # 正则符号解析（回退）
│       └── *.test.ts            # 各模块单元测试
│
└── grammar/
    ├── config.ts                # grammarSource、g4Validation 配置（见 docs/grammar-config.md）
    ├── parser.ts                # parseSysML()、parseResultToDiagnostics()
    ├── astUtils.ts              # getNodeRange、getElementNameRange、astToDocumentSymbols、getAstIndentLevels
    ├── astSymbols.ts            # AST 符号提取（供补全使用）
    ├── generated/               # Langium 生成，勿手改
    │   ├── ast.ts               # 生成 AST 类型（601 KB）
    │   ├── grammar.ts           # 生成语法模块（536 KB）
    │   └── module.ts            # 生成 DI 模块
    ├── g4/
    │   ├── SysMLv2Lexer.g4
    │   ├── SysMLv2Parser.g4
    │   ├── SysMLv2Lexer.tokens
    │   ├── g4Runner.ts          # runG4Parse(text)：G4 独立诊断通道
    │   └── README.md
    ├── KerML.langium            # KerML 语法源
    ├── SysML.langium            # SysMLv2 语法源
    └── *.test.ts
```

---

## 4. LSP 传输层

LSP 完全运行在浏览器中，通过 **Web Worker** 实现服务端，主线程通过 `postMessage` 进行 JSON-RPC 通信。

```
主线程                                    Worker 线程
──────────────────────────────────       ─────────────────────────────────
SysmlLSPClient (lspClient.ts)       ←→  sysmlLSPWorker.ts
  sendRequest(method, params)             BrowserMessageReader(self)
  sendNotification(method, params)        BrowserMessageWriter(self)
  pendingRequests: Map<id, {resolve}>     createConnection(ProposedFeatures.all, reader, writer)
```

Worker 传输初始化（`sysmlLSPWorker.ts:267-269`）：

```typescript
// sysmlLSPWorker.ts:267-269
const reader = new BrowserMessageReader(self as any);
const writer = new BrowserMessageWriter(self as any);
const connection = createConnection(ProposedFeatures.all, reader, writer);
```

客户端 JSON-RPC 封装（`lspClient.ts:50-70`）：

```typescript
// lspClient.ts:50-70
private async sendRequest(method: string, params: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const id = ++this.requestId;
    this.pendingRequests.set(id, { resolve, reject });
    this.worker.postMessage({ jsonrpc: '2.0', id, method, params });
  });
}

private sendNotification(method: string, params?: any) {
  this.worker.postMessage({ jsonrpc: '2.0', method, params });
}
```

---

## 5. LSP 客户端方法（`src/workers/lspClient.ts`，类 `SysmlLSPClient`）

### 5.1 连接生命周期

```typescript
// lspClient.ts:72-85
async initialize(): Promise<any> {
  // 发送 initialize 请求，然后发 initialized 通知
  const result = await this.sendRequest('initialize', {
    processId: null, rootUri: null,
    capabilities: {}, workspaceFolders: null
  });
  this.sendNotification('initialized', {});
  this.initialized = true;
  return result;
}
```

| 方法 | 行号 | LSP 方法 |
|------|------|---------|
| `constructor(options)` | L25 | 注册 `worker.onmessage` 分发器，按 `message.id` resolve/reject 挂起请求 |
| `initialize()` | L72 | `initialize` + `initialized` |
| `setDocumentUri(uri)` | L87 | 切换当前活跃文档 URI |

### 5.2 文档同步

```typescript
// lspClient.ts:91-127
async openDocument(content: string): Promise<void> {
  // 幂等：已打开则跳过
  this.sendNotification('textDocument/didOpen', {
    textDocument: { uri: this.documentUri, languageId: 'sysmlv2', version: 1, text: content }
  });
}

async updateDocument(content: string, version: number): Promise<void> {
  // 若未打开则自动 open
  this.sendNotification('textDocument/didChange', {
    textDocument: { uri: this.documentUri, version },
    contentChanges: [{ text: content }]
  });
}

async closeDocument(): Promise<void> {
  this.sendNotification('textDocument/didClose', {
    textDocument: { uri: this.documentUri }
  });
}
```

### 5.3 诊断

```typescript
// lspClient.ts:129-152
async getDiagnostics(): Promise<any[]> {
  const result = await this.sendRequest('textDocument/diagnostic', {
    textDocument: { uri: this.documentUri }
  });
  return result?.items || [];
}

// G4 独立严格模式（阶段 B）
async getG4Diagnostics(): Promise<any[]> {
  const result = await this.sendRequest('sysml/g4Diagnostics', {
    textDocument: { uri: this.documentUri }
  });
  return Array.isArray(result) ? result : [];
}
```

### 5.4 补全与悬停

```typescript
// lspClient.ts:154-177
async getCompletion(position: { line: number; character: number }): Promise<any[]> {
  const result = await this.sendRequest('textDocument/completion', {
    textDocument: { uri: this.documentUri }, position
  });
  return result?.items || [];
}

async getHover(position: { line: number; character: number }): Promise<any> {
  return await this.sendRequest('textDocument/hover', {
    textDocument: { uri: this.documentUri }, position
  });
}
```

### 5.5 跳转定义与引用（阶段 G）

```typescript
// lspClient.ts:179-205
// 返回 Location | Location[] | null（跨文件时可为数组）
async getDefinition(position: { line: number; character: number }) {
  return await this.sendRequest('textDocument/definition', {
    textDocument: { uri: this.documentUri }, position
  });
}

// includeDeclaration: 是否在结果中包含定义处本身
async getReferences(
  position: { line: number; character: number },
  includeDeclaration = false
): Promise<Location[]> {
  const result = await this.sendRequest('textDocument/references', {
    textDocument: { uri: this.documentUri },
    position,
    context: { includeDeclaration }
  });
  return Array.isArray(result) ? result : [];
}
```

### 5.6 重命名（阶段 G，跨文件 WorkspaceEdit）

```typescript
// lspClient.ts:207-219
// 返回 WorkspaceEdit { changes: { [uri]: TextEdit[] } }
async getRename(
  position: { line: number; character: number },
  newName: string
) {
  return await this.sendRequest('textDocument/rename', {
    textDocument: { uri: this.documentUri }, position, newName
  });
}
```

### 5.7 文档符号、折叠、语义 Token（阶段 H）

```typescript
// lspClient.ts:221-252
async getDocumentSymbols(): Promise<DocumentSymbol[]> {
  const result = await this.sendRequest('textDocument/documentSymbol', {
    textDocument: { uri: this.documentUri }
  });
  return Array.isArray(result) ? result : [];
}

async getFoldingRanges(): Promise<FoldingRange[]> {
  const result = await this.sendRequest('textDocument/foldingRange', {
    textDocument: { uri: this.documentUri }
  });
  return Array.isArray(result) ? result : [];
}

// 返回 delta 编码的 token 整数数组
async getSemanticTokens(): Promise<number[]> {
  const result = await this.sendRequest('textDocument/semanticTokens/full', {
    textDocument: { uri: this.documentUri }
  });
  return result?.data ?? [];
}
```

### 5.8 签名帮助与代码操作（阶段 H）

```typescript
// lspClient.ts:254-280
async getSignatureHelp(position: { line: number; character: number }) {
  return await this.sendRequest('textDocument/signatureHelp', {
    textDocument: { uri: this.documentUri }, position
  });
}

async getCodeActions(range: Range, diagnostics: Diagnostic[]) {
  const result = await this.sendRequest('textDocument/codeAction', {
    textDocument: { uri: this.documentUri },
    range,
    context: { diagnostics }
  });
  return Array.isArray(result) ? result : [];
}
```

### 5.9 格式化

```typescript
// lspClient.ts:282-382
async formatDocument(options?: { tabSize?: number; insertSpaces?: boolean }) {
  const edits = await this.sendRequest('textDocument/formatting', {
    textDocument: { uri: this.documentUri },
    options: { tabSize: options?.tabSize ?? 2, insertSpaces: options?.insertSpaces ?? true }
  });
  return edits ?? [];
}

async formatDocumentRange(range: Range, options?) { /* textDocument/rangeFormatting */ }
async getOnTypeFormatting(position, ch, options?) { /* textDocument/onTypeFormatting */ }
```

### 5.10 其他能力

| 方法 | 行号 | LSP 方法 |
|------|------|---------|
| `getTypeDefinition(position)` | L295 | `textDocument/typeDefinition` |
| `getCodeLens()` | L307 | `textDocument/codeLens` |
| `getDocumentHighlights(position)` | L319 | `textDocument/documentHighlight` |
| `getWorkspaceSymbols(query)` | L332 | `workspace/symbol` |
| `getInlayHints(range)` | L342 | `textDocument/inlayHint` |
| `getSelectionRanges(positions)` | L384 | `textDocument/selectionRange` |
| `getLinkedEditingRanges(position)` | L397 | `textDocument/linkedEditingRange` |

---

## 6. LSP 服务端（`src/workers/sysmlLSPWorker.ts`）

### 6.1 能力声明（`connection.onInitialize`，L271-298）

```typescript
// sysmlLSPWorker.ts:271-298
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
    semanticTokensProvider: {
      full: { delta: false },
      legend: { tokenTypes: semanticTokensLegendLsp.tokenTypes, tokenModifiers: [] }
    },
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
  },
  serverInfo: { name: 'SysMLv2 LSP', version: '1.0.0' }
}));
```

### 6.2 多文件索引初始化（阶段 G，L49-57）

```typescript
// sysmlLSPWorker.ts:49-57
// G.1: 多文件索引 — 文档打开/变更时更新，关闭时移除
documents.onDidOpen((e) => {
  updateIndex(e.document.uri, e.document.getText());
});
documents.onDidChangeContent((e) => {
  updateIndex(e.document.uri, e.document.getText());
});
documents.onDidClose((e) => {
  removeFromIndex(e.document.uri);
});
```

### 6.3 跨文件 Index 查找辅助（L301-307）

```typescript
// sysmlLSPWorker.ts:301-307
/** 从 Index 构建 scopeLookupInIndex 所需的 Map<uri, IndexEntryForLookup> */
function indexForLookup(): Map<string, IndexEntryForLookup> {
  const map = new Map<string, IndexEntryForLookup>();
  for (const [uri, entry] of getIndex()) {
    map.set(uri, { scopeRoot: entry.scopeRoot });
  }
  return map;
}
```

### 6.4 诊断流水线（`validateDocument`，L110-264）

```typescript
// sysmlLSPWorker.ts:110-135
function validateDocument(text: string, uri?: string): Diagnostic[] {
  // 1. Langium 解析器错误
  const parseResult = parseSysML(text);
  markers.push(...parseResultToDiagnostics(parseResult));

  if (parseResult.parserErrors.length === 0 && parseResult.lexerErrors.length === 0) {
    // 2. 语义校验（跨文件索引）
    const crossFile = uri ? { currentUri: uri, index: indexForLookup() } : undefined;
    const semantic = runSemanticValidation(parseResult.value, text, crossFile);
    markers.push(...semantic);
    return markers;
  }

  // 3. 解析失败时 fallback：正则扫描（缺失分号、关键字拼写、重复定义、括号不匹配）
  // ...
}
```

诊断通道注册：

```typescript
// sysmlLSPWorker.ts:421-441
connection.languages.diagnostics.on(async (params) => {
  const document = documents.get(params.textDocument.uri);
  return {
    kind: DocumentDiagnosticReportKind.Full,
    items: validateDocument(document.getText(), params.textDocument.uri)
  };
});

connection.languages.diagnostics.onWorkspace(async () => {
  // 批量诊断（最多 20 个文件）
  const items = [];
  for (const [, entry] of getIndex()) {
    items.push({ uri: entry.uri, kind: 'full', items: validateDocument(entry.text, entry.uri) });
  }
  return { items };
});
```

G4 独立严格模式（阶段 B，L340-345）：

```typescript
// sysmlLSPWorker.ts:340-345
connection.onRequest('sysml/g4Diagnostics',
  (params: { textDocument: { uri: string } }): Diagnostic[] => {
    const doc = documents.get(params.textDocument.uri);
    const items = runG4Parse(doc.getText());
    return items.map(d => ({ ...d, source: 'G4' }));
  }
);
```

### 6.5 跳转定义（L729-740）

```typescript
// sysmlLSPWorker.ts:729-740
connection.onDefinition((params) => {
  const uri = params.textDocument.uri;
  const entry = getIndexEntry(uri);         // 从多文件 Index 取当前文档
  if (!entry?.root) return null;
  const { line, character } = params.position;

  // 跨文件定义查找（阶段 G）
  const resolved = getDefinitionAtPositionWithUri(
    entry.root, entry.text, line, character, uri, indexForLookup()
  );
  if (!resolved) return null;

  const targetEntry = getIndexEntry(resolved.uri);
  const range = getNodeRange(resolved.node, targetEntry?.text ?? entry.text);
  return { uri: resolved.uri, range };    // Location 可为其他文件 URI
});
```

类型定义跳转（L743-759）：

```typescript
// sysmlLSPWorker.ts:743-759
connection.onRequest('textDocument/typeDefinition', (params) => {
  const entry = getIndexEntry(params.textDocument.uri);
  const node = findNodeAtPosition(entry.root, entry.text, line, character);
  const typeRefName = getTypeReferenceName(node);   // 提取 "part engine : Engine" 中的 Engine
  const resolved = resolveToDefinitionWithUri(scope, typeRefName, uri, indexForLookup());
  return { uri: resolved.uri, range };
});
```

### 6.6 查找引用（L761-783）

```typescript
// sysmlLSPWorker.ts:761-783
connection.onReferences((params) => {
  const resolved = getDefinitionAtPositionWithUri(
    entry.root, entry.text, line, character, uri, indexForLookup()
  );
  const locations = [];

  // 可选：包含定义处
  if (params.context.includeDeclaration) {
    const defRange = getElementNameRange(resolved.node, defText);
    locations.push({ uri: resolved.uri, range: defRange });
  }

  // 跨所有已索引文件收集引用
  const refs = findReferencesToDefinitionAcrossIndex(getIndex(), resolved.uri, resolved.node);
  for (const { uri: refUri, node } of refs) {
    const range = getElementNameRange(node, refText) ?? getNodeRange(node, refText);
    locations.push({ uri: refUri, range });
  }
  return locations;
});
```

### 6.7 重命名（L785-820）

```typescript
// sysmlLSPWorker.ts:785-820
connection.onPrepareRename((params) => {
  // 验证光标处可重命名：返回当前名称范围与占位符
  const nameRange = getElementNameRange(node, entry.text);
  return { range: nameRange, placeholder: name };
});

connection.onRenameRequest((params) => {
  const changes: Record<string, TextEdit[]> = {};

  // 定义处改名
  addEdit(resolved.uri, resolved.node);

  // 跨文件所有引用处改名
  const refs = findReferencesToDefinitionAcrossIndex(getIndex(), resolved.uri, resolved.node);
  for (const { uri: refUri, node } of refs) addEdit(refUri, node);

  return { changes };   // WorkspaceEdit，可包含多 URI
});
```

### 6.8 文档符号与折叠（阶段 H，L916-928）

```typescript
// sysmlLSPWorker.ts:916-928
connection.onDocumentSymbol((params) => {
  const entry = getIndexEntry(params.textDocument.uri);
  const astSymbols = astToDocumentSymbols(entry.root, entry.text);
  return astSymbols.map(astSymbolToLsp);   // AstDocumentSymbol → LSP DocumentSymbol
});

connection.onFoldingRanges((params) => {
  const entry = getIndexEntry(params.textDocument.uri);
  const ranges = getFoldingRanges(entry.root, entry.text);
  return ranges.map((r): FoldingRange => ({ startLine: r.startLine, endLine: r.endLine }));
});
```

### 6.9 语义高亮 Token（阶段 H，L931-936）

```typescript
// sysmlLSPWorker.ts:931-936
connection.onRequest('textDocument/semanticTokens/full', (params) => {
  const entry = getIndexEntry(params.textDocument.uri);
  const text = entry?.text ?? documents.get(params.textDocument.uri)?.getText() ?? '';
  const data = getSemanticTokensDataLsp(text, entry?.root);
  return { data };   // delta 编码整数数组
});
```

### 6.10 签名帮助（L955-1030）

```typescript
// sysmlLSPWorker.ts:955-976
connection.onSignatureHelp((params) => {
  // 1. 内置函数（println、toInteger 等）
  const fnMatch = beforeParen.match(/\b(println|print|assert|...)\s*$/);
  if (fnMatch) {
    const sig = BUILTIN_SIGNATURES[fnName];
    return { signatures: [sig], activeSignature: 0, activeParameter: commaCount };
  }

  // 2. 用户定义函数：在 Index 中查找参数列表
  let defNode = findDefinitionByName(entry.root, userFnName);
  // 跨文件搜索
  for (const [, ie] of getIndex()) {
    if (!defNode && ie.root) defNode = findDefinitionByName(ie.root, userFnName);
  }
  return { signatures: [...], activeSignature: 0, activeParameter: commaCount };
});
```

### 6.11 代码操作（L1037+）

```typescript
// sysmlLSPWorker.ts:1037+
connection.onCodeAction((params) => {
  // 1. Unresolved type → "Add definition stub"
  // 2. Duplicate definition → "Go to first definition"（command: sysml.goToFirstDefinition）
  const actions: CodeAction[] = [];
  for (const diag of params.context.diagnostics) {
    if (diag.message.startsWith('Unresolved type')) { /* ... */ }
    if (diag.message.startsWith('Duplicate definition')) {
      actions.push({
        title: 'Go to first definition',
        kind: CodeActionKind.QuickFix,
        command: { command: 'sysml.goToFirstDefinition', arguments: [line, col] }
      });
    }
  }
  return actions;
});
```

### 6.12 文档高亮与工作区符号（L822-876）

```typescript
// sysmlLSPWorker.ts:822-851
connection.onDocumentHighlight((params) => {
  // 定义处：DocumentHighlightKind.Write
  // 引用处：DocumentHighlightKind.Read
  const defNameRange = getElementNameRange(node, entry.text);
  const refNodes = findReferencesToDefinition(entry.root, node, scope);
  return [
    { range: defNameRange, kind: DocumentHighlightKind.Write },
    ...refNodes.map(ref => ({ range: getElementNameRange(ref, entry.text), kind: DocumentHighlightKind.Read }))
  ];
});

// sysmlLSPWorker.ts:854-876
connection.onWorkspaceSymbol((params) => {
  // 遍历所有 Index，按 query 过滤后返回 SymbolInformation[]
  const query = params.query.toLowerCase();
  for (const [uri, entry] of getIndex()) {
    const symbols = astToDocumentSymbols(entry.root, entry.text);
    // 递归收集所有 symbol，过滤匹配 query 的
  }
  return results;
});
```

### 6.13 Code Lens（L879-913）

```typescript
// sysmlLSPWorker.ts:879-913
connection.onCodeLens((params) => {
  // 为每个 Definition 显示引用计数（跨所有已索引文件）
  // command: sysml.showReferences → 触发 Monaco 引用面板
  const refs = findReferencesToDefinitionAcrossIndex(getIndex(), uri, defNode);
  return [{
    range: nameRange,
    command: {
      title: `${refs.length} reference(s)`,
      command: 'sysml.showReferences',
      arguments: [uri, nameRange.start]
    }
  }];
});
```

### 6.14 格式化（L347-419）

```typescript
// sysmlLSPWorker.ts:347-364
connection.onRequest('textDocument/formatting', (params) => {
  const parseResult = parseSysML(text);
  const root = parseResult.parserErrors.length === 0 ? parseResult.value : undefined;
  // 解析成功时传入 AST root，使用 AST 感知缩进（阶段 A）
  const formatted = formatSysmlv2Code(text, { tabSize: 2, insertSpaces: true }, root);
  return [{ range: fullRange, newText: formatted }];
});

connection.onRequest('textDocument/rangeFormatting', (params) => {
  // 范围格式化使用括号深度计算（不依赖 AST）
  const formatted = formatSysmlv2Code(rangeText, { tabSize: 2, insertSpaces: true });
  return [{ range: params.range, newText: formatted }];
});

connection.onRequest('textDocument/onTypeFormatting', (params) => {
  // 输入时格式化：按括号深度计算当前行期望缩进
  const expectedIndent = indent.repeat(depth);
  return [{ range: lineIndentRange, newText: expectedIndent }];
});
```

---

## 7. 多文件索引（`src/workers/indexManager.ts`）

```typescript
// indexManager.ts:10-18
export interface IndexEntry {
  uri: string;
  text: string;
  root: Namespace | undefined;   // 解析根（Langium AST）
  parseErrors: number;           // 解析错误总数
  scopeRoot: ScopeNode | null;   // buildScopeTree(root) 结果
}
```

| 函数 | 行号 | 说明 |
|------|------|------|
| `updateIndex(uri, text)` | L25 | didOpen/didChange 时调用；执行 parseSysML + buildScopeTree，存入全局 Map |
| `removeFromIndex(uri)` | L39 | didClose 时调用，从 Map 删除条目 |
| `getIndexEntry(uri)` | L46 | 按 URI 查单条 IndexEntry |
| `getIndexedUris()` | L53 | 返回所有已索引 URI 列表 |
| `getIndex()` | L60 | 返回完整 `Map<string, IndexEntry>` |

```typescript
// indexManager.ts:25-34
export function updateIndex(uri: string, text: string): IndexEntry {
  const parseResult = parseSysML(text, uri);
  const parseErrors = (parseResult.parserErrors?.length ?? 0)
                    + (parseResult.lexerErrors?.length ?? 0);
  const root = parseResult.value && isNamespace(parseResult.value)
    ? parseResult.value as Namespace : undefined;
  const scopeRoot = root ? buildScopeTree(root) : null;
  const entry = { uri, text, root, parseErrors, scopeRoot };
  index.set(uri, entry);
  return entry;
}
```

---

## 8. Scope 与引用解析

### 8.1 `src/languages/sysmlv2/scope.ts`

- **`buildScopeTree(root: Namespace): ScopeNode`** — 递归构建 Scope 树，每级存储 `declarations: Map<string, Element>`
- **`scopeLookupInIndex(uri, scopeRoot, name, index)`** — 当前文档未命中时从其他文件根级 declarations 查找

```typescript
// scope.ts（示意）
export interface ScopeNode {
  declarations: Map<string, Element>;
  children: ScopeNode[];
  parent: ScopeNode | null;
}

export type IndexEntryForLookup = { scopeRoot: ScopeNode | null };

// 先本文件 scope 链，未命中再遍历跨文件 Index
export function scopeLookupInIndex(
  uri: string,
  scopeRoot: ScopeNode | null,
  name: string,
  index: Map<string, IndexEntryForLookup>
): { uri: string; node: Element } | undefined
```

### 8.2 `src/languages/sysmlv2/references.ts`

| 函数 | 说明 |
|------|------|
| `getDefinitionAtPositionWithUri(root, text, line, char, uri, index)` | 光标处定义查找，支持跨文件 |
| `resolveToDefinitionWithUri(scopeRoot, name, currentUri, index)` | 名称 → 定义，先本文件后跨文件 |
| `findReferencesToDefinitionAcrossIndex(index, uri, node)` | 在所有已索引文件中收集引用，返回 `{ uri, node }[]` |
| `findReferencesToDefinition(root, defNode, scope)` | 仅在单文件内查找引用 |
| `findNodeAtPosition(root, text, line, char)` | 光标处 AST 节点 |
| `getTypeReferenceName(usage)` | 从 Usage 的 `typeRelationships` 或 `heritage` 提取类型名 |
| `getTypeReferenceRange(usage, text)` | 获取类型引用在文档中的 range（用于光标在类型名时跳转） |

---

## 9. 编辑器工作流

### 9.1 `App.tsx` 根组件（L1-250）

```typescript
// App.tsx:21-48  大纲解析（正则，供侧边栏展示）
function parseOutlineFromContent(content: string): OutlineSymbol[] {
  // 解析 package / part def / requirement / enum / attribute 等，构建层级树
}

// App.tsx:68-167  状态与事件
function App() {
  const [theme, setTheme] = useState('sysmlv2-dark');
  const editorRef = useRef<CodeEditorHandle>(null);

  // 初始化示例文件（仅首次）
  useEffect(() => {
    for (const f of EXAMPLE_FILES) fileStore.addFile(f.name, f.content);
  }, []);

  // 键盘快捷键
  // Ctrl+B → 切换侧边栏
  // Ctrl+Shift+M → 切换问题面板
  // Ctrl+N → 新建文件
  // Ctrl+S → 保存
  // Ctrl+Shift+F → 格式化
}
```

### 9.2 `CodeEditor.tsx` 组件（L1-360）

`forwardRef` 组件，封装 Monaco Editor，负责 LSP 生命周期与诊断驱动。

**初始化（`useEffect`，L187-298，仅执行一次）：**

```typescript
// CodeEditor.tsx:187-269
useEffect(() => {
  registerSysmlv2Language();   // Monarch + 所有 Monaco Provider
  registerSysmlv2Theme();      // 注册 sysmlv2-dark 主题

  const editor = monaco.editor.create(container, {
    language, theme, minimap: { enabled: true }, fontSize: 14,
    lineNumbers: 'on', automaticLayout: true, tabSize: 2,
    folding: true, foldingStrategy: 'indentation',
    parameterHints: { enabled: true }, inlayHints: { enabled: 'on' },
  });

  // 注册全局命令
  monaco.editor.registerCommand('sysml.goToFirstDefinition', (_, lineNumber, column) => {
    editor.setPosition({ lineNumber, column });
    editor.revealLineInCenter(lineNumber);
  });
  monaco.editor.registerCommand('sysml.showReferences', (_, uri, position) => {
    editor.trigger('codeLens', 'editor.action.goToReferences', null);
  });

  // 启动 LSP Worker
  const worker = new Worker(new URL('../workers/sysmlLSPWorker.ts', import.meta.url), { type: 'module' });
  const client = createSysmlLSPClient({ worker, documentUri: 'file:///sysmlv2/init.sysml' });
  setSysmlv2LspClientGetter(() => lspClientRef.current);
  await client.initialize();
  useLspRef.current = true;
  onLspReadyRef.current?.(true);
}, []);
```

**文件模型管理（`useEffect` on `[fileUri, fileContent]`，L307-350）：**

```typescript
// CodeEditor.tsx:307-350
useEffect(() => {
  let model = modelsRef.current.get(fileUri);
  if (!model) {
    model = monaco.editor.createModel(fileContent, language, monaco.Uri.parse(fileUri));
    modelsRef.current.set(fileUri, model);
    // 通知 LSP 新文件打开
    client.setDocumentUri(fileUri);
    client.openDocument(fileContent);
  }
  editor.setModel(model);
  lspClientRef.current.setDocumentUri(fileUri);

  model.onDidChangeContent(() => {
    onContentChangeRef.current?.(fileUri, model.getValue());
    scheduleDiagnostics(fileUri);   // 防抖 300ms
  });
}, [fileUri, fileContent]);
```

**诊断流（`applyDiagnostics`，L85-155）：**

```typescript
// CodeEditor.tsx:85-155
async function applyDiagnostics(uri, content, version) {
  // 1. LSP 诊断（优先）
  await client.updateDocument(content, version);
  const items = await client.getDiagnostics();
  monaco.editor.setModelMarkers(model, 'sysmlv2-lsp', items);

  // 2. G4 独立诊断（配置开启时）
  if (isG4ValidationEnabled()) {
    const g4Items = await client.getG4Diagnostics();
    monaco.editor.setModelMarkers(model, 'sysmlv2-g4', g4Items);
  }

  // 3. fallback：本地 validator（LSP 不可用时）
  // monaco.editor.setModelMarkers(model, 'sysmlv2', fallback)
}

// 防抖 300ms
function scheduleDiagnostics(uri) {
  clearTimeout(diagnosticDebounceRef.current);
  diagnosticDebounceRef.current = setTimeout(() => applyDiagnostics(uri, ...), 300);
}
```

**命令式句柄（`useImperativeHandle`，L169-185）：**

```typescript
// CodeEditor.tsx:169-185
useImperativeHandle(ref, () => ({
  formatDocument: () => editor.getAction('editor.action.formatDocument')?.run(),
  goToLine: (line, column = 1) => {
    editor.setPosition({ lineNumber: line, column });
    editor.revealLineInCenter(line);
    editor.focus();
  },
  getEditor: () => editorRef.current,
}));
```

### 9.3 Monaco Provider 注册（`src/languages/sysmlv2/index.ts`）

`registerSysmlv2Language()` 按 **LSP 优先，本地回退** 模式注册全部 Monaco Provider：

| Provider | LSP 调用 | 本地回退 |
|----------|----------|---------|
| 语义高亮 | `client.getSemanticTokens()` | `getSemanticTokensDataLsp`（AST/正则） |
| Inlay 提示 | `client.getInlayHints(range)` | `sysmlv2InlayHintsProvider` |
| 补全 | `client.getCompletion(pos)` | `sysmlv2CompletionProvider`（Scope + 关键字） |
| 悬停 | `client.getHover(pos)` | AST findNodeAtPosition → 简单标识符悬停 |
| 折叠 | `client.getFoldingRanges()` | 括号计数 |
| 跳转定义 | `client.getDefinition(pos)` | `getDefinitionAtPosition`（AST + Scope）→ 正则 |
| 查找引用 | `client.getReferences(pos)` | `findReferencesToDefinition`（AST + Scope）→ 正则 |
| 重命名 | `client.getRename(pos, name)` | — |
| 文档符号 | `client.getDocumentSymbols()` | — |
| 文档高亮 | `client.getDocumentHighlights(pos)` | — |
| 代码操作 | `client.getCodeActions(range, diags)` | — |
| Code Lens | `client.getCodeLens()` | — |
| 签名帮助 | `client.getSignatureHelp(pos)` | — |
| 工作区符号 | `client.getWorkspaceSymbols(query)` | — |
| 全文格式化 | `client.formatDocument(options)` | — |
| 范围格式化 | `client.formatDocumentRange(range)` | — |
| 输入时格式化 | `client.getOnTypeFormatting(pos, ch)` | — |

### 9.4 状态管理（`src/store/fileStore.ts`）

```typescript
// fileStore.ts（示意）
class FileStore {
  files: Map<string, VirtualFile>         // URI → 文件内容与元数据
  openTabs: string[]                      // 有序的已打开 URI 列表
  activeFileUri: string | null
  diagnostics: Map<string, DiagnosticItem[]>
  cursorPosition: CursorPosition
  lspReady: boolean
}
```

主要方法：`addFile`、`openTab`、`closeTab`、`setActiveFile`、`updateFileContent`、`saveFile`、`isFileDirty`、`setDiagnostics`、`getDiagnosticCounts`、`setLspReady`、`createNewFile`

通过 `useFileStore.ts` 中的 `useSyncExternalStore` 供 React 组件消费。

---

## 10. 数据流总览

```
App.tsx
  → Toolbar / Sidebar / TabBar / StatusBar / ProblemsPanel
  → CodeEditor.tsx (editorRef: CodeEditorHandle)
       → registerSysmlv2Language()         (languages/sysmlv2/index.ts)
       → setSysmlv2LspClientGetter()       (languages/sysmlv2/index.ts)
       → createSysmlLSPClient()            (workers/lspClient.ts)
       → Worker(sysmlLSPWorker.ts)         (workers/sysmlLSPWorker.ts)
       → createSysmlv2Validator()          (languages/sysmlv2/validator.ts)
       → isG4ValidationEnabled()           (grammar/config.ts)

sysmlLSPWorker.ts
  → indexManager.ts                        (Map<uri, IndexEntry>)
  → grammar/parser.ts                      (parseSysML)
  → grammar/astUtils.ts                    (getNodeRange, astToDocumentSymbols, getFoldingRanges)
  → languages/sysmlv2/scope.ts             (buildScopeTree, scopeLookupInIndex)
  → languages/sysmlv2/references.ts        (getDefinitionAtPositionWithUri, findReferencesToDefinitionAcrossIndex)
  → languages/sysmlv2/semanticTokens.ts    (getSemanticTokensDataLsp)
  → languages/sysmlv2/formatter.ts         (formatSysmlv2Code)
  → languages/sysmlv2/semanticValidation.ts (runSemanticValidation)
  → vscode-languageserver/browser
  → vscode-languageserver-textdocument
```

---

## 11. scripts/

| 文件 | 说明 |
|------|------|
| `g4-generate.mjs` | 调用 ANTLR 生成 G4 Lexer/Parser（见 `src/grammar/g4/README.md`） |

---

## 12. plan/

| 文件 | 说明 |
|------|------|
| `最终完成计划.md` | 阶段 A～H（及扩展阶段 I/J/K）目标、施工方案与验收清单 |
| `验收结果与后续优化计划.md` | 中段验收结果与后续优化项 |
| `语言功能完全实现计划.md` | 语言功能范围与各阶段实现计划 |

---

## 13. docs/

| 文件 | 说明 |
|------|------|
| `project-structure.md` | 本文档：项目结构与工作流 |
| `usage-guide.md` | 使用说明（安装、运行、功能、配置、测试） |
| `grammar-config.md` | 解析/校验配置项说明（grammarSource、g4Validation） |
| `grammar-mapping.md` | G4 规则 ↔ Langium 规则/AST 类型对照表 |
| `grammar-extension-and-fix.md` | 语法扩展与修复记录 |
| `current-vs-sysml-2ls-comparison.md` | 与 sysml-2ls 参考项目的能力对比 |
| `sysml-2ls-project-structure.md` | 外部参考：sysml-2ls 仓库结构与本项目 LSP 对照 |

---

## 14. 构建产物

- **开发**：`pnpm dev` 不生成持久化产物；Worker 与入口由 Vite 按需编译。
- **生产**：`pnpm build` 输出到 `dist/`：
  - `index.html`
  - `assets/*.js`（含主应用、Monaco、`sysmlLSPWorker-*.js` 等）
  - `assets/*.css`、字体等
