# AGENTS.md

## 项目概览

纯静态站点，无构建步骤、无框架、无运行时依赖：`index.html` + `style.css` + `core.js` + `session.js` + `poster.js` + `i18n.js` + `app.js` + `members.js` + `simplified.js`，用静态服务器直接托管。

- 站点覆盖四系列共 24 团：48g 七团（AKB48 / SKE48 / NMB48 / HKT48 / NGT48 / STU48 / SDN48）、坂道三团（乃木坂46 / 櫻坂46 / 日向坂46）、等爱三团（=LOVE / ≠ME / ≒JOY）、早安家族十一团（モーニング娘。 / アンジュルム / Juice=Juice / つばきファクトリー / BEYOOOOONDS / OCHA NORMA / ロージークロニクル / Berryz工房 / カントリー・ガールズ / こぶしファクトリー / ℃-ute），现役 + 毕业（人数以脚本输出为准，见 `docs/agents/data-pipeline.md`）。
- 能力：四系列切换（各自保留已选/对决/筛选进度）、7/16/40 档位（筛选步逐轮二分划掉一半，层级与题数上限见 `docs/adr/0019-screening-then-rank.md`）、海报四样式（金字塔默认 / 杂志 / 榜单 / 拼贴，跟随皮肤）、简体输入与罗马字检索、对决进度与刷新续玩、向导模式（三步指示器、首屏见脸、引导卡、① 返回不丢进度）、成员简介卡片、皮肤切换（classic / sticker）、PWA 可安装 + 离线。
- 层次：`core.js` 无 DOM 依赖的纯逻辑（搜索归一、两级分组、筛选轮次与层级、`mergeSort` 对决 replay、持久化载荷编解码、导航相位 `nav`/`steps`、`names()` 命名组合）；`session.js` 会话状态深模块（系列/档位/已选/对决/筛选，storage 与成员查询注入，node 可测）；`poster.js` 海报绘制（7/16/40 × 四样式，ctx 依赖注入，假 ctx 可测）；`i18n.js` 是 zh/en/ja 文案；`app.js` 是 DOM 层：向导 → pick → 筛选 → duel → result（canvas 海报导出）。
- `members.js` / `simplified.js` 是生成文件，不要手改。
- 三语 UI（zh/en/ja）：文案在 `i18n.js`，`index.html` 的 `data-i18n` 引用同一批键。**加一个 UI 文案要同时改三种语言**（漏一种时 `test/i18n.test.js` 会红，它还额外要求 ja 与 zh 同集合）；出身地/星座/期生/状态这类可穷举字段走映射表（只服务 zh/en，ja 直出数据原文），趣味/特技走仓库内「日文原文 → zh/en」对照表，未收录自动回退原文。

## 工作流：三条链

**核心链条（做新功能）**：`grill-with-docs` → `to-spec` → `to-tickets` → `implement-spec` → `code-review` → `retro`

- `grill-with-docs` 顺带维护 `CONTEXT.md` 与 `docs/adr/`（术语与不可逆决定），不要跳过。
- `implement-spec` 的前提是**真 issue tracker + 每工单一个 worktree + 子代理并发**。本仓 tracker 是本地 markdown（`docs/agents/issue-tracker.md`），工单通常在**同一会话里顺序做**，所以实际常用 `/implement` 逐工单（它内部驱动 `tdd` 并以 `code-review` 收尾）；工单彼此独立且量大时才用 `implement-spec`。子代理的笔记要存**仓库外**（否则会被 lint-staged 的格式化卷进去）。
- `retro` 的产出是**改 agent 环境**（导航指针、自动化检查、编码规范、工具），不是代码改动 —— 大部分落点是本文件、`docs/agents/*`、测试守卫。

**修 Bug**：`diagnosing-bugs` → `tdd`

先有一条**能对这个 bug 变红**的命令（脚本路径 / 测试），再谈原因；修完补回归测试。`app.js` 没有单测缝，接线层的 bug 只有 E2E 能抓（见下）。

**架构重构**：`improve-codebase-architecture` → （需要看得见的问题时）`prototype` → `to-spec` → `to-tickets` → `tdd`

扫描给出的候选要**自己复核证据**再排序（子代理的结论会错）。有可复现症状的先按 `diagnosing-bugs` 建回路，纯形状问题才直接进 `to-spec`。

## 测试：七处缝与实际文件

跨缝前先跟用户确认。`npm test` 一次跑全部（`node --test` + Python unittest），均离线不联网。

