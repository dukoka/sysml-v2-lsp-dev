---
pageType: doc
---

# 开发者入门指南

本文档帮助新开发者快速熟悉本项目，了解核心概念和开发流程。通过本文档，您将了解项目的整体架构、如何搭建开发环境、以及如何进行功能开发。

---

## 1. 项目概述

SysML v2 LSP 是一个基于浏览器的 SysML v2 语言服务器实现，提供企业级的语言服务功能：

- **代码补全**：智能补全建议，支持关键字和用户定义类型
- **语法诊断**：实时语法检查与错误提示
- **跳转到定义**：快速导航到符号定义位置
- **引用查找**：查找符号的所有引用位置
- **语义高亮**：基于 LSP 语义标记的语法高亮
- **符号导航**：文档符号和工作区符号列表
- **代码格式化**：自动格式化代码

### 1.1 技术栈

| 技术 | 说明 |
|------|------|
| React 19 | UI 框架 |
| Vite 7 | 构建工具 |
| Monaco Editor | 代码编辑器 |
| Langium 4 | 语法解析框架 |
| Web Worker | LSP 后台运行 |
| Vitest | 单元测试 |

### 1.2 架构特点

- **纯浏览器运行**：无需 Node.js 后端，整个 LSP 运行在浏览器中
- **Web Worker 架构**：LSP 服务器运行在独立的 Web Worker 中，不阻塞主线程
- **多文件索引**：支持跨文件符号引用和类型查找

---

## 2. 快速开始

### 2.1 环境要求

- Node.js 18+
- pnpm 8+ (推荐) 或 npm 9+

### 2.2 安装与运行

```bash
# 克隆项目
git clone https://github.com/your-repo/sysmlv2-lsp-dev.git
cd sysmlv2-lsp-dev

# 安装依赖
pnpm install

# 启动开发服务器（热更新）
pnpm dev
```

打开浏览器访问 `http://localhost:5173` 即可看到编辑器界面。

### 2.3 常用脚本

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 启动开发服务器 |
| `pnpm build` | 生产构建 |
| `pnpm preview` | 预览生产版本 |
| `pnpm test` | 启动测试（watch 模式） |
| `pnpm test:run` | 单次运行测试 |
| `pnpm lint` | ESLint 检查 |
| `pnpm langium:generate` | 生成 Langium AST |
| `pnpm g4:generate` | 生成 G4 Parser |

---

## 3. 项目结构

### 3.1 根目录结构

```
sysmlv2-lsp-demo1/
├── index.html              # 应用入口 HTML
├── package.json           # 依赖与脚本配置
├── vite.config.js         # Vite 构建配置
├── vitest.config.ts       # 单元测试配置
├── langium-config.json   # Langium 语法生成配置
├── rspress.config.ts    # 文档站点配置
├── src/                  # 应用与语言服务源码
├── scripts/              # 构建/生成脚本
└── docs/                 # 项目文档
```

### 3.2 src/ 目录结构

```
src/
├── main.tsx              # React 应用入口
├── App.tsx              # 主应用组件（根组件）
├── components/          # UI 组件
│   ├── CodeEditor.tsx   # Monaco 编辑器封装组件
│   ├── Sidebar.tsx      # 侧边栏组件
│   └── TabBar.tsx       # 标签栏组件
├── languages/           # 语言支持配置
│   └── sysmlv2/        # SysML v2 语言配置
│       ├── config.ts    # 语言配置
│       └── completion.ts # 代码补全实现
├── workers/             # Web Worker（核心）
│   ├── lspClient.ts    # LSP 客户端（与 Worker 通信）
│   ├── sysmlLSPWorker.ts # LSP 服务器主逻辑
│   ├── stdlibLoader.ts # 标准库加载器
│   └── indexManager.ts # 多文件索引管理器
├── stores/             # 状态管理
│   └── fileStore.ts   # 文件存储状态管理
├── grammar/            # 语法定义
│   ├── sysml.langium  # Langium 语法定义
│   └── g4/            # ANTLR4 语法（备用）
└── utils/              # 工具函数
    └── ...
```

### 3.3 docs/ 目录结构

```
docs/
├── index.md              # 首页
├── _nav.json            # 顶部导航配置
├── architecture/        # 架构文档
│   ├── lsp-overview.md
│   ├── langium-parser.md
│   └── ...
├── flow/                # 流程文档
│   ├── execution-flow-overview.md
│   ├── completion-flow.md
│   └── ...
├── guide/               # 使用指南
│   ├── getting-started.md
│   ├── project-structure.md
│   └── ...
├── modules/            # API 参考
│   ├── lsp-client/
│   ├── lsp-worker/
│   └── store/
└── superpowers/        # 未来规划
```

---

## 4. 核心概念详解

### 4.1 LSP 架构

项目采用浏览器端的 LSP（Language Server Protocol）实现，使用 **双线程架构**：

```
┌─────────────────────────────────────────────────────┐
│                    主线程                            │
│  ┌─────────────┐      ┌─────────────────────────┐    │
│  │   React    │ ←──→ │    Monaco Editor        │    │
│  └─────────────┘      └─────────────────────────┘    │
│         │                      │                     │
│         ↓                      ↓                     │
│  ┌──────────────────────────────────────────┐   │
│  │            LSP 客户端 (lspClient.ts)       │   │
│  └──────────────────────────────────────────┘   │
│         ↑                                      │
│         │ PostMessage                          │
└─────────┼──────────────────────────────────────┘
          ↓
┌─────────────────────────────────────────────────────┐
│                  Web Worker 线程                    │
│  ┌──────────────────────────────────────────┐    │
│  │       LSP 服务器 (sysmlLSPWorker.ts)       │    │
│  │  ┌──────────┐ ┌─────────┐ ┌──────────┐    │    │
│  │  │ 解析器   │ │ 验证器  │ │ 补全器   │    │    │
│  │  └──────────┘ └─────────┘ └──────────┘    │    │
│  └──────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

#### LSP 客户端 (lspClient.ts)

负责与 Monaco Editor 交互，发送请求到 Worker：

- `initialize()` - 初始化 LSP 连接
- `openDocument()` - 打开文档
- `updateDocument()` - 更新文档内容
- `getCompletion()` - 获取代码补全
- `getDiagnostics()` - 获取诊断信息
- `getDefinition()` - 跳转到定义
- `getReferences()` - 查找引用

#### LSP Worker (sysmlLSPWorker.ts)

运行在独立线程中，处理各种 LSP 请求：

- `onInitialize` - 初始化处理
- `validateDocument` - 文档验证
- `onCompletion` - 补全处理
- `extractUserDefinedTypes` - 提取用户定义类型

### 4.2 Langium 语法解析

Langium 是一个基于 TypeScript 的语法解析框架，用于定义 DSL 语法。

#### 语法定义文件

`src/grammar/sysml.langium` 定义了 SysML v2 的语法规则：

```text
grammar SysML

