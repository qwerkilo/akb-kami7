# 第八轮架构健康扫描 · 测试/工具层（B 路）候选报告

- 仓库：/mnt/sdcard/Download/akb-kami7（HEAD 89e2597）
- 范围：`e2e/`、`test/`、`scripts/*.mjs`、`package.json`、`.github/workflows/check.yml`、`docs/reviews/checkpoints.md`（最近一批改动：`_check/_suite/_wait/_ui/_store/_noise`、`e2e-v5` dialog、`ccn.mjs`、`mutate.mjs`、`serve` 脚本、CI）
- 方法：只读。实跑了 `eslint@6.4.0`（与 CI 同版本）、`node scripts/complexity.mjs`、`lizard`、`scripts/ccn.mjs` 的 AST 统计、`serve.py` 绑定失败复现；**未跑浏览器套件**（避免内存/残留服务器干扰）。
- 严重度口径：**Strong** = 高置信 + 真实假绿/盲区；**Worth exploring** = 高置信 + 影响中低或需条件；**Speculative** = 事实成立但影响小或路径条件化。
- 不确定处均逐条标注「不确定」。

---

## 候选 1 · `lint:undef` 覆盖面漏掉 `sw.js`（与 `sw-cache-rules.js`）—— 全仓唯一没有静态检查、也没有测试执行的产品文件

**严重度：Strong**

证据：

- `package.json:21` 的 `lint:undef` 文件清单是：`e2e/*.cjs test/*.js core.js app.js session.js poster.js i18n.js scripts/*.mjs`。根目录实际有 9 个 `.js`（`app/core/i18n/members/poster/session/simplified/sw-cache-rules/sw`）。`members.js` / `simplified.js` 是生成文件（跳过合理），但 **`sw.js` 与 `sw-cache-rules.js` 是手写产品代码**，两者都不在清单里。
- 实测（与 CI 同版本的 eslint 6.4.0，即 `/usr/bin/eslint`）：
  - `sw.js` 单跑该配置 → `7:1 error 'importScripts' is not defined`，exit 1；
  - 加 `--global importScripts` 后 → exit 0（说明只差一个 global，不是不可加的）；
  - `sw-cache-rules.js` **不加任何 global 就直接 exit 0**（漏得毫无理由）。
- 无其它兜底：`test/pwa-artifact.test.js:90-107` 只做 `new Function(src)`（**编译期**，未定义标识符是运行期错误，编译抓不到）+ install/skipWaiting 形状；`test/sw-cache-rules.test.js` 只 require 纯函数模块。`npm run check` 的其它环节（prettier、complexity）不解析引用。
- 对照承诺：引入该闸门的提交 c1834cf 自述「覆盖 e2e/test/产品 JS/scripts」；仓内没有任何记录说明 sw.js 为何被排除。**不确定**：sw.js 的排除是否曾有意（因为 importScripts 报错），但没有任何文档/注释记录这个决定。
- 失败形态：sw.js 的事件处理器里出现拼写类未定义标识符（正是该闸门为 e2e-v5 的 `errs` 而建的那类缺陷）时，没有任何静态检查会红；部分处理器内部有 `catch (_) {}`（如 `sw.js:55-58` 的 `put`），运行时也会静默。

如何自查：

```bash
grep -o '[a-z-]*\.js' package.json | sort -u   # 对照 ls *.js
eslint --no-eslintrc --env node,browser,es6 --parser-options ecmaVersion:2020,sourceType:module \
  --global AKB_POSTER,globalThis --rule '{"no-undef":"error"}' sw.js sw-cache-rules.js
# sw.js 报 importScripts；sw-cache-rules.js 直接通过
```

---

## 候选 2 · 复杂度棘轮的静默方向：回涨 ≤ 历史峰值会被印成「↓ 降了」，Python 侧解析失效无自检

**严重度：Worth exploring**

证据（确定性部分）：

