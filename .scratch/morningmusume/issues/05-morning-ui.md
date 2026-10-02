# 05 · 站里接线：core.js 第 4 分支 + i18n 三语 + 第 4 个 tab

- **Status**: ready-for-agent
- **Blocked by**: 04
- **所属 spec**：`.scratch/morningmusume/spec.md`
- **缝**：②（`core.js` 纯逻辑）/ ⑥（i18n）/ ③（CSS 与产物不变式）/ ⑦（E2E）

## 内容

1. **`core.js` 的 `names()`**（现 535 行）加第 4 分支：现在是
   `saka = series === "sakamichi"` / `love = series === "love"` 两个布尔，
   加第三个会让嵌套三元**再深一层** —— 判据是 CCN > 10 的棘轮，所以建议改成
   **查表**（`{48g: {...}, sakamichi: {...}, love: {...}, morning: {...}}`）而不是
   堆第四个三元。**这是 grill 没定的实现细节，按棘轮的要求选。**
2. **7 档品牌名只有按系列那一个分支要改**：16 档（选拔组）与 40 档（圈内）是四个
   系列共用的，**别动**。
3. **i18n 三语各 4 个键**：`series_morning` / `series_morning_short` /
   `title_prefix_morning` / `brand_7modeshi`。漏一种语言 `test/i18n.test.js`
   会红（它还要求 ja 与 zh 同集合）。
   - zh：早安少女家族 / 早安 / 我的早安少女家族 / 推し7
   - en：Morning Musume / **MM** / My Morning Musume / Modeshi 7
   - ja：モーニング娘。/ モー娘 / 私のモーニング娘。/ 推し7
4. **`index.html` 的第 4 个 tab**（现三个是硬编码的 button，`data-series`）。
   注意 `AGENTS.md` 记着一条：**系列按钮的文案由 `app.js` 的 `applyStatic` 每次用
   `textContent` 覆写**，所以 `index.html` 里写的子元素会被抹掉 —— 短标签必须来自
   `core.names()` 的 `seriesShort`。
5. **`test/i18n.test.js` 的系列枚举**若写死了三个系列，要加第四个。

## 版式：已实测的结论（别再自己推）

390 / 414 / 560px × zh/en/ja × 短/全名共 **18 个状态**，注入第四个 tab 后：

- **16 个通过**：三个短标签（zh「早安」42px / en「MM」42px / ja「モー娘」55px）
  在 390/414/560 三档宽度下都**点得到、不出视口、不换行、无省略号**，
  原有三个 tab 的宽度**一个都没变**（zh 45/42/42、en 45/52/64、ja 45/42/55），
  页头高度不变，与「更多」不重叠，页面无横向滚动。
- **2 个红**：**en 全名「Morning Musume」× 390px 与 414px** —— tab 宽 143px，
  被「更多」压住**点不到**（`elementFromPoint` 命中 more-btn）。
  这就是短标签在 en 必须是「MM」的原因，**不是要修的缺陷**。
- ja 全名 107px、zh 全名 94px 都装得下，所以**零 CSS 改动**。

守卫：`test/style-artifact.test.js`（缝③）加一条「`index.html` 的系列 tab 数
= `core.js` 里 `names()` 认识的系列数」—— 用 `SIZES` 那种双向比对，别只查一边。

## 验收

- 三套 E2E 全绿，且**要加一条「切到早安系列」的流程**（现有脚本假设三个系列）
- `npm test` 全绿，JS 测试数从 255 增加
- 变异验证：至少四个（en 短标签改回全名 / `names()` 漏一个字段 / 三语漏一种语言 /
  tab 数与 `names()` 不一致），全部会红
- **版式基线不动**：390px 下页头 66/60、首卡 ≤400、托盘不透明
