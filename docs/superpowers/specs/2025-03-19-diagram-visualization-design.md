# SysMLv2 Editor - Diagram Visualization & Saved Views Design

**Date**: 2025-03-19
**Phases**: I (Diagram Visualization) + K (Saved Views)
**Status**: Design Approved

---

## 1. Overview

This document specifies the implementation of two related features for the SysMLv2 LSP Editor:

1. **Phase I: Diagram Visualization** - ELK-based SVG diagram rendering with real-time AST synchronization
2. **Phase K: Saved Views** - Named view presets for filtering diagram elements

### 1.1 Goals

- Visualize SysMLv2 structure (packages, part definitions, attributes, ports) as BDD-style diagrams
- Enable bidirectional navigation between code and diagram
- Support customizable views for different abstraction levels
- Export to draw.io format for external editing

### 1.2 Non-Goals

- Interactive diagram editing (drag-and-drop) - Phase I is view-only
- Connection/IBD view - out of scope for initial implementation
- MCP Server (Phase J) - deferred to future milestone

---

## 2. Architecture

### 2.1 Component Structure

```
src/
├── diagram/
│   ├── astToGraph.ts          # AST → ELK graph model conversion
│   ├── elkLayout.ts           # ELK layout engine wrapper
│   ├── DiagramPanel.tsx       # Main diagram React component
│   ├── DiagramView.tsx        # View selector and controls
│   ├── svgRenderer.tsx        # SVG rendering from layouted graph
│   ├── symbols/
│   │   ├── PartDefSymbol.tsx  # PartDefinition rendering
│   │   ├── AttributeRow.tsx   # Attribute row rendering
│   │   └── PortSymbol.tsx     # Port indicator rendering
│   ├── hooks/
│   │   ├── useDiagramLayout.ts    # ELK layout hook
│   │   └── useViewFilter.ts       # View filtering hook
│   └── export/
│       └── toDrawIO.ts        # draw.io XML export
├── store/
│   ├── diagramStore.ts        # Zustand store for diagram state
│   └── viewStore.ts           # Saved views persistence
```

### 2.2 Data Flow

```
┌─────────────────┐
│   SysML Text    │
│  (Monaco Editor)│
└────────┬────────┘
         │ parse
         ▼
┌─────────────────┐
│   AST (Langium) │
└────────┬────────┘
         │ astToGraph
         ▼
┌─────────────────┐     ┌─────────────────┐
│   ELK Graph     │◄────│  View Filters   │
│   (hierarchy)   │     │  (Saved Views)  │
└────────┬────────┘     └─────────────────┘
         │ elkLayout
         ▼
┌─────────────────┐
│ Layouted Graph  │
│ (x, y, w, h)    │
└────────┬────────┘
         │ svgRenderer
         ▼
┌─────────────────┐     ┌─────────────────┐
│   SVG Display   │────►│  Click Handler  │
│                 │     │  (goto source)  │
└─────────────────┘     └─────────────────┘
```

---

## 3. Phase I: Diagram Visualization

### 3.1 ELK Integration

**Dependency**: `elkjs` (npm package)

**Configuration**:
```typescript
const elkConfig = {
  algorithm: 'layered',
  direction: 'DOWN',        // Top-down layout
  spacing: {
    nodeNode: 40,
    portPort: 20,
    edgeEdge: 10
  },
  layering: {
    strategy: 'NETWORK_SIMPLEX'
  }
};
```

### 3.2 AST to Graph Conversion

**Node Types**:

| AST Element | ELK Node Type | Visual |
|-------------|---------------|--------|
| `Package` | Container | Rectangle with label header |
| `PartDefinition` | Node with children | Rectangle with «part def» stereotype |
| `Attribute` | Child node | Small rectangle inside parent |
| `PartUsage` | Child node | Same as attribute |
| `PortDefinition` | Node | Small circle/rectangle |

**Edge Types**:

| Relationship | Edge Style |
|--------------|------------|
| `part engine: Engine` | Solid blue line with filled diamond |
| `specializes` | Dashed line with hollow triangle |
| `reference` | Simple line with arrow |

