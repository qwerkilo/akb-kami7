# 深化 ⑬：海报页框与卡片面板单一出处（含 normalizeName / 缓存路径）

扫描（2026-09-28 v3）批次 2 的三处「知识两份 + 静默失配点」收口。

## 做法

- **B1 `frame(W, H)`**：海报四样式各自手写的左右边距 72 与内容界线 `H-84` 收成单一出处（`{margin, right, footerTop}`）。
- **B2 `panel(ctx, T, x, y, w, h, r, {color,blur,dy,stroke})`**：「阴影 + 卡片底 + `cardStroke` 描边」的卡片面板收成一处，`slotCard`/榜单领奖台/拼贴贴纸标题/拼贴拍立得四处消费（阴影参数由各样式传入，保留既有差异）。
  - **顺带修复真漂移**：拼贴拍立得此前不消费 `cardStroke`——贴纸皮肤下少 3px 墨描边（与同皮肤其他卡片不一致）。修复只影响贴纸皮肤（原版 `cardStroke=0` 无描边，行为不变）。
- **B3 `rankColor(rank, T)`**：前三样式共享的「前 7 名品牌粉、其余墨色」规则从 4 处手写收成一处（样式 a 的名次胶带自成一套，不参与）。
- **D `normalizeName`**：变体正则改由 `Object.keys(VARIANTS)` 生成（字符类转义），消除「表与正则各写一份」的静默失配点。
- **E `orig_path(mid, url, dir)`**：`scripts/fetch_members.py` 的原图缓存路径契约（id + URL 扩展名小写）从下载与缓存命中两处收成一处。

## 验证

- **海报调用序列对拍**（自建记录型 ctx，四样式 × 7/16/32/40 共 16 组）：**a/b/c 全部逐字节一致**；d 的差异仅两类——① 32/40 档分别新增 32/33 次 3px 墨描边（拍立得补的边框，贴纸皮肤实拍核对）；② 每张卡片的 `shadowColor="transparent"` 手工复位（d-32：33 处）被 `panel` 的 `save/restore` 取代（像素等价）。
- `npm test` JS 128 + Python 83；E2E 回归 86/86、v5 49/49。

## 备注

- `panel` 的 `stroke` 入参供 `slotCard` 的 compact 语义（`min(2, cardStroke)`）使用；其余卡片用默认 `cardStroke`。
- 扫描提到的「濑/瀨 疑似漏改」经复核是扫描代理的转写误差（实际正则与表一致，`渡邊→渡辺`/`山﨑→山崎`/`髙橋→高橋` 实测通过）；本次仍以「单一出处」消除维护隐患。
