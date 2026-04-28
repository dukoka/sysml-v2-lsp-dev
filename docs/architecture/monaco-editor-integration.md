---
description: Monaco 编辑器集成文档，包括编辑器初始化、语言注册、主题支持、模型管理、事件处理、LSP 通信和诊断显示。
---

# Monaco 编辑器集成

## 概述

SysMLv2 编辑器集成 Monaco 编辑器（为 Visual Studio Code 提供支持的相同代码编辑器），以提供丰富的编辑体验，包括语法高亮、智能代码补全、悬停信息等功能。

## 集成方式

Monaco 编辑器作为独立组件集成在 React 应用程序中。集成在 `src/components/CodeEditor.tsx` 中处理，创建和管理 Monaco 编辑器实例，将它们连接到语言服务器协议 (LSP) Worker，并处理编辑器状态和应用程序状态之间的同步。

### 关键集成点

1. **编辑器初始化**：创建具有适当配置的 Monaco 编辑器实例
2. **语言注册**：向 Monaco 注册 SysMLv2 语言
3. **主题支持**：同步编辑器主题与应用程序主题
4. **模型管理**：为多个文件管理 Monaco 文本模型
5. **事件处理**：将编辑器事件连接到应用程序状态更新
6. **LSP 通信**：促进 Monaco 和 LSP Worker 之间的通信
7. **诊断显示**：在编辑器边距中显示验证结果

## 编辑器初始化

Monaco 编辑器在 CodeEditor 组件的 `useEffect` hook 中初始化：

```typescript
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
```

### 配置选项

- **language**：设置为 'sysmlv2' 以支持 SysMLv2 语言
- **theme**：与应用程序主题同步（浅色/深色变体）
- **minimap**：启用以便代码导航概览
- **automaticLayout**：容器更改时自动调整编辑器大小
- **folding**：使用基于缩进的策略启用折叠
- **inlayHints**：启用以在代码中显示类型提示
- **suggestOnTriggerCharacters**：在特定字符（.、:、(、[)上触发建议

## 语言注册

SysMLv2 语言支持通过 `src/languages/sysmlv2.ts` 中的函数向 Monaco 注册：

```typescript
registerSysmlv2Language();
registerSysmlv2Theme();
```

这些函数：
1. 定义 SysMLv2 语言配置（关键字、括号、注释等）
2. 使用 TextMate 语法规则设置语法高亮
3. 注册 SysMLv2 自定义主题

## 主题支持

编辑器主题与应用程序主题同步：

```typescript
useEffect(() => {
  if (editorRef.current) {
    monaco.editor.setTheme(theme);
  }
}, [theme]);
```

应用程序支持 'sysmlv2-light' 和 'sysmlv2-dark' 主题，这些映射到 Monaco 内置的浅色和深色主题，并具有 SysMLv2 特定的颜色自定义。

## 模型管理

对于每个打开的文件，创建和管理 Monaco 文本模型：

```typescript
let model = modelsRef.current.get(fileUri);
if (!model) {
  const monacoUri = monaco.Uri.parse(fileUri);
  model = monaco.editor.createModel(fileContent, language, monacoUri);
  modelsRef.current.set(fileUri, model);
}

// 如果更改则更新编辑器的模型
if (editor.getModel() !== model) {
  editor.setModel(model);
}
```

模型存储在 Map（`modelsRef`）中，以在标签页之间切换时避免重新创建，保持编辑器状态如滚动位置和光标位置。

## 事件处理

CodeEditor 组件设置几个事件监听器：

### 光标位置更改

```typescript
editor.onDidChangeCursorPosition((e) => {
  onCursorChangeRef.current?.({
    lineNumber: e.position.lineNumber,
    column: e.position.column,
  });
});
```

### 内容更改

```typescript
contentChangeDisposableRef.current = model.onDidChangeContent(() => {
  const val = model!.getValue();
  onContentChangeRef.current?.(fileUri, val);
  scheduleDiagnostics(fileUri);
});
```

这会触发：
1. 虚拟文件存储中的内容更新
2. 计划的诊断验证（去抖动）

## LSP 通信

编辑器维护与 Web Worker LSP 客户端的连接：

1. **初始化**：编辑器挂载时创建 Web Worker 和 LSP 客户端
2. **文档同步**：将文件内容更改发送到 LSP Worker
3. **请求处理**：将 LSP 请求（补全、悬停等）转发到 Worker
4. **响应处理**：应用 LSP 结果以更新编辑器装饰

### 关键 LSP 集成点

- **诊断信息**：应用 LSP 验证结果以在编辑器中显示错误/警告
- **补全**：基于 LSP 响应提供智能代码建议
- **悬停**：显示 LSP 的符号悬停信息
- **导航**：通过 LSP 实现跳转到定义和查找引用
- **格式化**：使用 LSP 进行代码格式化操作

## 诊断显示

Langium 解析器和 LSP Worker 的验证结果在编辑器中显示：

```typescript
// 为此资源清除之前的标记
monaco.editor.setModelMarkers(model, 'sysmlv2-lsp', []);

// 应用 LSP 的新标记
monaco.editor.setModelMarkers(model, 'sysmlv2-lsp', markers);

// 如需要与其他标记源合并
const allMarkers = monaco.editor.getModelMarkers({ resource: model.uri });
onDiagnosticsChangeRef.current?.(uri, convertMarkersToDiagnostics(allMarkers));
```

使用不同的标记类型：
- 'sysmlv2'：内置验证器结果
- 'sysmlv2-lsp'：LSP Worker 结果
- 'sysmlv2-g4'：G4 解析器验证（启用时）

## 自定义命令

编辑器为特定的 SysMLv2 功能注册自定义命令：

```typescript
// 跳转到第一个定义
(monaco.editor as any).registerCommand?.('sysml.goToFirstDefinition', 
  (_: any, lineNumber: number, column: number) => {
    // 实现...
  }
);

// 显示引用
(monaco.editor as any).registerCommand?.('sysml.showReferences',
  (_: any, uri: string, position: { line: number; character: number }) => {
    // 实现...
  }
});
```

这些命令从 UI（如 ProblemsPanel）调用以触发特定的编辑器操作。

## 性能优化

1. **Web Worker 卸载**：语言处理在后台 Worker 中进行以防止 UI 阻塞
2. **去抖动诊断**：验证请求被去抖动以减少频率
3. **模型重用**：标签页之间切换时重用编辑器模型以保持状态并避免重新创建成本
4. **选择性标记更新**：仅在实际更改内容时更新诊断标记
5. **高效 LSP 通信**：使用 JSON-RPC over postMessage 以实现低延迟 Worker 通信

## 编辑器 API 暴露

CodeEditor 组件暴露一个命令句柄以进行编程控制：

```typescript
export interface CodeEditorHandle {
  formatDocument: () => void;
  goToLine: (line: number, column?: number) => void;
  getEditor: () => monaco.editor.IStandaloneCodeEditor | null;
}
```

这允许父 App 组件：
- 触发文档格式化
- 导航到特定行
- 访问原始 Monaco 编辑器实例以进行高级操作

## 依赖

- **monaco-editor**：核心编辑器库
- **@monaco-editor/loader**：用于在 React 中动态加载（如果使用）
- `src/languages/` 中的自定义 SysMLv2 语言注册文件

## 集成总结

SysMLv2 编辑器中的 Monaco 编辑器集成提供：
- 熟悉、功能丰富的编辑体验
- 通过 LSP 自定义语言功能的无缝集成
- 编辑器和应用程序之间的高效状态管理
- 通过后台处理提供响应迅速的 UI
- 可扩展架构以添加新的语言功能