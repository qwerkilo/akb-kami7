# 2026-11-02 · 接触印相与测试矩阵两轴审查

## 第一百一十二轮

- **本次基点**：`3f5800e`
- **审查范围**：`git diff 3f5800e...HEAD`（10 个提交：接触印相样式、测试矩阵、检查点）。
- **Spec**：`docs/adr/0030-poster-contact-sheet.md`、`.scratch/test-matrix/spec.md`、检查点 110/111。
- **结论**：
  - Standards：3 条硬性（poster 注释数字/蜡笔圈颜色过期；`test/poster.test.js:685` 标题称五样式却只跑 a–d；AGENTS 的「跟随皮肤」与 ADR-0030 暗房固定色矛盾）+ 6 条判断类（contact 卡双重描边、`posterPx` 重复三份、五段三元分派、`contactCard` 11 个位置参数、内联颜色字面量、检查点基点跳段）。
  - Spec：7 条（AGENTS 过度概括；矩阵权限行自相矛盾；token 测试漏 e；占位测试标题过期；6×7「姓名更大」未兑现（实测 11px 与 5×8 相同）；注释与 ADR 漂移；`cardStroke=0` 仍画 1px，测试标题不成立）。无 scope creep。
- **处置**：报告后按硬性项修复（见补记）。
- **下次基点**：`a1dace3`（本批修复前的审查基点）

## 补记：修复

- 注释改为 6×7 / 品红蜡笔圈；AGENTS 的「跟随皮肤」限定为暗房底色固定。
- `contactCard` 去掉内层重复描边，描边走 `panel` 的 `T.cardStroke`；`cardStroke=0` 不再画 1px（先红后绿）。
- 接触印相 40 档姓名 11px→12px（先红后绿：新测试断言 ≥12px）。
- `test/poster.test.js` 的占位令牌测试改为 `poster.styles`（覆盖 e），标题与「五样式」一致。
- `.scratch/test-matrix/spec.md` 权限行改为已覆盖。
- 验证：`check` 0；`poster` 28；`e2e` 288/288；`e2e:all` 5/5（288/54/46/73/433）。
