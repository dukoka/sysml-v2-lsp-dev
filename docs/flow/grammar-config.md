# 解析/校验配置说明

解析与校验相关配置集中在 **`src/grammar/config.ts`**，通过 `getGrammarConfig()` / `setGrammarConfig()` 读写。

## 配置项

| 配置项 | 类型 | 可选值 | 默认值 | 说明 |
|--------|------|--------|--------|------|
| `grammarSource` | `'langium' \| 'g4'` | `'langium'`, `'g4'` | `'langium'` | 解析/校验使用的语法来源。当前仅实现 `'langium'`；`'g4'` 预留。 |
| `g4Validation` | `boolean` | `true`, `false` | `false` | 为 `true` 时启用 G4 独立严格模式：G4 解析错误单独展示（如 `sysmlv2-g4` 诊断源），不合并进主 Langium 诊断。仅在 `grammarSource === 'langium'` 时生效。 |

## 使用示例

```ts
import { getGrammarConfig, setGrammarConfig, isG4ValidationEnabled } from './grammar/config.js';

// 读取
const config = getGrammarConfig();
console.log(config.grammarSource, config.g4Validation);

// 写入
setGrammarConfig({ g4Validation: true });

// 快捷
if (isG4ValidationEnabled()) {
  // 拉取并展示 G4 诊断
}
```

## 与计划文档的对应

- **语言功能完全实现计划**：「解析/校验来源与 G4 开关」通过本配置与本文档说明。
- **最终完成计划 阶段 C**：本文件即「配置集中并文档化」的交付之一。
