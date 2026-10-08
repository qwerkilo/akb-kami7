# Spec：名册卡片大小档位（「一排几个头像」可自定义）

- Status: ready-for-agent
- 来源：用户报告（2026-10-08）「PC 版不能选择/自定义一排有几个头像」—— 核实为**功能请求**
  （全仓无该控件）。grill 五问 + 验收一问全部采纳推荐。
- 注：同报告的①「桌面语言切换不可达」已修复（检查点第七十三轮，`6c75f67`）。

## 决定（grill 2026-10-08）

| #   | 决定                                                                                 |
| --- | ------------------------------------------------------------------------------------ |
| Q1  | **全宽度可用**（一个控件，手机/桌面都能改 —— 不做「按宽度分叉的可见性」）            |
| Q2  | 档位语义 = **卡片大小**（大/中/小），不是固定列数 —— 与 `auto-fill` 一致，列数是结果 |
| Q3  | 三档，**默认 = 现状**（中 = 92px），现有观感不变                                     |
| Q4  | 控件 = 「更多」浮层里第三个 seg（`.seg-cols`，单选），与语言/皮肤并列                |
| Q5  | 持久化 = `core.PREF_KEYS.cols`（`akb:cols`），走**皮肤同一条路**；不进 `session.js`  |
| Q6  | 验收：E2E（切档真的变 + 刷新保持）+ 变异 + 三语文案 + 核刻度/栅格守卫                |

## 设计

- `style.css`：`:605` 的 `minmax(92px, 1fr)` 改为 `minmax(var(--card-min, 92px), 1fr)`；
  `html[data-cols="large"] { --card-min: 120px }` / `html[data-cols="compact"] { --card-min: 72px }`
  （默认无属性 = 92px = 中档）。与 `data-skin` 同一模式。
- `index.html`：「更多」浮层加 `.seg-cols`（`data-cols="large|std|compact"` 三个按钮，
  `role="radio"` + `aria-checked`，与 `.seg-lang`/`.seg-skin` 同构）。
- `app.js`：`setCols(name)` —— 经 `PREF_KEYS.cols` 读写（守卫禁止字面量）、写
  `document.documentElement.dataset.cols`、更新 `aria-checked`；boot 时应用已存值。
  **不需要**首屏内联脚本（cols 只影响名册栅格，名册在 boot 后渲染，不存在「闪色」问题）。
- `i18n.js`：`cols_label` / `cols_large` / `cols_std` / `cols_compact` 三语各一份。
- E2E：主套件桌面块里加 2 条（切到「大」→ 卡宽真的变大；刷新后保持）→ expect 247 → 249。

## 验收（可证伪）

1. 切档后 `.card` 计算宽度/列数真的变（E2E 计算样式，不读属性）。
2. 刷新后档位保持（走 `akb:cols`）。
3. 三语文案齐全（`test/i18n.test.js` 绿）。
4. 变异：`setCols` 不写 `data-cols` → E2E 红。
5. `npm run check` exit=0；`npm run e2e:all` 5/5（247→249 等）。
6. `style-artifact` 的栅格/刻度守卫若钉了 `92px` → 更新为 token（核过：目前只钉页头
   与按钮的 padding/gap，**未**钉卡栅格）。
