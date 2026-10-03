# handoff · 未解决的 bug：℃-ute 折叠段展开后 0 张卡

- **日期**：2026-10-02
- **基点**：`a754e8d`（工单 03 部分收口，干净工作区）
- **工单**：`.scratch/helloproject-cute/issues/03-real-fetch.md`（Status: partially-resolved）
- **为什么停在这里**：诊断回路已经建好并确认红，但 Phase 4（打点）连续多次工具调用
  失败/输出退化，继续硬啃的边际收益为负。按 ask-matt 的 Phase boundaries，此处该交接。

## 症状（用户原话症状）

切到早安系列 → 点「℃-ute」的团头 → 折叠状态**正确翻转**（`aria-expanded` 与
`hidden` 都对），但**段里永远是 0 张卡**。点两次来回翻转，始终 0 张。无 JS 报错。
对照：モーニング娘。同位置 51 张。

## 回路（已验证：确定性、8 秒、能区分「不是这个 bug」）

```bash
node /tmp/opencode/repro-cute-toggle.cjs
```

- 退出码 **1** = 本 bug（℃-ute 0 张、对照团 > 0 张）
- 退出码 **2** = 回路没走到目标状态（对照团也是 0 张）—— **不是本 bug，别照着查**
- 连跑两次都是「红」，确定性成立

⚠️ **`serve.py` 只吃端口，docroot 来自进程 `cwd`** —— 必须
`spawn("python3", ["/tmp/opencode/serve.py", port], { cwd: "/mnt/sdcard/Download/akb-kami7" })`。
把目录当第二个参数传会被忽略，服务的是当前目录，症状是「页签不可见」，
看起来像产品坏了。这个坑我踩过三次（`e2e-pwa.cjs`、`probe-love.cjs`、本次）。

## 已排除（有证据，不是推测）

| 假设 | 排除方式 |
|---|---|
| `core.rosterView` 逻辑层 | node 里跑真实 `members.js`：`℃-ute(段1, 计数8)` —— **绿的** |
| `simplified.js` 里没有℃-ute | 全文搜索：它只有 1671 字节，**两个团都没有** |
| `nested()` 依赖期生 | 它就是 `return snap.group === "all"` |
| 渲染时抛异常 | pageerror 监听器捕获，**无错误** |
| H1：缺 `generation` 键 | 差分回路：给 8 人补 `generation: ""` → **仍红** |
| H4：缺 `nick_aliases` | 差分回路：两个键都补 → **仍红** |

⚠️ **上面两条差分实验本身是无效的** —— 它们跑在一份**不完整的站点拷贝**上
（只 copy 了部分文件），页签都找不到。结论「仍红」不能当证据。
**重做这两条时先确认拷贝能跑**（最省事的做法：`tar` 整份仓库、排除
`.git`/`.scratch`/`img`/`node_modules`/`.codegraph`）。

## 关键线索：两个团的成员键集不一样

```
℃-ute         : id,name,kana,nick,status,end,img,bio
モーニング娘。: id,name,kana,nick,status,end,img,bio,generation,nick_aliases
```

两者都出自 `roster.project` 的同一个 `optional` 列表，却不一样 —— 这条差异值得先查。

## 下一步的三条路（按建议顺序）

1. **先在浏览器里直接量** `content()` 返回什么。在 `toggleSection` 里插一行带标记的
   打点（我插的版本在 `/tmp/opencode/site-h1/app.js`，但那份拷贝是坏的，重做）：
   ```js
   const v = rosterView();
   const node = v.nodes.find((n) => n.group === key);
   document.body.setAttribute("data-dbg", JSON.stringify({
     key, open, opts: viewOpts(),
     nodeKeys: v.nodes.map((n) => n.group),
     secCount: node ? node.sections.length : "NO-NODE",
     members: node ? node.sections.map((x) => x.members.length) : null,
   }));
   ```
   `NO-NODE` 与 `members: [0]` 指向完全不同的两条路。
2. **对比 node 与浏览器的 `rosterView` 输入**。node 里绿、浏览器里红 → 差异在
   `viewOpts()` 的 `snap.*`（尤其 `snap.group` / `snap.query` / `snap.filter`）。
   在页面里把 `rosterView().nodes` 打出来，与 node 层的输出对比。
3. 若 1、2 都指向数据差异，就查 `roster.project` 为什么对℃-ute 少投影两个键
   （它是 Python 侧 `scripts/roster.py` 的 `optional` 处理，与 `generation`
   为空就省略的既有行为可能相关）。

## 修好之后必须做的

- 在 `test/members-artifact.test.js` 或新的产物测试里补一条守卫，钉住
  「每个团段的成员键集与モーニング娘。一致」—— 那是本 bug 的可自动化形态
- 重跑 `/tmp/opencode/e2e.cjs`：现在 **231/238**，其中 2 条红正是这个 bug
- 工单 03 从 `partially-resolved` 改回 `resolved`

## 同批未做的

- **工单 04**（系列改名 / 期生按团隐藏 / 身高上资料卡）：**别在修好这个 bug 之前做** ——
  期生按团隐藏要动的正是 `generation`，两件事叠在一起会让这个 bug 更难定位
- **工单 05**（守卫与整体验收）：依赖 04
- 另外 5 个散文团（Juice=Juice / つばき / BEYOOOOONDS / OCHA NORMA / ロージー）：
  需独立工单 + 散文解析器，spec 已记
- 推送：本地领先若干提交，用户暂缓