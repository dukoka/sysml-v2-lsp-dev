---
description: 标准库加载器，用于加载 SysMLv2 标准库文件
---

# stdlibLoader - 标准库加载器

`src/workers/stdlibLoader.ts` 文件负责从 `/sysml.library/` 目录加载 SysMLv2 标准库文件。

## 导出函数

### loadStandardLibrary

异步加载所有标准库文件：

```typescript
export async function loadStandardLibrary(
  client: SysmlLSPClient
): Promise<{ loaded: number; failed: number }>
```

**参数：**
- `client`: SysML LSP 客户端实例

**返回：**
- `{ loaded, failed }`: 成功加载数和失败数

**加载策略：**
- 分批加载，每批 8 个文件
- 避免浏览器并发请求过多

## 标准库文件列表

### Kernel Semantic Library

| 文件 | 说明 |
|------|------|
| Base.kerml | 基础定义 |
| KerML.kerml | KerML 核心 |
| Links.kerml | 链接定义 |
| Objects.kerml | 对象定义 |
| Occurrences.kerml | 出现定义 |
| Performances.kerml | 性能定义 |
| Transfers.kerml | 转移定义 |
| StatePerformances.kerml | 状态性能 |
| TransitionPerformances.kerml | 转移性能 |
| ControlPerformances.kerml | 控制性能 |
| FeatureReferencingPerformances.kerml | 特性引用性能 |
| Metaobjects.kerml | 元对象 |
| Clocks.kerml | 时钟 |
| Triggers.kerml | 触发器 |
| Observation.kerml | 观察 |
| SpatialFrames.kerml | 空间框架 |

### Kernel Data Type Library

| 文件 | 说明 |
|------|------|
| ScalarValues.kerml | 标量值 |
| VectorValues.kerml | 向量值 |
| Collections.kerml | 集合 |

### Kernel Function Library

| 文件 | 说明 |
|------|------|
| BaseFunctions.kerml | 基础函数 |
| BooleanFunctions.kerml | 布尔函数 |
| NumericalFunctions.kerml | 数值函数 |
| IntegerFunctions.kerml | 整数函数 |
| NaturalFunctions.kerml | 自然数函数 |
| RealFunctions.kerml | 实数函数 |
| RationalFunctions.kerml | 有理数函数 |
| ComplexFunctions.kerml | 复数函数 |
| StringFunctions.kerml | 字符串函数 |
| ScalarFunctions.kerml | 标量函数 |
| VectorFunctions.kerml | 向量函数 |
| TrigFunctions.kerml | 三角函数 |
| CollectionFunctions.kerml | 集合函数 |
| SequenceFunctions.kerml | 序列函数 |
| OccurrenceFunctions.kerml | 出现函数 |
| ControlFunctions.kerml | 控制函数 |
| DataFunctions.kerml | 数据函数 |

### Systems Library

| 文件 | 说明 |
|------|------|
| SysML.sysml | SysML 核心 |
| Attributes.sysml | 属性 |
| Items.sysml | 项 |
| Parts.sysml | 零件 |
| Ports.sysml | 端口 |
| Connections.sysml | 连接 |
| Interfaces.sysml | 接口 |
| Flows.sysml | 流 |
| Actions.sysml | 动作 |
| States.sysml | 状态 |
| Constraints.sysml | 约束 |
| Calculations.sysml | 计算 |
| Cases.sysml | 用例 |
| Requirements.sysml | 需求 |
| AnalysisCases.sysml | 分析用例 |
| VerificationCases.sysml | 验证用例 |
| UseCases.sysml | 使用用例 |
| Allocations.sysml | 分配 |
| Metadata.sysml | 元数据 |
| Views.sysml | 视图 |
| StandardViewDefinitions.sysml | 标准视图定义 |

### Domain Libraries

| 类别 | 说明 |
|------|------|
| Quantities and Units | 量和单位 |
| Geometry | 几何 |
| Metadata | 元数据 |
| Analysis | 分析 |
| Cause and Effect | 因果 |
| Requirement Derivation | 需求派生 |

## 内部常量

### BASE_URL

标准库基础 URL：

```typescript
const BASE_URL = '/sysml.library/';
```

### STDLIB_URI_PREFIX

标准库 URI 前缀：

```typescript
const STDLIB_URI_PREFIX = 'file:///sysml.library/';
```

### STDLIB_FILES

标准库文件列表（107 个文件）：

```typescript
const STDLIB_FILES = [
  // Kernel Semantic Library (~25 files)
  // Kernel Data Type Library (~3 files)
  // Kernel Function Library (~18 files)
  // Systems Library (~20 files)
  // Domain Libraries (~41 files)
];
```

## 使用场景

1. **启动时加载** - 编辑器初始化时加载标准库
2. **类型检查** - 标准库类型验证
3. **补全提示** - 标准库符号补全
4. **跳转定义** - 跳转到标准库定义