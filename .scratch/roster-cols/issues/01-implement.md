# 工单 01：卡片大小档位（CSS 变量 + seg + PREF_KEYS.cols + E2E）

- **Status**: resolved
- **Blocked by**: 无

## 实现（按 TDD：先红）

1. `core.js` 的 `PREF_KEYS` 加 `cols: "akb:cols"`。
2. `style.css`：`--card-min` 变量 + `html[data-cols]` 两档覆盖；`:605` 用变量。
3. `index.html`：`.seg-cols` 三个按钮。
4. `i18n.js`：四个键 × 三语。
5. `app.js`：`setCols` + boot 应用 + 点击接线。
6. E2E：主套件桌面块 2 条 check（切「大」→ 卡宽变；刷新保持）→ expect 249。

## 判据

- `npm run check` exit=0；`npm run e2e:all` 5/5；变异（`setCols` 不写 `data-cols`）→ 红。

## 结果

- 全部落地：`PREF_KEYS.cols`（`akb:cols`）+ `--card-min` 变量（大/中/小 = 120/92/72，
  默认不留属性）+ `.seg-cols`（「更多」浮层）+ 三语四键 + app.js `setCols/readCols/paintCols`。
- E2E：桌面块 2 条（切「大」→ 卡宽 99.33 → 130.56；刷新保持）—— **红（248/249）→ 绿（249/249）**。
- 变异 1/1 被杀（`readCols` 恒返 std → 刷新保持那条红）。
- **踩到的坑（值得记）**：`setCols` 里的 `try { localStorage... } catch {}` 把我写的
  `core.PREF_KEYS`（app.js 里叫 **`CORE`**，第 4 行 `const CORE = window.AKB_CORE`）
  吞成了静默 no-op —— 点击后 `dataset` 变了、存储没写。**是 E2E 的「刷新后保持」抓住的**，
  不是单测（app.js 没有单测缝）。
- 棘轮订正：⑧/⑨ 两个检查点写的「棘轮无新增」不实 —— `build_bio` 因血型回退升到 11、
  `load_fetcher.fetch` 12→13；本批拆掉（`_fill_from_wiki` / `wiki`+`site` 两个内层函数），
  现为 1 处（低于基线 2）。
