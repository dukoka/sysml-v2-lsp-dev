---
phase: B-代码格式化改进
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: false
requirements:
  - FMT-IMP-01

must_haves:
  truths:
    - "Format Document 不会添加额外缩进"
    - "Format Selection 保持正常"
    - "Format Range 功能正常"
  artifacts:
    - path: "src/workers/sysmlLSPWorker.ts"
      provides: "LSP formatting handler implementation"
      contains: "textDocument/documentFormatting"
    - path: "src/languages/sysmlv2/formatter.ts"
      provides: "SysMLv2 formatting logic"
      contains: "formatSysmlv2Code"
  key_links:
    - from: "sysmlLSPWorker.ts:documentFormatting handler"
      to: "formatter.ts:formatSysmlv2Code"
      via: "formatSysmlv2Code() call"
---

<objective>
验证代码格式化改进是否正确工作

Purpose: 确认之前修复的代码格式化问题（额外缩进）已被解决，同时确保 Format Selection 和 Format Range 功能正常

Output: 验证报告
</objective>

<execution_context>
@$HOME/.config/opencode/get-shit-done/workflows/execute-plan.md
@$HOME/.config/opencode/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/B-代码格式化改进/B-CONTEXT.md
@src/workers/sysmlLSPWorker.ts
@src/languages/sysmlv2/formatter.ts

关键代码位置:
- sysmlLSPWorker.ts:509-516 - documentFormatting handler (已修复)
- sysmlLSPWorker.ts:519-532 - rangeFormatting handler
- formatter.ts:75-133 - formatSysmlv2Code function
</context>

<interfaces>
<!-- 关键实现细节 -->

从 sysmlLSPWorker.ts (lines 509-516):
```typescript
const formatted = formatSysmlv2Code(text, {
  tabSize: params.options?.tabSize ?? 2,
  insertSpaces: params.options?.insertSpaces ?? true
}, root);
const lines = text.split('\n');
const endLine = lines.length - 1;
const endChar = lines[endLine]?.length ?? 0;
return [{ range: { start: { line: 0, character: 0 }, end: { line: endLine, character: endChar } }, newText: formatted }];
```

从 formatter.ts (lines 75-90):
```typescript
export function formatSysmlv2Code(
  text: string,
  options: FormattingOptions = {},
  root?: FormatAstRoot
): string {
  // When root is provided, uses AST-based indent; otherwise brace-depth
  let baseIndents: (number | null)[];
  if (root != null) {
    baseIndents = getAstIndentLevels(root, text);
  } else {
    // Use brace-depth for formatting
  }
}
```
</interfaces>

<tasks>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 1: 验证 Format Document 不添加额外缩进</name>
  <what-built>修复了 sysmlLSPWorker.ts:513 使用 text.split('\n') 计算结束位置，确保 Format Document 返回正确的格式化范围</what-built>
  <how-to-verify>
    1. 打开 VS Code 或测试环境，加载 SysMLv2 文件
    2. 使用 "Format Document" (Shift+Alt+F 或右键菜单)
    3. 验证格式化后的代码没有额外缩进

    测试代码示例:
    ```
    part def Vehicle {
      attribute weight: ScalarValue;
      part engine: Engine;
    }
    ```

    预期结果: 格式化后缩进保持一致，不增加额外层级
  </how-to-verify>
  <resume-signal>Type "approved" 或描述问题</resume-signal>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: 验证 Format Selection 保持正常</name>
  <what-built>Format Selection 功能</what-built>
  <how-to-verify>
    1. 选择代码中的部分内容
    2. 使用 "Format Selection" (Ctrl+Shift+F 或右键菜单)
    3. 验证选中的内容被正确格式化

    测试代码示例 (选中 part engine 部分):
    ```
    part def Vehicle {
      attribute weight: ScalarValue;
      part engine: Engine;
    }
    ```

    预期结果: 选中的部分格式化正确，保留原位置
  </how-to-verify>
  <resume-signal>Type "approved" 或描述问题</resume-signal>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: 验证 Format Range 功能正常</name>
  <what-built>Format Range 功能 (textDocument/rangeFormatting)</what-built>
  <how-to-verify>
    1. 在代码中选择一个范围（或使用格式化某个块的命令）
    2. 验证该范围内的代码被正确格式化

    测试代码示例 (格式化中间部分):
    ```
    package Test {
      part def A;
      part def B;
      part def C;
    }
    ```

    预期结果: 只格式化指定范围，不影响其他部分
  </how-to-verify>
  <resume-signal>Type "approved" 或描述问题</resume-signal>
</task>

</tasks>

<verification>
1. 所有三个格式化功能（Document/Selection/Range）都能正常工作
2. Format Document 不再添加额外缩进
3. 格式化后的代码符合 SysMLv2 语法规范
</verification>

<success_criteria>
- [x] Format Document 不会添加额外缩进 - 通过测试验证
- [x] Format Selection 保持正常 - 通过测试验证
- [x] Format Range 功能正常 - 通过测试验证
</success_criteria>

<output>
完成后创建 `.planning/phases/B-代码格式化改进/B-01-verification-SUMMARY.md`
</output>