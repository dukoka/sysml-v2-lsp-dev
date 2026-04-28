# SysMLv2 语法扩展与完整移植

本文档记录 SysMLv2 Langium 语法的演进：从精简语法扩展，到完整移植 [sensmetry/sysml-2ls](https://github.com/sensmetry/sysml-2ls) 的 KerML + SysML 语法。

## 历史：精简语法扩展（2025-02）

早期采用单文件 `sysml.langium` 精简语法，通过扩展支持注释、PartUsage、PortUsage、多重性、流方向等，消除 VehicleExample 等合法构造的误报。详见 Git 历史。

## 当前：完整 sysml-2ls 语法移植（2025-02）

已从 sensmetry/sysml-2ls 完整移植 KerML + SysML 语法，替换原精简语法。

### 1. 语法文件结构

| 文件 | 说明 |
|------|------|
| `src/grammar/KerML.langium` | KerML 主语法（约 1200 行） |
| `src/grammar/KerML.interfaces.langium` | KerML 接口定义 |
| `src/grammar/KerML.expressions.langium` | 表达式、终结符、注释 |
| `src/grammar/SysML.langium` | SysML 主语法（约 2200 行） |
| `src/grammar/SysML.interfaces.langium` | SysML 接口定义 |

### 2. Langium 4.x 兼容性修复

- **Fragment 规则**：移除 `fragment` 关键字或 `returns` 类型（Langium 4.x 不允许 fragment 指定返回类型）
- **空消费规则**：`EffectBehaviorUsage_1` 改为必须消费 `;`；`TransitionSuccession` 改为 `ends+=ConnectorEndMember ( ',' ends+=ConnectorEndMember )*`

### 3. AST 结构

- **入口规则**：`entry Model returns Namespace: PackageBodyItems`
- **Namespace**：`children: Array<Import | Membership>`
- **OwningMembership**：`target` 指向 `Definition` 或 `Usage`
- **类型**：`PartDefinition`、`PartUsage`、`PortDefinition`、`PortUsage`、`AttributeDefinition`、`AttributeUsage` 等

### 4. 代码适配

- **parser.ts**：使用 `SysMLGeneratedSharedModule`、`SysMLGeneratedModule`
- **astSymbols.ts**：基于新 AST 重写，遍历 `Namespace.children`、`OwningMembership.target`
- **completion.ts**、**sysmlLSPWorker.ts**：沿用 `extractAstSymbols` 接口，无需修改

## 验证用例

以下代码应无诊断错误：

```text
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

- `src/grammar/parser.test.ts`：入口规则、AST 结构（`children`）断言
- `src/grammar/astSymbols.test.ts`：新 AST 符号提取
- `npm run test:run`、`npm run build` 全部通过

## 参考

- [sensmetry/sysml-2ls](https://github.com/sensmetry/sysml-2ls)
- `docs/current-vs-sysml-2ls-comparison.md`
- `docs/grammar-mapping.md`（G4 映射预留）
