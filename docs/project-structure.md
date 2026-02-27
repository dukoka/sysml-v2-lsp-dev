# sysmlv2-lsp-demo1 项目结构说明

本文档描述本仓库的目录与模块结构，适用于开发与二次集成。当前结构已包含阶段 G（多文件索引与跨 URI 引用）与阶段 H（LSP 为能力唯一源）的实现。

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
├── package-lock.json
├── vite.config.js          # Vite 构建配置
├── vitest.config.ts        # 单元测试配置
├── eslint.config.js
├── langium-config.json     # Langium 语法生成配置
├── .gitignore
│
├── src/                    # 应用与语言服务源码（见 §3）
├── scripts/                # 构建/生成脚本（见 §4）
├── plan/                   # 计划与验收文档（见 §5）
├── docs/                   # 项目文档（见 §6）
└── rspress-app/            # 可选：Rspress 文档站点
```

### 2.1 根 package.json 主要脚本

| 脚本 | 说明 |
|------|------|
| `npm run dev` | 启动 Vite 开发服务器（热更新） |
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
├── main.jsx                # React 入口
├── App.jsx                 # 根组件（主题切换 + CodeEditor）
├── App.css
├── index.css
│
├── components/
│   └── CodeEditor.tsx      # SysMLv2 编辑器封装：Monaco + LSP Worker + 诊断/主题
│
├── workers/
│   ├── sysmlLSPWorker.ts   # LSP 服务端（Web Worker）：Connection、Index、全部 LSP 能力
│   ├── indexManager.ts     # 多文件索引：uri → IndexEntry（root, scopeRoot, text）
│   └── lspClient.ts       # LSP 客户端：与 Worker JSON-RPC 通信，对外暴露 getDefinition/getReferences/...
│
├── languages/
│   └── sysmlv2/
│       ├── index.ts           # 语言注册入口：Monarch、补全、定义/引用/重命名 Provider、setSysmlv2LspClientGetter
│       ├── tokenizer.ts       # Monarch 词法（语法高亮）
│       ├── keywords.ts        # 关键字列表（补全与拼写纠错）
│       ├── completion.ts      # 补全逻辑（上下文感知）
│       ├── validator.ts       # 本地校验器（LSP 不可用时的回退）
│       ├── scope.ts          # 语义层：Scope 树、scopeLookup、scopeLookupInIndex（跨 URI）
│       ├── references.ts      # 引用解析：resolveToDefinition、getDefinitionAtPositionWithUri、findReferencesToDefinitionAcrossIndex
│       ├── documentSymbols.ts # 文档符号（大纲）：AST / parseSymbols 回退
│       ├── semanticTokens.ts  # 语义高亮：AST / 正则回退，含 getSemanticTokensDataLsp（LSP 用）
│       ├── semanticValidation.ts # 语义校验（未解析类型、重复定义等）
│       ├── formatter.ts       # 格式化
│       ├── inlayHints.ts      # Inlay 提示（可选）
│       ├── symbols.ts         # 基于正则的符号解析（回退）
│       └── *.test.ts          # 各模块单元测试
│
├── grammar/
│   ├── config.ts           # 解析/校验配置：grammarSource、g4Validation（见 docs/grammar-config.md）
│   ├── parser.ts           # 解析入口：parseSysML（基于 Langium 生成）
│   ├── astUtils.ts         # AST 工具：getNodeRange、getElementNameRange、astToDocumentSymbols、getFoldingRanges
│   ├── astSymbols.ts       # AST 符号提取（补全等）
│   ├── generated/         # Langium 生成，勿手改
│   │   ├── ast.ts
│   │   ├── grammar.ts
│   │   └── module.ts
│   ├── g4/                 # G4 语法与生成
│   │   ├── SysMLv2Lexer.g4
│   │   ├── SysMLv2Parser.g4
│   │   ├── g4Runner.ts      # G4 解析运行器（独立诊断通道）
│   │   └── README.md
│   ├── *.langium           # Langium 语法源（KerML/SysML）
│   └── *.test.ts
│
└── (其他资源)
```

