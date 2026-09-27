# 会话状态收成单一深模块（session.js），storage 与成员查询注入

交互状态（系列 / 档位 / 已选 / 对决进度 / 筛选）原先散在 `app.js` 的 12 个事件处理器里（44 处 `state.*` 引用），跨系列隔离、改选作废进度、恢复与损坏丢弃等规则没有单一定义处——上轮的「跨系列串写」事故正由此而来。决定把会话状态收成 DOM 无关的 `session.js`：命名方法 + `snapshot()` 读取；`storage` 适配器与成员查询（`byId`）依赖注入；相位与名次由已有纯函数（`CORE.replay` / `CORE.duelProgress`）派生。`core.js` 保持纯计算与载荷编解码，`app.js` 只做 DOM 渲染、事件转发、i18n、动画与海报。

## Considered Options

- 只收「持久化边界」、筛选等 UI 状态留在 app：事故类（跨系列串写、动画期间竞态）仍然无家可归
- `dispatch(action)` + `snapshot()`（reducer 风格）：接口更小，但在本规模读起来更绕，且不带来新的局部性
- 状态并入 `core.js`：core 是不含存储概念的纯计算模块，混入 localStorage 语义会毁掉它的纯度

## Consequences

- 会话规则（按系列隔离、改选作废进度、完成进结果、损坏/越权数据丢弃）有唯一实现处；`node:test` 用内存 storage 直测接口面（会话模块的测试面＝接口面）。
- `app.js` 变薄，只剩渲染与转发；E2E 42 项黑盒行为不变，作为本次重构的回归基线。
- 沿用 `akb:state:v2:*` 与 `akb:series` 键与 v1 载荷格式，用户已存进度不迁移、不丢失。
