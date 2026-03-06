export const EXAMPLE_FILES: Array<{ name: string; content: string }> = [
  {
    name: 'Vehicle.sysml',
    content: `package VehicleExample {
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
`,
  },
  {
    name: 'Requirements.sysml',
    content: `package Requirements {
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
`,
  },
  {
    name: 'Actions.sysml',
    content: `package ActionExample {
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
`,
  },
];
