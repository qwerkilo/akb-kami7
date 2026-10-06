# 工单 02：E2E 砍浪费（header / v2 / v5）

- **Status**: resolved
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

## 背景更新（2026-10-05 工单 07 之后）

主套件已从 21m07s 降到 **3m02s**，**header（4m04s）成了新的长杆** —— 本工单的收益
直接决定全量并行（当前 5m12s）还能降多少。

## 实现记录（2026-10-06）

**实现**：

1. `verify-header.cjs`：一次性取「档位 × 系列 → 成员 id」表（原来每个状态自己 goto+reload
   两次只为拿它）→ 每个状态 `ctx.addInitScript` 种 localStorage + **单次 goto**
   （72 → 36 次页面加载）。
2. `e2e.cjs` 的 v2 块：`goto+ready → clear → reload` 改成「先 clear 再 goto」
   （与其余块一致的写法）—— 第一次完整加载（含 ready）不再被丢掉。
3. `e2e-v5.cjs`：新建 context 的 localStorage 本来就是空的 → 删掉 goto→clear→reload
   里那次多余加载。

**实测（`npm run e2e:all`，4/4 全绿）**：header **4m04s → 3m45s**（72→36 次加载）、
主套件 3m55s（v2 块省一次完整加载）、v5 36s、pwa 50s，总 **5m11s**。

## 注意

- **不要动** `ready()` 的「等什么」：它刚被工单 07 修正（视口内图片 + 字体），
  再改就是拆自己刚立的判据。
- v2/v5 的 clear 时机要保证「种 key 后 reload」的语义不变（否则测的就不是同一个场景）。