| 缝                  | 落点                                       | 文件                                                                                                                       |
| ------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| ① Python 解析纯函数 | fixture 驱动                               | `scripts/test_*.py`                                                                                                        |
| ② `core.js` 纯逻辑  | 纯函数直接调                               | `test/core.test.js`                                                                                                        |
| ③ 产物不变量        | 清单 vs 盘上 reality **双向**比对          | `test/members-artifact.test.js`、`test/pwa-artifact.test.js`、`test/style-artifact.test.js`、`test/sw-cache-rules.test.js` |
| ④ `session.js`      | 注入内存 storage + 假成员表                | `test/session.test.js`                                                                                                     |
| ⑤ `poster.js`       | 注入假 ctx 与 tokens                       | `test/poster.test.js`                                                                                                      |
| ⑥ `i18n` 键完整性   | 含**拼出来的键家族**（死键守卫查不到它们） | `test/i18n.test.js`                                                                                                        |
| ⑦ E2E 黑盒          | 行为不变的硬验收                           | `e2e/`（`npm run e2e` / `:v5` / `:pwa` / `:header`）                                                                       |

- 跑单个文件：`node --test test/core.test.js`；单条用例加 `--test-name-pattern`。
- **E2E 在 `e2e/`**：`npm run e2e`（主套件）/ `:v5` / `:pwa` / `:header`（窄屏矩阵，含在线/离线）。⑦ 是 UI 改动的唯一验收手段，改 `app.js`/`core.js` 后必须跑。
- 缝③ 的守卫要么双向（清单 vs 盘上），要么带**级联后的有效值**：只扫「有没有这条规则」会被同名规则骗过（`style.css` 有**两个** `@media (max-width: 560px)` 块）。
- 缝④ 的夹具 id 前缀：`a1–a40` = 48g、`s1–s40` = 坂道、`l1–l40` = 等爱。写错前缀时 `toggleSelect` 静默返回 false，测试会以「筛不出东西」的方式假绿。
- 断言要挑**有分辨力**的那一个：同一条测试里有的断言在错误路径上也会通过（曾有一条「complete」假绿、只有「已划人数」抓住）。
- **「同值的第二份实现」行为测试按定义抓不到**：把 `_date` 改回自己造格式串（值完全相同），
  Python 行为断言全绿，只有缝③ 的源码守卫（「不许出现 `zfill`」）会红 —— 这类回归要守卫，
  别指望行为断言；用变异确认到底哪一条在承重。
- **`vm.runInNewContext` 读出来的产物数组跨 realm**：`assert/strict` 的 `deepEqual` 会按原型判「same structure but not reference-equal」。要么 `join("/")` 比字符串，要么逐元素 `assert.equal`（产物测试的既有写法就是这么绕的）。

## 变异验证：用脚本，不要手搓

```
node scripts/mutate.mjs --mutate <文件> <旧文本> <新文本> [--mutate ...] [--dry-run] -- <测试命令>
```

每个变异单独跑一次命令、**跑完立刻还原**，全被杀掉则退出 0，有存活则退出 1。**锚点必须恰好命中一次**，命中 0 次或多次一律退出 2（工具失败，结论不可信）—— 「变异没打上」与「变异存活」在结果上长得一模一样，手搓脚本时我两者都报错过。

- **锚点含换行时要传真的换行**（bash 里 `$'…\n…'`），写 `\n` 两个字面字符会命中 0 次、退出 2。
- **接线行为的变异命令用 E2E**：`app.js` 的接线没有单测缝，`e2e/` 脚本退出 1 就是「被杀」。仓内守卫守形状、E2E 守行为，两边都要有。

## CodeGraph（代码检索优先）

- 本仓库已建立 CodeGraph 索引（`.codegraph/` 是本地缓存，已 gitignore）。**定位符号、梳理调用链、了解架构一律先走 CodeGraph**：MCP 工具 `codegraph_explore`（带 `projectPath`），或命令行 `codegraph explore "<符号或问题>"`。
- 改动后同步：`npm run graph:sync`；状态 `codegraph status`；异常时 `codegraph index`。
- 本机 git 钩子不执行（见环境限制），**每次提交前手动同步一次**，与手跑 lint-staged 同一条流程。索引只覆盖 JS/Python，HTML/CSS 不在索引内。

## 常用命令

