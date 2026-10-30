# 02 · 字体交付面：Zen CSS 88KB 与 48 个 woff2

- **Type**: research
- **Status**: resolved
- **Blocked by**: 无

## Question

Google Fonts 的 Zen CSS（≈88KB gzip、363 个 face）与预热 48 个 woff2（0.48MB）是否还有无损压缩空间？
比较：保持现状 / 自托管 + 子集化（按成员名与 UI 字符集，OFL 许可）/ 只按实际使用 face 拆 CSS。
给出预计字节、离线一致性、维护成本与许可结论；不实施。

## Answer

完整报告：`.scratch/perf-load/research/02-font-delivery.md`。

- **交付面**：Dela 825 B wire / 1,292 B decoded（1 face，`text=` 子集，12,812 B 字体）；Zen+Nunito 87,244 B wire / 341,037 B decoded（373 faces = Zen 363 [121 ranges × 500/700/900] + Nunito 10 [5 ranges × 800/900，两档共用 5 个 URL]），368 个唯一 woff2；全量 Zen 4.03 MiB。首访实际是 zh 38–42 个 / 395–431 K、en 10–18 个 / 139–203 K；票面的「48 个 / 0.48 MB」未复现。
- **选择口径**：`warmFonts` → `fontUsages`（可见叶子 × computed family 列表里的每个 family × weight）→ `warmUrls`（最近权重 + unicode-range 命中）。两个 bug：(a) 权重平局全保留（600 同时选 500/700，800 同时选 700/900；CSS 实际选 700/900）；(b) 拉丁/数字同时记到 Zen，尽管 Nunito 会画。390 zh classic 真正绘制 15 个 Zen face / 142 K，预热拉了 37 个 / 365 K —— **22 个 face / 约 223 K（61%）是多预热**；500 档在 classic 一个都没画（67.5 K 纯浪费）。
- **Zen 不是名册名字的字体**：classic `.card .nm` = `--font-ui` 600，sticker = `--font-serif`；首访 Zen 只画约 22 个中文 UI 字符（`--font-round` 里 Nunito 画不了的 CJK）。动态 Zen 只在 duel 名字（900）与 sticker 海报名字（700）。Dela 只用于安装浮层标题与 sticker 海报标题，首访完全不需要（825 B CSS 可延后）。
- **方案**：A 保持现状 zh 481–517 K / en 225–289 K，离线只覆盖拉过的子集，第三方故障静默（01 的 2/16、国内不可达）。B 自托管 OFL：B0 UI 子集约 60–150 K；B1 再加 817 CJK 名字子集（700/900 各 114.6 K）约 290–380 K，换来确定性离线与无 Google 依赖。C 拆分：C1 把 500 拆成品牌 `text=`（主 CSS −28.7 K，500 67.5 K → 3.9 K）；C2 延后 Dela（−0.8 K）；C3 修 `warmUrls`（−223 K woff2）；C1+C2+C3 可把 zh 首访降到约 238 K（−51%）且不改视觉。C4「eager UI `text=` + 懒加载全量 700/900」可到 50–75 K，但要维护跨相位字符集、改「正文不能带 text=」守卫并加懒加载路径，风险/成本最高。
- **立即可做（零视觉变化）**：修 `warmUrls` 权重平局 + 首覆盖 family；500 拆品牌 `text=`；Dela CSS 延后。预连接已在，不用动。
- **许可**：三份字体均 OFL 1.1，版权行无 Reserved Font Name；允许子集化/自托管，随附 OFL 与版权声明、不单独售卖即可。
- **注意**：只跑了 390/zh/classic 一个探针条件，没有逐相位/三语/1280 扫描，没有 E2E 或视觉 A/B；`text=` 数字是 Google 输出，fonttools 合并子集会有 ±10–20% 差异。
