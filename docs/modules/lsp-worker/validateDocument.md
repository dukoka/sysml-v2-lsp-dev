# validateDocument()

## 函数签名
```typescript
function validateDocument(text: string, uri?: string): Diagnostic[]
```

## 位置
src/workers/sysmlLSPWorker.ts:110

## 参数
- `text`：string - 要验证的文档的源文本
- `uri`：string（可选）- 文档的 URI，用于跨文件验证

## 返回值
- `Diagnostic[]` - 诊断对象数组，表示在文档中发现的语法和语义错误

## 描述
为 SysMLv2 文档生成诊断的主要验证函数。结合 Langium 解析器的 AST 验证和基于正则表达式的验证，用于额外检查，如缺少分号、未知关键字和字符串/注释验证。

## 行为
1. 初始化空标记数组以收集诊断
2. 尝试使用 Langium 解析器进行 AST 验证：
   - 使用 `parseSysML()` 解析文本
   - 通过 `parseResultToDiagnostics()` 将解析器错误转换为诊断
   - 如果没有解析器/词法分析器错误，使用 `runSemanticValidation()` 运行语义验证
   - 如果 AST 验证成功则提前返回
3. 如果 AST 验证失败（解析器初始化/运行时错误），继续进行基于正则表达式的验证：
   - 将文本拆分为行
   - 提取用户定义的类型以检测未知关键字
   - 对每行进行各种验证检查：
     - 检测缺少分号
     - 使用 Levenshtein 距离进行未知关键字建议
     - 检测未闭合的字符串字面量
     - 检测可能未闭合的块注释
     - 检测无效标识符（不能以数字开头）
     - 检测定义中缺少名称
     - 检测冗余分号
     - 检测不正确的独立 'def' 用法
     - 检测重复定义
     - 检测不匹配的大括号
4. 返回收集的标记数组

## 使用示例
```typescript
// 此函数由 LSP Worker 的诊断处理器内部调用
// 可能产生的示例：
const diagnostics = validateDocument(`
part def Vehicle {
  part engine: Engine
  part wheels: Wheel[4]
}`, 'sysmlv2://main.model');
// 返回包含缺少分号诊断的数组
```

## 相关函数
- `extractUserDefinedTypes()` - 提取用户定义的名称以检测未知关键字
- `levenshteinDistance()` - 计算关键字建议的编辑距离
- `findSimilarKeyword()` - 查找类似关键字以生成错误消息
- LSP 诊断处理器 - 将此函数的结果发送给客户端的位置