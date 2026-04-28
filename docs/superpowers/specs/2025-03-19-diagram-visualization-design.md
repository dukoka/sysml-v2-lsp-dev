# SysMLv2 编辑器 - 图表可视化与保存视图设计

**日期**: 2025-03-19
**阶段**: I (图表可视化) + K (保存视图)
**状态**: 设计已批准

---

## 1. 概览

本文档指定了 SysMLv2 LSP 编辑器两个相关功能的实现：

1. **阶段 I: 图表可视化** - 基于 ELK 的 SVG 图表渲染，实时同步 AST
2. **阶段 K: 保存视图** - 用于筛选图表元素的命名视图预设

### 1.1 目标

- 将 SysMLv2 结构（包、part 定义、属性、端口）可视化为 BDD 风格图表
- 实现代码与图表之间的双向导航
- 支持不同抽象级别的可自定义视图
- 导出为 draw.io 格式以供外部编辑

### 1.2 非目标

- 交互式图表编辑（拖放）- 阶段 I 仅供查看
- 连接/IBD 视图 - 初始实现范围外
- MCP 服务器（阶段 J）- 推迟到未来里程碑

---

## 2. 图表可视化 (阶段 I)

### 2.1 架构概述

```
┌─────────────────────────────────────────────────────────────┐
│                      React 前端                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │  代码编辑  │  │  图表渲染  │  │  保存视图  │   │
│  │  Monaco   │◄─►│   ELK+    │  │  预设面板  │   │
│  │   编辑器   │  │   D3.js    │  │           │   │
│  └──────┬────┘  └──────┬────┘  └──────┬────┘   │
│         │              │              │             │
│         └──────────────┼──────────────┘             │
│                        │                        │
│                   ┌────▼────┐                   │
│                   │  AST    │                   │
│                   │ 同步   │                   │
│                   └────┬────┘                   │
└────────────────────────┼────────────────────────┘
                       │
                       │ 消息
                       ▼
┌───────────────────────────────────────────────────────────┐
│                  LSP Worker                    │
│  ┌───────────────────────────────────────────┐ │
│  │         图表生成服务            │ │
│  │  - 解析 AST                      │ │
│  │  - 生成 ELK 布局                │ │
│  │  - 计算位置                     │ │
│  └───────────────────────────────────────────┘ │
└───────────────────────────────────────────────────┘
```

### 2.2 数据流

1. **用户输入** → Monaco 编辑器
2. **AST 更新** → LSP Worker (通过 `textDocument/didChange`)
3. **图表同步** → 通过 `window.postMessage` 发送消息
4. **布局计算** → ELK 算法
5. **SVG 渲染** → D3.js
6. **显示** → React 组件

### 2.3 消息协议

```typescript
// LSP Worker -> 前端
interface DiagramUpdate {
  type: 'diagram-update';
  uri: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  version: number;
}

interface DiagramNode {
  id: string;
  label: string;
  type: 'package' | 'part' | 'port' | 'attribute';
  sourceLocation: SourceLocation;
}

interface DiagramEdge {
  source: string;
  target: string;
  type: 'contains' | 'references';
}
```

### 2.4 ELK 配置

```typescript
const elkOptions = {
  'elk.algorithm': 'layered',
  'elk.layered.spacing.nodeNode': '50',
  'elk.layered.spacing.edgeNode': '10',
  'elk.direction': 'DOWN',
  'elk.crossingMinimization.strategy': 'LAYER_SWEEP',
};
```

### 2.5 图表类型

#### 2.5.1 包结构图 (IBD 风格)

```
┌────────────────────────────────┐
│    VehicleExample (Package)       │
├────────────────────────────────┤
│ ┌──────────┐  ┌──────────┐  │
│ │ Vehicle │  │  Engine │  │
│ │  Part   │  │  Part   │  │
│ └──────────┘  └──────────┘  │
└────────────────────────────────┘
```

#### 2.5.2 内部块定义图 (BDD)

