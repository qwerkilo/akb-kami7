# 工单 02：守卫与变异

- **Status**: ready
- **Blocked by**: 01

## 实现

1. `test/e2e-source.test.js` 新守卫「页面操作词汇只有一处」：① `_ui.cjs` 的 def 集合 == 五个
   ② 套件（清单派生自磁盘）不许定义这五个 ③ 用到就必须从 `./_ui.cjs` 引入。
2. 变异：① 把 `fillScreening` 抄回 `e2e-v5.cjs` → 守卫红 ② `_ui.cjs` 的划除上限 60→0 →
   `npm run e2e:v5` 红。

## 判据

- 守卫全绿；两条变异都被杀；`npm run check` exit=0。
