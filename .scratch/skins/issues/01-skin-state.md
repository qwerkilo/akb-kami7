# 01 皮肤状态（session）

**Status:** resolved
**Blocked by:** 无

## What to build

`session.js` 新增皮肤状态：`skin`（默认 `"classic"`）、`setSkin(next)`（校验 `classic|sticker`、持久化到 `akb:skin`、同值 no-op）、`snapshot().skin`；不涉及 DOM。

## Acceptance

- [x] `test/session.test.js` 覆盖：默认 classic、切换与持久化（重建实例后保持）、非法值拒绝、同值 no-op 返回 false、快照暴露
- [x] `npm test` 全绿（JS 80 + Python 77）
- [x] 无用户可见变化（app 尚未消费）

## Comments

2026-09-27：session.skin 落地（默认 classic、白名单校验、`akb:skin` 持久化、同值 false）；测试 2 项 + 快照形状更新；`npm test` JS 83 + Python 77。
