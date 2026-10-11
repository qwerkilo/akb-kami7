# 第八轮架构健康扫描 · 前端层一路（app.js / style.css / index.html / i18n.js）

- 扫描基点：`89e2597`（HEAD，2026-10-10）。
- 范围：`app.js`、`style.css`、`index.html`、`i18n.js` 及它们与 `core.js` / `session.js` 的接缝。
  以本批 `9e75c0a^..HEAD`（M1–M6 / L7–L12 / 字体 #2#4 / 搜索上限，24 项）的改动为主轴，
  同时覆盖文件里既有的可疑点。
- 方法：`git log/show/diff/blame`、`grep`、`codegraph explore`、`npm run complexity`、
  `scripts/ccn.mjs` 直调，以及 5 个只读浏览器探针
  （`/tmp/opencode/scan8-probe{,2,3,4,5}.cjs`，走 `e2e/serve.py` 线程版 + `e2e/_playwright.cjs`；
  每个探针都在 `try/finally` 里关浏览器）。
- 本轮已核对为**干净、不作为候选**的点（供分流，不再重复摸）：
  - L12 `#clear-btn::after` 没有盖住托盘槽位：实测 `overlapPx=0`（覆盖层顶边 794.8 > 槽底 791.6），
    在槽底 -2px 处 `elementFromPoint` 命中槽位 `IMG`，真点击也没有 confirm（`dialogShown=false`）。
  - L11 boot 占位有**间接守卫**：不摘掉会把首屏判据（第一张卡 top ≤ 400）顶穿（`e2e/e2e.cjs:1676`）。
  - 字体 #2/#4 有间接守卫：`e2e/e2e-pwa.cjs:144-156` 等 `link.media` 翻转后才量 face；
    `:455-467` 断离线 `h1` 宽度不得变样。`--card-min` 有 E2E（`e2e/e2e.cjs:1906-1923` 切换 + 刷新保持）。
  - `#duel-live` 有 E2E check（`e2e/e2e.cjs:531-546`）。
  - `lockMark`/`markLabel` 在 `npm run complexity` 口径内（`renderScreen` 本体 CCN=4，行模板见候选 9）。

---

## 候选 1【Strong】筛选摘要 / 触发按钮可及名在「搜索、换团、换期生」三条路径上不更新（陈旧数字）

- 类别：同一事实的第二份表示（名册投影人数在 DOM 里有两份，第二份只在部分路径重算）。
- 证据（探针实测，1280×800，en）：
  - 载荷：默认 `#search` 为空时 `#filter-sum` = `1134`、`.filter-trigger[aria-label]` = "Member scope · 1134"。
  - 输入 `前田` 后：名册 7 张卡、`.search-hint` = "7 found"，而 **`#filter-sum` 仍是 `1134`**、
    aria-label 仍是 "Member scope · 1134"。
  - 换团为 `AKB48`、换期生 `1期生` 后同样停在 `1134`（`scan8-probe5` 输出）。
- 代码：`paintFilterSum`（`app.js:691-722`）**自带搜索分支**（`view.mode === "search" ? view.hits.length`），
  但它只在 `paintFilters` 里被调用（`app.js:686`）——`paintFilters` 的两个触发点是
  `renderChrome`（`app.js:730-737`，切档位/语言/系列走它）与筛选 seg 点击（`app.js:766-771`）。
  搜索输入（`app.js:787-794`）、换团（`app.js:754-759`）、换期生（`app.js:761-764`）都只调
  `renderPick()`，不经过 `paintFilterSum`。结果是「投影变了、摘要没变」——桌面肉眼可见，
  读屏听到的 `aria-label` 同样陈旧（窄屏 `.filter-sum` 是 `display:none`，但 aria-label 照样在用）。
  反向也不对：搜索态下点一次筛选会让摘要记下搜索结果，此后清空搜索它仍停在那个搜索人数。
