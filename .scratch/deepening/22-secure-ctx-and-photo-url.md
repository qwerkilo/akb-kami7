# ㉒ 两个一行级收口：安全上下文用平台原语、照片 URL 单一出处

- **日期**：2026-09-29
- **来源**：架构扫描 Worth exploring 档的最后两条（候选 5 / 6）
- **性质**：执行既有约定（`file://` 下不注册 SW ✓ / 离线预热 `img/full` ✓），**不是新决定** → 不新立 ADR
- **测试缝**：E2E 黑盒（两条新断言进 `/tmp/opencode/e2e-pwa.cjs` ✓ 不入仓）

## 候选 5：安全上下文判定

`app.js:1096` 原本手搓白名单 `https | localhost | 127.0.0.1 | [::1]` ✓，只用于两处：`pwa_insecure` 原因提示的显隐 ✓ 与 **SW 注册的门**（`if (!swOK || !secureCtx) return;` ✓）。

问题：白名单把 http 侧的 `127.0.0.2`、`*.localhost`（按 W3C 属 potentially-trustworthy ✓）判成「装不了也用不了离线」✗。

**订正（上一版把收益说大了）**：https 一律放行——白名单第一项就是 `location.protocol === "https:"` ✓，所以企业内网 https、GitHub Pages 自定义域修前就是安全的 ✓。真实增量只有 http 侧那两类 ✓。

**关键事实（决定了方案不是「纯换原语」）**：`file://` 在浏览器里 `window.isSecureContext` **也是 true**（potentially-trustworthy ✓），而 `"serviceWorker" in navigator` 在 `file://` 上同样为 true ✓ → 纯换原语会让代码**尝试在 `file://` 注册 SW** ✗，破掉 `AGENTS.md` 与 `docs/agents/pwa.md` 都写着的那条不变量 ✓。

改法：`window.isSecureContext && location.protocol !== "file:"` —— 原语覆盖全部可信源 ✓，单点排除 `file:` 并在注释里写明理由 ✓。

**没动的一处**：`app.js:812` 的 `shareUrl` 判据 `/^(localhost|127\.)/` 问的是另一个问题（「这是不是开发地址、要不要分享」✓），不该一起换 ✓。

## 候选 6：照片 URL 两份实现

`app.js:37` 手拼 `"img/full/" + id + ".webp"` ✓，而 `app.js:135-136` 已在用 `CORE.photoSrc` ✓ —— 同一文件两套写法。`warmPhotos` 里 `const m = BY_ID.get(id)` 就在上一行 ✓（还先判了 `!m || !m.img` ✓）→ 直接 `CORE.photoSrc(m, "full")` ✓，零新接口 ✓。

## 判别力（1 个变异变红，另一个**结构上不可判别**）

| 变异                                              | 结果                         |
| ------------------------------------------------- | ---------------------------- |
| 换回纯 `window.isSecureContext`（放过 `file://`） | 红（原因提示消失）           |
| 照片 URL 换回手拼                                 | **绿**（PWA E2E 42/42 全绿） |

**订正**：上一版这张表把「照片 URL 换回手拼」记成红 —— **实测是绿的**，而且结构上不可能红：两种写法对全部 1375 名成员产出**逐字相同**的 URL（两轴 A/B 实测 0 差异），所以**没有任何测试能区分它们**。那条 E2E 断言守的是「预热这个行为存在」，不是「URL 由谁拼」。

两条新断言在**改代码之前**就是绿的（白名单本来正确）→ 它们是**回归守卫**而非这次改动的红绿循环。

## 两条断言里有一条「不咬」的诚实记账

`file:// 下没有注册 SW` 这条**咬不住**：`navigator.serviceWorker.getRegistration()` 在 `file://` 上本来就抛（无论判定宽窄 ✓），而 `app.js:1284` 的注册 promise 被 catch 住、控制台没有报错 ✓。我试过加一条「控制台无 SW 注册报错」的断言 ✓ ——变异下**仍全绿** ✓ → 已删（不会失败的断言是噪音 ✓）✓。真正能咬住的是**用户可见的那半**：判定放宽时「装不了也不能离线」的原因提示会消失 ✓ ✓（变异下确实红 ✓）。**结论：`file://` 下不注册 SW 这条不变量在浏览器里不可直接观测** ✓，代码里保留门 ✓、测试守住它的可见后果 ✓。

## 验证

`npm test` JS 166 + Python 113；E2E 回归 **95/95**、v5 **49/49**、PWA **42/42**（+2）。

**耐久性缺口（如实记账）**：㉒ 的两条断言都在 `/tmp`（不入仓，见 `docs/agents/pwa.md` 的取舍）→ 仓内对这两处改动**零守卫**。
