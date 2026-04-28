# SysMLv2 编辑器 — 使用说明

本文档说明如何安装、运行、配置和使用本项目的 SysMLv2 编辑器，以及如何嵌入到其他应用。

---

## 1. 环境要求

- **Node.js**：建议 18.x 或 20.x（LTS）
- **包管理器**：npm（随 Node 安装）或兼容的 yarn/pnpm
- **浏览器**：支持 Web Worker 与 ES Module 的现代浏览器（Chrome、Firefox、Edge、Safari 等）

无需安装任何后端服务；LSP 在浏览器内的 Web Worker 中运行。

---

## 2. 安装与运行

### 2.1 克隆与安装依赖

```bash
# 进入项目根目录
cd sysmlv2-lsp-demo1

# 安装依赖
npm install
```

### 2.2 开发模式（推荐日常使用）

```bash
npm run dev
```

- 启动后终端会显示本地访问地址（通常为 `http://localhost:5173`）。
- 在浏览器中打开该地址即可使用编辑器。
- 修改源码后会自动热更新，无需手动刷新。

### 2.3 生产构建

```bash
npm run build
```

- 构建产物输出到 `dist/` 目录。
- 可将 `dist/` 部署到任意静态站点或 CDN。

### 2.4 预览生产构建

```bash
npm run preview
```

- 使用 Vite 本地服务器预览 `dist/` 内容，用于部署前验证。

---

## 3. 界面与基本操作

### 3.1 主界面

- **顶部**：标题 “SysMLv2 Editor” 与主题选择（Dark / Light / SysMLv2 Dark）。
- **主体**：Monaco 编辑器，默认加载一段 SysMLv2 示例代码（VehicleExample 包与 part/port 定义）。

### 3.2 编辑与主题

- 直接输入或粘贴 SysMLv2 文本即可编辑。
- 通过顶部 **Theme** 下拉框切换浅色/深色/自定义 SysMLv2 Dark 主题。
- 编辑器支持括号匹配、自动缩进、行号、小地图、折叠等常见 IDE 行为。

### 3.3 常用快捷键（与 VS Code 一致）

| 操作 | Windows/Linux | macOS |
|------|----------------|--------|
| 补全 | `Ctrl+Space` | `Cmd+Space` |
| 跳转定义 | `F12` 或 `Ctrl+Click` | `F12` 或 `Cmd+Click` |
| 查找引用 | `Shift+F12` | `Shift+F12` |
| 重命名 | `F2` | `F2` |
| 格式化文档 | `Shift+Alt+F` | `Shift+Option+F` |
| 保存 | `Ctrl+S` | `Cmd+S`（若宿主支持） |
| 撤销/重做 | `Ctrl+Z` / `Ctrl+Y` | `Cmd+Z` / `Cmd+Shift+Z` |

---

## 4. LSP 功能详解

编辑器通过内置 LSP（运行在 Web Worker）提供以下能力。**在 LSP 可用时，跳转定义、查找引用、重命名会优先使用 LSP 结果**（支持单文件及多文件索引）；若 LSP 不可用或请求失败，将回退到本地 AST/符号逻辑。

### 4.1 诊断（错误与警告）

- **实时校验**：输入或修改内容后，LSP 会进行语法与语义校验。
- **展示方式**：错误与警告以红色/黄色波浪线显示在编辑器中；鼠标悬停可查看具体消息。
- **诊断源**：
  - **主诊断**：基于 Langium 解析与语义校验（未解析类型、重复定义、关键字拼写建议等）。
  - **G4 诊断**（可选）：若在配置中开启 G4 独立严格模式，会额外显示 G4 解析结果（见 §6 配置）。

### 4.2 代码补全

- **触发方式**：输入时自动触发，或按 `Ctrl+Space`（Mac：`Cmd+Space`）；在特定位置输入 `.`、`:`、`(`、`[` 也会触发。
- **内容**：关键字、类型名、包名、部件/端口/属性名等；上下文敏感（如 `part def` 后补全定义名，`:` 后补全类型）。
- **来源**：LSP 补全（基于 AST 与 Scope）；失败时使用本地补全逻辑。

### 4.3 悬停（Hover）

- 将鼠标悬停在标识符或关键字上，可查看简短说明（如 “SysMLv2 identifier”）。  
- 后续可扩展为显示类型、文档等（仍通过 LSP hover 提供）。

### 4.4 跳转定义（Go to Definition）

- **操作**：光标放在符号上，按 `F12` 或 `Ctrl+Click`（Mac：`Cmd+Click`）。
- **行为**：解析当前符号的定义位置；若定义在另一文档（多文件索引已打开），可返回多 URI 的 Location；当前为单文档时，跳转到同文件内定义位置。
- **适用**：类型引用（如 `part engine : Engine` 中的 `Engine`）、部件/端口/属性名等。

### 4.5 查找引用（Find References）

- **操作**：光标放在符号上，按 `Shift+F12`。
- **行为**：列出所有引用该定义的位置；可选“包含定义处”。结果可能跨多个文档（当 Index 中有多 URI 时）。
- **展示**：依赖 Monaco/宿主对 “References” 视图或内联展示的支持；本编辑器提供 LSP 数据。