- `scripts/complexity.mjs:119-129`：`added = list.filter(k => !base.has(k))`、`worse = list.filter(k => base.has(k) && v.ccn > base.get(k))`、`better = ... v.ccn < base.get(k)`；**只有当前列表里的条目参与判定**。
- 于是「曾 >10、后降回 ≤10、又涨回 ≤ 旧峰值」的函数：`worse` 不成立（`v.ccn > 旧峰值` 为假），`better` 反而成立 → 输出把回归印成「↓ 降了」，`exit 0`。
- 现成的活证据：基线 `docs/reviews/complexity-baseline.txt` 第 3 行 `12 load_fetcher.fetch@./scripts/test_love_members.py 415-436`；今天 `lizard` 报该函数 **CCN 6**（`load_fetcher.fetch@496-507`）。实跑 `node scripts/complexity.mjs` 输出「CCN>10：当前 1 处，基线 2 处 … ✓ 没有新增热点」exit 0 —— 基线条目已陈旧却无人更新，而只要它涨回 11，就会被当成「12→11 的进步」放行。
- Python 侧无 JS 侧同款自检：`complexity.mjs:26-31` 调 `ccn.mjs` 的 `selfTest()`（先例 764c57c 的结论：「一个能整体失效还全绿的守卫比没有守卫更危险」），但 `complexity.mjs:63-86` 的 lizard 输出解析没有任何自检——若输出格式漂移导致正则 `:77-79` 全部不匹配，Python 热点会**静默整体消失**，`added/worse` 全空、依旧绿。CI 的 lizard 未钉版本（`.github/workflows/check.yml:22`：`pip install --user Pillow lizard`）。**不确定**：没有实证过一次真实格式漂移，这条是风险方向。

如何自查：

```bash
node scripts/complexity.mjs            # 看「当前 1 处 / 基线 2 处」且 exit 0
# 模拟回涨：临时把基线中 load_fetcher.fetch 的 12 改 8（副本），再让该函数涨过 10 → 观察是否判「降了」
```

---

## 候选 3 · 本批三处新逻辑零守卫：`SEARCH_RENDER_CAP`、`lockMark`/`markLabel`、`warmFonts` 四助手

**严重度：Worth exploring**

（同一问题的三处实例；`#duel-live` **不在此列**——它已有 `e2e/e2e.cjs:531-545` 的真实断言。）

1. **`SEARCH_RENDER_CAP`（搜索渲染上限 80 + `search_more` 提示）**
   - 实现：`app.js:415-426`；`grep -rn 'SEARCH_RENDER_CAP\|search_more' test/ e2e/` → **0 命中**；提交 429b4c3 只改 `app.js/i18n.js/checkpoints`，验证证据是一次性探针（检查点补记二十四），未入仓。
   - 静默方向：上限被删/写反（回到 1089 张卡的一次性重建，冻结 ~1s 回归）、`more > 0` 条件写错、计数错——全套件不会红。i18n 只保证键存在（`test/i18n.test.js:10-26`），不保证用到/用对。
2. **`lockMark` / `markLabel`（锁定行 🔒 与可及名原因）**
   - 实现：`app.js:1476-1483`，接线 `app.js:1509-1512`；零测试引用；`e2e/e2e.cjs:126-170` 的锁定断言只看 `.locked` class + `disabled`（`off` 判据本身有覆盖），不看 🔒、不看 `aria-label` 文案映射；`e2e.cjs:321-329` 的 aria-label 检查是托盘、与锁标无关。
   - 静默方向：`markLabel` 的 keep/cut 互换、off 分支取错键（603e568 刚做过一次拆分重构）——无任何红灯。
3. **`warmFonts` 四助手（`fontCodePoints`/`fontRange`/`faceCovers`/`warmUrls`）**
   - 实现：`app.js:1801-1871`；零测试引用（`grep -c 'fontCodePoints\|fontRange\|faceCovers\|warmUrls' test/*.js` 全 0）；提交 590c83c 给 app.js +47 行，无测试文件。
   - 现有覆盖只在下限方向：`e2e/e2e-pwa.cjs:236-245` 等 `css > 0 && n >= 17`，离线断言走 h1 宽度（`:450-467`）。**过度包含方向全静默**：`faceCovers` 在 `!m` 或无有效 range 时 `return true`（`app.js:1825-1827`），若 `fontRange` 正则因 CSS 格式变化失灵 → 全部子集被预热（`491 → 491`，等价撤销 #4 的 -69%）→ e2e:pwa 照样绿。

如何自查：

```bash
grep -rn 'SEARCH_RENDER_CAP\|search_more\|lockMark\|markLabel' test/ e2e/   # 0 命中
# 锁标映射：改 markLabel 的 off 分支跑全量单测，观察「存活」（=无守卫）
node scripts/mutate.mjs --mutate app.js 'if (off) return t("screen_locked");' \
  'if (off) return t("screen_keep");' -- npm test
# 字体过度包含：同一行内加 return true（不要用 \n 字面量——mutate 的锚点要真换行）
node scripts/mutate.mjs --mutate app.js 'function faceCovers(face, codes) {' \
  'function faceCovers(face, codes) { return true;' -- npm run e2e:pwa
```