terminal ID: /[a-zA-Z_][a-zA-Z0-9_]*/
terminal KW_PACKAGE: 'package'
terminal KW_PART: 'part'

Entry: element+=Package*
Package: 'package' name=ID '{' elements+=Element* '}'
Part: 'part' name=ID ':' type=[Package:ID]
```

#### 生成 AST

运行 `pnpm langium:generate` 会生成：

- `src/grammar/generated/ast.ts` - AST 类型定义
- `src/grammar/generated/langium.ts` - 解析器

### 4.3 Monaco 集成

Monaco Editor 提供 VS Code 同款的代码编辑体验：

```typescript
// 创建编辑器
const editor = monaco.editor.create(container, {
  language: 'sysml',    // 注册的语言
  theme: 'vs-dark',    // 主题
  value: content,       // 初始内容
})

// 注册 SysML 语言
monaco.languages.register({ id: 'sysml' })

// 配置代码补全
monaco.languages.registerCompletionItemProvider('sysml', {
  provideCompletionItems: (model, position) => {
    // 返回补全建议
  }
})
```

### 4.4 文件存储与索引

#### VirtualFileStore

虚拟文件存储管理多个打开的文档：

```typescript
// 添加文件
store.addFile({ uri, content })

// 打开标签页
store.openTab(uri)

// 获取状态
store.getState()
```

#### IndexManager

跨文件索引，支持多文件符号查找：

```typescript
// 添加到索引
indexManager.addFile(documentUri, symbols)

// 查找定义
indexManager.findDefinition(uri, position)

// 查找引用
indexManager.findReferences(uri, position)
```

---

## 5. 开发指南

### 5.1 添加新功能步骤

假设要添加一个新的 LSP 功能（如鼠标悬停提示）：

#### 步骤 1：在 Worker 中添加处理逻辑

`src/workers/sysmlLSPWorker.ts`:

```typescript
// 注册 hover 处理器
connection.onHover((params, token) => {
  const document = documents.get(params.textDocument.uri)
  const ast = parser.parse(document.text)
  // ... 查找 hover 信息
  return {
    contents: { kind: 'markdown', value: 'Hover信息' }
  }
})
```

#### 步骤 2：在客户端添加调用方法

`src/workers/lspClient.ts`:

```typescript
async getHover(position: Position): Promise<Hover | null> {
  return this.connection.sendRequest(HoverRequest.type, {
    textDocument: this.documentUri,
    position
  })
}
```

#### 步骤 3：添加到 Monaco 集成

`src/languages/sysmlv2/hover.ts`:

```typescript
monaco.languages.registerHoverProvider('sysml', {
  provideHover: (model, position) => {
    // 调用客户端方法
  }
})
```

#### 步骤 4：添加文档

`docs/modules/lsp-client/getHover.md`:

```markdown
# SysmlLSPClient.getHover

获取指定位置的悬停信息。

## 方法签名

```typescript
async getHover(position: Position): Promise<Hover | null>
```

## 参数

- `position` - 文档位置

## 返回值

悬停信息对象
```

### 5.2 调试技巧

#### 浏览器调试

1. 打开 Chrome DevTools (F12)
2. 在 `Sources` 面板中找到源文件
3. 设置断点

#### Worker 调试

```typescript
// 在 sysmlLSPWorker.ts 中添加调试日志
self.onmessage = (event) => {
  console.log('Worker 收到消息:', event.data)
  // ... 处理逻辑
}
```

#### 测试

```bash
# 运行单个测试文件
pnpm test -- src/workers/lspClient.test.ts

# 运行测试并显示 Coverage
pnpm test -- --coverage
```

### 5.3 构建与发布

```bash
# 开发构建（Source Map）
pnpm build

# 生产构建���压���）
NODE_ENV=production pnpm build

