---
description: 多文件工作区索引管理器，用于跨文件引用解析
---

# indexManager - 索引管理器

`src/workers/indexManager.ts` 文件负责管理多文件工作区的索引，供跨 URI 引用解析和 LSP 使用。

## 核心接口

### IndexEntry

```typescript
export interface IndexEntry {
  uri: string;
  text: string;
  /** 解析根（Namespace 或无效时的 undefined） */
  root: Namespace | undefined;
  /** 解析错误数 > 0 时 root 可能仍可用 */
  parseErrors: number;
  scopeRoot: ScopeNode | null;
}
```

## 导出函数

### updateIndex

更新指定 URI 的索引：

```typescript
export function updateIndex(uri: string, text: string): IndexEntry
```

**处理步骤：**
1. 解析 text 为 AST
2. 计算解析错误数
3. 构建 scopeRoot
4. 存储到索引

### removeFromIndex

移除 URI 的索引：

```typescript
export function removeFromIndex(uri: string): void
```

**调用时机：** 文档关闭时

### getIndexEntry

获取 URI 对应的索引项：

```typescript
export function getIndexEntry(uri: string): IndexEntry | undefined
```

### getIndexedUris

获取当前所有已索引的 URI：

```typescript
export function getIndexedUris(): string[]
```

### getIndex

获取全局索引（Map）：

```typescript
export function getIndex(): Map<string, IndexEntry>
```

## 内部实现

### index

内存索引存储：

```typescript
const index = new Map<string, IndexEntry>();
```

## 使用场景

1. **跨文件引用解析** - 查找其他文档的符号定义
2. **工作区符号搜索** - 跨文件搜索
3. **依赖分析** - 分析文件依赖关系
4. **增量更新** - 只更新修改过的文档