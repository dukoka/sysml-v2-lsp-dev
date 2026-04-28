---
description: SysMLv2 关键字、类型名和内置函数的定义
---

# keywords - 关键字定义

`src/languages/sysmlv2/keywords.ts` 文件定义了 SysMLv2 语言的所有关键字、类型名、运算符和标记类型。

## 导出常量

### SYSMLV2_KEYWORDS

语言保留关键字列表：

```typescript
export const SYSMLV2_KEYWORDS = [
  // Package and Import
  'import', 'package', 'library', 'alias',
  
  // Definitions
  'def', 'definition', 'abstract', 'specialization',
  
  // Usages
  'part', 'port', 'flow', 'connection', 'item',
  'action', 'state', 'transition', 'event',
  
  // Types
  'type', 'enum', 'struct', 'datatype',
  
  // Behavior
  'actor', 'behavior', 'constraint',
  'requirement', 'assumption', 'verification',
  
  // Relationships
  'generalization', 'reduction', 'feature',
  'end', 'binding', 'succession', 'participation',
  
  // Control
  'if', 'else', 'while', 'for', 'return',
  'true', 'false', 'null',
  
  // Visibility
  'public', 'private', 'protected', 'readonly',
  
  // Other
  'owned', 'exhibits', 'subject', 'comment',
  'metadata', 'snapshot', 'stage',
  'attribute', 'in', 'out'
];
```

### SYSMLV2_TYPES

内置类型名列表：

```typescript
export const SYSMLV2_TYPES = [
  // Base Types
  'Boolean', 'Integer', 'Real', 'String', 'Natural', 'Positive',
  'Magnitude', 'Vector', 'Matrix',
  
  // KerML Base
  'Element', 'Feature', 'Type', 'ElementType',
  'Classifier', 'StructuredType', 'DataType',
  'ObjectType', 'Participation', 'FeatureMembership',
  
  // SysMLv2 Specific
  'PartDef', 'PortDef', 'FlowDef', 'ItemDef',
  'ActionDef', 'StateDef', 'Transition',
  'Requirement', 'ConstraintDef',
  'Interface', 'Connection',
  'Actor', 'UseCase', 'AnalysisCase',
  'RequirementUsage', 'RequirementConstraint',
  'SysMLPackage', 'Variant', 'Configuration'
];
```

### SYSMLV2_BUILTINS

标准库内置函数：

```typescript
export const SYSMLV2_BUILTINS = [
  'assert', 'println', 'print', 'toString',
  'toInteger', 'toReal', 'size', 'empty',
  'ownedElement', 'member', 'featuring',
  'type', 'superclassifier', 'isSpecializationOf'
];
```

### SYSMLV2_OPERATORS

运算符列表：

```typescript
export const SYSMLV2_OPERATORS = [
  // Arithmetic
  '+', '-', '*', '/', '%', '**',
  // Comparison  
  '==', '!=', '<', '>', '<=', '>=',
  // Logical
  '&&', '||', '!',
  // Assignment
  '=', '+=', '-=', '*=', '/=',
  // Other
  '?', ':', '::', '->', '<-', '>>', '<<',
  // Brackets
  '(', ')', '[', ']', '{', '}'
];
```

### SYSMLV2_TOKEN

Monaco Editor 标记类型映射：

```typescript
export const SYSMLV2_TOKEN = {
  keyword: 'keyword',
  type: 'type',
  builtin: 'support.function',
  string: 'string',
  number: 'number',
  comment: 'comment',
  operator: 'operator',
  identifier: 'identifier',
  punctuation: 'delimiter'
};
```

## 使用场景

1. **语法高亮** - 关键字和类型名着色
2. **补全提示** - 关键字和类型名自动补全
3. **代码验证** - 检查标识符是否与关键字冲突