# 生成文档
npx rspress build
```

---

## 6. 代码规范

### 6.1 文件命名

- 组件：`PascalCase`（如 `CodeEditor.tsx`）
- 工具函数：`camelCase`（如 `utils.ts`）
- 类型定义：`types.ts`
- 样式：`*.module.css`

### 6.2 提交规范

```
feat: 添加新功能
fix: 修复问题
docs: 文档更新
refactor: 重构
test: 测试
chore: 构建/配置
```

---

## 7. 相关文档

| 文档 | 说明 |
|------|------|
| [项目结构](./project-structure.md) | 详细目录说明 |
| [使用指南](./usage-guide.md) | 使用说明 |
| [LSP 概述](../architecture/lsp-overview.md) | LSP 架构详解 |
| [Langium 解析器](../architecture/langium-parser.md) | 语法解析说明 |
| [API 参考](../modules/lsp-client/index.md) | LSP 客户端 API |
| [补全流程](../flow/completion-flow.md) | 代码补全流程 |

---

## 8. 常见问题

### Q: 如何添加新的关键字？

在 `src/workers/keywords.ts` 中添加：

```typescript
export const SYSMLV2_KEYWORDS = [
  'package', 'part', 'port', 'flow', 'action',
  // 新增关键字
  'newKeyword',
]
```

### Q: 如何修改语法高亮颜色？

在 `src/languages/sysmlv2/tokenizer.ts` 中修改 token 类型映射。

### Q: 如何添加新的诊断规则？

在 `src/workers/sysmlLSPWorker.ts` 的 `validateDocument` 函数中添加验证逻辑。

---

## 9. 集成指南

本章详细介绍如何将 SysML v2 LSP 集成到您自己的项目中。无论您使用的是原生 JavaScript、React、Vue3 还是其他框架，都能找到适合自己的集成方案。

### 9.1 集成方式概览

在开始集成之前，需要了解两种主要的集成方式和四种集成程度。

#### 9.1.1 集成方式

| 集成方式 | 适用场景 | 复杂度 | 优缺点 |
|---------|---------|--------|--------|
| **拷贝代码** | 不想发布 npm 包，直接复制源码到项目 | 低 | ✅ 无需发布包<br>✅ 灵活性高<br>❌ 需要手动同步更新 |
| **npm 包** | 已有打包发布的包 | 中 | ✅ 易于维护<br>✅ 版本管理<br>❌ 需要发布流程 |

**拷贝代码适用场景**：
- 项目需要深度定制 LSP 功能
- 不想维护独立的 npm 包
- 仅用于内部项目

**npm 包适用场景**：
- 需要在多个项目间共享
- 希望统一版本管理
- 有完善的 CI/CD 发布流程

#### 9.1.2 集成程度

| 集成程度 | 提供功能 | 适用场景 | 依赖 |
|---------|---------|---------|------|
| **仅 LSP** | 语法验证、诊断、补全 | 后端验证服务、CLI 工具 | vscode-jsonrpc, vscode-languageserver |
| **+ Monaco** | 代码编辑、补全、高亮、悬停 | Web 编辑器 | monaco-editor |
| **+ React** | 完整 UI 组件 | React 项目 | react, monaco-editor |
| **+ Vue3** | 完整 UI 组件 | Vue 项目 | vue, monaco-editor |

选择合适的集成程度：
- 如果只需要语言服务功能（如语法验证），选择**仅 LSP**
- 如果需要完整的代码编辑体验，选择 **+ Monaco** 或更高
- 如果使用的是 React/Vue 框架，可以选择对应的集成程度

### 9.2 方式一：拷贝代码集成

拷贝代码是最简单的集成方式，直接将本项目的相关文件复制到您的项目中。

#### 9.2.1 文件拷贝清单

将以下文件/目录从本项目复制到您的项目：

| 源目录 | 说明 | 必需 |
|--------|------|------|
| `src/workers/` | 核心 Worker（lspClient, sysmlLSPWorker, stdlibLoader, indexManager） | ✅ |
| `src/languages/sysmlv2/` | 语言配置（config, completion, tokenizer） | ✅ |
| `src/grammar/` | 语法定义（sysml.langium 及生成文件） | ✅ |
| `src/stores/fileStore.ts` | 文件存储 | 推荐 |
| `src/workers/keywords.ts` | 关键字定义 | 推荐 |

**目录结构示例**：
```
您的项目/
├── src/
│   ├── workers/
│   │   ├── lspClient.ts          # LSP 客户端
│   │   ├── sysmlLSPWorker.ts   # LSP 服务器
│   │   ├── stdlibLoader.ts      # 标准库加载
│   │   └── indexManager.ts    # 索引管理
│   ├── languages/
│   │   └── sysmlv2/
│   │       ├── config.ts       # 语言配置
│   │       ├── completion.ts  # 代码补全
│   │       └── tokenizer.ts # 分词器
│   ├── grammar/
│   │   ├── sysml.langium     # 语法定义
│   │   └── generated/       # 生成的 AST
│   └── stores/
│       └── fileStore.ts     # 文件存储
```

#### 9.2.2 安装依赖

在您的项目中安装 LSP 相关依赖：

```bash
pnpm add vscode-jsonrpc vscode-languageserver vscode-languageserver-textdocument
```

或者在 `package.json` 中添加：

```json
{
  "dependencies": {
    "vscode-jsonrpc": "^8.2.0",
    "vscode-languageserver": "^9.0.0",
    "vscode-languageserver-textdocument": "^1.0.12"
  }
}
```

**依赖说明**：
- `vscode-jsonrpc`：JSON-RPC 通信协议，用于 Worker 与��线程通信
- `vscode-languageserver`：LSP 协议实现，包含所有语言服务接口
- `vscode-languageserver-textdocument`：文本文档管理

#### 9.2.3 配置 Vite

在 `vite.config.ts` 中添加配置：

```typescript
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@sysml': path.resolve(__dirname, './src/sysml')
    }
  },
  optimizeDeps: {
    include: ['vscode-jsonrpc', 'vscode-languageserver']
  }
});
```

**配置说明**：
- `alias`：设置 `@sysml` 路径别名，简化导入路径
- `optimizeDeps`：预构建依赖，避免运行时加载问题

#### 9.2.4 创建 Worker 入口

在 `public/sysmlLSPWorker.js` 中创建 Worker 入口文件：

```javascript
import { createConnection, BrowserMessageReader, BrowserMessageWriter } from 'vscode-jsonrpc';

const connection = createConnection(
  new BrowserMessageReader(self),
  new BrowserMessageWriter(self)
);

import('./src/workers/sysmlLSPWorker.ts').then(({ startLanguageServer }) => {
  startLanguageServer(connection);
});
```

**为什么需要单独的 Worker 入口**：
- LSP 服务需要在独立的线程中运行，避免阻塞主线程
- 浏览器环境需要通过 `import` 动态加载模块
- `public/` 目录下的文件可以直接通过 URL 访问

#### 9.2.5 TypeScript 配置

确保 `tsconfig.json` 包含正确的路径配置：

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@sysml/*": ["src/sysml/*"]
    }
  }
}
```

#### 9.2.6 目录拷贝详细步骤

**步骤 1：创建目录结构**

```bash
mkdir -p src/workers src/languages/sysmlv2 src/grammar/generated src/stores
```

**步骤 2：拷贝文件**

