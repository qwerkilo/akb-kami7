# v8 版面原型（四版）

只改**版面骨架**，不动视觉语言 —— 令牌逐字取自主站 `style.css` 的三块真实令牌
（字体共享块 / classic 块 / sticker 块，见 `v8-tokens.css`），成员与照片是真数据
（`members.js` + `img/`）。红线的六条全部照旧：两款皮肤各自的样子、三语言、档位
7/16/40、海报四样式、E2E 几何断言、`core/session/poster` 的模块边界。

## 四版差别

| | 页头 | 对决页 | 已选 |
| --- | --- | --- | --- |
| **A 紧凑页头条** | 一行（品牌+系列+档位+⋯） | 两张脸进首屏 | 底部一条（约 72px） |
| **B 对决沉浸** | 挑人页照旧；进对决收成一条细进度条 | 两张脸撑满首屏 | 右下悬浮药丸 |
| **C 分栏工作台** | 顶栏 + 一行筛选；≥900px 三栏 | 两张脸 + 底部操作条 | 手机底部条 / 桌面右栏 |
| **D 底部抽屉** | 只剩标题栏（点它拉设置抽屉） | 两张脸 + 底部操作条 | 底部把手，点开才是已选板 |

## 看

```bash
python3 -m http.server 8830 --directory /tmp/akb-proto-layout/prototype/ui-v8-layout
# http://127.0.0.1:8830/?variant=A   （A/B/C/D × skin=classic|sticker × view=pick|duel）
```
