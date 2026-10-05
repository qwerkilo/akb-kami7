# 工单 02：E2E 砍浪费（header / v2 / v5）

- **Status**: ready-for-agent
- **Blocked by**: 无

## 目标

删掉三处**纯浪费**的页面加载与等待（不动任何断言语义）：

1. `e2e/verify-header.cjs`：每个状态**先 goto 再 reload**（goto 只为拿到 origin/localStorage）
   → 改成 `addInitScript` 种 localStorage + **单次 goto**（72 次加载 → 36 次）。
2. `e2e/e2e.cjs` 的 v2 块：先 `goto`+`ready` 再 clear+reload —— 第一次完整加载被丢弃。
3. `e2e/e2e-v5.cjs`：同样先 goto 再 clear+reload。

## 判据（可证伪）

1. header 的页面加载次数 **72 → 36**（用计数探针或日志验证，不靠估算）。
2. 四套件 check 数不变（245 / 54 / 43 / 72）且全绿。
3. 实测 header 墙钟明显下降（记录前后数字）。

## 注意

- **不要动** `ready()`（等图片 + 字体）：它防的是断言在资源未就绪时假绿/假红，收益小、风险大。
- v2/v5 的 clear 时机要保证「种 key 后 reload」的语义不变（否则测的就不是同一个场景）。