---

## 候选 4 · i18n 语言标记守卫的两个缺口：函数型条目（26 个）不在 en 纯拉丁检查内；互异/语言标记清单只覆盖 6 个 `screen_*` 键

**严重度：Worth exploring**

证据：

- `test/i18n.test.js:422-429` 的「en 字典表不含汉字/假名」过滤条件是 `typeof v === "string"`。实测（`node -e` 统计）：zh/en/ja 各有 **26 个函数型条目**（`search_more`、`found`、`empty_search`、`pick_who`…）；en 当前函数型条目没有 CJK（**无现行 bug**，是守卫缺口）。即：**把 `en.search_more` 写成中文/日文，这条守卫看不到**。
- 「三语互不相同 + 各带语言标记」的检查（`:353-415`）只覆盖手抄的 6 个键（`:355-362`、`:383-388`），**不含 `screen_locked`（L8 新增）与 `search_more`（搜索 #3 新增）**。存在性有保证（`:10-26` 键集合一致），语义正确性没有。
- 静默方向：函数型 en 文案复制粘贴成中文 → 英文用户看到中文，`npm test` 全绿。

如何自查：

```bash
node -e 'const I=require("./i18n.js");console.log(["zh","en","ja"].map(l=>[l,Object.values(I[l]).filter(v=>typeof v==="function").length]))'
# 变异：把 en.search_more 改成中文，node --test test/i18n.test.js 预期存活
```

---

## 候选 5 · 非阻塞字体加载（#2）的 noscript 兜底无守卫，且字体 URL 在 `index.html` 内已是一式两份

**严重度：Worth exploring**

证据：

- `index.html:20-30`：同一个 `https://fonts.googleapis.com/css2?…` URL 出现两次——主链接（含 `media="print" onload="this.media='all'"`）与 `<noscript>` 兜底；两者逐字相同，**但没有任何测试比较它们或断言 noscript 存在**（`grep -rn 'noscript' test/ e2e/` 仅命中 `e2e/e2e-pwa.cjs:140` 一句注释）。
- 静默方向：① 改字体族时只改一份 → 无 JS 用户拿到另一套字体，无红灯；② 删掉 `<noscript>` → 无红灯（所有套件都开着 JS）；③ 把 `media="print"` 去掉（回退为阻塞加载，#2 的收益静默消失）→ e2e-pwa 的 `measureFonts`（`e2e-pwa.cjs:140-160`）等的是「media 不是 print 且 faces>0」，回退后立即满足，照样绿。
- `sw-cache-rules.js:13-14` 的注释已知「字体源有两份要一起改」——那里说的是 SW 域名单，**index.html 内部的这两份没有出现在任何注释或守卫里**。**不确定**：是否有意容忍（noscript 只服务极小众场景）。

如何自查：

```bash
grep -n 'fonts.googleapis.com' index.html        # 21 与 28 行
grep -rn 'noscript' test/ e2e/                    # 0 个断言
# 变异：删掉 <noscript> 块跑 npm run e2e:pwa → 预期全绿（即无守卫）
```

---

## 候选 6 · `runSuite` 无法证明「应答的就是它起的服务」：绑定失败被吞、占用者被当就绪

**严重度：Speculative**（事实确定，假绿路径条件化——须占用者 docroot 不同）

证据：

- `e2e/_suite.cjs:56-67`：`spawn("python3", [serve.py, port], { stdio: "ignore" })`，只挂 `'error'`（抓 ENOENT 类），**没有任何子进程存活/归属校验**；`:71-79` 的就绪判定是「`base` 上有人答 200」。
- `e2e/serve.py:10` 端口被占时是 `OSError` traceback、exit 1（已实测复现）——不是 spawn 的 `'error'` 事件、stderr 又被 `stdio:"ignore"` 吞掉，所以「自己绑定失败」不可见。
- 后果：端口上已有占用者（历轮残留服务器 / 别的进程）时，`waitServer` 直接判定就绪、body 对着**不是本套件起的服务**跑；自家服务进程已死，`finally` 的 `kill` 也杀不到占用者（残留链条延续）。仓内先例：`docs/reviews/checkpoints.md:2142-2143`（8790 端口历轮遗留服务器，绑定失败被吞，坑掉一整轮探针）。
- 诚实标注：常见情形（同仓残留）docroot 相同、serve.py 按请求读盘，结论与自起等价；**假绿需要一个 docroot 不同的占用者**（低概率）。确定成立的只是「套件分不清自己的服务」+「绑定失败无归因」。

