# SysMLv2 语言编辑器

基于 React + Monaco Editor + Web Worker LSP 的 SysMLv2 语言编辑器，纯浏览器运行，无需 Node 后端。

## 文档

- **[项目结构说明](docs/project-structure.md)**：目录与模块说明、数据流、构建产物与依赖。
- **[使用说明](docs/usage-guide.md)**：安装、运行、LSP 功能详解、配置、测试、嵌入与故障排除。

## 功能特性

### 1. Monaco Editor 集成
- 基于 Monaco Editor（VS Code 同款编辑器）
- 支持语法高亮、代码补全、括号匹配
- 支持多种主题（vs-dark, vs-light）

### 2. SysMLv2 语言支持

#### 关键字高亮
支持以下关键字的语法高亮：
- **定义关键字**: `def`, `definition`, `abstract`, `specialization`
- **部件关键字**: `part`, `port`, `flow`, `connection`, `item`
- **行为关键字**: `action`, `state`, `transition`, `event`
- **类型关键字**: `type`, `enum`, `struct`, `datatype`
- **约束关键字**: `requirement`, `constraint`, `assumption`, `verification`
- **控制流**: `if`, `else`, `while`, `for`, `return`
- **修饰符**: `public`, `private`, `protected`, `readonly`
- **其他**: `package`, `import`, `library`, `attribute`, `in`, `out` 等

#### 类型识别
- **基础类型**: `Boolean`, `Integer`, `Real`, `String`, `Natural`, `Positive`
- **KerML 类型**: `Element`, `Feature`, `Type`, `Classifier`, `DataType`
- **SysMLv2 特有类型**: `PartDef`, `PortDef`, `FlowDef`, `ActionDef`, `StateDef`, `Requirement` 等

#### 代码补全
- 关键字自动补全
- 类型名称自动补全
- 代码片段（Snippets）：
  - `package` - 包定义
  - `part def` - 部件定义
  - `port def` - 端口定义
  - `action` - 动作定义
  - `requirement` - 需求定义
  - `import` - 导入语句
  - `connection` - 连接定义
  - `flow` - 流定义
  - `state def` - 状态定义
  - `attribute` - 属性定义

### 3. LSP 功能（Web Worker 实现）

纯浏览器环境下使用 Web Worker 实现 LSP 服务，无需 Node.js 后端。支持多文件索引与跨 URI 引用解析（阶段 G/H）。

#### 已实现的 LSP 功能

| 功能 | 说明 |
|------|------|
| 诊断 | 实时语法/语义校验；关键字拼写建议、括号/字符串/注释匹配、未解析类型、重复定义等 |
| 补全 | 上下文敏感补全（关键字、类型、包名、part/port/属性名等），`Ctrl+Space` 或 `.` `:` `(` 触发 |
| 悬停 | 标识符悬停说明 |
| 跳转定义 | `F12` 或 `Ctrl+Click`，支持类型引用与符号定义，可跨文件（多 URI 索引时） |
| 查找引用 | `Shift+F12`，可包含定义处，支持多文件 |
| 重命名 | `F2`，重命名定义及所有引用，支持多文件 WorkspaceEdit |
| 文档符号 | 大纲（包、part def、port def、属性等层级） |
| 折叠 | 按 AST 块折叠 |
| 语义高亮 | 定义/类型/属性等语义 token |
| 签名帮助 | 内置函数（如 `println`、`assert`）参数提示 |
| 代码操作 | 快速修复：插入分号、纠错关键字、未解析类型添加桩、重复定义跳转第一处等 |
| 格式化 | 整篇/选中区域格式化 |

#### 拼写纠错示例
```
输入: defk     →  提示: Unknown keyword 'defk'. Did you mean 'def'?
输入: packge   →  提示: Unknown keyword 'packge'. Did you mean 'package'?
输入: requiremnt →  提示: Unknown keyword 'requiremnt'. Did you mean 'requirement'?
```

## 项目结构概览

```
src/
├── components/CodeEditor.tsx   # 编辑器封装（Monaco + LSP Worker + 诊断）
├── workers/
│   ├── sysmlLSPWorker.ts       # LSP 服务端（Index、definition/references/rename/documentSymbol/…）
│   ├── indexManager.ts         # 多文件索引（uri → root, scopeRoot）
│   └── lspClient.ts            # LSP 客户端（JSON-RPC）
├── languages/sysmlv2/          # 词法、补全、Scope、引用、文档符号、语义高亮、格式化等
├── grammar/                    # Langium 解析、AST 工具、G4、配置
└── App.jsx
```

完整目录与模块说明见 **[docs/project-structure.md](docs/project-structure.md)**。

## 技术实现

### Monaco Monarch Tokenizer
使用 Monaco 的 Monarch 词法分析器进行语法高亮，关键字定义为数组格式供 Monarch 使用。

### 验证器
- 使用 Levenshtein 距离算法检测关键字拼写错误
- 实时验证括号匹配
- 检测字符串和注释的完整性

### Web Worker LSP
- LSP 服务器运行在独立的 Web Worker 线程中
- 支持 JSON-RPC 通信协议
- 提供验证、悬停、自动完成等功能

## 运行项目

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 生产构建
npm run build
```

## 快速开始

```bash
npm install
npm run dev
```

浏览器打开终端提示的地址（如 `http://localhost:5173`）即可使用。更多操作与 LSP 功能说明见 **[docs/usage-guide.md](docs/usage-guide.md)**。

## 示例代码

```sysml
package VehicleExample {
  // Part definitions
  part def Vehicle {
    part engine: Engine;
    part wheels: Wheel[4];
    port fuelIn: FuelPort;
  }

  part def Engine {
    attribute horsepower: Integer;
  }

  // Port definitions
  port def FuelPort {
    in attribute fuelFlow: Real;
  }
}
```
