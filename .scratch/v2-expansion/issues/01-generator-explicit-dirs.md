# 01: 管线路径显式依赖（预重构）

**What to build:** 生成器不再从模块全局取路径——`main` 与缩略层接受显式目录依赖（原图/成品/缩略图/仓库根），`wiki` 的 transport/opener 可注入；集成测试删除 `patch.object` 全局自检与真实目录 mtime 守卫，改用显式 tmp 依赖注入；生成行为与产物不变（`--no-dl` 幂等、`members.js` 字节不变）。

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] `main`/缩略层签名接受显式目录；模块常量仅作 CLI 入口默认值
- [x] 集成测试无全局 patch 与真实目录守卫，仍断言幂等与「不写真实目录」
- [x] `npm test` 全绿；`--no-dl` 重跑后 members.js 与 img 目录无变化

## Comments

2026-09-27：`main(argv, dirs, fetch_page, api_fn, fetch_url)`，`default_dirs()` 仅服务 CLI；`wiki.build_opener()` 可注入 opener。集成测试改为显式 tmp dirs（删除 4 处 `patch.object`、补丁自检与真实目录 mtime 守卫）。验证：39 个 Python 测试全绿；`--no-dl` 实测 members.js 字节不变、图片无变化。
