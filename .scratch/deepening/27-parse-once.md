# 深化㉗：wikitext 只解析一次（装配收已解析的成员）

- **来源**：架构扫描候选③（`/tmp/opencode/architecture-review-20261003-130435.html`），
  grill 三问全采纳（2026-10-03）
- **范围**：`scripts/morningmusume_members.py` 的 `load` / `_assemble` / `build_members`
  / `build_members_from_wiki` + 测试

## 事实（实测）

- `load()` 为打印人数调一次 `parse_wiki_members`，`_assemble` 再调一次 —— 探针实测
  11 团 → **22 次解析**。
- `build_members` 的调用点：`load` + 测试 3 处（都传原始 wikitext）；
  `build_members_from_wiki` 只有测试在用。

## 决定（grill 2026-10-03）

1. **接口方向 A**：`build_members(official, parsed)` 收「已解析的成员」（`{团: [记录]}`）；
   解析收进 `parse_all(pages)`；`load` 只解析一次、**从解析结果打印**（语义不变）；
   `build_members_from_wiki(pages)` 保留为「解析 + 装配」的便利入口（测试用）。
2. **测试直接走 `mm.parse_all`**（3 处传 wikitext 的调用改成 `build_members(official, mm.parse_all({...}))`）
   —— 新接口本身要被测到。
3. **计数测试承重**：`mock.patch` 包住 `parse_wiki_members`，跑 `load(photo=False)` 后
   断言**每团恰好一次**（11 次）—— 否则「解析两次」对任何断言都不可见。

## 等价性凭据

纯重构：产物 `members.js` 逐字节不变；打印的人数与顺序不变；全部测试绿。