```bash
# 拷贝 workers 目录
cp -r /path/to/sysmlv2-lsp-dev/src/workers/* src/workers/

# 拷贝语言配置
cp -r /path/to/sysmlv2-lsp-dev/src/languages/sysmlv2 src/languages/

# 拷贝语法文件
cp -r /path/to/sysmlv2-lsp-dev/src/grammar/* src/grammar/

# 拷贝文件存储
cp /path/to/sysmlv2-lsp-dev/src/stores/fileStore.ts src/stores/
```

**步骤 3：安装依赖**

```bash
pnpm install
```

### 9.3 方式二：npm 包集成

如果您已将本项目发布为 npm 包，可以使用此方式。这种方式更适合需要在多个项目间共享的情况。

#### 9.3.1 安装

```bash
pnpm add @your-org/sysmlv2-lsp
```

#### 9.3.2 基本使用

```typescript
import { SysmlLSPClient } from '@your-org/sysmlv2-lsp';

async function main() {
  const worker = new Worker('/sysmlLSPWorker.js');
  const lspClient = new SysmlLSPClient(worker);
  
  await lspClient.initialize();
  await lspClient.openDocument('file:///test.sysml', 'package Demo {}');
  
  const diagnostics = await lspClient.getDiagnostics();
  console.log(diagnostics);
}
```

#### 9.3.3 高级使用

```typescript
import { CodeEditor } from '@your-org/sysmlv2-lsp';

function App() {
  return (
    <CodeEditor
      initialValue="package Demo { part Main {} }"
      onChange={(value) => console.log(value)}
    />
  );
}
```

### 9.4 集成程度选择

根据您的需求选择合适的集成程度。

#### 9.4.1 仅 LSP（轻量级）

只使用 LSP 语言服务，不包含编辑器。适用于后端验证服务、CLI 工具等场景。

**适用场景**：
- 后端语法验证服务
- CI/CD 中的代码检查
- 命令行工具
- 需要嵌入到现有编辑器的场景

**代码示例**：

```typescript
import { SysmlLSPClient } from './src/workers/lspClient.ts';

async function validateCode(code: string): Promise<Diagnostic[]> {
  // 1. 创建 Worker
  const worker = new Worker('/sysmlLSPWorker.js');
  
  // 2. 创建 LSP 客户端
  const lspClient = new SysmlLSPClient(worker);
  
  // 3. 初始化
  await lspClient.initialize();
  
  // 4. 打开文档
  await lspClient.openDocument('file:///test.sysml', code);
  
  // 5. 获取诊断
  const diagnostics = await lspClient.getDiagnostics();
  
  // 6. 清理资源
  lspClient.dispose();
  worker.terminate();
  
  return diagnostics;
}

// 使用
const code = `
package Demo {
  part Main {
  }
}
`;

validateCode(code).then(diagnostics => {
  console.log(`发现 ${diagnostics.length} 个问题`);
  diagnostics.forEach(d => console.log(d.message));
});
```

**功能列表**：
- ✅ 语法诊断
- ✅ 代码补全（通过 API 调用）
- ✅ 跳转到定义（通过 API 调用）
- ✅ 查找引用（通过 API 调用）

#### 9.4.2 LSP + Monaco Editor（Web 编辑器）

完整的代码编辑器体验。

**适用场景**：
- Web 代码编辑器
- 在线代码编辑工具
- 需要嵌入到现有 Web 应用

**代码示例**：

```typescript
import * as monaco from 'monaco-editor';
import { SysmlLSPClient } from './src/workers/lspClient.ts';
import { sysmlLanguageConfig } from './src/languages/sysmlv2/config.ts';

function createSysmlEditor(container: HTMLElement, initialCode: string = '') {
  // ========== 1. 注册语言 ==========
  monaco.languages.register({ id: 'sysml' });
  monaco.languages.setMonarchTokensProvider('sysml', sysmlLanguageConfig);

  // ========== 2. 创建 Worker 和客户端 ==========
  const worker = new Worker('/sysmlLSPWorker.js');
  const lspClient = new SysmlLSPClient(worker);
  
  // 异步初始化
  lspClient.initialize().then(() => {
    console.log('LSP 客户端已初始化');
  });

  // ========== 3. 创建编辑器 ==========
  const editor = monaco.editor.create(container, {
    value: initialCode || 'package Demo { part Main {} }',
    language: 'sysml',
    theme: 'vs-dark',
    fontSize: 14,
    minimap: { enabled: true },
    lineNumbers: 'on',
    automaticLayout: true
  });

  // ========== 4. 配置代码补全 ==========
  monaco.languages.registerCompletionItemProvider('sysml', {
    provideCompletionItems: async (model, position) => {
      const completions = await lspClient.getCompletion({
        textDocument: { uri: model.uri },
        position
      });
      return completions;
    }
  });

  // ========== 5. 配置悬停提示 ==========
  monaco.languages.registerHoverProvider('sysml', {
    async provideHover(model, position) {
      return lspClient.getHover({
        textDocument: { uri: model.uri },
        position
      });
    }
  });

  // ========== 6. 监听内容变化，更新诊断 ==========
  editor.onDidChangeModelContent(async () => {
    const content = editor.getValue();
    await lspClient.updateDocument('file:///test.sysml', content);
    
    const diagnostics = await lspClient.getDiagnostics();
    monaco.editor.setModelMarkers(editor.getModel()!, 'sysml', diagnostics);
  });

  // ========== 7. 配置跳转到定义 ==========
  editor.onMouseDown(async (e) => {
    if (e.target.type === monaco.editor.MouseTargetType.CONTENT_GUTTER_GLYPH_MARGIN) {
      const position = e.target.position;
      const definition = await lspClient.getDefinition({
        textDocument: { uri: editor.getModel()!.uri },
        position
      });
      
      if (definition.location) {
        // 跳转到定义位置
        const range = definition.location.range;
        editor.setPosition({ lineNumber: range.start.line, column: range.start.character });
        editor.revealPositionInCenter({
          lineNumber: range.start.line,
          column: range.start.character
        });
      }
    }
  });

  // 返回编辑器实例和 LSP 客户端，供外部控制
  return { editor, lspClient };
}

// 使用
const container = document.getElementById('editor');
const { editor, lspClient } = createSysmlEditor(container, 'package Demo {}');
```