- 本地预览（仓库根目录）：`python3 -m http.server`，用 `http://` 访问（`file://` 下海报导出会因 canvas 污染失败）。**用 threading 版**（`ThreadingHTTPServer`）：页面并发要 ~30 个字体文件，单线程版会让 `load` 事件迟迟不触发，E2E 偶发导航超时。
- **提交闸门 = `npm run check`**（`prettier --check .` + `npm test` + `npm run complexity`）。格式化与复杂度都**不会**被 `npm test` 抓到，所以闸门把它们串在一起。**以退出码为准**（`echo $?`）：输出里混着基线的既有热点，`grep` 关键词会漏掉末尾的 ✗ —— 2026-10-04 因此带着红闸门提交过**两次**（第二次是 shell 里用 `;` 串了「check → commit」，红闸门照样提交了）。把 check 与提交用 `&&` 串起来，红的会拦住提交。
- 格式化写回用（`check` 红了之后）：`PATH=/root/.local/bin:$PATH node node_modules/lint-staged/bin/lint-staged.js`
  （`/root/.local/bin/prettier` 是垫片，指向 `node_modules/prettier/bin/prettier.cjs`）。**顺序有陷阱**：lint-staged 只处理**已暂存**的文件，先跑 `graph:sync` 再 `git add` 会让它变成 no-op（本项目踩过两次）。
- 仓库没有 lint / typecheck 脚本。
- 查看原型：原型在 `prototype/*` 分支上，main 工作区里没有属预期。`git worktree add /tmp/akb-proto-<名> prototype/<分支>` 检出，再静态服务器托管（原型引用的 `members.js`/`img/` 在 worktree 内齐全）。

## UI 版面：横账要按维度算，不能只按默认状态量

- 窄屏（≤560px）页头横账 = **品牌 + 系列 tab + 「更多」**，其中**品牌宽度随系列与档位变**（en 16 档的 "Senbatsu" 133 比 7 档的 "Oshi 7" 96 宽 37）、**tab 满宽随语言变**。离线胶囊在窄屏不再占横向（`position:absolute` 缩成「更多」按钮上方的一个点，文字用 `clip-path` 移出屏幕而**不是** `display:none` —— 它是 `role="status"`，要靠那段文字播报）。只按「7 档 + 中文 + 在线」量过就会全绿，然后 P0 照溜（已因此漏过两轮）。
- 横账的第四个维度（在线/离线）只有 `npm run e2e` 的 390px 块与 `npm run e2e:header` 覆盖；仓内 `test/style-artifact.test.js` 只能守「规则不许被删」，守不住「预算算错」。改窄屏页头后把四维矩阵重跑一遍并如实记录数字。
- ≤380px 的换行用 `display: contents` 让品牌 / tab /「更多」各自参与 `.masthead` 排列，tab 落第二行、其余留第一行；`margin-left: auto` 而不是写死像素（zh「更多」52 / en「More」63 宽度不同）。
- 探针**读计算样式**而不是元素属性：`[hidden]` 会被作者样式的 `display` 盖掉（`el.hidden === true` 但元素仍在布局里），这类问题只有计算样式看得见。
- **两个主色别混**：`--pink` 两款皮肤**同值**（`#e4007f`），`--peach` 在贴纸皮是**浅色** `#ffb4a2`。压 `--peach` 的文字用 `--on-primary`（按皮肤），压 `--pink` 的用 `--on-pink`（白字）。我一次把两者搞混、加了个多余的 `--on-accent`，在贴纸皮上造成深墨压强洋红 3.63:1 —— 对比度守卫现在逐对断言，别再加新令牌。
- **刻度守卫是棘轮**：`style.css` 里还有刻度外的字号与间距，`test/style-artifact.test.js` 钉着清单并**只许减不许增**。整体重排要动全层数值（改 padding 就是改版面），所以分批做。
- 名册卡片 `<img>` 没有 `onerror` 兜底 —— 0 字节的图会渲染成坏卡片。

## 注释与文档里能不能写数字

- **陈述当前状态的数字不要写**（如「gap 8→6 省 4px」「40 档最坏 106 题」）：它一定会有第二份
  副本，然后漂移。本项目已因此出过两次文档与代码不符（style.css 注释与生效值、AGENTS.md 说
  离线胶囊还占 84px 而实现已改成绝对定位）。**数字让测试钉住**，文档与注释只指路
  （`core.screenRounds(size).cuts` / 那个断言生效值的守卫）。
- **「为什么这么定」的实测依据要写**（如「360px en 下按钮右边缘 366 → 6px 横向滚动」）——
  那是决策快照，改决策时自然会更新，不会自己漂。
- ADR 与 `docs/adr/` 里的数字属于决策记录，按历史快照处理，不因为代码变了就回改。

## 视觉批次里踩过的坑（2026-09 那一批换来的，别再踩）