### 3.3 SVG Rendering

**Symbol Specifications**:

```typescript
interface PartDefSymbolProps {
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  stereotype: 'part def' | 'port def' | 'action def';
  attributes: Array<{ name: string; type: string }>;
  onClick: () => void;
  sourceLocation: { line: number; column: number };
}

// Visual style (matches SysMLv2 Dark theme)
const styles = {
  partBox: {
    fill: '#0d1117',
    stroke: '#58a6ff',
    strokeWidth: 2,
    rx: 4
  },
  stereotype: {
    fill: '#8b949e',
    fontSize: 10,
    fontStyle: 'italic'
  },
  name: {
    fill: '#c9d1d9',
    fontSize: 13,
    fontWeight: 500
  },
  attribute: {
    fill: '#9cdcfe',
    fontSize: 11
  }
};
```

### 3.4 Bidirectional Navigation

**Code → Diagram**:
- Cursor position change → highlight corresponding diagram node
- Debounced 100ms to avoid flicker

**Diagram → Code**:
- Click node → `editor.setPosition({ line, column })`
- Double-click → reveal range in center of viewport

### 3.5 Real-time Synchronization

```typescript
// Debounced re-layout (500ms)
const useDiagramSync = () => {
  const debouncedLayout = useDebounce((ast: Namespace) => {
    const graph = astToGraph(ast);
    const layouted = elkLayout(graph);
    setDiagram(layouted);
  }, 500);

  useEffect(() => {
    if (ast) debouncedLayout(ast);
  }, [ast]);
};
```

### 3.6 draw.io Export

**Format**: XML compatible with diagrams.net

```typescript
function toDrawIO(graph: ElkGraph): string {
  // Generate mxGraph XML
  // Nodes → mxCells with geometry
  // Edges → mxCells with waypoints
  return `<?xml version="1.0"?>
<mxfile>
  <diagram name="SysMLv2">
    <mxGraphModel>
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
        ${graph.children.map(nodeToMxCell).join('\n')}
        ${graph.edges.map(edgeToMxCell).join('\n')}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;
}
```

---

## 4. Phase K: Saved Views

### 4.1 Data Model

```typescript
// src/store/viewStore.ts
interface SavedView {
  id: string;
  name: string;
  description?: string;
  filters: ViewFilters;
  layout: ViewLayoutConfig;
  createdAt: number;
  updatedAt: number;
}

interface ViewFilters {
  elementTypes: ElementType[];  // empty = all
  includePackages: string[];     // empty = all
  excludeElements: string[];     // element names to hide
  maxDepth: number | null;       // null = unlimited
  showAttributes: boolean;
  showPorts: boolean;
}

type ElementType =
  | 'package'
  | 'part'
  | 'port'
  | 'action'
  | 'state'
  | 'connection'
  | 'attribute';

interface ViewLayoutConfig {
  type: 'nested' | 'tree';
  direction: 'TB' | 'LR' | 'BT' | 'RL';
  compactMode: boolean;
}

