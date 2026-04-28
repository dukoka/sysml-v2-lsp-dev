# React Frontend Architecture

## Overview

The React frontend forms the user interface layer of the SysMLv2 Editor, built with React 18 and TypeScript. It manages the application state, renders UI components, and handles user interactions.

## Core Structure

### Main Application (`src/App.tsx`)

The `App.tsx` file serves as the root component that orchestrates the entire application:

- **State Management**: Uses custom hooks (`useFileStore`) to manage file state, active tabs, cursor position, and diagnostics
- **Component Composition**: Combines various UI components (Toolbar, TabBar, Sidebar, CodeEditor, ProblemsPanel, StatusBar)
- **Event Handling**: Processes user actions like file creation, formatting, theme changes, and keyboard shortcuts
- **Side Effects**: Initializes example files, manages theme settings, and updates outline symbols when files change

### UI Components

The application is composed of several reusable components located in `src/components/`:

1. **Toolbar** (`src/components/Toolbar.tsx`)
   - Contains actions for file operations, formatting, theme switching, and sidebar toggling
   - Displays current theme and provides access to editor functions

2. **TabBar** (`src/components/TabBar.tsx`)
   - Manages open file tabs with visual indicators for dirty files
   - Handles tab switching and closing

3. **Sidebar** (`src/components/Sidebar.tsx`)
   - Displays file explorer with open/closed state indicators
   - Shows outline view of active file symbols
   - Provides navigation to specific lines in files

4. **CodeEditor** (`src/components/CodeEditor.tsx`)
   - Main editing interface powered by Monaco Editor
   - Integrates with Language Server Protocol for advanced features
   - Manages editor lifecycle and communication with LSP worker

5. **ProblemsPanel** (`src/components/ProblemsPanel.tsx`)
   - Displays diagnostics (errors, warnings, info) from validation
   - Allows navigation to problem locations in code

6. **StatusBar** (`src/components/StatusBar.tsx`)
   - Shows current cursor position, character count, LSP status, and language info
   - Provides quick access to problems panel

## State Management

The application uses a custom file store implementation for state management:

### File Store (`src/store/fileStore.ts`)

- **Core Responsibilities**:
  - Managing in-memory file system with content versioning
  - Tracking file modifications (dirty state)
  - Managing open tabs and active file state
  - Storing cursor positions and diagnostics per file
  - Coordinating LSP readiness state

- **Key Features**:
  - Immutable-like updates with efficient change detection
  - Event-driven updates through callback mechanisms
  - Persistence of editor state (cursor position, scroll) when switching tabs
  - Batch operations for performance optimization

### Custom Hooks

- `useFileStore.ts`: Provides React hooks for accessing and modifying file store state
- Automatic re-rendering when relevant state changes occur

## Styling and Theming

- **CSS Modules**: Component-scoped styling to prevent conflicts
- **CSS Variables**: Theme colors defined as CSS variables for easy switching
- **Theme Support**: Light and dark themes with dynamic switching
- **Responsive Design**: Layout adapts to different screen sizes

## Component Communication

Communication between components follows these patterns:

1. **Prop Drilling**: Simple data flow from parent to child components
2. **Callback Functions**: Child components notify parents of user actions
3. **Global State**: File store provides shared state accessible to any component via hooks
4. **Refs**: Direct access to DOM elements or editor instances when needed (e.g., CodeEditor ref for programmatic control)

## Lifecycle Management

- **Initialization**: Loads example files and sets up initial state on mount
- **Resource Cleanup**: Properly disposes of Monaco editor instances, Web Workers, and subscriptions on unmount
- **Memory Management**: Prevents leaks by clearing timeouts, disposing models, and terminating workers

## Integration Points

The frontend integrates with several subsystems:

1. **Monaco Editor**: Through the CodeEditor component which creates and manages editor instances
2. **Language Server**: Via JSON-RPC communication over postMessage to Web Worker
3. **File System Operations**: Virtual file store provides abstraction over in-memory files
4. **User Preferences**: Theme settings persisted via browser storage mechanisms

## Performance Considerations

- **Lazy Initialization**: Editor instances created only when needed
- **Debouncing**: Diagnostic updates debounced to prevent excessive processing
- **Selective Rendering**: Components only re-render when relevant state changes
- **Worker Offloading**: Heavy language processing moved to Web Workers to maintain UI responsiveness
- **Efficient Updates**: Fine-grained subscriptions to file store state prevent unnecessary re-renders

## Extensibility

The frontend architecture supports extension through:

- **Component Composition**: New UI features can be added as additional components
- **State Extension**: File store can be extended with additional metadata
- **Action System**: New toolbar/menu items can dispatch actions through existing callbacks
- **Editor Enhancements**: Monaco editor can be extended with additional languages or features