---
description: SysMLv2 语言的词法分析器配置，用于 Monaco Editor
---

# tokenizer - 词法分析器

`src/languages/sysmlv2/tokenizer.ts` 文件为 Monaco Editor 提供 SysMLv2 语言的词法分析配置。

## 导出内容

### sysmlv2Language

Monaco Monarch 语言定义：

```typescript
export const sysmlv2Language: monaco.languages.IMonarchLanguage
```

核心配置包括：

| 配置项 | 说明 |
|--------|------|
| `defaultToken` | 未匹配时的默认标记 |
| `tokenPostfix` | 语言后缀 `.sysmlv2` |
| `keywords` | 关键字列表 |
| `typeKeywords` | 类型关键字列表 |
| `operators` | 运算符列表 |
| `symbols` | 符号正则表达式 |

### tokenizer.root

词法分析规则：

| 正则表达式 | 标记类型 | 说明 |
|-----------|---------|------|
| `/\/\/.*$/` | comment | 行注释 `//` |
| `/\/\*/` | comment | 块注释开始 `/*` |
| `/"[^"]*"/` | string | 双引号字符串 |
| `/'[^']*'/` | string | 单引号字符串 |
| `/\d+(\.\d+)?([eE][\-+]?\d+)?/` | number | 数字 |
| `/0x[0-9a-fA-F]+/` | number.hex | 十六进制数 |
| `/[a-z_$][\w$]*/` | keyword/identifier | 小写标识符/关键字 |
| `/[A-Z][\w$]*/` | type | 大写类型标识符 |

### sysmlv2LanguageConfig

Monaco 语言配置：

```typescript
export const sysmlv2LanguageConfig: monaco.languages.LanguageConfiguration
```

包含：
- **comments** - 行注释 `//` 和块注释 `/* */`
- **brackets** - 括号配对 `{ }`, `[ ]`, `( )`
- **autoClosingPairs** - 自动闭合
- **surroundingPairs** - 周围配对
- **indentationRules** - 缩进规则
- **wordPattern** - 单词模式

## 缩进规则

### increaseIndentPattern

增加缩进的模式：

```regex
^\s*(def|part|port|action|state|requirement|package|actor|behavior|if|while|for)\b.*\{\s*$
```

以下关键字开头的行后增加缩进：
- `def`, `part`, `port`, `action`, `state`, `requirement`
- `package`, `actor`, `behavior`
- `if`, `while`, `for`

### decreaseIndentPattern

减少缩进的模式：

```regex
^\s*\}
```

以 `}` 开头的行减少缩进。

## 使用场景

1. **语法高亮** - 代码着色
2. **代码折叠** - 块注释折叠
3. **括号匹配** - 自动高亮配对括号
4. **缩进推断** - 智能缩进