// Default views
const DEFAULT_VIEWS: SavedView[] = [
  {
    id: 'all',
    name: 'All',
    filters: {
      elementTypes: [],
      includePackages: [],
      excludeElements: [],
      maxDepth: null,
      showAttributes: true,
      showPorts: true
    },
    layout: { type: 'nested', direction: 'TB', compactMode: false }
  },
  {
    id: 'structure',
    name: 'Structure Only',
    filters: {
      elementTypes: ['package', 'part', 'port', 'connection'],
      includePackages: [],
      excludeElements: [],
      maxDepth: null,
      showAttributes: false,
      showPorts: true
    },
    layout: { type: 'nested', direction: 'TB', compactMode: true }
  },
  {
    id: 'behavior',
    name: 'Behavior Only',
    filters: {
      elementTypes: ['action', 'state'],
      includePackages: [],
      excludeElements: [],
      maxDepth: null,
      showAttributes: false,
      showPorts: false
    },
    layout: { type: 'nested', direction: 'TB', compactMode: false }
  }
];
```

### 4.2 Filtering Logic

```typescript
function applyFilters(
  ast: Namespace,
  filters: ViewFilters
): FilteredNamespace {
  const shouldInclude = (node: AstNode, depth: number): boolean => {
    // Depth filter
    if (filters.maxDepth !== null && depth > filters.maxDepth) {
      return false;
    }

    // Element type filter
    if (filters.elementTypes.length > 0) {
      const type = getElementType(node);
      if (!filters.elementTypes.includes(type)) {
        return false;
      }
    }

    // Package filter
    if (filters.includePackages.length > 0) {
      const pkg = getContainingPackage(node);
      if (!filters.includePackages.includes(pkg?.name)) {
        return false;
      }
    }

    // Exclude filter
    if (filters.excludeElements.includes(getNodeName(node))) {
      return false;
    }

    return true;
  };

  return filterAst(ast, shouldInclude, 0);
}
```

### 4.3 Persistence

```typescript
// Local storage keys
const STORAGE_KEYS = {
  views: 'sysml-views',
  activeView: 'sysml-active-view',
  viewPreferences: 'sysml-view-preferences'
};

