# G4 语法目录

本目录专用于存放 ANTLR 语法文件（`.g4`），作为 **G4 校验** 的语法来源。

## 首版 G4 来源

从 [dukoka/sysml-v2-lsp 的 grammar 目录](https://github.com/dukoka/sysml-v2-lsp/tree/main/grammar) 拷贝以下文件到此目录：

- `SysMLv2Lexer.g4`
- `SysMLv2Parser.g4`
- `SysMLv2Lexer.tokens`（可选，可由 ANTLR 生成）

## 使用方式

1. **存放**：将上述 `.g4` 文件放入本目录即可。
2. **生成解析器**：使用 ANTLR 从本目录生成解析器（如 TypeScript/JavaScript），例如：
   ```bash
   antlr4 -Dlanguage=TypeScript -o generated -listener -visitor -no-listener SysMLv2Parser.g4 SysMLv2Lexer.g4
   ```
   生成产物建议输出到 `src/grammar/g4/generated` 或项目约定的目录。
3. **独立 G4 严格模式**：开启 G4 校验时，使用上述解析器对文档单独解析，结果**单独展示**，不合并进主 Langium 诊断。

## 与 Langium 的关系

- 当前解析与 IDE 能力仍以 **Langium**（`src/grammar/*.langium`）为主。
- G4 仅用于「独立 G4 严格模式」校验一路。
- 规则对照可维护在 `docs/grammar-mapping.md`（G4 规则名 ↔ Langium 规则名）。

## 切换与配置

详见计划文档「G4 语法与校验」一节：更换 G4 来源、开关 G4、Langium/G4 主从切换均通过配置或本目录文件完成。
