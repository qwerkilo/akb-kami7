# 06: 端到端验收 + 文档

**What to build:** v3 四项功能的端到端验收与文档同步：清空、金字塔 32 海报、简介 sheet、等爱系列全流程；两轴代码审查与检查点。

**Blocked by:** 01、02、03、05

**Status:** resolved

- [x] E2E 全项（清空确认 / 简介开合与字段 / 三系列切换 / 32 金字塔海报无 undefined）无 JS 报错
- [x] `npm test` 全绿（JS/Python 新计数）；`--no-dl` 幂等
- [x] AGENTS / qa-baseline / 检查点同步
- [x] 两轴（Standards/Spec）代码审查完成

## Comments

## Comments

2026-09-27：E2E 扩到 **55 项**（新增等爱：品牌推し 7、三团 12/12/13、默认标题、展开卡片、简介字段、完成对决生成海报、切回 48g 隔离），全绿；`npm test` JS 69 + Python 71；覆盖：`fetch_members.py` 96%、`love_members.py` 87%、`core.js` 行 99.78%。两轴审查（Standards + Spec）实缺 3 项已修（等爱失败快速中止、无链接姓名行取假名、结果 ⓘ 定位/键盘），判断项 8 项已取舍记录；ADR-0010 与实现对齐。文档：AGENTS.md 数据管线与规模更新；qa-baseline 追加 v3 复检；检查点第六轮。（原型分支 `prototype/ui-v3-pyramid` d6da539、`prototype/ui-v3-profile` 764d029 留档。）