- **`flex-wrap: wrap` 的换行按**基准尺寸**判定，不按收缩后尺寸**。所以想「让一项可收缩 +
  同行不换行」必须把 `flex` 基准设成 0（`flex: 1 1 0`）；写 `1 1 auto` 的话基准就是内容宽，
  还没轮到收缩就先换行了（症状是「改了没反应」）。窄屏横账那一节的四维量法之外，
  这条是同一族的坑。
- **同权重下「后写的赢」不是「更具体的赢」**。给一个已存在的选择器新增 transition / 布局属性时，
  要改**原来那条**规则；新起一条插在文件顶部会被后面的原规则盖掉（点选反馈第一版就这么白写）。
- **`.map(渲染函数)` 会把 `(element, index, array)` 三个参数全传进去**。把带可选第三参的
  函数直接交给 `.map`，第三参会收到**数组**，算出来的自定义属性是 `NaN`，而**已定义**的
  NaN 自定义属性不会触发 `var(--x, 兜底)` 的兜底 → 整条声明静默失效且控制台无报错。
- **自定义属性没有类型检查**：`--i: NaN` 时 `calc(var(--i) * 18ms)` 在计算值阶段非法 → 整条失效。
- **观测「短暂存在的元素」用 `setInterval` 轮询，不要用 MutationObserver**。实测它只记到
  `add` 记不到 `remove`（320~700ms 的窗口里两次变更落在同一批回调前），量出来是「没发生」。
- **观测「动画真的在跑」要看 `getAnimations()`，不是看元素存在了多久**。一个一帧内生灭、
  零动画的层也能通过「存在 ≤400ms」的判据。
- **`appendChild` 之后单次 `requestAnimationFrame` 改样式不保证产生 transition**（浏览器不保证
  这之间做过样式重算）。要 `void el.offsetHeight` 强制一次。
- **主色有两个**：`--pink` 两款皮肤同值（`#e4007f`），`--peach` 在贴纸皮是浅色 `#ffb4a2`。
  **压 `--pink` 的文字用 `--on-pink`（两款都是白字），压 `--peach` 的用 `--on-primary`**；
  把主色当**图形**用（渐变、边框）也只能用 `--pink` —— 层级段曾用 `--peach`，
  贴纸皮下与底色只差 1.02:1。
- **窄屏的判据要按「语言 × 皮肤 × 档位」跑矩阵**。只量「中文 + 经典皮 + 7 档」会全绿，
  而 en × 贴纸皮 × 40 档是每一轮的最坏组合（品牌名更宽、圆点撑高引导卡）。

## PWA（可安装 + 离线）

策略与选型见 `docs/adr/0016-pwa.md`；要改 SW / 缓存 / 指引文案 / 离线验收时读 `docs/agents/pwa.md`。

- **改了壳文件就同步 `sw-cache-rules.js` 的 `SHELL_FILES`**（根目录 `.js` / `style.css` / `index.html` / 图标）：漏了 `test/sw-cache-rules.test.js` 会红。缓存分类规则（哪个请求进哪个桶、容量多少）也在那个文件里，`sw.js` 用 `importScripts` 引入 —— 所以规则是可断言的，而不是 grep 出来的形状。
- **持久化键名只有一处**：`core.js` 的 `PREF_KEYS`（含按系列存档的 `state: (s) => …`）。`app.js` / `session.js` 不得出现 `akb` 开头的键名字面量，也不得直接 `localStorage.*("akb…")`（守卫在 `test/session.test.js`，它同时要求两边**真的用上** `PREF_KEYS`）。**刻意的例外**：`index.html` 的内联脚本要读 `akb:skin` 才能让首屏不闪 —— 它必须在模块加载前跑，且那个默认值必须等于 `session.js` 的默认皮肤（由首屏 E2E 钉住）。
- **能力探测决定按钮行为，不决定入口可见性**：页脚安装入口除已装成应用外始终显示，`beforeinstallprompt` 只决定「安装」是一键还是改名「怎么装？」。把可见性挂在这个事件上，入口会在 Firefox / macOS Safari / headless / 非安全上下文里整体消失。
- **离线要预热两样**：选中成员时预热 `img/full`（名册只渲染 thumb，海报读 full）、SW 接管后重取字体（首访的字体请求发生在接管之前）。
- **更新由用户点「刷新」才切**，不自动 reload（会打断进行中的对决）。`file://` 下不注册 SW。

## 会话状态的接线纪律

