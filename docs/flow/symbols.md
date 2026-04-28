---
description: 符号表解析，用于定义查找和引用追踪
---

# symbols - 符号表

`src/languages/sysmlv2/symbols.ts` 文件负责解析代码中的符号（定义、引用、类型）。

## 核心接口

### SymbolInfo

```typescript
export interface SymbolInfo {
  name: string;
  kind: 'definition' | 'reference' | 'type';
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  container?: string;
}
```

## 导出函数

### parseSymbols

从代码构建符号表：

```typescript
export function parseSymbols(text: string): Map<string, SymbolInfo[]>
```

**解析的符号类型：**

| 模式 | 容器 | 说明 |
|------|------|------|
| `part/def` | part | Part 定义 |
| `port/def` | port | Port 定义 |
| `flow/def` | flow | Flow 定义 |
| `connection/def` | connection | Connection 定义 |
| `action/def` | action | Action 定义 |
| `state/def` | state | State 定义 |
| `def TypeName` | type | 类型定义 |
| `attribute` | attribute | 属性定义 |
| `part name : Type` | part | Part 使用 |
| `port name : Type` | port | Port 使用 |

### findSymbolAtPosition

查找指定位置的符号：

```typescript
export function findSymbolAtPosition(
  symbols: Map<string, SymbolInfo[]>,
  line: number,
  column: number
): SymbolInfo | null
```

### findReferences

查找符号的所有引用：

```typescript
export function findReferences(
  symbols: Map<string, SymbolInfo[]>,
  symbolName: string
): SymbolInfo[]
```

### findDefinition

查找符号的定义位置：

```typescript
export function findDefinition(
  symbols: Map<string, SymbolInfo[]>,
  symbolName: string
): SymbolInfo | null
```

### findAllOccurrences

查找符号的所有出现位置（定义 + 引用）：

```typescript
export function findAllOccurrences(
  symbols: Map<string, SymbolInfo[]>,
  symbolName: string
): SymbolInfo[]
```

## 内部关键字

### definitionKeywords

定义关键字列表：

```typescript
const definitionKeywords = [
  'part', 'port', 'flow', 'connection', 'action', 'state',
  'def', 'type', 'enum', 'struct', 'requirement', 'constraint',
  'package', 'actor', 'behavior'
];
```

### typeKeywords

类型定义关键字列表：

```typescript
const typeKeywords = [
  'PartDef', 'PortDef', 'FlowDef', 'ItemDef', 'ActionDef', 'StateDef',
  'Requirement', 'ConstraintDef', 'Interface', 'Connection'
];
```

## 使用场景

1. **文档符号** - 大纲视图
2. **查找引用** - 快速定位引用
3. **重命名** - 重命名符号
4. **跳转到定义** - 导航到定义