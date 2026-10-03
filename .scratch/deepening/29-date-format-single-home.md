# 深化㉙：日期格式只有一个家（morning 的 `_date` 改走 `roster.ymd`）

- **来源**：架构扫描候选⑤（`/tmp/opencode/architecture-review-20261003-130435.html`），
  grill 两问全采纳（2026-10-03）
- **范围**：`scripts/morningmusume_members.py` 的 `_date` + 一条缝③ 源码守卫

## 事实（实测）

- `roster.ymd` 是日期格式的家：`fetch_members`（3 处）与 `love_members`（3 处）都走它，
  **只有 morning 的 `_date` 自己造格式串**。
- 既有行为断言钉的是**值**（`1999.10.07` 等），产物守卫只断**形状** ——
  「第二份格式」回归没有任何测试会红（扫描指出的静默点）。

## 决定（grill 2026-10-03）

1. `_date` 内部改调 `roster.ymd(m.group(1), m.group(2), m.group(3))`，删掉重复格式串。
2. **缝③ 源码守卫**：「morning 必须调 `roster.ymd(`、且不许出现 `zfill`」
   （`zfill` 是第二份格式串的指纹）。

## 等价性凭据与变异

- 纯重构：产物 `members.js` 逐字节不变；既有日期断言全绿。
- 变异：**「改回本地格式」对 Python 行为测试存活**（两种实现的值相同 —— 这正是
  为什么行为断言抓不到它）、**对源码守卫被杀**；「`_date` 返回空」被杀。