- 如何自查：1280px 打开筛选面板，对比输入 `前田` 前后 `#filter-sum` 与 `.search-hint` 的数字；
  或对 `paintFilters`/`paintFilterSum` 的调用点跑一次 grep（只有两处）。
- 建议形状：把 `paintFilterSum()` 并进 `renderPick()`（或所有投影变更的唯一渲染点），
  数字与 `.search-hint`、名册三处共用同一次 `rosterView()` 结果；data-active 的判定留在同一函数里不受影响。
- 不确定处：无（探针证实；数字 1134/7 与探针输出的 dump 一致）。

## 候选 2【Strong】结果页步骤条 ①「挑人」静默作废对决（无确认）——M5 只盖了 2/3 条销毁路径

- 类别：脆弱路径 / 与 M5 已确立的「作废要对齐确认」约定不一致。
- 证据（探针实测，390px，7 档 8 题打完到结果页）：
  - 结果页点 `#steps [data-step="pick"]` 后：`#phase-result` 隐藏、`#phase-pick` 显示、
    `#resume-card` 隐藏（对决已清）、③ 步 `disabled` —— 海报与全部对决答案消失，无任何确认。
- 代码：步骤条点击 → `navigate("pick")`（`app.js:1634-1636`）；`CORE.nav` 的 pick 规则在
  `view === "result"` 时返回 `effect: "abandon"`（`core.js:1170-1172`）；`navigate` 见 abandon 调
  `S.abandonDuel()`（`app.js:1557-1560`）→ `state.duel = emptyDuel()`（`session.js:442-447`）。
  本批 M5 给了另两条销毁路径 `window.confirm`（结果页「重新选人」`app.js:1165-1169`、
  续玩卡「放弃」`app.js:1624-1629`），步骤条 ① 是同类第三处，仍是一键销毁。
  （`#steps [data-step="pick"]` 在 pick 自身的可用性是 `core.js:1239` 的 `enabled: true`。）
- 如何自查：完成任意一局到结果页，点步骤条第 ① 枚，然后看 `#phase-result` 与 `#resume-card`；
  或在 E2E 里加一条「结果页点 ① → 弹确认 / 不弹」的断言（当前套件没有覆盖这条路径）。
- 建议形状：两个方向任选其一并做成一处口径——① `pick` intent 从结果页也走 `reselect_confirm`
  （或专门文案）；② 若不销毁，则要解决「留在 result 相位、回挑人后开始按钮语义」的流程问题
  （现在这条属于隐式的「必须清」的产物）。扫描只报不改，取舍交给人。
- 不确定处：低。机制已用探针跑通；唯一未证的是产品是否「有意如此」（checkpoints 未见记录）。

## 候选 3【Worth exploring】主套件里 `#restart-btn` 的 confirm 没有被接住 —— M5 的 restart 路径零验证（v5 修过同款，主套件漏了）

- 类别：守卫抓不到的静默路径（测试以为点了，其实被 auto-dismiss）。
- 证据：
  - `e2e/e2e.cjs:1297` 直接 `page.click("#restart-btn")`；主套件里唯一的 dialog 监听在 `:1100`
    （「清空」那次，`page.once` 用完即弃）。M5 给 restart 加了 `window.confirm`（`app.js:1165-1169`）
    → Playwright 无监听时**默认 dismiss** → `navigate("restart")` 不执行。
  - 探针 2 复现：点击后仍在结果页（`afterRestart: {resultVisible:true, pickVisible:false}`）。
  - 该步后续断言（切 48g → 品牌回神7，`:1298-1306`）在「restart 没发生」时照样通过，
    所以整套 250/250 绿，没有任何东西变红。
  - 对照：v5 同样事故已修（`e2e/e2e-v5.cjs:231` 加 `page.once("dialog", d => d.accept())`，
    checkpoints 补记二十五），主套件的兄弟实例没跟着修。
- 如何自查：`grep -n "dialog" e2e/e2e.cjs`（只有 1100）；把 restart 那次点的前置断言
  （比如「点击后应回到挑人页」）补上就会当场红。
