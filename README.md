# SysMLv2 语言编辑器

基于 React + Monaco Editor + Web Worker LSP 的 SysMLv2 语言编辑器。

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

纯浏览器环境下使用 Web Worker 实现 LSP 服务，无需 Node.js 后端。

#### 已实现的 LSP 功能

| 功能 | 说明 |
|------|------|
| 语法验证 | 实时检测代码错误 |
| 关键字拼写检查 | 检测类似关键字的拼写错误（如 `defk` → `def`） |
| 括号匹配检查 | 检测未闭合的 `{}`、`[]`、`()` |
| 字符串字面量检查 | 检测未闭合的字符串 |
| 注释检查 | 检测未闭合的块注释 |
| 标识符验证 | 检测以数字开头的无效标识符 |

#### 拼写纠错示例
```
输入: defk     →  提示: Unknown keyword 'defk'. Did you mean 'def'?
输入: packge   →  提示: Unknown keyword 'packge'. Did you mean 'package'?
输入: requiremnt →  提示: Unknown keyword 'requiremnt'. Did you mean 'requirement'?
```

## 项目结构

```
src/
├── components/
│   └── CodeEditor.tsx      # Monaco Editor 组件
├── languages/
│   └── sysmlv2/
│       ├── index.ts        # 语言注册
│       ├── tokenizer.ts   # 词法分析器（Monarch）
│       ├── completion.ts   # 自动完成提供者
│       ├── validator.ts   # 语法验证器
│       └── keywords.ts    # 关键字定义
├── workers/
│   ├── sysmlLSPWorker.ts # Web Worker LSP 服务器
│   └── lspClient.ts     # LSP 客户端
└── App.jsx               # 主应用
```

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

## 使用说明

1. 启动应用后，编辑器自动加载 SysMLv2 示例代码
2. 输入代码时自动显示关键字高亮
3. 按 `Ctrl+Space` 或输入 `.` 触发自动完成
4. 拼写错误会实时显示红色波浪线
5. 鼠标悬停查看错误详情

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
