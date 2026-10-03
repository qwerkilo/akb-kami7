# 03 · 管线：loader 扩到 11 团 + 真实抓取 + 缺口名单

- **Status**: ready-for-agent
- **Blocked by**: 02
- **所属 spec**：`.scratch/helloproject-all/spec.md`
- **缝**：①（管线纯函数）

## 内容

1. `morningmusume_members.py` 的 `GROUPS` / 官网 `SITES` 扩到 11 团；
   `load()` 对 6 个现役团抓官网列表（+ 详情页仅在需要时）、对全部团抓
   ja.wikipedia 条目。
2. **源门**：`read_baseline` 已按 `GROUP_ORDER` 泛化，**先核实**新团自动进基线；
   若不进，扩它 —— 门的三个判据（团消失 / 总数腰斩 / 逐团下限）必须覆盖 11 团。
3. **真实抓取一次**（`AKB_PROXY=` 直连 + 自带 UA 已实测可用；**请求间节流 ≥3s**，
   上一轮 429 假象的教训）：产出**照片缺口名单**（逐人点名），写进工单。
   注意 Commons 会限流 —— 缺口名单要注明「是否被限流影响」。
4. 抓完核对：4 个合并者只出现一次、停止活动团全员 former、人数与工单 01 的
   fixture 计数一致（± 上游变动）。

## 验收

- 注入式离线测试：loader 覆盖 11 团（假 fetch），门对 11 团会响。
- 真实抓取 `exit 0`（门正确放行）；缺口名单写进本工单（逐人）。
- 产物重新生成后 `members.js` 变化，**必须跑三套 E2E**（本批唯一会改产物的一单）。
- `npm run check` 退出码 0；复杂度棘轮未推高。