- 建议形状：`:1297` 前加 `page.once("dialog", (d) => d.accept())`（与 v5 同款），
  并顺手加一条「restart 真的回到挑人页」的断言；否则这个交互属于「看着在测、其实没测」。
- 不确定处：无（探针 + 代码双证）。

## 候选 4【Worth exploring】本批五个 UX 细节全部只有一次性探针见证：L7 / L8 / L9 / L12 / 搜索上限的回归会被套件静默放过

- 类别：探针/守卫抓不到的静默路径（系统性，逐条列证据）：
  | 功能                  | 实现                | 套件引用                                                                                                                            |
  | --------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
  | L7 `data-active` 粉边 | `app.js:713-720`    | `data-active` 在 `e2e/`、`test/` 里 0 命中                                                                                          |
  | L8 🔒 与原因文案      | `app.js:1476-1512`  | `.lock` / `screen_locked` 在 `e2e/`、`test/` 0 命中（E2E 只查 `.screen-row.locked` 类，`e2e/e2e.cjs:127-162`）                      |
  | L9 seg 方向键         | `app.js:1013-1028`  | 套件里的 Arrow 只有 `e2e-v5.cjs:164`（说明卡打开时**不作答**），与 seg 无关                                                         |
  | L12 命中区 44px       | `style.css:860-867` | E2E 只点按钮中心（`e2e/e2e.cjs:1094-1112`），`elementFromPoint` 判据只在 checkpoints 的一次性探针里                                 |
  | 搜索渲染上限 80       | `app.js:417-426`    | `SEARCH_RENDER_CAP` / `search_more` 在 `e2e/` 0 命中；上限**被删掉**（性能回归回来）时无红灯（上限被改小到 0 会被既有搜名断言抓到） |
- 如何自查：逐条把对应实现做一次「仅删除修复」的变异（如 `lockMark` 直接 `return ""`、删 `SEARCH_RENDER_CAP` 截断），
  跑 `npm run e2e:all`——预期全绿，即为缺口。
- 建议形状：挑成本最低的两三条进主套件即可（`data-active` 与 `lockMark` 都能用一句 `evaluate` 断言形状；
  搜索上限可断言「宽命中时渲染卡数 == 80 且提示存在」）；不追求六条全进，但至少别让整批都靠一次性探针。
- 不确定处：无（每条都给了 `功能 → 实现 → 套件零引用` 的三元组）。

## 候选 5【Worth exploring】「名额用尽」的行复用了「锁定」的原因文案：读屏听到「这一轮已定」，但这个人并没有被定

- 类别：同一事实的第二份表示（一个 `off` 谓词合并了两种不同原因，共用一份文案）。
- 证据（探针 3 实测，en，7 档划 3 人后）：
  - 第 1-3 行（第 1 轮已划）：`{cut:true, disabled:true, lockedClass:true, icon:true, aria:"Decided this round — use Reset all to redo 板野友美"}`——合理。
  - 第 4-7 行（**未划**、本轮名额用尽）：`{cut:false, lockedClass:false, icon:true, title:"Decided this round …", aria:"Decided this round … 大島麻衣", visible:"🔒Cut"}`。
    「这一轮已定」（zh）、"Decided this round"（en）、「この回で確定済み」（ja）对这四个人是**假陈述**——
    他们没被划、也没被「定」，只是本轮划别人的名额用完了。
- 代码：`off = locked || noQuota`（`app.js:1503-1505`），`lockMark(off)` / `markLabel(off, …)` 都把两者
  折叠成同一输出（`app.js:1476-1483`、`1511-1512`）；文案是同一个键 `screen_locked`
  （`i18n.js:653 / 841 / 1036`）。checkpoints 补记二十一/二十二明确写了「锁定/名额用尽」都挂 🔒，
  所以「合并」是有意的；**含糊的是文案只描述了两者之一**。
