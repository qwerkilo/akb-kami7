# 深化 ⑩：名册装配契约（报告候选 ⑥）

**Status:** resolved（2026-09-28）

## 背景

架构扫描（报告候选 ⑥）：`sections` 数组形状是拼接处（`fetch_members.py:589`）的隐性契约，却没有单一所有者——`build_sections` 的**组内排序**（`(status != "current", kana or name)`）与**成员投影**在两个生产器里逐字重写（fetch 版含 `leave/note/extras`，love 版只含 `bio`），消费端（`app.js` 摊平、`core.js` 字幕）隐式依赖字段。历史事故带全在这里：extras 去重回归、SDN48 脏数据、等爱投影修补。

## 做了什么

1. 新增 `scripts/roster.py`（唯一契约）：
   - `BASE_KEYS = ("id","name","kana","nick","status","end","img")`；
   - `sort_members(members)`：现役优先 → 假名（空则姓名），原地排序；
   - `project(member, optional=("bio",))`：基础字段恒在（缺值 None），可选字段仅真值带上；
   - `section(group, series, label, members, optional=…)`：产出 `{group, series, label, members}`，不改动入参。
2. `fetch_members.build_sections` 与 `love_members.build_sections` 改为调用 `roster`；删除各自的 `project_member` / `project`。
3. `scripts/test_roster.py`：5 例（排序、投影键序/缺值为 None、可选仅真值、分段形状与排序、不改入参）；`test_fetch_members.py` 的原投影测试改走 `build_sections`（行为层）。

## 边界（有意保留）

- **分组逻辑各留一份**：按「团体 × 期生」建 section_key（含 `note_of` 回填、`GROUP_ORDER.index`）只在 48pedia 侧存在，等爱是「每团一段」——这不是重复，是各自数据模型。
- `GROUP_ORDER` 两个模块各有一份（48G+坂道十团 vs 等爱三团），域不同，不合并。

## 验证

- `npm test`：JS 97 + Python **82**（+5）全绿——含既有管线测试与产物不变量测试（行为不变的证据）。
- **真实数据字节级验证**：`AKB_PROXY=http://127.0.0.1:7890 python3 scripts/fetch_members.py --no-dl` → 1375 人 / 114 段 / 1375 图，**`members.js` 与 `simplified.js` 字节不变**（`git diff` 为空）——重构未改一个字节的产物。
