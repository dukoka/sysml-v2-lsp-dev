---
description: 虚拟文件存储和标签页管理系统文档，涵盖文件存储、状态跟踪、标签页管理、LSP 协调和 React 集成。
---

# 虚拟文件存储和标签页管理

## 概述

虚拟文件存储是 SysMLv2 编辑器的核心子系统，管理多个 SysMLv2 文件的内存文件系统。它与标签页管理系统配合，提供无缝的文件切换、状态保存和更改跟踪。

## 核心职责

1. **文件存储**：维护 SysMLv2 文件的内存表示
2. **状态跟踪**：监控文件修改（脏状态）、光标位置和诊断信息
3. **标签页管理**：跟踪打开的标签页和活动文件状态
4. **LSP 协调**：管理语言服务器协议就绪状态和文档同步
5. **持久性**：切换文件时保存编辑器状态（滚动位置、选择）

## 实现位置

虚拟文件存储实现于：
- `src/store/fileStore.ts`：核心文件存储逻辑
- `src/store/useFileStore.ts`：用于访问文件存储状态的 React Hook
- `src/store/exampleFiles.ts`：用于演示的预加载示例文件

## 文件存储架构

### 核心数据结构

文件存储维护几个关键数据结构：

```typescript
interface FileEntry {
  uri: string;           // 唯一文件标识符（file:///...）
  name: string;          // 显示名称（不含路径）
  content: string;       // 文件内容
  languageId: string;    // 语言标识符（'sysmlv2'）
  isDirty: boolean;      // 跟踪文件是否有未保存的更改
  version: number;      // 用于更改跟踪的内容版本
}

// 内部存储
private files: Map<string, FileEntry> = new Map();     // URI -> FileEntry
private openTabs: string[] = [];                       // 打开的文件 URI 有序列表
private activeFileUri: string | null = null;           // 当前活动文件
private cursorPositions: Map<string, CursorPosition> = new Map(); // URI -> 光标位置
private diagnosticsStore: Map<string, DiagnosticItem[]> = new Map(); // URI -> 诊断信息
private lspReady: boolean = false;                     // LSP 就绪状态
```

### 关键功能

#### 1. 文件生命周期管理

- **添加文件**：`addFile(name, content)` - 创建新文件条目
- **打开文件**：`openTab(uri)` - 使文件活动并添加到标签页列表
- **关闭文件**：`closeTab(uri)` - 从标签页列表移除（但保存在存储中）
- **更新内容**：`updateFileContent(uri, content)` - 修改文件并标记为脏
- **保存文件**：`saveFile(uri)` - 重置脏标志（将在完整实现中持久化到磁盘）

#### 2. 状态跟踪

- **脏跟踪**：内容更改时自动将文件标记为脏
- **版本控制**：每次内容更改时递增版本号
- **光标位置**：为每个文件保存和恢复光标位置
- **诊断信息**：维护每个文件的 LSP Worker 验证结果

#### 3. 标签页管理

- **有序列表**：按打开顺序维护打开的标签页
- **活动文件**：跟踪编辑器中当前活动的文件
- **可见性**：提供方法检查文件是否打开/脏/活动

#### 4. LSP 集成

- **就绪状态**：跟踪 LSP Worker 是否已初始化并就绪
- **文档同步**：协调文件打开/更改/关闭通知到 LSP Worker
- **版本感知**：提供用于 LSP 同步的文档版本

## 数据流

### 文件操作流程

```
用户操作 → App 组件 → 文件存储方法 → 内部状态更新 → 
              ↓                                    ↓
       组件重新渲染 ← 状态更改通知 ← 订阅
```

### 示例：文件内容更改

1. 用户在 Monaco 编辑器中输入
2. CodeEditor 组件通过 model.onDidChangeContent 检测更改
3. 调用 `onContentChange` prop（在 App 中绑定到 `handleContentChange`）
4. App 调用 `fileStore.updateFileContent(uri, newContent)`
5. FileStore：
   - 更新 FileEntry.content
   - 递增 FileEntry.version
   - 设置 FileEntry.isDirty = true
   - 通知订阅者更改
6. App 组件使用更新后的状态重新渲染
7. Sidebar/TabBar 更新以显示脏标志
8. CodeEditor 安排诊断信息更新（去抖动）
9. 诊断请求通过 client.updateDocument() 发送到 LSP Worker

### 标签页切换流程

1. 用户在 TabBar 中点击标签页
2. TabBar 调用 onActiveTabChange prop
3. App 为所选标签页调用 `fileStore.openTab(uri)`
4. FileStore：
   - 将 activeFileUri 设置为标签页的 URI
   - 保持标签页顺序（如果不是第一个则移到前面）
