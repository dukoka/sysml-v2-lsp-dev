# extractUserDefinedTypes()

## 函数签名
```typescript
function extractUserDefinedTypes(text: string): Set<string>
```

## 位置
src/workers/sysmlLSPWorker.ts:68

## 参数
- `text`：string - 要提取用户定义类型的源文本

## 返回值
- `Set<string>` - 包含在文本中找到的所有用户定义类型名称的集合

## 描述
通过扫描定义模式从 SysMLv2 源文本中提取用户定义的类型名称。这用于未知关键字检测和验证。

## 行为
1. 初始化空集合以存储类型名称
2. 将输入文本拆分为行
3. 对于每行：
   - 跳过以注释（// 或 /*）开头的行
   - 对剪后的行测试 DEFINITION_PATTERNS 中的每个模式
   - 如果模式匹配并且有名称的捕获组（match[2]），则将该名称添加到集合
4. 返回收集的类型名称集合

DEFINITION_PATTERNS 常量（定义在文件前面）包含用于以下内容的正则表达式模式：
- part/port/action/state/flow/item/connection/constraint/actor/behavior 定义
- requirement 定义
- enum/struct/datatype/package 定义

## 使用示例
```typescript
const text = `
package VehicleExample {
  part def Vehicle {
    part engine: Engine;
    part wheels: Wheel[4];
  }
  
  part def Engine {
    attribute horsepower: Integer;
  }
}
`;

const types = extractUserDefinedTypes(text);
// types 集合包含: ['Vehicle', 'Engine', 'Wheel']
// 注意: 'VehicleExample' (package) 和 'Integer' (内置) 不包含在内
```

## 相关函数
- `validateDocument()` - 使用此函数获取用户定义类型以检测未知关键字
- `DEFINITION_PATTERNS` - 用于识别定义的正则表达式模式
- `findSimilarKeyword()` - 使用提取的类型提供更好的未知关键字建议