# 02: 抽出 core.js（行为不变的重构）

**What to build:** 把排名、筛选与搜索等与 DOM 无关的纯逻辑从单文件界面代码中抽出为独立模块，供 node:test 直接测试；页面行为与视觉零变化。这是"先把改动变容易"的预重构。

**Blocked by:** 01

**Status:** resolved

- [x] 新模块不引用 DOM/浏览器 API，测试中可直接加载
- [x] node:test 覆盖：对决序列可回放（同一答案序列还原同一名次）、最坏题数（worstCase）、状态筛选、搜索归一
- [x] 界面代码改为消费该模块；选人/对决/结果/语言切换功能与重构前一致
- [x] 页面脚本加载顺序正确，`npm test` 全绿

## Comments

2026-09-26：完成。`core.js`（UMD，浏览器挂 `window.AKB_CORE`、Node 走 module.exports）导出 `normalizeName / isVisible / replay / worstCase / shuffle`；`app.js` 改为消费之，`index.html` 在其后加载。验证：JS 7 例 + Python 7 例全绿，`node --check` 通过，无残留旧引用；浏览器端实测留到 07 端到端验收。