如何自查：

```bash
# 在仓库根起一个任意 200 的占用者，再跑一个套件看它是否毫无怨言地开跑
python3 -m http.server 8871 &  npm run e2e:header
```

---

## 候选 7 · 存储键守卫的扫描集不含其余 `_*.cjs` 助手与 `run-all.cjs`（注释自己记过这个类，但只补了一处）

**严重度：Speculative**

证据：

- `test/e2e-source.test.js:368-377`：「键字面量」扫描集 = `[...suites, "_store.cjs"]`，其中 `suites`（`:369-372`）= 不以 `_` 开头、非 `run-all.cjs` 的 `.cjs`。所以 `_check/_noise/_playwright/_progress/_suite/_ui/_wait.cjs` 与 `run-all.cjs` **都不在扫描内**。
- 同一守卫的注释（`:365-367`）自述「`_` 前缀的助手此前被排除在外 —— 两轴审查抓的正是这个缺口」；补丁只把 `_store.cjs` 加回去（该文件的键本来就派生自 `core.PREF_KEYS`），**类没修**。
- 静默方向：未来新增 `_seed*.cjs` 一类助手写死 `"akb:state:v2:…"`（或用 `localStorage['setItem']` 之类绕开 `localStorage.setItem` 子串判定）→ 两处守卫都看不到；`PREF_KEYS` 改版后种子静默失效——`e2e/_store.cjs:3-5` 描述的正是这个失败形态。
- `AGENTS.md:44` 的表述「E2E 的存储种子…唯一出处是 `e2e/_store.cjs`」比守卫实际扫的面宽。

如何自查：

```bash
sed -n '351,407p' test/e2e-source.test.js   # 看扫描集构造
# 变异：往 e2e/_ui.cjs 里加一行 localStorage.setItem("akb:skin","classic") 跑 npm test → 预期全绿
```

---

## 候选 8 · `e2e/run-all.cjs` 的陈旧文字与不可达检查（一处文件、五个事实）

**严重度：Speculative**

逐条证据（同一文件，SUITES 现为 5 个套件，`:28-34`）：

- `:2`「并行跑**四个** E2E 套件」——同一文件 `:26` 自己写着「5 套件」。
- `:21-23`「与 package.json 的**四条**命令一一对应」——`package.json:14-18` 有五条（e2e / e2e:v5 / e2e:pwa / e2e:header / e2e:first）。
- `:5` 端口清单「8765/8777/8781/8861」漏 `e2e/verify-first-screen.cjs:17` 的 **8871**。
- `:122-123` `--only` 的错误消息手抄「v5,pwa,header,e2e」**漏 first**；对照 `:208-211` 的同类消息用 `SUITES.map` 派生——同一文件里两种做法并存。
- `:223-226` 第二处 `if (!suites.length)` 不可达：`:205-213` 已对同一个 `const suites` 判过并 `exit(2)`。

如何自查：

```bash
sed -n '1,34p;120,127p;203,227p' e2e/run-all.cjs
ls e2e/*.cjs && grep -n '"e2e' package.json
```

---

## 候选 9 · `test/style-artifact.test.js` 里有一对逐字节重复的测试（单提交内重复粘贴）

**严重度：Speculative**（事实确定，影响是维护质量）

证据：

- `test/style-artifact.test.js:1066-1080` 与 `:1097-1111` 内容逐字节相同（`diff` 为空），标题同为「对决：160ms 落盘延迟必须是具名常量并写明原因（它是决策，不是裸字面量）」；全仓 `test/*.js` 仅此一处重名（普查过）。
- 源头：提交 4c2b275 的 diff 内 `+test("对决：160ms …")` 出现两次（中间夹着另一条 undo 测试），是单次粘贴错误、此后一直随函数计数跑两遍（`node --test` 数字虚高）。
- 影响：未来修改这条守卫时改一处、另一处仍以旧断言把关（会「莫名红」或「改不彻底」）；删除时容易删错份数。

如何自查：

```bash
diff <(sed -n '1066,1080p' test/style-artifact.test.js) <(sed -n '1097,1111p' test/style-artifact.test.js)
grep -o '^test("[^"]*"' test/*.js | sort | uniq -d
```

---

## 候选 10 · `test/e2e-check.test.js` 的样本数字与真实套件已漂移（回答了「54 写在哪」：写法则不构成第二份守恒）

**严重度：Speculative**

证据与结论：

