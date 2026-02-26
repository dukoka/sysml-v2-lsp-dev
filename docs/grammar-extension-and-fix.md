# SysMLv2 语法扩展与误报修复

本文档记录 2025 年 2 月对 SysMLv2 Langium 语法的扩展，用于消除注释、part/port 用法、多重性、流方向等合法构造的误报诊断。

## 问题背景

用户提供的合法 SysMLv2 代码出现多处误报：

- 注释（`// Part definitions`）被报错
- part 用法名（`engine`, `wheels`）被报错
- port 用法名（`fuelIn`）被报错
- 多重性数字（`Wheel[4]` 中的 `4`）被报错
- 流方向（`in attribute`）被报错

根因：Langium 语法未支持上述构造，导致解析失败，`parseResultToDiagnostics` 将解析错误转为诊断，产生大量误报。

## 修复内容

### 1. 语法扩展（`src/grammar/sysml.langium`）

| 扩展项 | 说明 |
|--------|------|
| 注释 | `hidden terminal SL_COMMENT`、`hidden terminal ML_COMMENT`，使 lexer 识别并忽略 `//` 与 `/* */` |
| PartUsage | `part name: Type;` 用法规则 |
| PortUsage | `port name: Type;` 用法规则 |
| TypeRef 多重性 | `type=ID ('[' INT ']')?`，支持 `Wheel[4]` 等形式 |
| 流方向 | `direction=Direction?`，`Direction returns string: 'in' \| 'out'` |
| INT 终结符 | `terminal INT: /[0-9]+/` |

### 2. AST 变更

- 新增 `PartUsage`、`PortUsage` 节点
- `AttributeDef` 新增可选 `direction` 字段
- `Member` 类型扩展为 `PartDef | PortDef | AttributeDef | PartUsage | PortUsage`
- `TypeRef` 的 `$container` 扩展为 `AttributeDef | PartUsage | PortUsage`

### 3. 代码适配

- **astSymbols.ts**：在 `collectFromMember` 中处理 `PartUsage`、`PortUsage`（无嵌套成员，仅需跳过）
- **parser、completion、LSP Worker**：无需修改，自动兼容新 AST

## 验证用例

以下代码应无诊断错误：

```sysml
package VehicleExample {
  // Part definitions
  part def Vehicle {
    part engine: Engine;
    part wheels: Wheel[4];
    port fuelIn: FuelPort;
  }

  part def Engine {
    attribute horsepower: Integer;
  }

  // Port definitions
  port def FuelPort {
    in attribute fuelFlow: Real;
  }
}
```

## 测试

- `src/grammar/parser.test.ts`：新增 VehicleExample 解析测试
- `src/grammar/astSymbols.test.ts`：新增 PartUsage/PortUsage 符号提取测试
- `src/languages/sysmlv2/validator.test.ts`：新增 VehicleExample 零诊断测试

## 与参考项目的关系

参考项目 [sensmetry/sysml-2ls](https://github.com/sensmetry/sysml-2ls) 使用完整 SysML v2 / KerML 语法（多文件、约 3000+ 行）。本次实现采用**扩展现有语法**的方式，在单文件 `sysml.langium` 中增加最小必要规则，快速消除误报。未来若需完整语法，可参考 `docs/current-vs-sysml-2ls-comparison.md` 中的移植方案。

## G4 适配预留

当用户提供 G4（ANTLR）语法文件时，可参考 `docs/grammar-mapping.md`（若已创建）建立 G4 规则与 Langium 规则的映射关系。
