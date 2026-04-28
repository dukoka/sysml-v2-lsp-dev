---
description: 语义 Scope 树构建，用于引用解析和符号查找
---

# scope - 语义 Scope 树

`src/languages/sysmlv2/scope.ts` 文件负责构建 SysMLv2 的语义 Scope 树，用于引用解析、补全提示和跳转到定义。

## 核心接口

### ScopeNode

```typescript
export interface ScopeNode {
  /** 对应 AST 的 Namespace 节点 */
  namespace: Namespace;
  /** 父 scope（外层命名空间） */
  parent: ScopeNode | null;
  /** 本层声明的名称 → 定义/用法节点 */
  declarations: Map<string, Element>;
  /** 子 scope（内层命名空间），顺序与 AST 一致 */
  children: ScopeNode[];
}
```

### IndexEntryForLookup

```typescript
export interface IndexEntryForLookup {
  scopeRoot: ScopeNode | null;
}
```

## 导出函数

### buildScopeTree

从 AST 根（Namespace）构建 Scope 树：

```typescript
export function buildScopeTree(root: unknown): ScopeNode | null
```

**参数：**
- `root`: AST 解析根（Namespace 节点）

**返回：**
- Scope 树根节点，或 null（解析失败时）

### scopeLookup

在 scope 链上按名称查找定义/用法：

```typescript
export function scopeLookup(scope: ScopeNode | null, name: string): Element | undefined
```

**查找顺序：**
1. 当前层 declarations
2. 父层 declarations
3. 依此类推直到根

### scopeLookupInIndex

跨文档查找：

```typescript
export function scopeLookupInIndex(
  currentUri: string,
  scopeRoot: ScopeNode | null,
  name: string,
  index: Map<string, IndexEntryForLookup>
): { uri: string; node: Element } | undefined
```

**查找顺序：**
1. 当前文档 scope
2. 其他文档根级声明

### getScopeAtPosition

根据文档位置获取当前 Scope：

```typescript
export function getScopeAtPosition(
  scopeRoot: ScopeNode | null,
  astRoot: unknown,
  text: string,
  line: number,
  character: number
): ScopeNode | null
```

**参数：**
- `line`, `character`: 0-based 文档位置

## 内部函数

### buildScopeRec

递归构建 Scope 树：

```typescript
function buildScopeRec(ns: Namespace, parent: ScopeNode | null): ScopeNode
```

### namespacesContaining

收集包含指定位置的 Namespace：

```typescript
function namespacesContaining(
  ns: Namespace,
  text: string,
  line: number,
  character: number,
  out: Namespace[]
): void
```

### findScopeNodeByPosition

根据位置查找最内层 ScopeNode：

```typescript
function findScopeNodeByPosition(
  scopeRoot: ScopeNode,
  ns: Namespace,
  text: string,
  line: number,
  character: number
): ScopeNode | null
```

## 内置类型

Scope 内置以下类型（不在 scope 中查找）：

```typescript
const BUILTIN_TYPES = new Set([
  'Boolean', 'Integer', 'Real', 'String', 'Natural', 'Positive',
  'Magnitude', 'Vector', 'Matrix', 'Array', 'Element', 'Feature', 'Type'
]);
```

## 使用场景

1. **引用解析** - 查找符号定义
2. **补全提示** - 当前 scope 可用符号
3. **跳转到定义** - 导航到定义位置
4. **跨文件引用** - 多文件工作区查找