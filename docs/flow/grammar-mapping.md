# G4 与 Langium 规则映射

本文件维护 **G4 语法**（`src/grammar/g4/SysMLv2Parser.g4` / `SysMLv2Lexer.g4`）与 **Langium 语法**（`src/grammar/*.langium`）的规则名及 AST 类型对照，便于双语法校验与对照。

## 入口与根

| G4 规则 | Langium 规则 / AST 类型 | 说明 |
|---------|--------------------------|------|
| `rootNamespace` | `Model` → `Namespace`（SysML.langium）；`RootNamespace` → `Namespace`（KerML.langium） | 文档根 |
| `namespace` | `Namespace`、包/命名空间体 | 命名空间 |
| `packageBodyElement` | `PackageBodyItems`、包内成员 | 包体元素 |

## 类型与定义

| G4 规则 | Langium 规则 / AST 类型 | 说明 |
|---------|--------------------------|------|
| `type` | `Type`、类型声明 | 类型 |
| `classifier` | `Classifier`、分类器 | 分类器 |
| `part`（若存在） / 成员 | `PartDefinition`、`PartUsage` | 部件定义/用法 |
| `port`（若存在） / 成员 | `PortDefinition`、`PortUsage` | 端口定义/用法 |
| `feature` | `Feature`、特征 | 特征 |
| `attribute` | `AttributeDefinition`、`AttributeUsage` | 属性 |
| `package` | 包声明（Langium 中为包体项） | 包 |
| `dataType` | 数据类型 | 数据类型 |
| `structure` | 结构 | 结构 |

## 表达式与名称

| G4 规则 | Langium 规则 / AST 类型 | 说明 |
|---------|--------------------------|------|
| `ownedExpression` | `Expression`、各类表达式 | 表达式 |
| `qualifiedName` | `QualifiedName`、限定名 | 限定名 |
| `name` | 标识/名称 | 名称 |
| `literalExpression` | 字面量 | 字面量 |

## 关系与注解

| G4 规则 | Langium 规则 / AST 类型 | 说明 |
|---------|--------------------------|------|
| `dependency` | `Dependency` | 依赖 |
| `ownedAnnotation` | `OwnedAnnotation`、`AnnotatingMember` | 注解 |
| `comment` | `Comment` | 注释 |
| `documentation` | `Documentation` | 文档 |

## 使用说明

- **G4**：规则名来自 ANTLR 解析器（小写/下划线风格）。
- **Langium**：规则名与返回类型来自 `.langium` 文件（PascalCase 返回类型）。
- 本表可分批补充；G4 与 Langium 并非一一对应，仅作主要概念对照。