**功能列表**：
- ✅ 所有仅 LSP 功能
- ✅ 代码编辑
- ✅ 语法高亮
- ✅ 代码补全
- ✅ 悬停提示
- ✅ 跳转到定义
- ✅ 实时诊断

#### 9.4.3 LSP + Monaco + React（React 组件）

如果您的项目使用 React，可以使用此方式。

**适用场景**：
- React 项目
- 需要快速集成到 React 应用
- 希望使用 React 组件方式

**代码示例**：

```tsx
import { useEffect, useRef, useState } from 'react';
import * as monaco from 'monaco-editor';
import { SysmlLSPClient } from './src/workers/lspClient.ts';

interface SysmlEditorProps {
  /** 初始代码 */
  initialValue?: string;
  /** 代码变化回调 */
  onChange?: (value: string) => void;
  /** 主题 */
  theme?: 'vs' | 'vs-dark' | 'hc-black';
  /** 是否只读 */
  readOnly?: boolean;
  /** 字体大小 */
  fontSize?: number;
  /** 是否显示小地图 */
  minimap?: boolean;
}

export function SysmlEditor({
  initialValue = 'package Demo {}',
  onChange,
  theme = 'vs-dark',
  readOnly = false,
  fontSize = 14,
  minimap = true
}: SysmlEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor>();
  const lspRef = useRef<SysmlLSPClient>();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    // 注册 SysML 语言
    monaco.languages.register({ id: 'sysml' });
    monaco.languages.setMonarchTokensProvider('sysml', {
      tokenizer: {
        root: [
          [/package|part|port|action|flow|requirement/, 'keyword'],
          [/:=/, 'operator'],
          [/[{}]/, 'delimiter.bracket'],
          [/;/, 'delimiter'],
          [/[a-zA-Z_][a-zA-Z0-9_]*/, 'identifier']
        ]
      }
    });

    // 创建 Worker
    const worker = new Worker('/sysmlLSPWorker.js');
    const lspClient = new SysmlLSPClient(worker);

    // 创建编辑器
    const editor = monaco.editor.create(containerRef.current, {
      value: initialValue,
      language: 'sysml',
      theme,
      fontSize,
      readOnly,
      minimap: { enabled: minimap },
      automaticLayout: true,
      lineNumbers: 'on',
      folding: true,
      wordWrap: 'on'
    });

    // 初始化 LSP
    lspClient.initialize().then(async () => {
      await lspClient.openDocument('file:///demo.sysml', initialValue);
      setIsReady(true);
    });

    // 监听内容变化
    editor.onDidChangeModelContent(async () => {
      const value = editor.getValue();
      onChange?.(value);
      
      if (lspRef.current) {
        await lspRef.current.updateDocument('file:///demo.sysml', value);
        const diagnostics = await lspRef.current.getDiagnostics();
        monaco.editor.setModelMarkers(editor.getModel()!, 'sysml', diagnostics);
      }
    });

    // 配置补全
    monaco.languages.registerCompletionItemProvider('sysml', {
      provideCompletionItems: async (model, position) => {
        if (!lspRef.current) return { suggestions: [] };
        
        const completions = await lspRef.current.getCompletion({
          textDocument: { uri: model.uri },
          position
        });
        return { suggestions: completions };
      }
    });

    // 配置悬停
    monaco.languages.registerHoverProvider('sysml', {
      provideHover: async (model, position) => {
        if (!lspRef.current) return null;
        
        return lspRef.current.getHover({
          textDocument: { uri: model.uri },
          position
        });
      }
    });

    editorRef.current = editor;
    lspRef.current = lspClient;

    // 清理函数
    return () => {
      editor.dispose();
      lspClient.dispose();
    };
  }, []);

  return (
    <div 
      ref={containerRef} 
      style={{ 
        height: '500px',
        border: '1px solid #ccc',
        borderRadius: '4px'
      }} 
    />
  );
}
```

**使用方式**：

```tsx
import { SysmlEditor } from './components/SysmlEditor';

function App() {
  const handleChange = (code: string) => {
    console.log('代码已更改:', code);
  };

  return (
    <div style={{ height: '100vh', padding: '20px' }}>
      <h1>SysML 编辑器</h1>
      <SysmlEditor
        initialValue="package Demo { part Main {} }"
        onChange={handleChange}
        theme="vs-dark"
        fontSize={14}
      />
    </div>
  );
}
```

**功能列表**：
- ✅ 所有 LSP + Monaco 功能
- ✅ React 组件封装
- ✅ Props 配置
- ✅ 自动资源清理

#### 9.4.4 LSP + Monaco + Vue3（Vue3 组件）

如果您的项目使用 Vue3，可以使用此方式。

**代码示例**：

