# 01 · 把与站点无关的照片回退链提到共享模块

- **Status**: ready-for-agent
- **Blocked by**: 无
- **所属 spec**：`.scratch/morningmusume/spec.md`
- **依据**：grilling R2-Q3；既有 `wiki.py` / `roster.py` 已确立「按能复用来拆」的先例

## 内容

`love_members.py` 里有三段**与站点无关**的照片回退逻辑，与任何具体站点无关：
CDX 查询（`cdx_rows`）、Wayback 取图（`wayback_photo`）、Commons 取图（`commons_photo`）。
早安要用的回退链与它完全同形（官网 SSR + ja.wikipedia + Wayback + Commons）。

1. 新建共享模块（`scripts/photo_chain.py` 或并入既有共享模块，由你判断哪个更贴），
   移入那三段。**保持纯函数**（网络经注入的 fetch）、fixture 驱动测试随之迁过去。
2. `love_members.py` 改成 import，**逐字保持行为不变**。
3. **不动**站点有关的那两段（`archived_photo_pairs` / `archived_list_photos`）——
   它们编码的是等爱旧站的 HTML 形状，早安要自己写。

## 为什么不直接 `from love_members import ...`

那样「早安依赖等爱」，而 `love_members` 的模块 docstring 写的是「等爱系列成员
数据」—— 它会变成一个什么都有的杂物间，且它的模块名不再是准确的描述。

## 验收

- **等价性证明**：移动前后的链对同一批输入（fixture 里的 URL）产出**逐字相同**的
  结果。用 `scripts/mutate.mjs` 至少打三个变异（改了返回形状 / 改了回退次序 /
  去掉了 Commons 分支），全部会红。
- `npm test` 全绿，Python 测试数不减少（迁移不是删除）。
- 现有 `test_love_members.py` 的照片相关用例要么跟着迁到新模块的测试文件，
  要么证明它们仍然通过 —— 不允许「测试没了所以绿」。
