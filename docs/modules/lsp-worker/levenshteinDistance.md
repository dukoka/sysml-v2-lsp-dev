# levenshteinDistance()

## 函数签名
```typescript
function levenshteinDistance(a: string, b: string): number
```

## 位置
src/workers/sysmlLSPWorker.ts:82

## 参数
- `a`：string - 要比较的第一个字符串
- `b`：string - 要比较的第二个字符串

## 返回值
- `number` - 两个字符串之间的 Levenshtein 编辑距离

## 描述
计算两个字符串之间的 Levenshtein 距离（编辑距离）。Levenshtein 距离是将一个字符串更改为另一个所需的最少单字符编辑（插入、删除或替换）次数。

## 行为
1. 创建大小为 (b.length+1) x (a.length+1) 的矩阵
2. 用增量值（0、1、2...）初始化第一行和第一列
3. 遍历矩阵，填充每个单元格：
   - 如果字符匹配：取对角线单元的值（无额外成本）
   - 如果字符不同：取（左、上、对角线）的最小值 + 1
4. 返回矩阵右下角单元格的值

## 使用示例
```typescript
// Levenshtein 距离示例：
levenshteinDistance('kitten', 'sitting'); // 返回 3
// kitten → sitten（将 'k' 替换为 's'）
// sitten → sittin（将 'e' 替换为 'i'）
// sittin → sitting（在末尾插入 'g'）

levenshteinDistance('defk', 'def'); // 返回 1
levenshteinDistance('packge', 'package'); // 返回 2
```

## 相关函数
- `findSimilarKeyword()` - 使用此函数为未知关键字建议更正
- `validateDocument()` - 使用 findSimilarKeyword 提供有用的错误消息
- `SYSMLV2_KEYWORDS` - findSimilarKeyword 搜索的关键字列表