```vue
<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import * as monaco from 'monaco-editor';
import { SysmlLSPClient } from './src/workers/lspClient.ts';

interface Props {
  initialValue?: string;
  theme?: 'vs' | 'vs-dark' | 'hc-black';
  readOnly?: boolean;
  fontSize?: number;
}

const props = withDefaults(defineProps<Props>(), {
  initialValue: 'package Demo {}',
  theme: 'vs-dark',
  readOnly: false,
  fontSize: 14
});

const emit = defineEmits<{
  (e: 'change', value: string): void;
}>();

const editorRef = ref<HTMLDivElement | null>(null);
const editor = ref<monaco.editor.IStandaloneCodeEditor>();
const lspClient = ref<SysmlLSPClient>();

onMounted(async () => {
  if (!editorRef.value) return;

  // 注册语言
  monaco.languages.register({ id: 'sysml' });
  monaco.languages.setMonarchTokensProvider('sysml', {
    tokenizer: {
      root: [
        [/package|part|port|action|flow|requirement/, 'keyword'],
        [/:=/, 'operator'],
        [/[{}]/, 'delimiter.bracket'],
        [/;/, 'delimiter'],
        [/[a-zA-Z_][a-zA-Z0-9_]*/, 'identifier']
      ]
    }
  });

  // 创建 Worker
  const worker = new Worker('/sysmlLSPWorker.js');
  const lsp = new SysmlLSPClient(worker);

  await lsp.initialize();
  await lsp.openDocument('file:///demo.sysml', props.initialValue);

  // 创建编辑器
  const editorInstance = monaco.editor.create(editorRef.value, {
    value: props.initialValue,
    language: 'sysml',
    theme: props.theme,
    fontSize: props.fontSize,
    readOnly: props.readOnly,
    automaticLayout: true,
    lineNumbers: 'on',
    folding: true
  });

  // 监听变化
  editorInstance.onDidChangeModelContent(async () => {
    const value = editorInstance.getValue();
    emit('change', value);
    
    await lsp.updateDocument('file:///demo.sysml', value);
    const diagnostics = await lsp.getDiagnostics();
    monaco.editor.setModelMarkers(editorInstance.getModel()!, 'sysml', diagnostics);
  });

  // 配置补全
  monaco.languages.registerCompletionItemProvider('sysml', {
    provideCompletionItems: async (model, position) => {
      const completions = await lsp.getCompletion({
        textDocument: { uri: model.uri },
        position
      });
      return { suggestions: completions };
    }
  });

  editor.value = editorInstance;
  lspClient.value = lsp;
});

onUnmounted(() => {
  editor.value?.dispose();
  lspClient.value?.dispose();
});

watch(() => props.initialValue, (newValue) => {
  if (editor.value && newValue !== editor.value.getValue()) {
    editor.value.setValue(newValue);
  }
});
</script>

<template>
  <div 
    ref="editorRef" 
    style="height: 500px; border: 1px solid #ccc; border-radius: 4px;"
  />
</template>
```

**使用方式**：

```vue
<template>
  <div style="padding: 20px;">
    <h1>SysML 编辑器</h1>
    <SysmlEditor
      initial-value="package Demo { part Main {} }"
      @change="handleChange"
      theme="vs-dark"
    />
  </div>
</template>

<script setup lang="ts">
import { SysmlEditor } from './components/SysmlEditor.vue';

function handleChange(code: string) {
  console.log('代码已更改:', code);
}
</script>
```

### 9.5 完整示例

以下提供几种完整的集成示例，包括完整的环境搭建步骤。

#### 9.5.1 纯 HTML 集成

不使用任何框架的纯 HTML 集成示例，适合快速原型或简单的网页嵌入。

**文件结构**：

```
项目目录/
├── index.html
├── sysmlLSPWorker.js
└── (其他静态资源)
```