### 4.6 重命名（Rename）

- **操作**：光标放在符号上，按 `F2`，输入新名称并确认。
- **行为**：重命名该符号的定义及所有引用；LSP 返回 `WorkspaceEdit`，可能包含多个 URI 的编辑；当前单文档场景下为同文件内重命名。
- **注意**：仅会重命名语义上的“同一符号”（基于 Scope 与引用解析），不会做全文盲目替换。

### 4.7 文档符号（大纲）

- **用途**：在侧边栏或大纲视图中展示当前文件的符号树（包、part def、port def、属性等）。
- **来源**：LSP `textDocument/documentSymbol`，基于 AST 层级；若宿主集成了大纲视图，会消费该数据。

### 4.8 折叠（Folding）

- **用途**：按块折叠/展开（如包、part 定义块）。
- **来源**：LSP `textDocument/foldingRange`，基于 AST 块结构。
- **操作**：行号左侧折叠图标，或使用编辑器的折叠快捷键（与 VS Code 一致）。

### 4.9 语义高亮（Semantic Tokens）

- **用途**：在语法高亮基础上，对“定义”“类型”“属性”等做额外区分（若主题支持）。
- **来源**：LSP `textDocument/semanticTokens/full`；解析成功时基于 AST，否则基于正则回退。

### 4.10 签名帮助（Signature Help）

- **触发**：在内置函数（如 `println(`、`assert(`）的括号内输入或输入 `,` 时触发。
- **内容**：函数签名与参数说明（如 `println(value: String): void`）。
- **来源**：LSP `textDocument/signatureHelp`。

### 4.11 代码操作（Quick Fix）

- **触发**：在出现诊断的位置，通过“灯泡”或右键菜单等触发代码操作（依赖宿主 UI）。
- **示例**：
  - **Missing semicolon** → “Insert ;”
  - **Unknown keyword 'xxx'. Did you mean 'yyy'?** → “Replace with 'yyy'”
  - **Unresolved type reference: 'TypeName'** → “Add stub 'part def TypeName { }'”
  - **Duplicate definition: 'name'** → “Go to first definition”
- **来源**：LSP `textDocument/codeAction`，根据当前诊断生成。

### 4.12 格式化

- **格式化整篇**：使用快捷键 `Shift+Alt+F`（Mac：`Shift+Option+F`）或通过命令面板“Format Document”。
- **格式化选中**：选中一段后使用“Format Selection”或对应快捷键。
- **来源**：LSP `textDocument/formatting` / `textDocument/rangeFormatting`，基于 AST 或缩进规则。

---

## 5. 示例代码说明

默认加载的示例大致如下（具体以编辑器内为准）：

```text
package VehicleExample {
  part def Vehicle {
    part engine: Engine;
    part wheels: Wheel[4];
    port fuelIn: FuelPort;
  }

  part def Engine {
    attribute horsepower: Integer;
  }

  port def FuelPort {
    in attribute fuelFlow: Real;
  }
}
```

- 可在 `part engine : Engine` 的 `Engine` 上使用 **跳转定义**（会定位到 `part def Engine`）。
- 在 `Engine` 上使用 **查找引用** 可看到所有引用 `Engine` 的位置。
- 在 `Engine` 或 `engine` 上使用 **重命名** 可安全重命名定义与引用。
- 修改内容后，**诊断**会实时更新；若有未解析类型或重复定义，会给出相应提示与 **代码操作**。

---

## 6. 配置

### 6.1 解析/校验配置（grammar/config）

配置集中在 `src/grammar/config.ts`，通过 API 读写（非 UI）。详见 [grammar-config.md](./grammar-config.md)。

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `grammarSource` | `'langium' \| 'g4'` | `'langium'` | 解析与校验使用的语法来源；当前仅 `'langium'` 完整实现。 |
| `g4Validation` | `boolean` | `false` | 为 `true` 时启用 G4 独立严格模式，G4 解析错误单独展示（如 `sysmlv2-g4` 诊断源）。 |

在应用启动后、打开文档前设置即可生效，例如：

```ts
import { setGrammarConfig } from './grammar/config.js';

// 开启 G4 独立诊断通道
setGrammarConfig({ g4Validation: true });
```

### 6.2 LSP 文档 URI

- 当前单文档模式下，LSP 使用的文档 URI 为固定值（如 `file:///sysmlv2/main.sysml`），在 `CodeEditor` 中通过常量配置。
- 若需多文件（多 URI），需在上层维护多个“虚拟文件”并在打开/关闭时向 LSP 发送 `didOpen`/`didClose`，且保证 definition/references 返回的 URI 与前端能打开的文档一致。

---

## 7. 测试

### 7.1 运行单元测试

```bash
# 监听模式（修改代码后自动重跑）
npm run test

# 单次运行并输出结果
npm run test:run
```

- 测试框架：Vitest。
- 测试文件：`src/**/*.test.ts`（如 `grammar/astUtils.test.ts`、`languages/sysmlv2/completion.test.ts`、`references.test.ts` 等）。