5. App 组件使用新的活动文件重新渲染
6. CodeEditor 接收新的 fileUri prop 并：
   - 为文件获取或创建 Monaco 模型
   - 设置编辑器内容
   - 从 fileStore 恢复光标位置
   - 为文件请求诊断信息

## React 集成

### 自定义 Hook

`useFileStore` hook 为 React 组件提供对文件存储状态的访问：

```typescript
export const useFileStore = () => {
  const state = useContext(FileStoreContext);
  if (state === undefined) {
    throw new Error('useFileStore 必须在 FileStoreProvider 内使用');
  }
  return state;
};
```

组件使用此 hook 来：
- 读取状态（活动文件、打开的标签页、文件内容等）
- 订阅状态更改（相关更改时自动重新渲染）
- 调用操作（更新内容、更改活动文件等）

### Context Provider

`FileStoreProvider` 组件包装应用程序并提供文件存储上下文：

```tsx
<FileStoreProvider>
  <App />
</FileStoreProvider>
```

## 性能考虑

1. **高效更新**：文件存储在适当的地方使用不可变式模式，但在安全时为性能直接使用突变
2. **选择性订阅**：组件仅在相关状态更改时重新渲染（通过 useContext 和特定选择器）
3. **去抖动操作**：像诊断信息这样的昂贵操作在 CodeEditor 组件中去抖动
4. **内存管理**：文件保留在内存中直到明确移除；无自动垃圾回收
5. **延迟初始化**：Monaco 模型仅在需要时创建，切换标签页时重用

## 状态持久性

当前实现保留：
- 每个文件的光标位置
- 滚动位置（通过 Monaco 模型重用）
- 编辑器状态（折叠、选择）通过模型重用
- 文件内容和脏状态
- 标签页顺序和活动文件

当前未持久化（需要增强）：
- 浏览器刷新之间的会话持久性
- 窗口/布局状态
- 用户偏好（除主题外）

## 集成点

### 与 Monaco 编辑器（CodeEditor.tsx）
- 接收 fileUri 和 fileContent props
- 内容更改时调用 onContentChange
- 通过 onCursorChange 接收光标位置更新
- 通过 onDiagnosticsChange 接收诊断信息更新
- LSP Worker 初始化时调用 onLspReady

### 与 UI 组件
- **App.tsx**：主要消费者，协调所有状态
- **Toolbar**：读取活动文件状态以启用/禁用操作
- **TabBar**：读取打开的标签页和脏状态以便显示
- **Sidebar**：读取文件列表和活动文件以便导航
- **ProblemsPanel**：读取活动文件的诊断信息
- **StatusBar**：读取光标位置、LSP 状态和诊断信息计数

### 与 LSP Worker
- 通过 CodeEditor.tsx 中的 SysmlLSPClient
- 文件存储提供内容并接收版本号
- LSP Worker 返回的诊断信息存储在文件存储中
- 文件存储跟踪 LSP 就绪状态

## 扩展点

1. **持久存储**：为文件添加 localStorage/indexedDB 持久性
2. **历史**：为每个文件添加撤销/重做堆栈
3. **文件元数据**：添加时间戳、文件大小等
4. **工作区功能**：添加文件夹/项目概念
5. **高级过滤**：添加文件搜索和过滤功能
6. **批量操作**：添加多文件操作（保存全部、关闭全部等）

## 使用示例

### 获取活动文件内���
```typescript
const { activeFileUri, files } = useFileStore();
const activeFile = activeFileUri && files.get(activeFileUri);
const content = activeFile?.content ?? '';
```

### 检查文件是否脏
```typescript
const { fileStore } = useFileStore();
const isDirty = fileStore.isFileDirty(fileUri);
```

### 更新文件内容
```typescript
const { fileStore } = useFileStore();
fileStore.updateFileContent(uri, newContent);
```

### 获取文件标签页显示
```typescript
const { fileStore } = useFileStore();
const file = fileStore.getFile(uri);
const isDirty = fileStore.isFileDirty(uri);
const displayName = `${file.name}${isDirty ? '*' : ''}`;
```

## 结论

虚拟文件存储和标签页管理系统为在 SysMLv2 编辑器中管理多个文件提供了健壮的基础。通过将文件状态管理与 UI 关注点分离，它使组件能够专注于特定职责，同时通过中央状态管理系统保持同步。该系统有效地处理文件生命周期、状态跟踪和编辑器状态保存，以在处理多个 SysMLv2 文件时提供流畅的用户体验。