// Zustand store with persistence
export const useViewStore = create(
  persist(
    (set, get) => ({
      views: DEFAULT_VIEWS,
      activeViewId: 'all',

      createView: (name: string, filters: ViewFilters) => {
        const newView: SavedView = {
          id: crypto.randomUUID(),
          name,
          filters,
          layout: DEFAULT_LAYOUT,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        set(state => ({ views: [...state.views, newView] }));
      },

      updateView: (id: string, updates: Partial<SavedView>) => {
        set(state => ({
          views: state.views.map(v =>
            v.id === id ? { ...v, ...updates, updatedAt: Date.now() } : v
          )
        }));
      },

      deleteView: (id: string) => {
        set(state => ({
          views: state.views.filter(v => v.id !== id),
          activeViewId: state.activeViewId === id ? 'all' : state.activeViewId
        }));
      },

      setActiveView: (id: string) => set({ activeViewId: id }),

      exportViews: () => JSON.stringify(get().views, null, 2),

      importViews: (json: string) => {
        const views = JSON.parse(json);
        set({ views: [...DEFAULT_VIEWS, ...views] });
      }
    }),
    { name: STORAGE_KEYS.views }
  )
);
```

---

## 5. UI Integration

### 5.1 Layout Changes

```
┌─────────────────────────────────────────────────────────────────┐
│ Toolbar                                                         │
├──────────┬──────────────────────────────────────┬───────────────┤
│          │                                      │               │
│  Sidebar │    Code Editor (Monaco)              │  Diagram      │
│          │                                      │  Panel        │
│  Files   │                                      │               │
│  Outline │                                      │  ┌─────────┐  │
│          │                                      │  │ Package │  │
│          │                                      │  │ ┌─────┐ │  │
│          │                                      │  │ │Part │ │  │
│          │                                      │  │ └─────┘ │  │
│          │                                      │  └─────────┘  │
│          │                                      │               │
├──────────┴──────────────────────────────────────┴───────────────┤
│ Status Bar                                                      │
└─────────────────────────────────────────────────────────────────┘
```

Grid template: `260px 1fr 380px`

### 5.2 Diagram Panel Components

```typescript
// DiagramPanel.tsx
interface DiagramPanelProps {
  ast: Namespace | null;
  activeFileUri: string;
  onNavigateToSource: (location: SourceLocation) => void;
}

// ViewSelector.tsx
interface ViewSelectorProps {
  views: SavedView[];
  activeViewId: string;
  onSelect: (id: string) => void;
  onSaveCurrent: () => void;
  onManageViews: () => void;
}
```

### 5.3 Toolbar Integration

Add to existing Toolbar:
- View selector dropdown ("All", "Structure Only", etc.)
- "Save View" button
- "Export to draw.io" button with dropdown (SVG, PNG, draw.io)

---

## 6. Performance Considerations

### 6.1 Optimization Strategies

1. **Debounced Layout**: 500ms delay after text change
2. **Memoized AST**: Only re-convert when AST structure changes
3. **Virtual Scrolling**: For large diagrams (if needed)
4. **Worker Offloading**: Run ELK layout in web worker

### 6.2 Large File Handling

- Threshold: >1000 AST nodes
- Behavior: Show simplified view (hide attributes, collapse packages)
- Warning: Display "Large diagram - some elements hidden" message

---

## 7. Testing Strategy

### 7.1 Unit Tests

```typescript
// astToGraph.test.ts
describe('astToGraph', () => {
  it('converts Package to container node', () => {});
  it('converts PartDefinition with attributes', () => {});
  it('creates composition edges for part usage', () => {});
});

// viewFilters.test.ts
describe('applyFilters', () => {
  it('filters by element type', () => {});
  it('respects max depth', () => {});
  it('excludes elements by name', () => {});
});
```

### 7.2 Integration Tests

- Diagram renders from example files
- Click navigates to correct source location
- View filter updates diagram correctly
- Export produces valid draw.io XML

### 7.3 Visual Tests

- Screenshot comparison for reference diagrams
- Theme consistency with SysMLv2 Dark

---

## 8. Implementation Order

### Phase I - Diagram Visualization

1. **Setup**: Add `elkjs` dependency, create `src/diagram/` structure
2. **AST Conversion**: Implement `astToGraph.ts` for basic part definitions
3. **Layout**: Integrate ELK with layered algorithm
4. **SVG Rendering**: Create symbol components
5. **Panel Integration**: Add DiagramPanel to App layout
6. **Navigation**: Implement click-to-source
7. **Sync**: Debounced re-layout on AST change
8. **Export**: draw.io XML generator

### Phase K - Saved Views

1. **Store**: Create viewStore with persistence
2. **Default Views**: Implement All, Structure, Behavior presets
3. **Filtering**: Apply filters to astToGraph pipeline
4. **UI Controls**: View selector pills, save dialog
5. **Import/Export**: JSON serialization

---

## 9. Acceptance Criteria

### Phase I

- [ ] ELK-based diagram renders from AST
- [ ] Top-down layered layout for Package → PartDefinition → Attribute
- [ ] Click on diagram node jumps to source location
- [ ] Text edit triggers diagram update (debounced)
- [ ] Export to draw.io XML works
- [ ] No regression in editor performance

### Phase K

- [ ] Three default views (All, Structure, Behavior) function correctly
- [ ] Custom views can be created, named, and saved
- [ ] View filters apply correctly (element types, depth, exclusions)
- [ ] Views persist across sessions (localStorage)
- [ ] Views can be exported/imported as JSON
- [ ] UI clearly indicates active view

---

## 10. Dependencies

```json
{
  "dependencies": {
    "elkjs": "^0.9.3"
  }
}
```

---

## 11. Appendix: draw.io Export Format

```xml
<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="app.diagrams.net" modified="2025-03-19"
        agent="SysMLv2 Editor" version="21.0.0"
        etag="abc123" type="device">
  <diagram name="Page-1" id="diagram-id">
    <mxGraphModel dx="1422" dy="762" grid="1" gridSize="10"
                   guides="1" tooltips="1" connect="1" arrows="1"
                   fold="1" page="1" pageScale="1" pageWidth="850"
                   pageHeight="1100" math="0" shadow="0">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
        <!-- Part Definition -->
        <mxCell id="2" value="Vehicle" style="swimlane;fontStyle=1;..."
                vertex="1" parent="1">
          <mxGeometry x="120" y="80" width="140" height="100" as="geometry" />
        </mxCell>
        <!-- Attributes -->
        <mxCell id="3" value="engine: Engine" style="text;html=1;..."
                vertex="1" parent="2">
          <mxGeometry y="30" width="140" height="20" as="geometry" />
        </mxCell>
        <!-- Edge -->
        <mxCell id="4" value="" style="edgeStyle=orthogonalEdgeStyle;..."
                edge="1" parent="1" source="2" target="5">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
```
