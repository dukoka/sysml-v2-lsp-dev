---
phase: stdlib-completion
task: 3
total_tasks: 3
status: paused
last_updated: 2026-03-23T04:00:00Z
---

<current_state>
修复已写入 lspClient.ts，但浏览器测试仍显示旧行为（本地 fallback provider 的 StructuredType/SysMLPackage）。
怀疑 Vite worker bundle 缓存未清理，或修复位置不够完整。
</current_state>

<completed_work>

- Task 1: 修复 detectCompletionContextLsp — Done (commit 5fe560e)
- Task 2: 添加调试端点 — Done (commit 5fe560e)
- Task 3 (partial): 浏览器实测诊断
  - stdlib 92 files loaded ✓
  - [debug] index: 1422 type names across 92 files ✓
  - ScalarValue 在工作区符号搜索中找到 ✓
  - 根因已定位：lspClient.getCompletion() 用 result?.items 但 worker 返回 CompletionItem[] 数组
  - 修复已写入：src/workers/lspClient.ts 第178行加了 if (Array.isArray(result)) return result;
  - 但浏览器验证仍失败（仍显示本地 fallback）

</completed_work>

<root_cause_found>

**Bug 位置**: `src/workers/lspClient.ts` `getCompletion()` 方法
**原因**: Worker 的 `connection.onCompletion` 直接返回 `CompletionItem[]` 数组，
         但 lspClient 用 `result?.items` 访问（期望 CompletionList 格式），
         导致 `result?.items === undefined`，始终返回 `[]`。
         Monaco 收到空数组后 fallback 到本地 provider（completion.ts），
         本地 provider 只有硬编码类型如 StructuredType、SysMLPackage，无 stdlib 类型。

**修复**: lspClient.ts getCompletion() 中：
```typescript
// 修复前
return result?.items || [];
// 修复后
if (Array.isArray(result)) return result;
return result?.items || [];
```

</root_cause_found>

<remaining_work>

- 验证修复是否真正生效：
  1. 检查 src/workers/lspClient.ts 第178行是否有 if (Array.isArray(result)) return result;
  2. 清除 Vite 缓存: rm -rf node_modules/.vite (或 npx vite --force)
  3. 重启 dev server: npm run dev
  4. 浏览器测试：在包内输入 "attribute test : Sc" 触发补全，验证 ScalarValue 出现
  5. 如仍失败，检查 worker 是否还有其他 result?.items 格式问题

</remaining_work>

<decisions_made>

- 修复在 lspClient 侧（处理两种 LSP 格式），而非修改 worker 返回格式
- StructuredType/SysMLPackage 来自本地 completion.ts 的 SYSMLV2_TYPES 硬编码数组，非 LSP 索引
- 提供方注册了两次（console 两条 "language registered" 日志），这也是补全项重复的原因

</decisions_made>

<blockers>
Vite worker bundle 可能缓存旧代码，需要清缓存后重测
</blockers>

<next_action>
1. 检查修复是否正确写入 lspClient.ts（grep 确认）
2. 清 Vite 缓存并重启 dev server
3. 浏览器测试补全，验证 ScalarValue 出现
</next_action>
