# 浏览器测试计划 — 全功能 E2E 覆盖

> 制定日期：2026-03-23
> 工具：Playwright（通过 mcp__plugin_playwright）
> 目标：全功能浏览器端验证，覆盖所有用户可见行为
> 开发服务器：`npm run dev` → http://localhost:5173

---

## 执行前准备

```bash
npm run dev   # 启动开发服务器，保持运行
```

每个测试 Section 独立，可单独执行。
截图保存路径：`test-screenshots/`

---

## Section 1：页面加载与初始化

### 1.1 基础渲染
- [ ] 打开 http://localhost:5173，页面无白屏/崩溃
- [ ] 标题栏显示 "SysMLv2 Editor"
- [ ] Monaco 编辑器渲染完成（有行号、代码内容）
- [ ] 左侧文件面板显示 Files 区域
- [ ] 默认打开 Vehicle.sysml，编辑器有内容
- [ ] 状态栏底部显示 "SYSMLV2"
- [ ] 状态栏显示 "LSP"（LSP 连接成功）
- [ ] 状态栏显示 "No problems"（初始无错误）

### 1.2 stdlib 加载
- [ ] 控制台日志包含 "SysMLv2 stdlib: 92 files loaded"
- [ ] 控制台日志包含 "1422 type names"（或更多）
- [ ] 控制台无 ReferenceError（worker 无 TDZ 错误）
- [ ] 加载后 LSP 状态变为绿色/正常

### 1.3 主题
- [ ] 默认主题为 "SysMLv2 Dark"（下拉框显示）
- [ ] 切换到 "Light"，编辑器背景变白
- [ ] 切换到 "Dark"，编辑器背景变黑
- [ ] 切换回 "SysMLv2 Dark"，恢复自定义主题
- [ ] 语法高亮颜色在 SysMLv2 Dark 主题中正确显示

---

## Section 2：文件管理

### 2.1 文件切换
- [ ] 文件列表显示：Vehicle.sysml、Requirements.sysml、Actions.sysml
- [ ] 点击 Requirements.sysml → 编辑器内容切换
- [ ] 点击 Actions.sysml → 编辑器内容切换
- [ ] 点击 Vehicle.sysml → 切换回来
- [ ] Tab 栏显示当前文件名
- [ ] 切换文件后 Outline 随之更新

### 2.2 新建文件
- [ ] 点击 "+" 按钮 → 弹出新文件输入框或直接新建
- [ ] 输入文件名（如 NewTest.sysml）→ 文件出现在列表
- [ ] 新文件在编辑器中打开，内容为空
- [ ] Tab 栏显示新文件名

### 2.3 关闭文件
- [ ] Tab 上的 × 按钮关闭当前文件
- [ ] 关闭后切换到另一 Tab
- [ ] 关闭最后一个 Tab 后编辑器空白或显示欢迎页

---

## Section 3：Outline 面板

### 3.1 Vehicle.sysml Outline
- [ ] 显示 VehicleExample（package 图标）
- [ ] 展开后显示 Vehicle（part 图标）
- [ ] Vehicle 下有 Engine、Wheel（part）
- [ ] Engine 下有 horsepower、displacement（attribute）
- [ ] Wheel 下有 diameter、pressure（attribute）
- [ ] FuelPort、ExhaustPort 显示 port 图标
- [ ] FuelConnection 显示 connection 图标

### 3.2 Outline 交互
- [ ] 点击 Outline 条目 → 编辑器跳转到对应行
- [ ] 跳转后光标在正确位置
- [ ] 展开/折叠 Outline 节点（有子项的）

### 3.3 Requirements.sysml Outline
- [ ] 切换到 Requirements.sysml
- [ ] Outline 显示对应符号（requirement 等）

---

## Section 4：代码补全 — type 上下文（冒号后）

> 在 Vehicle.sysml 末尾测试

### 4.1 空前缀触发
- [ ] 新行输入 `part x : `，Ctrl+Space 触发补全
- [ ] 补全列表非空，包含 Integer、Real、String 等
- [ ] 补全列表包含 stdlib 类型（如 StructuredType）
- [ ] detail 标注显示 "type"

### 4.2 前缀过滤
- [ ] 输入 `part x : In`，Ctrl+Space → 只显示 In 开头的类型（Integer、Interface 等）
- [ ] 不出现非 In 开头的类型
- [ ] 输入 `part x : Sc` → 只显示 Sc 开头类型（StructuredType、ScalarValue 等）
- [ ] 输入 `part x : Re` → 只显示 Re 开头类型（Real、Relation 等）
- [ ] 输入 `part x : Bo` → 只显示 Boolean 等
- [ ] 输入 `part x : xyz123`（不存在的前缀）→ 补全列表为空或无相关项