**index.html**：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SysML Editor</title>
  <style>
    body {
      margin: 0;
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    
    h1 {
      margin-bottom: 20px;
    }
    
    #editor {
      width: 100%;
      height: 500px;
      border: 1px solid #ccc;
      border-radius: 4px;
    }
    
    .status {
      margin-top: 10px;
      padding: 10px;
      background: #f5f5f5;
      border-radius: 4px;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <h1>SysML v2 编辑器</h1>
  <div id="editor"></div>
  <div class="status" id="status">正在初始化...</div>

  <!-- 加载 Monaco Editor -->
  <script src="https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs/loader.js"></script>

  <script type="module">
    // 更新状态
    function updateStatus(message) {
      document.getElementById('status').textContent = message;
    }

    // 简单 LSP 客户端封装
    class SimpleLSPClient {
      constructor(worker) {
        this.worker = worker;
        this.documentUri = 'file:///untitled.sysml';
        this.pending = new Map();
        this.requestId = 0;

        this.worker.onmessage = (event) => {
          const { id, result, error } = event.data;
          const pending = this.pending.get(id);
          
          if (pending) {
            this.pending.delete(id);
            if (error) {
              pending.reject(error);
            } else {
              pending.resolve(result);
            }
          }
        };
      }

      sendRequest(method, params) {
        return new Promise((resolve, reject) => {
          const id = String(++this.requestId);
          this.pending.set(id, { resolve, reject });
          this.worker.postMessage({ id, method, params });
        });
      }

      async initialize() {
        return this.sendRequest('initialize', {
          processId: null,
          rootUri: null,
          capabilities: {}
        });
      }

      async openDocument(uri, text, languageId = 'sysml') {
        this.documentUri = uri;
        return this.sendRequest('textDocument/didOpen', {
          textDocument: { uri, text, languageId, version: 1 }
        });
      }

      async updateDocument(uri, text) {
        this.documentUri = uri;
        return this.sendRequest('textDocument/didChange', {
          textDocument: { uri, version: 2 },
          contentChanges: [{ text }]
        });
      }

      async getDiagnostics() {
        return this.sendRequest('textDocument/diagnostic', {
          textDocument: { uri: this.documentUri }
        });
      }

      async getCompletion(position) {
        return this.sendRequest('textDocument/completion', {
          textDocument: { uri: this.documentUri },
          position
        });
      }

      async getHover(position) {
        return this.sendRequest('textDocument/hover', {
          textDocument: { uri: this.documentUri },
          position
        });
      }
    }

    // 加载 Monaco
    require.config({ 
      paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' } 
    });

    require(['vs/editor/editor.main'], async () => {
      // 1. 注册语言
      monaco.languages.register({ id: 'sysml' });
      monaco.languages.setMonarchTokensProvider('sysml', {
        tokenizer: {
          root: [
            [/package|part|port|action|flow|requirement/, 'keyword'],
            [/:=/, 'operator'],
            [/[{}]/, 'delimiter.bracket'],
            [/;/, 'delimiter'],
            [/[a-zA-Z_][a-zA-Z0-9_]*/, 'identifier']
          ]
        }
      });

      // 2. 创建 Worker
      updateStatus('正在加载 LSP Worker...');
      const worker = new Worker('./sysmlLSPWorker.js');

      // 3. 初始化 LSP 客户端
      updateStatus('正在初始化 LSP...');
      const lspClient = new SimpleLSPClient(worker);
      
      try {
        await lspClient.initialize();
        await lspClient.openDocument(
          'file:///untitled.sysml', 
          'package Demo {\n  part Main {}\n}'
        );
        updateStatus('LSP 初始化完成');
      } catch (e) {
        updateStatus('LSP 初始化失败: ' + e.message);
      }

      // 4. 创建编辑器
      const editor = monaco.editor.create(document.getElementById('editor'), {
        value: 'package Demo {\n  part Main {}\n}',
        language: 'sysml',
        theme: 'vs-dark',
        fontSize: 14,
        minimap: { enabled: true },
        automaticLayout: true,
        lineNumbers: 'on',
        folding: true
      });

      // 5. 配置补全
      monaco.languages.registerCompletionItemProvider('sysml', {
        provideCompletionItems: async (model, position) => {
          const result = await lspClient.getCompletion({
            line: position.lineNumber,
            character: position.column
          });
          return result || { suggestions: [] };
        }
      });

      // 6. 配置悬停
      monaco.languages.registerHoverProvider('sysml', {
        provideHover: async (model, position) => {
          return lspClient.getHover({
            line: position.lineNumber,
            character: position.column
          });
        }
      });

      // 7. 监听内容变化，更新诊断
      editor.onDidChangeModelContent(async () => {
        const text = editor.getValue();
        
        try {
          await lspClient.updateDocument('file:///untitled.sysml', text);
          const diagnostics = await lspClient.getDiagnostics();
          
          monaco.editor.setModelMarkers(editor.getModel()!, 'sysml',
            (diagnostics || []).map(d => ({
              severity: monaco.MarkerSeverity.Error,
              message: d.message,
              startLineNumber: d.range.start.line + 1,
              startColumn: d.range.start.character + 1,
              endLineNumber: d.range.end.line + 1,
              endColumn: d.range.end.character + 1
            }))
          );
          
          updateStatus(`已检查 - ${diagnostics?.length || 0} 个问题`);
        } catch (e) {
          updateStatus('诊断错误: ' + e.message);
        }
      });

      updateStatus('编辑器就绪');
    });
  </script>
</body>
</html>
```

#### 9.5.2 Vite + React + Monaco 集成

使用 Vite 构建的 React 项目集成方案。

**步骤 1：创建项目**

```bash
npm create vite@latest my-sysml-app -- --template react-ts
cd my-sysml-app
```

**步骤 2：安装依赖**

```bash
pnpm add monaco-editor vscode-jsonrpc vscode-languageserver vscode-languageserver-textdocument
pnpm add -D vite-plugin-react()
```

**步骤 3：配置 Vite**

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['monaco-editor']
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'monaco-editor': ['monaco-editor']
        }
      }
    }
  }
});
```

**步骤 4：创建编辑器组件**

```tsx
// src/components/SysmlEditor.tsx
import { useEffect, useRef } from 'react';
import * as monaco from 'monaco-editor';
import { SysmlLSPClient } from '../workers/lspClient';

interface Props {
  initialValue?: string;
  onChange?: (value: string) => void;
}

export function SysmlEditor({ initialValue = 'package Demo {}', onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor>();
  const lspRef = useRef<SysmlLSPClient>();

  useEffect(() => {
    if (!containerRef.current) return;

    // 注册语言
    monaco.languages.register({ id: 'sysml' });
    monaco.languages.setMonarchTokensProvider('sysml', {
      tokenizer: {
        root: [
          [/package|part|port|action/, 'keyword'],
          [/[{}]/, 'delimiter.bracket']
        ]
      }
    });

    // 创建 Worker
    const worker = new Worker('/sysmlLSPWorker.js');
    const lspClient = new SysmlLSPClient(worker);

    // 创建编辑器
    const editor = monaco.editor.create(containerRef.current, {
      value: initialValue,
      language: 'sysml',
      theme: 'vs-dark'
    });

    // 初始化
    lspClient.initialize().then(async () => {
      await lspClient.openDocument('file:///demo.sysml', initialValue);
    });

    // 监听变化
    editor.onDidChangeModelContent(async () => {
      const value = editor.getValue();
      onChange?.(value);
      await lspClient.updateDocument('file:///demo.sysml', value);
      
      const diagnostics = await lspClient.getDiagnostics();
      monaco.editor.setModelMarkers(editor.getModel()!, 'sysml', diagnostics);
    });

    editorRef.current = editor;
    lspRef.current = lspClient;

    return () => {
      editor.dispose();
      lspClient.dispose();
    };
  }, []);

  return <div ref={containerRef} style={{ height: '500px' }} />;
}
```

#### 9.5.3 Vite + Vue3 + Monaco 集成

使用 Vite 构建的 Vue3 项目集成方案。

**步骤 1：创建项目**

```bash
npm create vite@latest my-sysml-app -- --template vue-ts
cd my-sysml-app
```

**步骤 2：安装依赖**

```bash
pnpm add monaco-editor vscode-jsonrpc vscode-languageserver
```

**步骤 3：创建编辑器组件**

```vue
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import * as monaco from 'monaco-editor';

const props = defineProps<{
  initialValue?: string;
}>();

const emit = defineEmits<{
  (e: 'change', value: string): void;
}>();

const containerRef = ref<HTMLDivElement | null>(null);
const editor = ref<monaco.editor.IStandaloneCodeEditor>();
const lspClient = ref<any>(null);

onMounted(async () => {
  if (!containerRef.value) return;

  // 注册语言
  monaco.languages.register({ id: 'sysml' });
  monaco.languages.setMonarchTokensProvider('sysml', {
    tokenizer: {
      root: [[/package|part|port|action/, 'keyword']]
    }
  });

  // 创建 Worker
  const worker = new Worker('/sysmlLSPWorker.js');
  const { SysmlLSPClient } = await import('./workers/lspClient');
  const lsp = new SysmlLSPClient(worker);

  await lsp.initialize();
  await lsp.openDocument('file:///demo.sysml', props.initialValue || 'package Demo {}');

  const editorInstance = monaco.editor.create(containerRef.value, {
    value: props.initialValue || 'package Demo {}',
    language: 'sysml',
    theme: 'vs-dark'
  });

  editorInstance.onDidChangeModelContent(async () => {
    const value = editorInstance.getValue();
    emit('change', value);
    await lsp.updateDocument('file:///demo.sysml', value);
  });

  editor.value = editorInstance;
  lspClient.value = lsp;
});

onUnmounted(() => {
  editor.value?.dispose();
  lspClient.value?.dispose();
});
</script>

<template>
  <div ref="containerRef" style="height: 500px;"></div>
</template>
```

### 9.6 配置自定义标准库

可以加载自定义的标准库文件，扩展内置的类型定义和库函数。

#### 9.6.1 配置方式

```typescript
// 方式一：构造函数配置
const lspClient = new SysmlLSPClient(worker, {
  stdlib: {
    paths: [
      'https://example.com/std/sysml-base.sysml',
      'https://example.com/std/units.sysml'
    ]
  }
});

// 方式二：动态加载
await lspClient.loadLibraryFile('https://example.com/std/sysml-base.sysml');
```

#### 9.6.2 标准库格式

标准库文件应该是有效的 SysML 代码：

```text
package Base {
  part Any {
  }
  
  flow FlowType {
  }
}
```

### 9.7 常见问题

#### Q: Worker 加载失败

**问题**：Worker 文件无法加载，控制台报错。

**解决方案**：

确保 Worker 文件在正确的位置：

```typescript
// 方式一：使用 import.meta.url（推荐）
const worker = new Worker(
  new URL('./worker.ts', import.meta.url), 
  { type: 'module' }
);

// 方式二：放在 public 目录
const worker = new Worker('/sysmlLSPWorker.js');

// 方式三：使用 Blob URL
const blob = new Blob([workerCode], { type: 'application/javascript' });
const worker = new Worker(URL.createObjectURL(blob));
```

#### Q: Monaco 语言未识别

**问题**：编辑器无法识别 sysml 语言。

**解决方案**：

在创建编辑器前手动注册语言：

```typescript
// 注册语言（在创建编辑器之前）
monaco.languages.register({ id: 'sysml' });
monaco.languages.setMonarchTokensProvider('sysml', languageDef);

// 然后创建编辑器
const editor = monaco.editor.create(container, {
  language: 'sysml',  // 注意：这里设置语言的 id
  // ...
});
```

#### Q: LSP 连接失败

**问题**：LSP 服务无法连接。

**解决方案**：

检查 CSP 配置：

```typescript
// vite.config.ts
export default defineConfig({
  server: {
    headers: {
      'Content-Security-Policy': "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: worker-src 'self'"
    }
  }
});
```

或者在开发环境禁用 CSP：

```typescript
// vite.config.ts
export default defineConfig({
  server: {
    cors: true
  }
});
```

#### Q: TypeScript 报错

**问题**：编译时提示找不到模块。

**解决方案**：

确保 `tsconfig.json` 配置正确：

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@sysml/*": ["src/sysml/*"],
      "*": ["*"]
    }
  }
}
```

#### Q: 内存泄漏

**问题**：多次创建编辑器后页面变卡。

**解决方案**：

确保在组件卸载时正确清理资源：

```typescript
useEffect(() => {
  // ... 创建编辑器
  
  return () => {
    editor?.dispose();
    lspClient?.dispose();
    worker?.terminate();
  };
}, []);
```

#### Q: 热更新后 LSP 失效

**问题**：开发模式下热更新导致 LSP 无法工作。

**解决方案**：

监听热更新事件：

```typescript
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    // 重新加载后重建编辑器
    window.location.reload();
  });
}
```

#### Q: Worker 中 "document is not defined"

**问题**：拷贝代码到新项目后，浏览器控制台报错 `Uncaught ReferenceError: document is not defined`。

**原因分析**：
- LSP 某些文件（如 `src/languages/sysmlv2/index.ts`）在模块级别调用了 `window` 或 `document`
- Web Worker 环境没有 `document` 对象
- 新项目的打包配置导致这些代码在 Worker 初始化时就执行了

**解决方案**：

**方案一：延迟初始化（推荐）**

将 `window` 调用延迟到运行时：

```typescript
// src/languages/sysmlv2/index.ts

// 不要在模块级别调用 window
// 删除或注释这行：
// console.log('SysMLv2 language registered successfully');

// 改为在函数中调用
export function registerSysml() {
  // 只在浏览器主线程调用
  if (typeof window !== 'undefined') {
    console.log('SysMLv2 language registered successfully');
  }
}
```

**方案二：检查运行环境**

在代码中添加环境检查：

```typescript
// src/languages/sysmlv2/index.ts

// 在访问 window 之前检查环境
const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

if (isBrowser) {
  console.log('SysMLv2 language registered successfully');
  // 其他 window/document 相关代码
}
```

**方案三：Vite 配置排除**

在 `vite.config.ts` 中标记某些模块为外部依赖：

```typescript
// vite.config.ts
export default defineConfig({
  worker: {
    format: 'es',
    plugins: [],
    rollupOptions: {
      external: ['vscode-jsonrpc', 'vscode-languageserver']
    }
  }
});
```

**方案四：修复源代码（根本解决）**

如果希望保持功能完整，可以修改源代码：

```typescript
// src/languages/sysmlv2/index.ts

// 将 console.log 改为条件执行
export function initSysmlLanguage() {
  // 只在非 Worker 环境中输出日志
  if (typeof self === 'undefined' || self.constructor.name === 'Window') {
    console.log('SysMLv2 language registered successfully');
  }
  
  // 其他初始化代码...
}
```

**步骤总结**：

1. 检查报错的文件（如 `src/languages/sysmlv2/index.ts`）
2. 将所有 `window` 和 `document` 调用改为条件执行
3. 或者使用上述方案三的 Vite 配置
4. 重新启动开发服务器

---

常见问题排查顺序：

1. **Worker 加载失败** → 检查 Worker 文件路径
2. **Monaco 语言未识别** → 注册语言
3. **LSP 连接失败** → CSP 配置
4. **TypeScript 报错** → tsconfig 配置
5. **Worker 中 document 未定义** → 本问题方案
6. **内存泄漏** → 清理资源
7. **热更新失效** → 监听热更新