- 如何自查：7 档选满、划 3 人，读第 4 行的 `title` 与 `aria-label`（或直接跑 `/tmp/opencode/scan8-probe3.cjs`）。
- 建议形状：给 noQuota 单独一条键（如 `screen_quota`：「本轮名额已用完」），`markLabel` 按两个谓词分派；
  或对 noQuota 行不挂 🔒/不发原因（它不需要「用全部恢复重来」的指引）。
- 不确定处：中低。「合并成一条」是记录在案的；是否值得拆文案取决于产品口径，但「假陈述」是实测事实。

## 候选 6【Worth exploring】index.html 里 Google Fonts 样式表 URL 有两份（本批 #2 引入），没有任何一致性守卫

- 类别：同一事实的第二份表示（同一 URL 字符串两份，改一处不响）。
- 证据：`index.html:19-24`（主 link，带 `media="print" onload=…`）与 `index.html:25-30`（`<noscript>` 兜底）
  的两条 href **逐字符相同**（脚本统计：occurrences=2, unique=1）。仓库里没有任何测试比较这两处；
  `e2e-pwa.cjs:144` 与 `app.js:1849-1851` 都只按子串选 link。
- 影响：改字体族/字重时只改主 link → 无 JS 用户走到旧的字体集，与 CSS 里的 `--font-*` 栈错位（字形回退）；
  反向同理。属于「两份清单」类，但漂移后果只落在 noscript 用户身上，所以严重度不高。
- 如何自查：`grep -n "fonts.googleapis.com/css2" index.html`，手动比对两行；再 grep 测试目录里有没有比对。
- 建议形状：加一条缝③式产物断言（从 html 里抓两处 href 并 `assert.equal`），或让 noscript 那份
  在构建脚本文档里显式注明「与主 link 同步」——前者更符合本仓「让测试钉住」的纪律。
- 不确定处：无。

## 候选 7【Worth exploring】动效注释仍停在被替换前的数字（160ms / 400ms），与令牌、守卫计算的都矛盾

- 类别：注释与实现/守卫事实不符（AGENTS.md「陈述当前状态的数字不要写」的又一实例）。
- 证据：
  - `style.css:91-92`：「18ms × 8 + 160ms ≈ 304ms，在 --dur-slow（320ms）之内」。
    但 `.roster.enter .card` 的动画是 `var(--dur-fast)`（`style.css:97`，现值 120ms，`:25`），
    守卫算的也是 `--dur-fast + 8 × --stagger-step`（`test/style-artifact.test.js:983-986`）→ 264ms。
    160ms 是 `aadd41e3` 把时长换成令牌之前写死的值（`git blame` 显示 91-92 来自 `661e121`）。
  - `style.css:94-95`：「.enter 由 show("pick") 加、动画结束或 **400ms 兜底**摘掉」；
    `app.js:394-396`：「**400ms 后摘掉**（…）」。但实际由 `rosterEntered()` 加类、由
    `playOnce`（`app.js:184-201`）用 `motionMs(...) + MOTION_MARGIN_MS(350)` 兜底（事件优先）。
    400ms 是 `34d7372` 时代的定时器；`3fbdcc38` 换掉后只在下一行留了「此前这里写死 600ms」。
  - 同族（没写错、只是复述现值，属漂移风险）：`app.js:1324` 与 `style.css:613` 都复述
    「大/中/小 → --card-min 120/92/72」，真值在 `style.css:533/536/615`。
- 如何自查：`grep -n "160ms\|400ms" style.css app.js`，对照 `var(--dur-fast)` 与 `playOnce`；
  守卫（`test/style-artifact.test.js:971-1045`）写的就是算出来的窗口，注释是唯一没跟上的地方。
- 建议形状：把两处注释改成「时长/余量从 CSS 读出，见 playOnce/MOTION_MARGIN_MS」这种**指路式**写法，
  不写现值；`--card-min` 两处同理删数字留指针。
- 不确定处：无（blame + 守卫代码可复核）。

## 候选 8【Worth exploring（低）】死代码三处：一个 CSS 选择器、一个永假的属性分支、一个只写不读的变量