### 4.3 选中后无光标跳动
- [ ] 输入 `part x : In`，选中 Integer → 结果是 `part x : Integer`（无 `InInteger`）
- [ ] 光标位于 Integer 末尾（Col 正确）
- [ ] 输入 `part x : Sc`，选中 StructuredType → 结果正确替换
- [ ] 输入 `attribute y : Re`，选中 Real → 无前缀残留

### 4.4 多种关键字的 type 上下文
- [ ] `port p : |` 触发 type 补全
- [ ] `attribute a : |` 触发 type 补全
- [ ] `connection c : |` 触发 type 补全
- [ ] `item i : |` 触发 type 补全

---

## Section 5：代码补全 — general 上下文（行首/顶层）

### 5.1 关键字补全
- [ ] 行首 Ctrl+Space → 显示 part、port、action、state、connection 等关键字
- [ ] 显示 package、requirement、constraint、calc 等
- [ ] 补全项 kind 为 Keyword

### 5.2 Snippet 补全
- [ ] `pac` → 显示 package（含 package snippet）
- [ ] `req` → 显示 requirement snippet
- [ ] `enu` → 显示 enum snippet
- [ ] `att` → 显示 attribute snippet
- [ ] 选中 enum snippet → 展开为 `enum Name { value1; value2; }`，光标在 Name 处

### 5.3 前缀过滤（general 上下文）
- [ ] `por` → 只显示 port 开头的项
- [ ] `act` → 只显示 action 开头的项
- [ ] `sta` → 只显示 state 开头的项
- [ ] 无关前缀不出现

---

## Section 6：代码补全 — definitionBody 上下文（{ } 内）

- [ ] 在 part def 内空行触发补全 → 显示 attribute、part、port 等成员关键字
- [ ] 同时显示类型名（可作为 specialization）
- [ ] `att` 在 body 内 → attribute 关键字出现
- [ ] `end` 在 body 内 → end 关键字出现
- [ ] 不显示顶层才有意义的关键字（如 package）

---

## Section 7：代码补全 — member 上下文（点后）

- [ ] 输入 `vehicleInstance.` → 显示成员补全（ownedElement、member 等）
- [ ] 显示内置函数（如 size、isKindOf 等）
- [ ] kind 为 Function 或 Property

---

## Section 8：诊断（Problems）

### 8.1 合法代码无错误
- [ ] 初始 Vehicle.sysml → Problems 面板显示 "No problems"
- [ ] 状态栏 error/warning 计数为 0

### 8.2 写入错误触发诊断
- [ ] 在文件末尾写 `part broken {`（未闭合）→ 出现红色波浪线
- [ ] Problems 面板显示错误条目
- [ ] 状态栏 error 计数 ≥ 1
- [ ] 点击 Problems 条目 → 跳转到对应行

### 8.3 修复后清除诊断
- [ ] 补全 `}` 闭合花括号 → 错误消失
- [ ] Problems 面板恢复 "No problems"

### 8.4 警告级别诊断
- [ ] 故意使用未定义类型（如 `part x : NonExistentType;`）→ 出现警告（橙色）
- [ ] warning 计数 ≥ 1

---

## Section 9：Hover 提示

- [ ] hover 到 `Vehicle`（part def 名称）→ 显示 tooltip 含 "part def Vehicle"
- [ ] hover 到 `Engine`（usage）→ 显示类型信息
- [ ] hover 到 `Integer`（类型引用）→ 显示类型定义信息
- [ ] hover 到注释 → 无 tooltip 或忽略
- [ ] hover 到空白 → 无 tooltip
- [ ] tooltip 文本格式正确（有签名，非空白）

---

## Section 10：跳转到定义（Go to Definition）

- [ ] 在 `Engine` usage 处 F12 / 右键 Go to Definition → 跳到 `part def Engine` 行
- [ ] 在 `: FuelPort` 处跳转 → 跳到 `port def FuelPort` 行
- [ ] 光标落在正确的 def 名称上
- [ ] 跳转后可 Alt+← 返回
- [ ] 跳转到不存在的引用 → 无操作或提示

---

## Section 11：查找引用（Find References）

- [ ] 右键 FuelPort → Find All References → 显示引用列表
- [ ] 引用列表包含所有 `: FuelPort` 出现位置
- [ ] 点击引用条目 → 跳转到对应行

