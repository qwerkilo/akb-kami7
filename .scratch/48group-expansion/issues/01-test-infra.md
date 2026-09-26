# 01: 测试基建（node:test + Python unittest）

**What to build:** 一条 `npm test` 命令同时运行 JS（Node 内置 node:test）与 Python（标准库 unittest）测试，作为后续所有实现的 TDD 基座；仓库当前没有任何测试基建。

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] `npm test` 退出码为 0，输出中同时包含 node:test 与 `python3 -m unittest` 的执行结果
- [x] JS 测试可被 `node --test` 自动发现（约定目录），Python 测试可被 unittest discover 自动发现
- [x] 至少各有一个带真实断言的测试（非空跑），示例测试随后续票替换为真实用例
- [x] 测试不依赖网络与代理，在本机（FUSE 挂载）可稳定运行

## Comments

2026-09-26：完成。`npm test` = `node --test && python3 -m unittest discover -s scripts -t scripts -p 'test_*.py'`。JS 2 例（members.js 产物结构不变量），Python 7 例（slug/clean_name/group_of/note_of）；首次运行还纠正了一处错误期望（`note_of` 返回 `AKB48 1期`）。Pillow 12.3.0 已装入本机环境。
