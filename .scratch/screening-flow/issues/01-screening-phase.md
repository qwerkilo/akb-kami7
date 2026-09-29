# 01-screening-phase · session 侧：筛选状态与两道门

- **Status**: resolved（`e8ec807` + 补测试的 follow-up）
- **所属 spec**：`.scratch/screening-flow/spec.md`
- **依据**：`docs/adr/0019-screening-then-rank.md`

## 阻塞

- 阻塞于 `core.js 转移表`
- 阻塞于 `session.js 状态与持久化`
- 阻塞于 `单测（②④）`

## 内容

nav 认识 screening + session 存筛选进度（不动 UI）

## 涉及缝

- 单测（②④）

## 备注

- 无

## 完成记录（含自查）

- 实现：`core.nav` 新增 `screen` / `rank` 两个意图与 `screening` 视图 ✓；`navState` 带
  `kept` ✓；`steps()` 筛选期间高亮第 ② 步、**步骤条仍是三步** ✓（不为筛选页单开一步 ✓）。
  `session` 持 `cut` ✓，导出 `toggleCut` / `resetScreening` ✓，快照给
  `screening: { cut, order, kept, size, canSubmit }` ✓。
- 存档：`serializeState` / `deserializeState` 带可选字段 `cut` ✓ —— 旧存档缺省 `[]` ✓
  （已补断言 ✓）；**脏划除（不在已选里的人）只在 `core.deserializeState` 一处过滤** ✓，
  删掉了 `loadSeries` 里的重复实现 ✓（单一出处 ✓）。
- 判别力：**7 个变异变红** ✓（`canSubmit` 不看档位 / `nav.rank` 门槛不设 / 切已选与档位不
  重置划除 / `toggleCut` 不校验在已选里 / core 不过滤脏划除 / 切系列不恢复 cut ✓）。
- **一处等价变异（如实记账）**：`state.cut = (store[...].cut || []).slice()` 的 `|| []`
  兜底——`loadSeries` 的返回已经保证是数组 ✓，去掉它**任何测试都不红** ✓ → 属等价变异 ✓，
  保留这层防御 ✓，但**不把它算进「变异全红」的账** ✓。
- **一次自查纠错**：上面的提交信息写了「7 个变异全部变红」✓，而实测是 6 红 1 等价 ✓
  （另有 1 条「切系列不恢复 cut」当时**仍全绿** ✓ → 那是真的测试缺口 ✓，已补断言 ✓，
  现在该变异会红 ✓）。