---

## Section 12：重命名（Rename）

- [ ] 选中 `Engine`，F2 → 弹出重命名输入框
- [ ] 输入新名 `Motor` → 所有 Engine 引用同步更新
- [ ] Undo（Ctrl+Z）→ 恢复原名

---

## Section 13：代码折叠

- [ ] package VehicleExample 左侧有折叠箭头
- [ ] 点击折叠箭头 → package 内容收起
- [ ] 再点击 → 展开
- [ ] part def Vehicle 可独立折叠
- [ ] 嵌套折叠（vehicle 折叠后内部 engine 不显示）

---

## Section 14：格式化（Format Document）

- [ ] 故意破坏缩进（多余空格/错误缩进）
- [ ] Shift+Alt+F 或右键 Format Document → 代码格式化
- [ ] 格式化后缩进正确（统一 4 空格或 2 空格）
- [ ] 格式化后无额外空行
- [ ] 格式化是幂等的（再次格式化无变化）

---

## Section 15：多文件联动

### 15.1 跨文件引用
- [ ] 在 NewFile.sysml 中写 `import Vehicle::*;`
- [ ] 写 `part x : Vehicle;` → 补全能识别 Vehicle（来自另一文件）
- [ ] 跳转到定义 → 跳转到 Vehicle.sysml 中的 part def

### 15.2 跨文件诊断
- [ ] 修改 Vehicle.sysml 中的类型名（如改 Engine → EngineNew）
- [ ] Actions.sysml 中引用 Engine 的地方出现错误提示

---

## Section 16：语义 Token（语法高亮验证）

- [ ] `part` 关键字显示为关键字颜色（紫色/蓝色）
- [ ] `def` 关键字颜色正确
- [ ] `Vehicle`（part def 名）显示为类名颜色
- [ ] `Integer`（类型引用）显示为类型颜色
- [ ] `horsepower`（attribute 名）显示为变量颜色
- [ ] 注释（// 和 /* */）显示为注释颜色
- [ ] 字符串 literal 显示为字符串颜色

---

## Section 17：Inlay Hints

- [ ] attribute 无显式类型时显示推断类型 hint（如 `: Integer`）
- [ ] hint 位于名称末尾，颜色较淡（灰色）
- [ ] 有显式类型时不显示重复 hint
- [ ] 设置关闭 inlay hints → hints 消失（如有此配置）

---

## Section 18：签名帮助（Signature Help）

- [ ] 在函数调用 `(` 后触发签名提示
- [ ] 参数列表高亮当前参数
- [ ] `,` 后切换高亮到下一个参数

---

## Section 19：文档高亮（Document Highlight）

- [ ] 点击 `Engine`（part def 名）→ 文件中所有 Engine 出现处高亮
- [ ] 点击其他地方 → 高亮消失

---

## Section 20：边界与压力测试

### 20.1 大文件性能
- [ ] 粘贴 500 行 SysML 代码 → 编辑器不卡顿
- [ ] 补全在 500 行文件中响应时间 < 2 秒
- [ ] 诊断在 500 行文件中完成时间 < 3 秒

### 20.2 快速连续输入
- [ ] 快速输入 20 个字符 → 补全不乱序
- [ ] 补全列表随输入实时更新
- [ ] 删除字符后补全列表正确刷新

### 20.3 特殊字符
- [ ] 输入 Unicode 标识符（如中文名称）→ 不崩溃
- [ ] 输入超长标识符（100 字符）→ 不崩溃
- [ ] 输入只有空格的行 → 补全可触发

### 20.4 Undo/Redo
- [ ] 修改代码后 Ctrl+Z → 还原
- [ ] Ctrl+Y / Ctrl+Shift+Z → 重做
- [ ] 多步 Undo → 逐步还原

---

## 执行脚本模板

每个 Section 开始前：
```
截图保存为 test-screenshots/sXX-起始.png
执行测试步骤
截图保存为 test-screenshots/sXX-结果.png
```

通过标准：
- ✅ 行为符合预期
- ❌ 行为异常，记录截图+描述
- ⚠️ 部分符合，有已知限制

---

## 已知遗留问题（不计入失败）

1. 补全列表每项出现两次（Monaco 内置 + LSP 重复）
2. `part def` snippet（带空格 label）在 Monaco 客户端过滤中不可见
3. 控制台有 1 个历史累积的 TDZ 错误（已修复，但 Playwright session 中仍显示）