- `session.js` 新增字段必须在 **snapshot / deserializeState / 落盘 / 切系列** 全部接上。漏一处的症状是「刷新前后相反」或「切系列就丢」——`deeperRound` 是第三例（localStorage 那条路存了，内存里按系列的 `remember()` 漏了）。
- 存档校验要**对称**：成员归属、跨轮去重、每轮人数（按 `screenRounds(size).cuts` 夹）三层都夹。少一层就会出现「提交按钮与细条题数打架」——旧扁平 cut 迁移会把全部 id 塞进第一轮，那是真实用户能踩到的越界形状。
- 加了新规则后**既有测试变红，先看夹具是不是越界形状**，别急着改断言迁就实现（7 档的计划只有 1 轮，「7 档存 3 轮」这种夹具在新规则下消失是对的）。

- **`scripts/mutate.mjs` 的每个变异是独立跑的**：想验证「移动一行」这种需要两次编辑的缺陷，
  写不成一个变异（我把调用挪到函数开头 + 删掉末尾那次，两条一起传 → 工具只分别单独应用，
  第一条单独跑等于「多加一次调用」，末尾那次还在，于是「存活」是假象）。要么找一个**单锚点**
  能表达的等价形状（我最后用「把调用挪到写 innerHTML 之前」），要么改测试。

## 环境限制（/mnt/sdcard 是 Android FUSE 挂载）

- 不支持符号链接和可执行位：`npm install` 必须加 `--bin-links=false --ignore-scripts`；husky 钩子无法执行（git 会跳过），所以提交前手动跑 lint-staged 与 `graph:sync`。
- 当前 Node v20.19.2：lint-staged 固定在 `^16`，不要升级到 v17（需要 Node ≥22）。
- **跑浏览器套件之前先跑 `node scripts/preflight.mjs`**：它报可用内存并列出历轮遗留的静态服务器，不足就退出 1。本机可用内存掉到 3GB 以下时单次页面导航要 30 秒（正常 ~1 秒），症状是「goto 超时」，看起来像产品坏了 —— 本项目已经因此白烧过两成回合。
- **内存是 E2E 的实际瓶颈**：本机 15GB 总量，可用常驻掉到 3GB 以下时单次页面导航要 **30 秒**（正常 ~1 秒），全量 E2E 必然超时。跑之前先 `free -m`，并清掉历轮遗留的静态服务器（`ps aux | grep http.server`；**别用宽泛的 `pkill http`，会误杀用户自己的预览**）。预算不足时把重矩阵拆成独立脚本分开跑。
- 网络：`github.com` 资源一律走 `https://gh-proxy.com/` 前缀；纯信息查询先 websearch。`gh` CLI 未安装，API 走 `https://gh-proxy.com/https://api.github.com/...`（列目录比猜 raw 路径可靠）。
- **调研外部源（Wikipedia/Commons 等）要节流（≥3s）**：429 会被当成「源里没有/页面不存在」——本批因此把 9 个**有表格**的团误判成「散文段落、要新写解析器」，那个错误结论还进了 spec 草稿。结论里要注明「是否可能被限流影响」。

## 数据与图片生成

重新生成成员数据/图片（`scripts/fetch_members.py`）前读 `docs/agents/data-pipeline.md`（含必需源门与 `--accept-drop` 逃生阀、成员 `img` 真值来源是站内文件而非远端解析结果）。

## Code Review 检查点

- 每次 review 结束后，向 `docs/reviews/checkpoints.md` 追加一条记录（格式见该文件）：日期、本次基点、审查范围、结论、遗留问题、下次基点（本次 HEAD 的 SHA）。
- 下次 review 从上次记录的基点开始，不重复审查已经通过的部分。
- 质检基线在 `docs/reviews/qa-baseline.md`；口径「CCN > 10 才列修」由 `npm run complexity` 的趋势棘轮守（只拦新增/变高，2026-10-04 接进闸门）；CRAP 与覆盖率仍靠手动跑（lizard 不输出 CRAP，本仓无覆盖率工具链）。

## 约定

- 与用户交流使用中文；提交信息使用中文（沿用仓库历史风格）。
- 声明「收口完成」前先 grep 全部调用点确认已接线（曾出现 `frame()` 只定义未接线却写进记录，被两轴审查抓出）。
- 验证结论要写实际跑过的命令与数字；跑不了的（如设备资源不够）**如实说明没跑成**，不要写成已验证。

## Agent skills

- **Issue tracker**：新建/更新 spec 与工单（`to-spec` / `to-tickets` / `triage` / `wayfinder`）前读 `docs/agents/issue-tracker.md`（`.scratch/<feature>/` 的本地 markdown 约定）。
- **Triage labels**：`triage` 打标签前读 `docs/agents/triage-labels.md`。
- **Domain docs**：改 `CONTEXT.md`、写 ADR 或命名领域概念前读 `docs/agents/domain.md`（单上下文：根 `CONTEXT.md` + `docs/adr/`）。