### 3.1 数据流与职责

| 层级 | 职责 |
|------|------|
| **CodeEditor** | 创建 Monaco、LSP Worker、lspClient；注册主题；设置 `setSysmlv2LspClientGetter`；拉取诊断并设 Marker；内容变更时 `updateDocument`。 |
| **lspClient** | 封装 JSON-RPC：initialize、didOpen/didChange/didClose、以及 definition/references/rename/documentSymbol/foldingRange/semanticTokens/signatureHelp/codeAction/completion/hover/formatting/diagnostic。 |
| **sysmlLSPWorker** | 使用 `TextDocuments` + `createConnection(BrowserMessageReader/Writer)`；维护 Index（onDidOpen/onDidChangeContent/onDidClose）；实现所有 LSP 请求 handler，基于 Index + scope/references/astUtils。 |
| **indexManager** | 全局 `Map<uri, IndexEntry>`；`updateIndex(uri, text)` 解析并构建 scopeRoot；供 Worker 内 definition/references/rename 跨 URI 解析。 |
| **languages/sysmlv2** | 词法、补全、符号、Scope、引用、文档符号、语义高亮、格式化；Provider 优先调用 LSP（通过 getter），失败则本地 AST/symbols 回退。 |
| **grammar** | Langium 解析、AST 工具、G4 独立通道、配置。 |

---

## 4. scripts/

| 文件 | 说明 |
|------|------|
| `g4-generate.mjs` | 调用 ANTLR 等生成 G4 Lexer/Parser（见 `src/grammar/g4/README.md`） |

---

## 5. plan/

| 文件 | 说明 |
|------|------|
| `最终完成计划.md` | 阶段 A～H 目标与验收清单；G/H 施工方案与验收状态 |
| `验收结果与后续优化计划.md` | 中段验收与后续优化项 |
| `语言功能完全实现计划.md` | 语言功能范围与实现计划 |

---

## 6. docs/

| 文件 | 说明 |
|------|------|
| `project-structure.md` | 本文档：项目结构 |
| `usage-guide.md` | 使用说明（安装、运行、功能、配置、测试、集成） |
| `grammar-config.md` | 解析/校验配置项说明 |
| `grammar-mapping.md` | 语法映射与扩展说明 |
| `grammar-extension-and-fix.md` | 语法扩展与修复记录 |
| `current-vs-sysml-2ls-comparison.md` | 与 sysml-2ls 的对比 |
| `sysml-2ls-project-structure.md` | 外部参考：sysml-2ls 仓库结构与本项目 LSP 对照 |

---

## 7. 构建产物

- **开发**：`npm run dev` 不生成持久化产物；Worker 与入口由 Vite 按需编译。
- **生产**：`npm run build` 输出到 `dist/`，包含：
  - `index.html`
  - `assets/*.js`（含主应用、Monaco、`sysmlLSPWorker-*.js` 等）
  - `assets/*.css`、字体等

---

## 8. 依赖关系概览

```
App.jsx
  → CodeEditor.tsx
       → registerSysmlv2Language, setSysmlv2LspClientGetter (languages/sysmlv2/index.ts)
       → createSysmlLSPClient (workers/lspClient.ts)
       → Worker(workers/sysmlLSPWorker.ts)
       → createSysmlv2Validator (languages/sysmlv2/validator.ts)
       → grammar/config (G4 开关)

sysmlLSPWorker.ts
  → indexManager.ts
  → grammar/parser, astUtils
  → languages/sysmlv2/scope, references, semanticTokens, formatter, ...
  → vscode-languageserver/browser, vscode-languageserver-textdocument
```

核心运行时依赖：`react`、`monaco-editor`、`vscode-languageserver`、`vscode-languageserver-textdocument`、`langium`（解析与生成 AST）。
