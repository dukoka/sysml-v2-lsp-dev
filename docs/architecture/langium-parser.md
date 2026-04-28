---
description: Langium 解析器集成文档，包括 Langium 语言工作台、解析器生成、AST 定义、语言功能提供者以及与 LSP Worker 的集成。
---

# Langium 解析器集成

本文档解释 Langium 解析器在 SysMLv2 编辑器中的集成，包括 Langium 语言工作台、解析器生成、抽象语法树 (AST) 定义、语言功能提供者以及与 LSP Worker 的集成。

## 概述

Langium 是一个用于构建域特定语言的语言工作台，在 SysMLv2 编辑器中用于：
- 从语法定义生成解析器
- 生成类型化的抽象语法树 (AST)
- 提供语言功能（补全、悬停、导航等）
- 支持语法验证和诊断

## Langium 在项目中的位置

```
src/
├── languages/
│   └── sysmlv2/
│       ├── index.ts              # 语言服务导出
│       ├── langium-generated/   # 自动生成的文件
│       │   ├── ast.ts         # AST 节点类型
│       │   ├── parser.ts     # 解析器
│       │   └── validator.ts # 验证规则
│       └── grammar/
│           └── sysmlv2.langium  # 语法定义文件
└── grammar/
    └── ...                  # 构建配置
```

## 语法定义

SysMLv2 语法在 `sysmlv2.langium` 文件中定义：

```text
grammar Sysmlv2

// 入口规则
Model returns Model:
    elements+=Element*;

// 定义规则
Element:
    PartDefinition | ConnectionDefinition | FlowConnection | ...
;

// 类型规则
PartDefinition:
    'part' name=ID ':' type=ReferenceType ';'
;

ConnectionDefinition:
    'connection' name=ID 'from' source=Reference 'to' target=Reference ';'
;

// 等等
```

## AST 生成

Langium 从语法生成类型化 AST：

```typescript
// 自动生成的 AST 节点类型
interface Model {
    elements: Element[];
}

interface PartDefinition extends Element {
    name: string;
    type: ReferenceType;
}

interface ConnectionDefinition extends Element {
    name: string;
    source: Reference;
    target: Reference;
}
```

## 解析器生成

Langium 生成一个解析器来处理 SysMLv2 源代码：

```typescript
import { parse } from './parser';

const result = parse('part myPart : System;');
// result = {
//   parserErrors: [],
//   value: Model {
//     elements: [
//       {
//         $type: 'PartDefinition',
//         name: 'myPart',
//         type: ReferenceType { ref: { $refText: 'System' } }
//       }
//     ]
//   }
// }
```

## 语言服务

Langium 生成语言服务，封装所有语言功能：

```typescript
import { createSysmlV2Services } from './languages';

const services = await createSysmlV2Services();
const { parser, validator, completionProvider, hoverProvider } = services;
```

### 解析

```typescript
const parseResult = parser.parse('part myPart : System;');
if (parseResult.errors.length > 0) {
  // 处理解析错误
}
const model = parseResult.value;
```

### 验证

```typescript
const diagnostics = validator.validate(model);
// diagnostics = [
//   { message: "类型 'Unknown' 未定义", severity: 'error', ... }
// ]
```

### 补全

```typescript
const completions = completionProvider.getCompletions(document, position);
// 返回补全项列表
```

### 悬停

```typescript
const hover = hoverProvider.getHover(document, position);
// 返回悬停信息
```

## 与 LSP Worker 集成

Langium 集成到 LSP Worker 中：

```typescript
// sysmlLSPWorker.ts
import { createSysmlV2Services } from '../languages';

self.onmessage = async (event) => {
  const { sysmlV2LangiumService } = await createSysmlV2Services();
  
  // 处理 LSP 请求
  switch (event.data.method) {
    case 'textDocument/completion':
      const completions = await sysmlV2LangiumService.completionProvider
        .getCompletions(document, position);
      break;
    case 'textDocument/hover':
      const hover = await sysmlV2LangiumService.hoverProvider
        .getHover(document, position);
      break;
    // 等等
  }
};
```

## 自定义语言功能

除了自动生成的功能，还可以添加自定义语言功能：

### 符号索引

```typescript
class Sysmlv2SymbolIndex {
  private index = new Map<string, AstNode[]>();
  
  update(document: LangiumDocument) {
    // 索引文档中的所有符号
  }
  
  findDefinition(name: string): AstNode[] {
    return this.index.get(name) || [];
  }
}
```

### 自定义补全

```typescript
// 在 grammar 中添加补全规则
completion rules:
  // 例如，从已知类型提供补全
  { Keyword, Member }
```

## 构建过程

1. **编写语法**：`sysmlv2.langium`
2. **生成代码**：`npm run langium:generate`
3. **实现功能**：添加自定义验证/补全
4. **打包**：生成 `sysmlv2.wasm`（WebAssembly）

## 关键概念

### 序列化

Langium AST 可以序列化为 JSON：

```typescript
import { serialize } from 'langium';

const json = serialize(model);
// json = { "_eTN": "Model", "elements": [...] }
```

### 引用解析

Langium 使用跨文件引用：

```typescript
type: =ReferenceType { 
  ref: { $refText: 'System' }  // 符号引用
}
```

### 范围计算

Langium 计算作用域以进行引用解析：

```typescript
// 'System' 类型在系统定义中定义
// 'myPart : System' 解析为该定义
```

## 性能优化

- 使用增量解析（仅重新解析更改的部分）
- 缓存已解析的 AST
- 延迟加载未打开的文档
- 使用 WebAssembly 加速解析

## 调试

使用 Langium REPL 进行调试：

```typescript
import { createSysmlV2Services } from './languages';

const services = await createSysmlV2Services();
const { parser } = services;

const result = parser.parse('part test : System;');
console.log(result.parserErrors);
console.log(result.value);
```

## 总结

Langium 为 SysMLv2 编辑器提供了强大的语言基础设施：
- 从声明语法生成类型化解析器
- 自动生成核心语言功能
- 可扩展的自定义功能
- 与 LSP Worker 无缝集成
- 高性能的 WebAssembly 输出