- 类别：死代码 / 死亡分支。
- 证据：
  1. `style.css:1964` 的 `#phase-duel .versus`：全仓 grep `versus` 只命中这一行；
     `index.html:457` 渲染的是 `<span class="or">`，JS 也不生成 `.versus`。同一规则的后半
     `#phase-duel .duel .or` 是活的，所以是选择器半段死亡。
  2. `app.js:715-716`：`.seg-filter [aria-pressed="true"]` 这个分支永远不匹配——`.seg-filter` 的按钮
     只有 `aria-checked`（`index.html:331-354`、`paintSeg` 只写 `aria-checked`；探针 3 实测三枚
     `pressed` 全为 `null`），全仓的 `aria-pressed` 只出现在 `.card`（`app.js:285/498`）与
     `.mark`（`app.js:1509`），都不在 `.seg-filter` 内。
  3. `app.js:1656/1789` 的 `swReg`：只写不读，全仓 grep 只有这两行（声明 + `watchUpdate` 里赋值）。
     （同函数里真正被消费的是 `watchUpdate` 的参数与事件监听。）
- 如何自查：三条 grep——`grep -rn "versus"`、`grep -n "aria-pressed" index.html app.js`、
  `grep -rn "swReg"`。
- 建议形状：都是「指出不删」（AGENTS 规范）：选择器半段与非分支可以删；`swReg` 若确实没有消费方
  就删声明，或注明保留理由。
- 不确定处：`aria-pressed` 分支可能是有意的防御性写法（对另一套状态表示保底）——但按现状是永假分支；
  标注为低严重度。

## 候选 9【Worth exploring（低）】复杂度：`renderScreen` 的行模板恰好卡在阈值 10（>10 才红），下一条三元就翻闸

- 类别：接近基线的热点。
- 证据：
  - `npm run complexity` → 「CCN>10：当前 1 处，基线 2 处 … ✓ 没有新增热点」（exit=0）。
  - `scripts/ccn.mjs` 直调：`app.js` 的 `(anonymous) 1499-1514`（= `renderScreen` 里
    `snap.selected.map(...)` 的行模板）CCN=**10**；`applyStatic 91-129` 也是 **10**；
    本批新加的 `profileTrap 979-999` 是 9。
  - 闸门口径是 `if (ccn <= THRESHOLD) return;`（`scripts/complexity.mjs`，THRESHOLD=10）——
    即只在 **>10** 时拦截；本批 `603e568` 记录把行模板从 13 拆到 10。任何给行再加一条 `?:`
    或一个新 `if` 的改动都会立刻让闸门红，而这一行是 L8/M6 反复动过的地方。
  - 顺带订正：任务描述里的「基线在 `scripts/complexity-baseline.txt`」**不存在**；
    实际在 `docs/reviews/complexity-baseline.txt`（`scripts/complexity.mjs:22` 的 `BASELINE`）。
- 如何自查：`npm run complexity` + `node --input-type=module -e "import {jsCcn} from './scripts/ccn.mjs'; …"`
  （一行脚本见本报告方法节；或读 `test/style-artifact.test.js` 里同为行模板守卫的部分）。
- 建议形状：下次动 `renderScreen` 前先把行模板的下一个维度（如针对 noQuota 的候选 5 文案）也拆成
  小函数，别让「提取函数」当批已成惯例的情况下再回退成内联。
- 不确定处：无（命令输出可复核）。

---

## 附：口径与纪律备注

- 探针均为只读（不改仓库、不提交）；脚本在 `/tmp/opencode/scan8-probe{,2,3,4,5}.cjs`，
  运行时用 `python3 e2e/serve.py 8017`（线程版，跑完即 kill），浏览器每次 `try/finally` 关闭。
- 本报告不修复任何候选；候选 1/2/5 的复现路径最短，候选 3 是测试侧问题，
  候选 4 是覆盖策略问题，其余为低严重度清理项。
