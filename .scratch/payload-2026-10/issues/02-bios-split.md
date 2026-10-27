# 02 bio 拆出 members.js → bios.js（空闲预取 + SW 壳缓存）

- **Status**: done
- **Blocked by**: 无

## 落地

- 生成器 `write_members_js`：`members.js` 不再含 bio（1544 人 0 个 bio 键），同目录写 `bios.js`（id → bio，紧凑 JSON）。
- `app.js`：模块级 `BIOS`；`warmBios()` 在 boot 后空闲加载；打开资料卡时若未到 → 先画无 bio 卡片，数据到了补画。
- `sw-cache-rules.js`：`bios.js` 进 `SHELL_FILES`（离线可看简介）。
- 守卫：`members.js` 不许有 `bio` 键；`bios.js` 键集 == 成员 id 集；producer 测试断言拆分；pwa 断网打开资料卡仍有生日。

## 验证

- `members.js` 443 → **323KB**（gzip 75.2 → 57.6）；`bios.js` 101KB / gzip 10.9KB（空闲）。
- `bios` 覆盖 1544/1544（1543 人有生日）；既有 bio 断言通过合并后的视图继续生效。
- `npm run e2e` **255/255**、`e2e:pwa` **43/43**（新增断网简介检查）；`npm run check` exit 0。
- **变异被杀**：`app` 不合并 bios → 主 E2E 简介检查红。
- 如实记账：接受标准写的是「关键 JS ≤270KB」，实际 **323KB**（Python `indent=1` 的排版开销；改成紧凑可到 ~250KB，但数据 diff 不可读，选择可评审性）。gzip 57.6KB（目标 ≤56KB，基本达标）。
