# 架构深化 ③：设计 token 单一来源

**What to build:** 海报绘制使用的颜色与字体栈不再与 `style.css` 各存一份：CSS `:root` 是唯一来源，app 读取 `getComputedStyle` 后注入 `AKB_POSTER.draw({tokens})`；poster 保留内置 `defaultTokens()` 作为缺省（node 测试与无 DOM 场景可用）。

**Blocked by:** None

**Status:** resolved

## Comments

2026-09-27：按 grilling 结论实现——`poster.js` 删除模块级 `C`/`UI_FONT`/`JP_FONT`/`DISPLAY`，改为 `defaultTokens()` + `resolveTokens(tokens)`，并把 tokens 以参数贯穿全部内部绘制函数（无模块级可变状态）；`draw` 缺省回退默认 tokens 并导出 `defaultTokens`。app 新增 `posterTokens()`：从 `:root` 读 7 色（`--floor/--card/--ink/--muted/--line/--pink`，海报胶带取 `--lemon`）与三个字体栈（`--font-ui/--font-jp/--font-display`），空白归一后注入。测试：假 ctx 升级为记录 `fillStyle`/`font` 赋值；新增用例断言注入值生效（含榜首 pink 与胶带 tape 两处）且缺省回退内置。验证：`npm test` JS 59 + Python 47、E2E 42/42、海报截图目测一致（7 人版）。
