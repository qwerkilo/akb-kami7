# 03 · 早安 loader 的装配与 load

- **Status**: ready-for-agent
- **Blocked by**: 01、02
- **所属 spec**：`.scratch/morningmusume/spec.md`
- **缝**：①（纯函数与装配）

## 内容

把 01 的照片回退链与 02 的 parse 接成 `scripts/morningmusume_members.py` 的
装配层，对齐 `love_members.py` 的形状：

1. `build_members(official, wiki)` —— 官网给现役的**资料与照片**，Wikipedia 给
   **期生与毕业状态**，两源按姓名合并。**姓名归一**用 `norm_name`（与等爱共用思路）。
2. `resolve_former_photos` —— 毕业成员走回退链（工单 01 的共享模块）。
   **参数化一个地点**：`archived_list_photos` 要能吃早安的旧站列表 URL
   （`https://helloproject.com/morningmusume/`，**必须带尾斜杠**，不带返回 404），
   而等爱吃的是它自己的 —— 所以站点有关的那两段按站点分别实现，共享模块只给
   与站点无关的三段。
3. `load(fetch, warn=print)` —— 官网 + Wikipedia + 照片，顺序与等爱一致，
   每步打印人数（`早安: N 人（官网）` 这类）。
4. `build_sections(members)` —— 走 `roster.section(group, SERIES, ...)`。
   **早安是一个系列一个团**，所以 sections 里只有一段；`label` 段的分组维度是
   **期生**（与等爱把 `GENERATION = "1期生"` 塞进 section 不同，早安把期生留给
   `members[i].generation`，因为它有 18 期）。

## 关键事实（别自己重新推）

- **现役头像来自官网**，照片是内容哈希文件名（`/upload/images/<sha256>.webp`），
  **无姓名信息** → 只能靠「列表页 DOM 里名字与 img 相邻」配对，不能靠 URL 反查。
- 官网列表页的 `MemberPanel__link` 有 11 个（现役 11 人）。
- 毕业成员在官网上**完全没有页面**（8 个候选 URL 全 404），只能靠回退链。
- 档位对早安**全部成立**（49 人 > 40 档）；期生下拉会出现 18 项，走的是站里现成的
  「分段 label = 筛选维度」机制，**筛选侧零改动**。

## 验收

- `scripts/test_morning_members.py` 覆盖 build 层：两源合并（**含只有一侧有资料的人**）、
  姓名归一、毕业照片回退的**每一级**（含全部失败时的占位）、`build_sections` 的形状。
- **变异验证**：至少四个（合并时覆盖掉一侧 / 归一化写成恒等 / 回退链跳过一级 /
  section 的 series 写错），全部会红。
- `load()` 的网络部分用注入的 fetch 测试，**不发真实请求**。
