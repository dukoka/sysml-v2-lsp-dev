---
description: 示例文件定义，用于新文件模板
---

# exampleFiles - 示例文件

`src/store/exampleFiles.ts` 文件定义了编辑器新建文件时可用的示例模板。

## 导出内容

### EXAMPLE_FILES

示例文件数组：

```typescript
export const EXAMPLE_FILES: Array<{ name: string; content: string }>
```

## 示例文件

### Vehicle.sysml

车辆定义示例：

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
    attribute displacement: Real;
    port exhaustOut: ExhaustPort;
  }

  part def Wheel {
    attribute diameter: Real;
    attribute pressure: Real;
  }

  // Port definitions
  port def FuelPort {
    in attribute fuelFlow: Real;
  }

  port def ExhaustPort {
    out attribute exhaustFlow: Real;
  }

  // Connections
  connection def FuelConnection {
    end source: FuelPort;
    end target: FuelPort;
  }
}
```

### Requirements.sysml

需求定义示例：

```text
package Requirements {
  requirement def PerformanceReq {
    doc /* The system shall meet performance targets. */
    attribute targetValue: Real;
    attribute unit: String;
  }

  requirement MaxSpeed : PerformanceReq {
    doc /* Maximum speed shall be at least 200 km/h. */
    attribute redefines targetValue = 200.0;
  }

  requirement FuelEfficiency : PerformanceReq {
    doc /* Fuel consumption shall not exceed 8 L/100km. */
    attribute redefines targetValue = 8.0;
  }

  requirement def SafetyReq {
    doc /* The system shall comply with safety standards. */
    attribute safetyLevel: String;
  }
}
```

### Actions.sysml

动作和状态机示例：

```text
package ActionExample {
  action def StartEngine {
    in item key: Boolean;
    out item engineStatus: Boolean;
  }

  action def Accelerate {
    in item throttle: Real;
    out item speed: Real;
  }

  action def DriveSequence {
    action start: StartEngine;
    then action accel: Accelerate;

    flow start.engineStatus to accel.throttle;
  }

  state def EngineState {
    entry action turnOn;
    do action idle;
    exit action turnOff;

    state off;
    state starting;
    state running;
    state stopping;

    transition off_to_starting
      first off
      then starting;

    transition starting_to_running
      first starting
      then running;
  }
}
```

## 使用场景

1. **新建文件** - 新建 SysML 文件时选择模板
2. **学习示例** - 学习 SysML 语法
3. **快速开始** - 快速创建常用结构