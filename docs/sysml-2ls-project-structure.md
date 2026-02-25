# sysml-2ls 项目完整结构说明

> 本文档描述 [sensmetry/sysml-2ls](https://github.com/sensmetry/sysml-2ls)（SysIDE Editor Legacy）仓库的完整目录与模块结构。  
> 仓库主站：GitLab [sensmetry/public/sysml-2ls](https://gitlab.com/sensmetry/public/sysml-2ls)。  
> **注意**：该扩展已被弃用，官方推荐使用新版 [Syside Editor](https://marketplace.visualstudio.com/items?itemName=sensmetry.syside-editor)。

---

## 1. 仓库概览

- **技术栈**：TypeScript、pnpm 单体仓库、Langium（语法与 LSP 生成）、vscode-languageserver
- **规范**：SysML v2 与 KerML [2024-12 版本](https://github.com/Systems-Modeling/SysML-v2-Release/tree/2024-12)
- **根脚本**：`grammar:generate` / `grammar:watch` 在 `packages/syside-languageserver` 中执行 Langium 生成；`build` 先 prebuild 再 `tsc -b` 并构建 VS Code 扩展

---

## 2. 根目录结构

```
sysml-2ls/
├── .editorconfig
├── .eslintrc.json
├── .git-blame-ignore-revs
├── .gitattributes
├── .githooks/                 # Git 钩子（如 pre-commit）
├── .github/                   # GitHub 配置
├── .gitlab/                   # GitLab 配置
├── .gitignore
├── .prettierrc
├── .vscode/                   # 工作区/调试配置
├── CHANGELOG.md
├── CODE_OF_CONDUCT.md
├── CONTRIBUTING.md
├── DCO
├── LICENSE
├── README.md
├── docs/                      # 项目文档
├── jest.config.base.js
├── jest.config.js
├── package.json               # 根 package，定义 workspace 脚本
├── pnpm-lock.yaml
├── pnpm-workspace.yaml        # 定义 6 个子包
├── packages/                  # 所有子包（见下节）
├── scripts/                   # 构建、发布、索引等脚本
├── tsconfig.build.json
├── tsconfig.eslint.json
└── tsconfig.json
```

### 2.1 根 `package.json` 主要脚本

| 脚本 | 说明 |
|------|------|
| `build` | prebuild → `tsc -b` → 构建 syside-vscode |
| `watch` | 监听 TypeScript 与 VS Code 扩展 |
| `grammar:generate` | 在 syside-languageserver 中执行 `langium generate` 并复制 syntaxes |
| `grammar:watch` | Langium 监听模式 |
| `vscode:package` | 打包 VS Code 扩展 |
| `prepare-validation` / `run-validation` | 校验相关 |
| `update-stdlib` | 更新标准库脚本 |

---

## 3. pnpm workspace 子包（packages/）

`pnpm-workspace.yaml` 定义：

```yaml
packages:
  - "packages/syside-base"
  - "packages/syside-languageserver"
  - "packages/syside-cli"
  - "packages/syside-languageclient"
  - "packages/syside-protocol"
  - "packages/syside-vscode"
```

---

## 4. 各子包结构详解

### 4.1 syside-base

**职责**：共享基础能力（URI、标准库路径等），被 languageserver 等依赖。

```
packages/syside-base/
├── README.md
├── jest.config.js
├── package.json
├── src/
│   ├── __tests__/
│   ├── index.ts      # 导出
│   ├── stdlib.ts     # 标准库路径/配置
│   └── uri.ts        # URI 工具
├── tsconfig.json
└── tsconfig.test.json
```

---

### 4.2 syside-protocol

**职责**：LSP/IDE 相关协议与类型定义，供 language server 与 client 共用。

```
packages/syside-protocol/
├── README.md
├── jest.config.js
├── package.json
├── src/              # 协议类型与常量
├── tsconfig.json
└── tsconfig.test.json
```

---

### 4.3 syside-cli

**职责**：命令行入口（如独立运行语言服务或工具）。

```
packages/syside-cli/
├── README.md
├── bin/              # 可执行入口
├── jest.config.js
├── package.json
├── src/
├── tsconfig.json
└── tsconfig.test.json
```

---

### 4.4 syside-languageclient

**职责**：LSP 客户端封装，用于连接并调用语言服务（如 VS Code 扩展内使用）。

```
packages/syside-languageclient/
├── README.md
├── jest.config.js
├── package.json
├── src/
├── tsconfig.json
└── tsconfig.test.json
```

---

### 4.5 syside-languageserver（核心）

**职责**：SysML v2 / KerML 的解析器与 LSP 实现。语法由 Langium 定义并生成解析器与 AST，LSP 能力在此基础上实现。

#### 4.5.1 顶层结构

```
packages/syside-languageserver/
├── .gitignore
├── README.md
├── bin/                    # 启动脚本（如 syside-languageserver）
├── browser.d.ts / browser.js
├── node.d.ts / node.js     # 环境入口占位
├── langium-config.json     # Langium 生成配置（grammar 路径等）
├── package.json
├── scripts/                # 克隆/校验等脚本
├── syntaxes/               # TextMate 语法（grammar 生成后复制到 vscode）
├── tsconfig.json
├── tsconfig.test.json
└── src/
```

#### 4.5.2 src/ 详细结构

```
src/
├── __tests__/
├── browser/                # 浏览器环境 LSP 入口（如 vscode.dev）
├── generated/              # Langium 生成，勿手改
│   ├── ast.ts              # AST 节点类型
│   ├── grammar.ts          # 解析器/词法
│   └── module.ts           # 默认 Langium 模块
├── grammar/                # 语法规则（Langium DSL）
│   ├── KerML.expressions.langium
│   ├── KerML.interfaces.langium
│   ├── KerML.langium
│   ├── SysML.interfaces.langium
│   └── SysML.langium
├── index.ts                # 包导出
├── launch/                 # 与运行环境无关的 LSP 启动逻辑
│   ├── index.ts
│   └── server.ts
├── model/                  # 语义模型与 AST 辅助
│   ├── KerML/ / SysML/
│   ├── __tests__/
│   ├── containers.ts
│   ├── enums.ts
│   ├── expressions/
│   ├── implicits.ts
│   ├── index.ts
│   ├── metamodel.ts
│   ├── mixins/
│   ├── naming.ts
│   ├── notes/
│   ├── printer/
│   ├── semantic-tokens.ts
│   ├── sexp.ts
│   ├── types.ts
│   ├── util.ts
│   └── ...
├── node/                   # Node 环境 LSP 入口与传输
│   ├── __tests__/
│   ├── arg-parser.ts
│   ├── cli.ts
│   ├── index.ts
│   ├── main.ts              # Node 入口：解析参数 → startServer
│   ├── node-file-system-provider.ts
│   ├── server.ts            # createConnection + createSysMLServices + startServer
│   └── ...
├── services/               # 解析、校验、LSP 提供器
│   ├── config.ts
│   ├── events.ts
│   ├── index.ts
│   ├── lsp/                 # LSP 能力实现
│   ├── parser/
│   ├── references/
│   ├── services.ts
│   ├── shared/
│   ├── sysml-ast-reflection.ts
│   ├── sysml-validation.ts
│   ├── validation/
│   └── ...
├── sysml-module.ts         # 依赖注入/服务模块（createSysMLServices）
├── testing/
└── utils/
```

#### 4.5.3 services/lsp/（LSP 功能实现）

| 文件 | 功能 |
|------|------|
| `language-server.ts` | 注册 LSP 能力、初始化 |
| `completion-provider.ts` | 补全 |
| `hover-provider.ts` | 悬停文档 |
| `semantic-token-provider.ts` | 语义高亮 |
| `formatter.ts` | 格式化 |
| `execute-command-handler.ts` | 自定义命令（重命名、引用等） |
| `index.ts` | 导出 |

#### 4.5.4 语法规则（grammar/）

| 文件 | 内容 |
|------|------|
| `KerML.langium` | KerML 主语法（命名空间、包、类型、特征、关系、表达式等） |
| `KerML.expressions.langium` | KerML 表达式 |
| `KerML.interfaces.langium` | KerML 接口/抽象规则 |
| `SysML.langium` | SysML 主语法 |
| `SysML.interfaces.langium` | SysML 接口/抽象规则 |

修改语法后需执行根目录 `pnpm run grammar:generate`（或在本包内 `langium generate`），会更新 `generated/` 并同步 `syntaxes/` 到 syside-vscode。

---

### 4.6 syside-vscode

**职责**：VS Code 扩展——激活、启动 LSP（Node/浏览器）、语言配置与语法高亮。

```
packages/syside-vscode/
├── .gitignore
├── .vscodeignore         # 打包时排除
├── README.md
├── language-configuration.json   # 括号、注释等编辑器行为
├── package.json          # 扩展 manifest（含 engines、activationEvents、main）
├── scripts/
├── src/
│   ├── browser/          # Web 扩展：启动浏览器端 LSP
│   ├── common/            # 与 node/browser 共用逻辑
│   ├── node/              # 桌面扩展：启动 Node LSP 进程
│   └── configuration-schema.ts  # 配置项 JSON Schema
└── tsconfig.json
```

扩展会依赖 `syside-languageclient` 连接语言服务；语法文件由 syside-languageserver 的 `syntaxes/` 在构建时复制过来。

---

## 5. 根目录 scripts/

| 脚本 | 用途 |
|------|------|
| `build.mjs` | 使用 esbuild 打包 languageserver（Node/浏览器） |
| `generate-index.mjs` | 生成 model/node/services 等索引 |
| `gh-release.mjs` | GitHub 发布 |
| `licencemarkup.mjs` | 许可证标记 |
| `prepare-release.mjs` | 发布前版本与变更处理 |
| `update-stdlib.mjs` | 更新标准库引用 |

---

## 6. 根目录 docs/

| 文件/目录 | 说明 |
|-----------|------|
| `images/` | README/文档用图 |
| `known_limitations.md` | 已知限制 |
| `langium.md` | Langium 使用说明 |
| `releasing.md` | 发布流程 |

---

## 7. LSP 服务运行机制（供参考实现）

当前项目（sysmlv2-lsp-demo1）在浏览器里用 Web Worker 做 LSP，与 sysml-2ls 的架构可对照理解。本节说明 sysml-2ls 里 **LSP 服务是如何启动、传输、注册并处理请求的**，便于你在自己的 Worker 里对齐或借鉴。

### 7.1 整体架构：两条运行路径

LSP 的“大脑”都在 `syside-languageserver` 里，只是**进程/线程入口**和**传输层**不同：

| 环境 | 入口 | 传输 | 文件系统 |
|------|------|------|----------|
| **Node（桌面 VS Code）** | `src/node/main.ts` | stdio / Node IPC / Socket / Pipe | `SysMLNodeFileSystem`（真实磁盘） |
| **Browser（vscode.dev）** | `src/browser/main.ts` | Worker `postMessage`（通过 vscode-languageserver 的 BrowserMessageReader/Writer） | `VirtualFileSystem`（内存） |

两种环境最后都调用**同一套** `launch/server.ts` 的 `startServer(connection, fileSystemProvider, options)`，因此“LSP 如何注册、如何跑”是一致的。

### 7.2 Node 端：从进程启动到 LSP 监听

**步骤 1：进程入口与参数**

- 可执行入口：`packages/syside-languageserver/bin/syside-languageserver`（或通过 `node main.js`）。
- `src/node/main.ts` 只做两件事：用 `createArgParser(DefaultNodeLauncherOptions).parse()` 解析命令行，然后调用 `startServer(options)`。

**步骤 2：创建传输（createTransport）**

- `src/node/server.ts` 里先调用 `createTransport(options)`，得到 `[input, output]`。
- `src/node/cli.ts` 的 `createTransport` 根据参数返回不同传输方式：

  - **stdio（默认）**：`[process.stdin, process.stdout]`，VS Code 通过“子进程 + 标准输入输出”与 LSP 通信。
  - **Node IPC**：`IPCMessageReader(process)` / `IPCMessageWriter(process)`。
  - **Socket**：`SocketMessageReader` / `SocketMessageWriter`（TCP 端口）。
  - **Named Pipe**：`createServerPipeTransport(pipe, encoding)`。

**步骤 3：建立 LSP Connection**

- `server.ts`：`createConnection(ProposedFeatures.all, input, output)`。
- 这里 `input`/`output` 要么是 Node 的 `ReadableStream`/`WritableStream`（stdio），要么是 vscode-languageserver 的 `MessageReader`/`MessageWriter`（IPC/Socket/Pipe）。
- 得到的是标准 LSP **Connection** 对象，之后所有 LSP 请求/通知都通过它收发。

**步骤 4：注入服务并启动 Langium**

- `startServer(connection, SysMLNodeFileSystem, options)` 实现在 `src/launch/server.ts`：

  ```ts
  const services = createSysMLServices({ connection, ...context }, options);
  startLanguageServer(services.shared);
  return services;
  ```

- **createSysMLServices**（`src/sysml-module.ts`）：
  - 接收的 `context` 包含 **connection** 和 **fileSystemProvider**（Node 下为 `SysMLNodeFileSystem`）。
  - 用 Langium 的 `inject()` 合并：默认共享模块、生成模块、以及自定义的 `SysMLSharedModule` / `SysMLDefaultModule` 等。
  - 在 **shared** 里会把 `context` 里的 `connection` 和 `fileSystemProvider` 注入进去，供 Langium 和自定义服务使用。
  - 返回 `{ shared, SysML, KerML }`；**shared** 里已包含 Langium 的 Connection、Workspace、以及自定义的 `SysMLLanguageServer` 等。

- **startLanguageServer(services.shared)**（Langium 提供）：
  - 内部会从 `shared` 里取 **Connection** 和 **LanguageServer**（即 `SysMLLanguageServer`）。
  - 在 Connection 上注册各类 LSP 的 `onRequest` / `onNotification`（如 `initialize`、`textDocument/didOpen`、`textDocument/completion`、`textDocument/hover` 等）。
  - 最后调用 **connection.listen()**，进入“收消息 → 派发到对应 handler”的循环。

因此 Node 端流程可概括为：

```
main.ts → 解析参数
  → server.ts: createTransport(options) → createConnection(input, output)
  → startServer(connection, SysMLNodeFileSystem, options)
  → launch/server.ts: createSysMLServices({ connection, fileSystemProvider }) → startLanguageServer(shared)
  → Langium 用 shared 里的 Connection + LanguageServer 注册 LSP 并 listen()
```

### 7.3 浏览器端：Worker 内用 postMessage 当传输

- 入口：`src/browser/main.ts` 仅调用 `startServer({})`。
- `src/browser/server.ts` 中：
  - `const input = new BrowserMessageReader(self);`
  - `const output = new BrowserMessageWriter(self);`
  - 这里 **self** 即 Worker 全局对象；`BrowserMessageReader`/`BrowserMessageWriter` 是 vscode-languageserver/browser 提供的，内部通过 **self.postMessage** 与主线程（或扩展宿主）交换 JSON-RPC 消息。
  - `createConnection(input, output)` 得到与 Node 端同构的 **Connection**。
  - 然后同样调用 `_startServer(connection, VirtualFileSystem, options)`，即同一套 `createSysMLServices` + `startLanguageServer(shared)`，只是 **context** 里用的是 **VirtualFileSystem**（内存文件系统），没有真实磁盘。

所以浏览器端只是“传输”和“文件系统”不同，**LSP 如何运行、如何注册**与 Node 完全一致。

### 7.4 服务注入与 LSP 能力挂接（sysml-module）

- **createSysMLServices** 里通过模块覆盖/注册了：
  - **parser**：自定义 `createSysMLParser`、`createSysMLGrammarConfig`（基于 grammar）。
  - **references**：Scope、NameProvider、Linker 等（影响补全、跳转、引用）。
  - **validation**：DocumentValidator、ValidationRegistry、SysML/KerML 校验器。
  - **lsp**：Formatter、CompletionProvider、SemanticTokenProvider、HoverProvider、ExecuteCommandHandler、**LanguageServer**（`SysMLLanguageServer`）。
  - **workspace**：DocumentBuilder、IndexManager、WorkspaceManager、DocumentFactory、ConfigurationProvider 等。

- **SysMLLanguageServer**（`services/lsp/language-server.ts`）在 Langium 启动时被调用，负责把上述 LSP 提供器**绑定到 Connection** 上（例如 `connection.onRequest(CompletionRequest.type, ...)`），这样一旦 `connection.listen()`，所有 LSP 请求就会按协议派发到对应 handler。

- 因此：**语法与 AST** 来自 grammar + generated；**语义与 LSP 行为** 来自 model、references、validation 和 services/lsp 下的各 provider；**运行时的“接线”** 由 Langium 的 startLanguageServer + SysMLLanguageServer 完成。

### 7.5 与当前项目（Web Worker）的对照与参考

当前项目（sysmlv2-lsp-demo1）结构大致是：

- **主线程**：`lspClient.ts` 用 **Worker.postMessage** 发 JSON-RPC（initialize、textDocument/didOpen、textDocument/completion 等），并维护 pending 请求与回调。
- **Worker**：`sysmlLSPWorker.ts` 里 **手写 switch(method)** 处理各 LSP 方法，自己维护文档状态（Map<uri, DocumentState>），没有使用 vscode-languageserver 和 Langium。

与 sysml-2ls 的对应关系可以这样理解：

| 维度 | sysml-2ls | 当前项目（可参考方向） |
|------|-----------|------------------------|
| **传输** | Node：stdio；Browser：BrowserMessageReader/Writer(self) 封装 postMessage | 直接 postMessage + 自维护 requestId / 回调 |
| **Connection** | vscode-languageserver 的 createConnection(input, output)，统一 onRequest/onNotification | 无 Connection，Worker 内自己解析 JSON 并 switch(method) |
| **LSP 注册** | startLanguageServer(shared) + SysMLLanguageServer 在 Connection 上注册 | 在 handleRequest 里按 method 分支 |
| **文档与 AST** | Langium 解析 + WorkspaceManager/Document 等 | 自维护 documents Map + 简单校验逻辑 |
| **能力** | 补全/悬停/诊断/格式化/语义高亮等由各 Provider 实现，基于 AST | 补全/悬停/诊断在 Worker 内手写，不基于完整 AST |

若要在当前项目里**更接近 sysml-2ls 的“LSP 服务运行方式”**，可以考虑：

1. **保留 Worker 架构**：继续用 Worker 跑 LSP 逻辑，避免阻塞主线程。
2. **在 Worker 内引入 vscode-languageserver/browser**：  
   - 用 `BrowserMessageReader(self)` 和 `BrowserMessageWriter(self)` 包装 postMessage，  
   - 调用 `createConnection(reader, writer)`，  
   - 然后自己实现一套“服务创建 + 在 Connection 上注册 completion/hover/diagnostic 等”的逻辑（若不上 Langium，就手写 `connection.onRequest(CompletionRequest.type, handler)` 等），  
   - 最后 `connection.listen()`。  
   这样主线程侧只需按 LSP 标准发 JSON-RPC（或使用 vscode-languageclient 的浏览器版），无需改协议格式。
3. **文档与解析**：若希望补全/诊断更接近 SysML 语义，可逐步引入“解析器 + AST”（例如用 Langium 生成解析器在 Worker 里跑，或自写轻量 parser），再在 LSP handler 里基于 AST 做 scope、校验和补全，结构上就和 sysml-2ls 的 services 更一致。

这样，**“LSP 服务是怎么运行的”**在 sysml-2ls 里就是：**传输层 → Connection → createSysMLServices（注入 parser、references、validation、lsp 等）→ startLanguageServer(shared) → Connection 上注册并 listen()**；浏览器只是把传输换成 Worker 的 postMessage，运行机制相同。

---

## 8. 构建与运行流程简述

1. **安装**：`pnpm install`
2. **生成语法与解析器**：`pnpm run grammar:generate`（在 syside-languageserver 中执行 `langium generate`，并复制 syntaxes 到 syside-vscode）
3. **编译**：`pnpm run build`（prebuild → `tsc -b` → 构建 syside-vscode）
4. **开发**：`pnpm run watch` 与 `pnpm run grammar:watch` 可同时开，改 grammar 或 TS 后自动重新生成/编译
5. **LSP 启动**：  
   - Node：`packages/syside-languageserver/src/node/main.ts` → `server.ts` 建立 stdio 连接并调用 `launch` 的 `startServer`。  
   - 浏览器：由 syside-vscode 的 `src/browser` 加载并运行 languageserver 的浏览器 bundle。

---

## 9. 依赖关系概览

```
syside-vscode     → syside-languageclient
syside-languageserver → syside-base, syside-protocol
syside-languageclient → syside-protocol（通常）
syside-cli        → 可能依赖 languageserver 或 client
```

Langium 与 vscode-languageserver 仅在 syside-languageserver 中直接使用；语法与 LSP 的“规则”集中在 `packages/syside-languageserver`（grammar 与 services）。

---

## 10. 参考链接

- 仓库（GitHub）：https://github.com/sensmetry/sysml-2ls
- 仓库（GitLab）：https://gitlab.com/sensmetry/public/sysml-2ls
- SysML v2 规范（2024-12）：https://github.com/Systems-Modeling/SysML-v2-Release/tree/2024-12
- 新版扩展：https://marketplace.visualstudio.com/items?itemName=sensmetry.syside-editor