```
┌────────────────────────────────┐
│         Vehicle               │
├────────────────────────────────┤
│ + engine: Engine          │
│ + wheels: Wheel[4]       │
│ + fuelPort: FuelPort       │
├────────────────────────────────┤
│ ←───► fuelPort ───►│
└────────────────────────────────┘
```

### 2.6 交互功能

- **悬停**: 显示元素详细信息
- **点击**: 导航到代码定义
- **双击**: 展开/折叠子元素
- **拖拽**: 平移图表（仅视图）
- **缩放**: 鼠标滚轮

### 2.7 导出功能

支持导出为:
- **SVG**: 矢量图形
- **PNG**: 光栅图像
- **draw.io**: XML 格式

---

## 3. 保存视图 (阶段 K)

### 3.1 概念

保存视图 = 命名预设，定义图表的可见性和显示选项。

### 3.2 数据模型

```typescript
interface SavedView {
  id: string;
  name: string;
  description?: string;
  filters: ViewFilters;
  displayOptions: DisplayOptions;
  createdAt: Date;
  updatedAt: Date;
}

interface ViewFilters {
  elementTypes: ('package' | 'part' | 'port' | 'attribute')[];
  minVisibility: 'public' | 'private' | 'protected';
  showReferences: boolean;
}

interface DisplayOptions {
  layout: 'vertical' | 'horizontal';
  showLabels: boolean;
  showPorts: boolean;
  zoomLevel: number;
}
```

### 3.3 默认视图

| 视图 | 说明 |
|------|------|
| **完整** | 显示所有元素和连接 |
| **仅结构** | 仅包和 part 定义 |
| **仅端口** | 仅端口和连接 |
| **仅属性** | 仅属性 |

### 3.4 视图管理

- **创建**: 用户定义新视图
- **保存**: 存储到本地存储
- **加载**: 应用预设
- **删除**: 移除视图
- **导出/导入**: 跨浏览器共享

---

## 4. 实现计划

### 4.1 阶段 I: 图表可视化

| 周次 | 任务 |
|------|------|
| 1 | LSP Worker 图表生成服务 |
| 2 | 消息协议实现 |
| 3 | ELK 集成与布局算法 |
| 4 | D3.js SVG 渲染 |
| 5 | React 组件集成 |
| 6 | 交互功能 |
| 7 | 导出功能 |
| 8 | 测试与修复 |

### 4.2 阶段 K: 保存视图

| 周次 | 任务 |
|------|------|
| 9 | 视图数据模型 |
| 10 | 本地存储持久化 |
| 11 | 视图管理 UI |
| 12 | 默认视图 |
| 13 | 导出/导入 |
| 14 | 测��与修复 |

---

## 5. 技术考虑

### 5.1 性能

- **增量更新**: 仅发送更改的元素
- **去抖动**: 避免频繁重绘
- **虚拟化**: 大图表的视口渲染

### 5.2 可访问性

- 键盘导航
- 屏幕阅读器支持
- 对比度要求

### 5.3 浏览器支持

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

---

## 6. 待定/风险

- [ ] 与现有 LSP 功能的集成
- [ ] 多文件图表
- [ ] 连接线样式
- [ ] 自定义布局算法

---

## 7. 附录

### 7.1 示例: 图表 JSON 结构

```json
{
  "nodes": [
    {
      "id": "pkg:VehicleExample",
      "label": "VehicleExample",
      "type": "package",
      "location": { "start": { "line": 1 } }
    },
    {
      "id": "part:Vehicle",
      "label": "Vehicle",
      "type": "part",
      "parent": "pkg:VehicleExample",
      "location": { "start": { "line": 3 } }
    }
  ],
  "edges": [
    {
      "source": "pkg:VehicleExample",
      "target": "part:Vehicle",
      "type": "contains"
    }
  ]
}
```

### 7.2 参考文献

- [ELK JavaScript](https://github.com/kieler/elkjs)
- [D3.js](https://d3js.org)
- [draw.io XML](https://www.diagrams.net/doc/faq/export-to-format)