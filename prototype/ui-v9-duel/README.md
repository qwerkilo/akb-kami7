# v9 交互范式原型（四版）

v8 那批四版变的是**控件放在哪**，用户反馈「感觉没区别」——因为对决页四版都是
「并排两张脸 + 点一下」。这批换的是**核心交互范式**：你到底做什么动作。

| | 核心动作 | 题数（7 人） | 适合 |
| --- | --- | --- | --- |
| **E 滑选 Swipe** | 上下叠放两张脸，上滑选上/下滑选下，**无按钮** | 14 | 拇指流、沉浸 |
| **F 锦标赛 Bracket** | 一屏两列，**点一列 = 选那一列的 3 个**（选边不选张） | ~3 | 想快、扫一眼 |
| **G 清单 Checklist** | 往下滚，每人标「留/划掉」，走完一次性提交 | 0（1 屏） | 心里已有答案 |
| **H 对照长条 Rail** | 上下两条横向轨，点任一张 → 同步高亮 → 确认 | ~10 | 扫描式比较 |

令牌仍逐字取自主站 `style.css` 的三块真实块（`tokens.css`），数据是 `members.js`
+ `img/`。红线的六条照旧。

## 看

```bash
python3 -m http.server 8831 --directory /tmp/akb-proto-duel/prototype/ui-v9-duel
# http://127.0.0.1:8831/?variant=E&view=duel   （E/F/G/H × skin=classic|sticker × view=pick|duel）
```
