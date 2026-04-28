---
phase: A
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/CodeEditor.tsx
autonomous: true
requirements:
  - DIAG-MARK-01

must_haves:
  truths:
    - "LSP 初始化后自动显示语法错误标记"
    - "Problems 面板显示红/绿颜色标记"
    - "用户不需要手动触发 LSP ready 就能显示已有文件语法错误"
  artifacts:
    - path: "src/components/CodeEditor.tsx"
      provides: "LSP 诊断标记显示逻辑"
      contains: "onLspReady.*refreshDiagnostics|applyDiagnostics"
    - path: "src/App.tsx"
      provides: "LSP ready 状态处理"
      contains: "handleLspReady"
  key_links:
    - from: "CodeEditor.tsx line 332"
      to: "applyDiagnostics function"
      via: "callback trigger"
      pattern: "onLspReady.*applyDiagnostics"
    - from: "App.tsx handleLspReady"
      to: "CodeEditor.tsx onLspReady"
      via: "prop callback"
      pattern: "onLspReady=\{handleLspReady\}"
---

<objective>
修复语法诊断标记位置不准确问题

Purpose: LSP 使用 pull 模型，Monaco 需要在 LSP 初始化完成后主动获取诊断标记。当前 LSP ready 后没有触发诊断刷新，导致已打开文件的语法错误不会自动显示。

Output: 修改 CodeEditor.tsx，在 LSP ready 时自动刷新所有打开文档的诊断
</objective>

<execution_context>
@$HOME/.config/opencode/get-shit-done/workflows/execute-plan.md
@$HOME/.config/opencode/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/phases/A-语法校验标记修复/A-CONTEXT.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add diagnostic refresh on LSP ready</name>
  <files>src/components/CodeEditor.tsx</files>
  <read_first>
    - src/components/CodeEditor.tsx (lines 320-350 for onLspReady callback area, lines 169-180 for scheduleDiagnostics function)
    - src/components/CodeEditor.tsx (lines 85-110 for modelsRef and applyDiagnostics)
  </read_first>
  <action>
在 CodeEditor.tsx 的 onLspReady 回调中 (line 332 附近)，当 lspReady 为 true 时，遍历所有已打开的文档并刷新诊断:

1. 找到 onLspReadyRef.current?.(lspReady) 调用位置 (line 332)
2. 在该调用之后添加逻辑:
   - 如果 lspReady === true:
     - 遍历 modelsRef.current 中的所有 URI
     - 对每个 URI 调用 applyDiagnostics(uri, model.getValue(), version)
     - 可以使用 scheduleDiagnostics(uri) 函数批量刷新

3. 具体代码示例:
```typescript
// 在 line 332 之后添加
if (lspReady) {
  // 刷新所有已打开文档的诊断
  for (const [uri, model] of modelsRef.current) {
    const ver = (docVersionRef.current.get(uri) ?? 0) + 1;
    docVersionRef.current.set(uri, ver);
    applyDiagnostics(uri, model.getValue(), ver);
  }
}
```

不要修改其他诊断相关代码。
  </action>
  <verify>
    <automated>grep -n "if.*lspReady" src/components/CodeEditor.tsx | grep -E "modelsRef|applyDiagnostics"</automated>
  </verify>
  <done>LSP ready 后自动刷新所有打开文档的诊断标记</done>
  <acceptance_criteria>
    - [ ] CodeEditor.tsx 包含 `if (lspReady)` 代码块
    - [ ] 该代码块遍历 modelsRef.current
    - [ ] 对每个 model 调用 applyDiagnostics 或 scheduleDiagnostics
    - [ ] 编译通过 (npm run build 或 tsc 无错误)
  </acceptance_criteria>
</task>

<task type="auto">
  <name>Task 2: Verify marker display works</name>
  <files>src/components/CodeEditor.tsx</files>
  <read_first>
    - src/components/CodeEditor.tsx (lines 115-130 for setModelMarkers usage)
  </read_first>
  <action>
验证诊断标记显示逻辑:

1. 确认 applyDiagnostics 函数使用 monaco.editor.setModelMarkers 显示标记
2. 确认标记 severity 映射正确:
   - severity === 1 或 8 → Error (红色)
   - 其他 → Warning (黄色)
3. 确认标记范围使用正确的行列号转换 (line + 1, character + 1)

这段逻辑已在现有代码中，需要确认修改后不会被破坏。
  </action>
  <verify>
    <automated>grep -n "setModelMarkers.*sysmlv2-lsp" src/components/CodeEditor.tsx</automated>
  </verify>
  <done>诊断标记正确显示为红色错误和黄色警告</done>
  <acceptance_criteria>
    - [ ] setModelMarkers 调用存在且正确
    - [ ] Error 和 Warning 级别区分正确
  </acceptance_criteria>
</task>

</tasks>

<verification>
1. 编译检查: npm run build 无错误
2. 手动测试: 
   - 打开一个有语法错误的 .sysml 文件
   - 等待 LSP 初始化完成
   - 确认红色波浪线出现在错误位置
   - 确认 Problems 面板显示错误
</verification>

<success_criteria>
- LSP 初始化后，已打开文件的语法错误自动显示标记
- 标记位置准确 (在错误的字符位置)
- Problems 面板显示对应错误
</success_criteria>

<output>
After completion, create `.planning/phases/A-语法校验标记修复/A-01-SUMMARY.md`
</output>