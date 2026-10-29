# 01 · core：分享链接编解码（纯函数）

- **Status**: resolved
- **Blocked by**: 无
- **缝**：② `test/core.test.js`

## 内容

新增 `encodeShare({series,size,ids,title})` → query 串；`decodeShare(search)` → 对象或 null。

- 语法校验：系列 ∈ `SERIES_KEYS`、档位 ∈ `SIZES`、`ids.length === size`、id 匹配 `^m[0-9a-f]{10}$`、
  无重复、标题去控制字符并截到 24（与输入框 maxlength 一致）。
- `decodeShare` 对额外参数无感；空/坏串返回 null。
- 不做成员归属校验（core 不认识成员表，由 app 负责）。

## 验收

roundtrip（含 40 档、日文标题）、坏系列/坏档位/数量不符/重复 id/坏 id 五类返回 null。

## Comments

2026-10-29 实现：`core.encodeShare` / `core.decodeShare`（语法校验 + 标题去控制字符、截 24）。
`test/core.test.js` 新增 4 条（roundtrip 7/40 档、五类非法输入、encode 空串与截断），core 124/124；
**变异 2/2 被杀**（去掉重复 id 校验、去掉标题截断）。

审查后补：`Object.hasOwn` 防 `constructor/__proto__`；URL 手拼保留字面逗号；导出 `SHARE_TITLE_MAX`
并与 `index.html` 的 maxlength 互钉；新增 3 条单测（原型键、控制字符、maxlength），core 127/127；
另 2 个变异被杀（原型键放行、逗号编码）。