### 7.2 测试覆盖范围

- 当前覆盖包括：AST 工具、补全、符号、Scope、引用解析、校验器等；新加功能建议补充对应单测。

---

## 8. 嵌入到其他项目

### 8.1 最小集成

1. **复制或依赖**：将本仓库中与编辑器相关的源码（至少 `src/components/CodeEditor.tsx`、`src/workers/`、`src/languages/sysmlv2/`、`src/grammar/`）集成到你的项目中；或通过 npm 引用（若已发布包）。
2. **安装依赖**：确保已安装 `react`、`monaco-editor`、`vscode-languageserver`、`vscode-languageserver-textdocument`、`langium` 等（版本与 `package.json` 一致或兼容）。
3. **入口**：在 React 根组件中渲染 `CodeEditor`，并传入 `language`、`theme`、`initialValue`、`onChange` 等（见 §8.2）。

### 8.2 CodeEditor 组件 Props

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `language` | `string` | `SYSMLV2_LANGUAGE_ID` | Monaco 语言 ID，一般保持默认。 |
| `theme` | `string` | `'vs-dark'` | 主题名：`vs-dark`、`vs-light`、`sysmlv2-dark` 等。 |
| `initialValue` | `string` | VehicleExample 示例 | 初始文本。 |
| `onChange` | `(value: string) => void` | — | 内容变更回调，用于受控或同步到外部状态。 |

示例：

```jsx
import CodeEditor from './components/CodeEditor';
import { SYSMLV2_LANGUAGE_ID } from './languages/sysmlv2';

<CodeEditor
  language={SYSMLV2_LANGUAGE_ID}
  theme="vs-dark"
  initialValue="package MyPkg { }"
  onChange={(value) => console.log(value)}
/>
```

### 8.3 Worker 与 LSP 客户端

- **Worker**：`CodeEditor` 内部会 new 一个 Worker（指向 `sysmlLSPWorker.ts` 的打包结果）；在 Vite/Webpack 中需保证 Worker 路径正确（如 `new URL('../workers/sysmlLSPWorker.ts', import.meta.url)`）。
- **LSP 文档 URI**：单文档时使用固定 URI；若你的应用有多文件，需要修改 `CodeEditor` 或 `lspClient` 的 URI 策略，并在打开/关闭文档时调用 `openDocument`/`updateDocument`/`closeDocument`，以与 Worker 内 Index 一致。
- **样式**：为编辑器容器设置宽高（如 `width: 100%; height: 100%; min-height: 400px`），否则可能高度为 0。

### 8.4 仅使用语言能力（无 UI）

若只需解析、校验、符号等，不一定要挂载 `CodeEditor`：

- **解析**：`import { parseSysML } from './grammar/parser.js'`，调用 `parseSysML(text)`。
- **校验**：`import { createSysmlv2Validator } from './languages/sysmlv2/validator.js'`，使用返回的 validator 的 `validate(text)`。
- **配置**：`import { setGrammarConfig } from './grammar/config.js'`，按需设置 `g4Validation` 等。

---

## 9. 故障排除

### 9.1 编辑器空白或无法输入

- 确认容器有宽高；检查浏览器控制台是否有脚本错误。
- 确认 Monaco 与 React 版本兼容；若使用严格 CSP，需允许 Worker 与脚本来源。

### 9.2 LSP 不工作（无补全、无跳转等）

- 打开控制台，查看是否有 “LSP not available” 或 Worker 加载失败；若 Worker 路径错误，构建工具可能无法正确打包 Worker 入口。
- 确认 `setSysmlv2LspClientGetter` 在 LSP 客户端创建后被调用（见 `CodeEditor.tsx` 中 `lspClientRef.current = client` 之后的逻辑）。
- 若仅部分能力不可用，检查 Worker 内对应 handler 是否注册（如 `onDefinition`、`onReferences`、`onRenameRequest`）。

### 9.3 诊断不更新或 G4 诊断不显示

- 诊断有防抖（约 300ms）；快速输入后稍等再查看。
- G4 诊断需在代码中调用 `setGrammarConfig({ g4Validation: true })`，且前端需请求 `sysml/g4Diagnostics` 并将结果展示为单独 Marker 源（如 `sysmlv2-g4`）。

### 9.4 构建失败

- 执行 `npm run build` 前先 `npm install`。
- 若报 Langium 或 AST 相关错误，可先执行 `npm run langium:generate` 再构建。
- 若修改了 G4 语法，需执行 `npm run g4:generate`（并确保 ANTLR 等环境正确）。

### 9.5 测试失败

- 使用 `npm run test:run` 查看具体失败用例与堆栈。
- 确认 Node 版本与 `package.json` 中 engines 一致（若有）；Vitest 需在支持 ES Module 的环境下运行。

---

## 10. 参考文档

- [项目结构说明](./project-structure.md)
- [解析/校验配置](./grammar-config.md)
- [语法映射与扩展](./grammar-mapping.md)
- [与 sysml-2ls 对比](./current-vs-sysml-2ls-comparison.md)
- 根目录 [README.md](../README.md)