- `test/e2e-check.test.js:24` 断言 `summaryLine("v5", 54, 54) === "[v5] 54/54 通过"`；v5 的真实 `expect` 在 `e2e-v5.cjs:21`（现为 54，**恰好吻合**）。
- 但该测试只验证**格式**：改 v5 的 expect 不会让它红，改它也不会让 v5 红——**不是**守恒的第二份表示，无假绿入口。
- 漂移证据在隔壁：`:25` 的 `summaryLine("header", 71, 72)` 与 `e2e/verify-header.cjs:10` 的 `expect: 73` 已不一致（Q3 加过 +1），说明样本数字是装饰、且已经开始与现状脱节，容易被后来者误读为「真实收尾行基线」。

如何自查：

```bash
sed -n '23,26p' test/e2e-check.test.js; grep -n 'expect:' e2e/verify-header.cjs e2e/e2e-v5.cjs
```

---

## 已核查、未构成候选（避免下轮重复挖）

1. **`run-all.cjs` 清单 vs 磁盘**：`test/e2e-source.test.js:471-489` 从磁盘派生式守卫「每个套件必须进 runner」；反向多出会 spawn 失败，loud。
2. **CI 三套件 vs package.json**：改名 → CI 红（loud）；header/first 不入 CI 是 `check.yml:30-33` 明文的取舍。
3. **`_progress.cjs` 心跳 vs 文档**：注释「每 5s」与实现（`s>=5 && s-last>=5`）一致；仓内未找到相互矛盾的描述（`docs/agents/data-pipeline.md:19` 的 ~10s 心跳属于另一工具 `scripts/progress.py`）。
4. **`#boot`（L11）**：无专门守卫（验证是检查点补记十九的一次性 abort 探针），但占位若不被移除会占据首屏，首屏矩阵大概率红——判断为非静默；**未实测**，如需可补一条「JS 关闭/abort 时 #boot 在、正常路径不存在」的常设检查。
5. **`scripts/mutate.mjs` 的异常路径**：基线红 exit 2、锚点命中 ≠1 exit 2、`from===to` 自检、信号/null status 归工具失败、还原与快照交叉核对——未找到假绿方向（仅「坏用法」exit 1 与「工具失败」exit 2 的分界略随意，无后果）。
6. **`e2e-v5.cjs:231` 的 `page.once("dialog", …)`**：若该次点击未弹窗，handler 会留在页面上；但 v5 后续无第二处 confirm 交互，当前无实害。
7. **`_ui.cjs`「五个共享操作」措辞 vs 7 个导出**：操作（5）与判据（firstScreenGeo/Ok）分类上说得通，且 `test/e2e-source.test.js:292-310` 用 deepEqual 钉住 `_ui.cjs` 的导出集合，未列为候选。

## 附：一页速览（按严重度）

| #   | 位置                                    | 一句话                                                                        | 严重度          |
| --- | --------------------------------------- | ----------------------------------------------------------------------------- | --------------- |
| 1   | `package.json:21` / `sw.js`             | lint:undef 漏 sw.js（与 sw-cache-rules.js）；sw.js 无任何静态检查、无测试执行 | Strong          |
| 2   | `scripts/complexity.mjs:119-129`        | 回涨 ≤ 旧峰值被印成「↓ 降了」且绿；Python 解析无自检                          | Worth exploring |
| 3   | `app.js:415-426/1476-1483/1801-1871`    | 搜索上限 / 锁标可及名 / 字体预热四助手零守卫（#duel-live 有）                 | Worth exploring |
| 4   | `test/i18n.test.js:422-429`             | en 纯拉丁不查 26 个函数型条目；互异清单漏 screen_locked/search_more           | Worth exploring |
| 5   | `index.html:20-30`                      | noscript 兜底无守卫；字体 URL 一式两份可静默漂移                              | Worth exploring |
| 6   | `e2e/_suite.cjs:56-79`                  | 就绪判定分不清自起服务与占用者；绑定失败无归因                                | Speculative     |
| 7   | `test/e2e-source.test.js:368-377`       | 键字面量守卫不扫其余 `_*.cjs` 与 run-all.cjs（类未修）                        | Speculative     |
| 8   | `e2e/run-all.cjs:2/5/21-23/123/223-226` | 五处陈旧文字与一处不可达检查                                                  | Speculative     |
| 9   | `test/style-artifact.test.js:1066/1097` | 一对逐字节重复的测试                                                          | Speculative     |
| 10  | `test/e2e-check.test.js:25`             | 样本数字 71/72 与真实 expect 73 漂移（54 无假绿）                             | Speculative     |
