# Phase 7: Function-Level Documentation - Execution Plan

## Phase Overview
Document key functions in lspClient.ts, sysmlLSPWorker.ts, editor components, and virtual file store utilities as defined in the context.

## Goals
- Create detailed documentation for publicly exported and key internal functions
- Document function signatures, parameters, return values, descriptions, and usage examples
- Use modular approach - create individual documentation files for significant functions or group related functions
- Prioritize core LSP functionality functions in the src/ directory

## Target Functions to Document

### LSP Client (`src/workers/lspClient.ts`)
1. `constructor` - Initialize LSP client with worker and document URI
2. `initialize()` - Initialize LSP connection and send initialized notification
3. `setDocumentUri(uri)` - Change the document URI being served
4. `openDocument(content)` - Open a document in the LSP worker
5. `updateDocument(content, version)` - Update document content with version tracking
6. `closeDocument()` - Close the current document
7. `getDiagnostics()` - Get diagnostic information for current document
8. `getG4Diagnostics()` - Get G4-specific diagnostics
9. `getCompletion(position)` - Get completion items at position
10. `getHover(position)` - Get hover information at position
11. `getDefinition(position)` - Get definition location at position
12. `getReferences(position, includeDeclaration)` - Get references to symbol at position
13. `getRename(position, newName)` - Get rename edits for symbol at position
14. `getDocumentSymbols()` - Get document symbols for outline view
15. `getFoldingRanges()` - Get folding range information
16. `getSemanticTokens()` - Get semantic token data for syntax highlighting
17. `getSignatureHelp(position)` - Get signature help for function calls
18. `getCodeActions(range, diagnostics)` - Get code actions for range
19. `formatDocument(options)` - Format entire document
20. `getTypeDefinition(position)` - Get type definition at position
21. `getCodeLens()` - Get code lens information
22. `getDocumentHighlights(position)` - Get document highlights for symbol at position
23. `getWorkspaceSymbols(query)` - Get workspace symbols matching query
24. `getInlayHints(range)` - Get inlay hints for range
25. `getOnTypeFormatting(position, ch, options)` - Get formatting for on-type actions
26. `formatDocumentRange(range, options)` - Format document range
27. `getSelectionRanges(positions)` - Get selection ranges for positions
28. `getLinkedEditingRanges(position)` - Get linked editing ranges at position

### LSP Worker (`src/workers/sysmlLSPWorker.ts`)
1. `validateDocument(text, uri)` - Main validation function producing diagnostics
2. `extractUserDefinedTypes(text)` - Extract user-defined types from text
3. `levenshteinDistance(a, b)` - Calculate Levenshtein distance
4. `findSimilarKeyword(word)` - Find similar keyword for error suggestions
5. `connection.onInitialize` - Handle LSP initialize request
6. `connection.onRequest('sysml/debugIndexTypes')` - Debug endpoint for index info
7. `connection.onRequest('sysml/g4Diagnostics')` - G4 diagnostics handler
8. `connection.onRequest('textDocument/formatting')` - Document formatting handler
9. `connection.onRequest('textDocument/rangeFormatting')` - Range formatting handler
10. `connection.onRequest('textDocument/onTypeFormatting')` - On-type formatting handler
11. `connection.languages.diagnostics.on` - Diagnostic production handler
12. `connection.languages.diagnostics.onWorkspace` - Workspace diagnostics handler
13. `detectCompletionContextLsp(line, char)` - Detect completion context
14. `connection.onCompletion` - Handle completion requests
15. `connection.onHover` - Handle hover requests
16. `connection.onDefinition` - Handle definition requests
17. `connection.onRequest('textDocument/typeDefinition')` - Handle type definition requests
18. `connection.onReferences` - Handle reference requests
19. `connection.onPrepareRename` - Prepare rename operation
20. `connection.onRenameRequest` - Handle rename requests
21. `connection.onDocumentHighlight` - Handle document highlight requests
22. `connection.onWorkspaceSymbol` - Handle workspace symbol requests
23. `connection.onCodeLens` - Handle code lens requests
24. `connection.onDocumentSymbol` - Handle document symbol requests
25. `connection.onFoldingRanges` - Handle folding range requests
26. `connection.onRequest('textDocument/semanticTokens/full')` - Handle semantic tokens requests
27. `connection.onSignatureHelp` - Handle signature help requests

### Editor Components
#### CodeEditor (`src/components/CodeEditor.tsx`)
1. Editor initialization and worker setup
2. LSP client integration
3. Editor event handlers (content changes, cursor position, etc.)
4. Marker/diagnostic rendering integration
5. Completion triggering and handling
6. Editor theme and font management

#### ProblemsPanel (`src/components/ProblemsPanel.tsx`)
1. Diagnostic data processing and display
2. Error/warning count management
3. Navigation to source locations from panel
4. Diagnostic filtering and sorting

### Store Utilities
#### File Store (`src/store/fileStore.ts`)
1. File creation, reading, updating, deletion
2. Virtual file system synchronization with worker
3. File change notification handling
4. TextDocument synchronization with LSP worker

#### Tab Store (`src/store/tabStore.ts`)
1. Active tab management
2. File tab ordering and tracking
3. Unsaved changes tracking
4. Tab closing and restoration

## Documentation Approach
For each function, create documentation that includes:
1. Function signature and location
2. Detailed description of purpose and behavior
3. Parameter descriptions with types
4. Return value description with types
5. Usage examples where appropriate
6. Related functions and cross-references
7. Any important implementation notes or caveats

## Output Structure
Create documentation files in:
```
docs/functions/
├── lsp-client/
│   ├── constructor.md
│   ├── initialize.md
│   ├── openDocument.md
│   └── ... (other LSP client functions)
├── lsp-worker/
│   ├── validateDocument.md
│   ├── onCompletion.md
│   ├── onHover.md
│   └── ... (other worker functions)
├── editor-components/
│   ├── CodeEditor.md
│   ├── ProblemsPanel.md
│   └── ... (other components)
└── store/
    ├── fileStore.md
    └── tabStore.md
```

## Success Criteria
- [ ] All target functions documented with complete signatures
- [ ] Each documentation file follows consistent format
- [ ] Usage examples provided where beneficial
- [ ] Cross-references between related functions included
- [ ] Documentation reviewed for accuracy and clarity
- [ ] No major functions from target files left undocumented

## Estimated Effort
- LSP Client: ~28 functions × 0.5 hours = 14 hours
- LSP Worker: ~27 functions × 0.5 hours = 13.5 hours
- Editor Components: ~8 functions × 0.3 hours = 2.4 hours
- Store Utilities: ~6 functions × 0.3 hours = 1.8 hours
- Total: ~31.7 hours

## Dependencies
- Phase 6 (Execution Flow Documentation) should be complete for context understanding
- Codebase should be stable with minimal breaking changes during documentation phase

## Timeline
Start: Upon completion of Phase 6
Duration: Estimated 2 weeks part-time
End: When all target functions are documented and reviewed