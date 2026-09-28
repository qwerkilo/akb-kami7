/* 方案 A · 向导模式：三步指示器 + 引导卡 + 进度环与里程碑，把流程显式化、降低首次使用压力 */
(function () {
  "use strict";
  const api = window.PROTO.api;
  const {
    esc,
    S,
    t,
    CORE,
    toast,
    openProfile,
    cardHTML,
    fighterHTML,
    slotsHTML,
    ringHTML,
  } = api;
  const FOLD = CORE.foldIndex(window.AKB_SIMPLIFIED || {});

  window.PROTO.register({
    key: "A",
    name: "向导模式",
    desc: "常驻三步指示器 + 引导卡 + 进度环/里程碑 + 对决说明与续玩卡：把「现在在哪一步」说清楚",
    mount(root, api) {
      const ui = { view: "pick", coach: true, intro: true, answering: false };
      let tree = [];
      const secMembers = new Map();

      const snap = () => S.snapshot();

      /* ---------- 骨架 ---------- */
      function stepsHTML(s) {
        const picked = s.selected.length;
        const duelOk = s.duel || picked >= s.size;
        const resultOk = s.phase === "result";
        const cur = ui.view;
        const step = (n, id, label, on, extra) =>
          `<button type="button" class="vA-step${cur === id ? " on" : ""}" data-step="${id}" ${on ? "" : "disabled"}>
            ${n} ${label}${extra ? `<b>${extra}</b>` : ""}</button>`;
        return `<div class="vA-steps" role="tablist">
          ${step("①", "pick", "挑人", true, `${picked}/${s.size}`)}
          <span class="vA-sep">›</span>
          ${step("②", "duel", "对决", duelOk, s.duel ? `第 ${s.duel.step} 题` : "")}
          <span class="vA-sep">›</span>
          ${step("③", "result", "出图", resultOk)}
        </div>`;
      }

      function render() {
        const s = snap();
        if (ui.view !== "pick" && s.phase === "result") ui.view = "result";
        if (ui.view === "result") return renderResultPhase(s);
        if (ui.view === "duel" && s.phase === "duel") return renderDuelPhase(s);
        ui.view = "pick";
        return renderPickPhase(s);
      }

      /* ---------- 选人 ---------- */
      function renderPickPhase(s) {
        ensureOpen(s);
        s = snap();
        tree = CORE.groupSections(api.seriesGroups(s.series), "all");
        const resume = s.duel
          ? `<div class="vB-resume" style="margin:12px 0">
              <p><b>有一场进行中的对决</b><br>第 ${s.duel.step} / 最多 ${s.duel.max} 题 · 已完成 ${s.duel.percent}%</p>
              <button type="button" class="btn primary" data-act="resume">继续对决</button>
            </div>`
          : "";
        const coach = ui.coach
          ? `<div class="vA-coach">
              <p><b>三步挑出你的${esc(api.namesFor(s.series, s.size).brand)}</b>
              ① 在下面选满 ${s.size} 位 ② 两两对决排出顺序 ③ 生成海报。
              选满后按钮会亮起，进度会自动保存。</p>
              <button type="button" class="btn sm" data-act="coach">知道了</button>
            </div>`
          : "";
        root.innerHTML = `${stepsHTML(s)}<div class="wrap">
          ${coach}${resume}
          <div class="vA-progress" id="vA-progress"></div>
          <div class="vA-tools">
            <div class="seg seg-series">${["48g", "sakamichi", "love"]
              .map(
                (k) =>
                  `<button type="button" role="radio" aria-checked="${s.series === k}" data-series="${k}">${esc(api.namesFor(k, s.size).seriesLabel)}</button>`
              )
              .join("")}</div>
            <div class="seg seg-size">${[7, 16, 32]
              .map(
                (n) =>
                  `<button type="button" role="radio" aria-checked="${s.size === n}" data-size="${n}">${esc(api.namesFor(s.series, n).brand)}</button>`
              )
              .join("")}</div>
            <div class="seg seg-filter">${[
              ["all", "全部"],
              ["current", "现役"],
              ["former", "已毕业"],
            ]
              .map(
                ([k, v]) =>
                  `<button type="button" role="radio" aria-checked="${s.filter === k}" data-filter="${k}">${v}</button>`
              )
              .join("")}</div>
            <label class="field" style="max-width:150px"><span class="visually-hidden">团体</span>
              <select id="vA-group"><option value="all">全部团体</option>${tree
                .map(
                  (n) =>
                    `<option value="${esc(n.group)}" ${s.group === n.group ? "selected" : ""}>${esc(n.group)}</option>`
                )
                .join("")}</select></label>
            <label class="field" style="flex:1;min-width:160px"><span class="visually-hidden">搜索</span>
              <input id="vA-search" type="search" placeholder="搜索名字（汉字/假名/昵称）" value="${esc(s.query)}"></label>
          </div>
          <div id="vA-roster"></div>
          <div class="tray"><div class="tray-in">
            <ol class="slots" id="vA-slots"></ol>
            <button type="button" class="btn sm" data-act="clear" ${s.selected.length ? "" : "disabled"}>清空</button>
            <button type="button" class="btn primary" data-act="start" ${s.selected.length >= s.size ? "" : "disabled"} id="vA-start"></button>
          </div><p class="tray-hint">点卡片选中/取消；点右上角 i 看简介。</p></div>
        </div>`;
        renderRoster(s);
        renderProgress(s);
        renderTray(s);
      }

      function ensureOpen(s) {
        if (s.open.length || s.query || s.group !== "all") return;
        const t0 = CORE.groupSections(api.seriesGroups(s.series), "all");
        const first = t0[0];
        if (!first) return;
        S.toggleOpen("g:" + first.group);
        const sec = first.sections[0];
        if (sec) S.toggleOpen(first.group + "#" + sec.label);
      }

      function rosterHTML(s) {
        secMembers.clear();
        const q = CORE.normalizeName(s.query);
        if (q) {
          const hits = [];
          for (const g of api.seriesGroups(s.series)) {
            if (s.group !== "all" && g.group !== s.group) continue;
            for (const m of g.members)
              if (
                CORE.isVisible(m, s.filter) &&
                api.CORE.haystack(m, FOLD).includes(q)
              )
                hits.push(m);
          }
          return hits.length
            ? `<p class="muted" style="margin:6px 2px">找到 ${hits.length} 位</p><div class="pcard-grid">${hits.map((m) => cardHTML(m, { showGroup: true })).join("")}</div>`
            : `<p class="muted" style="margin:12px 2px">没有匹配「${esc(s.query)}」的成员，换个关键词试试（可搜汉字 / 假名 / 昵称）</p>`;
        }
        const out = [];
        for (const node of tree) {
          if (s.group !== "all" && node.group !== s.group) continue;
          const key = "g:" + node.group;
          const open = s.open.includes(key);
          const all = node.sections
            .flatMap((x) => x.members)
            .filter((m) => CORE.isVisible(m, s.filter));
          if (!all.length) continue;
          const picked = all.filter((m) => s.selected.includes(m.id)).length;
          out.push(`<section class="vA-grp">
            <button type="button" class="vA-head" data-grp="${esc(node.group)}" aria-expanded="${open}">
              <span>${open ? "▾" : "▸"}</span><span>${esc(node.group)}</span>
              <span class="n">${all.length} 人</span>
              ${picked ? `<span class="pk">已选 ${picked}</span>` : ""}
            </button>
            ${open ? node.sections.map((sec) => sectionHTML(sec, node.group, s)).join("") : ""}
          </section>`);
        }
        return out.join("") || `<p class="muted">没有符合条件的成员</p>`;
      }

      function sectionHTML(sec, group, s) {
        const ms = sec.members.filter((m) => CORE.isVisible(m, s.filter));
        if (!ms.length) return "";
        const secId = `${group}#${sec.label}`;
        secMembers.set(secId, ms);
        const open = s.open.includes(secId);
        const picked = ms.filter((m) => s.selected.includes(m.id)).length;
        return `<section class="vA-gen">
          <button type="button" class="vA-head" data-gen="${esc(secId)}" aria-expanded="${open}">
            <span>${open ? "▾" : "▸"}</span><span>${esc(sec.label)}</span>
            <span class="n">${ms.length} 人</span>
            ${picked ? `<span class="pk">已选 ${picked}</span>` : ""}
          </button>
          ${open ? `<div class="vA-body"><div class="pcard-grid">${ms.map((m) => cardHTML(m)).join("")}</div></div>` : ""}
        </section>`;
      }

      function renderRoster(s) {
        root.querySelector("#vA-roster").innerHTML = rosterHTML(s);
      }

      function renderProgress(s) {
        const el = root.querySelector("#vA-progress");
        if (!el) return;
        const picked = s.selected;
        const byGroup = new Map();
        picked.forEach((id) => {
          const m = api.BY_ID.get(id);
          if (m) byGroup.set(m.group, (byGroup.get(m.group) || 0) + 1);
        });
        el.innerHTML = `${ringHTML(picked.length, s.size)}
          <div class="vA-cov">
            <b style="flex-basis:100%;font-size:13px">已选 ${picked.length} / ${s.size} 位${
              picked.length >= s.size
                ? " · 选满啦！"
                : ` · 还差 ${s.size - picked.length} 位`
            }</b>
            ${[...byGroup.entries()]
              .map(
                ([g, n]) => `<span class="chip">${esc(g)} <b>${n}</b></span>`
              )
              .join("")}
          </div>`;
      }

      function renderTray(s) {
        const slots = root.querySelector("#vA-slots");
        if (!slots) return;
        slots.innerHTML = slotsHTML(s.selected, s.size);
        const clear = root.querySelector('[data-act="clear"]');
        if (clear) clear.disabled = !s.selected.length;
        const start = root.querySelector("#vA-start");
        if (start) {
          start.disabled = s.selected.length < s.size;
          start.textContent =
            s.selected.length < s.size
              ? `还差 ${s.size - s.selected.length} 位`
              : `开始对决（约 ${CORE.worstCase(s.size)} 题）`;
          start.classList.toggle("big", s.selected.length >= s.size);
        }
      }

      /* ---------- 对决 ---------- */
      function renderDuelPhase(s) {
        const d = s.duel;
        if (!d) {
          ui.view = "pick";
          return renderPickPhase(s);
        }
        root.innerHTML = `${stepsHTML(s)}<div class="wrap">
          <div class="vB-instr" style="margin-top:12px">
            <span><b>${d.step}</b> / 最多 ${d.max} 题</span>
            <span class="muted">已完成 ${d.percent}% · 还剩约 ${d.remaining} 题 · 约 ${Math.max(1, Math.ceil(d.etaSeconds / 60))} 分钟</span>
            <span class="vA-save" style="margin-left:auto">进度已自动保存</span>
          </div>
          <div class="vA-segbar">${Array.from({ length: d.max }, (_, i) => `<i class="${i < d.step - 1 ? "on" : ""}"></i>`).join("")}</div>
          <div class="duel-row" style="margin-top:12px">
            <button type="button" class="fighter" data-side="0">${fighterHTML(api.BY_ID.get(d.pair[0]))}</button>
            <span class="vs">VS</span>
            <button type="button" class="fighter" data-side="1">${fighterHTML(api.BY_ID.get(d.pair[1]))}</button>
          </div>
          <div class="res-actions" style="margin-top:12px">
            <button type="button" class="btn" data-act="undo" ${d.canUndo ? "" : "disabled"}>撤回上一题</button>
            <button type="button" class="btn" data-act="leave">保存并返回</button>
          </div>
          <p class="muted" style="margin-top:10px;font-size:12px">键盘可用 ← → 选择，Z 撤回</p>
        </div>`;
        if (ui.intro) {
          const ov = document.createElement("div");
          ov.className = "vA-intro";
          ov.innerHTML = `<div class="vA-intro-card">
            <h2>开始两两对决</h2>
            <ol>
              <li><b>①</b> 每次出现两张脸，点你更喜欢的一张</li>
              <li><b>②</b> 最多 ${d.max} 题（约 ${Math.max(1, Math.ceil(d.etaSeconds / 60))} 分钟）</li>
              <li><b>③</b> 进度自动保存，可随时离开再回来</li>
            </ol>
            <div class="res-actions">
              <button type="button" class="btn primary big" data-act="intro-go">开始</button>
              <button type="button" class="btn big" data-act="intro-skip">跳过说明</button>
            </div>
          </div>`;
          root.appendChild(ov);
          ov.addEventListener("click", (e) => {
            if (
              e.target.closest('[data-act="intro-go"]') ||
              e.target.closest('[data-act="intro-skip"]')
            ) {
              ui.intro = false;
              ov.remove();
            }
          });
        }
      }

      function answer(side) {
        if (ui.answering) return;
        const s = snap();
        if (s.phase !== "duel") return;
        ui.answering = true;
        const a = root.querySelector('[data-side="0"]');
        const b = root.querySelector('[data-side="1"]');
        const win = side === 0 ? a : b;
        const lose = side === 0 ? b : a;
        if (win) win.classList.add("picked");
        if (lose) lose.classList.add("dim");
        setTimeout(() => {
          ui.answering = false;
          S.answer(side === 0);
          const after = snap();
          if (
            after.phase === "duel" &&
            after.duel &&
            after.duel.percent >= 50 &&
            after.duel.percent < 56
          )
            toast("已完成一半，保持节奏");
          render();
        }, 180);
      }

      /* ---------- 结果 ---------- */
      function renderResultPhase(s) {
        root.innerHTML = `${stepsHTML(s)}<div class="wrap"><div id="vA-result"></div></div>`;
        api.renderResult(root.querySelector("#vA-result"), {
          reveal: true,
          onRestart: () => {
            S.abandonDuel();
            ui.view = "pick";
            render();
          },
          onResort: () => {
            const ids = snap().ranking.slice();
            S.startDuel(CORE.shuffle(ids));
            ui.view = "duel";
            render();
          },
        });
      }

      /* ---------- 事件 ---------- */
      root.addEventListener("click", (e) => {
        const step = e.target.closest("[data-step]");
        if (step) {
          const id = step.dataset.step;
          const s = snap();
          if (id === "pick") {
            if (s.duel) S.abandonDuel();
            ui.view = "pick";
            render();
          } else if (id === "duel" && (s.duel || s.selected.length >= s.size)) {
            if (!s.duel && !api.beginDuel()) return;
            ui.view = "duel";
            render();
          } else if (id === "result") {
            ui.view = "result";
            render();
          }
          return;
        }
        const info = e.target.closest(".pcard-i");
        if (info) return openProfile(info.dataset.info);
        const head = e.target.closest("[data-grp]");
        if (head) {
          S.toggleOpen("g:" + head.dataset.grp);
          return renderRoster(snap());
        }
        const gen = e.target.closest("[data-gen]");
        if (gen) {
          S.toggleOpen(gen.dataset.gen);
          return renderRoster(snap());
        }
        const card = e.target.closest(".pcard");
        if (card) {
          if (!S.toggleSelect(card.dataset.id)) {
            toast(`已选满 ${snap().size} 位；点底部头像可先移除一位`);
            return;
          }
          const s = snap();
          if (s.selected.length === s.size)
            toast("选满啦！点「开始对决」进入两两对比");
          syncPicked();
          return;
        }
        const rm = e.target.closest("[data-remove]");
        if (rm) {
          S.toggleSelect(rm.dataset.remove);
          return syncPicked();
        }
        const fighter = e.target.closest("[data-side]");
        if (fighter) return answer(+fighter.dataset.side);
        const act = e.target.closest("[data-act]");
        if (!act) return;
        const a = act.dataset.act;
        if (a === "coach") {
          ui.coach = false;
          render();
        } else if (a === "start") {
          if (!api.beginDuel()) return;
          ui.view = "duel";
          render();
        } else if (a === "resume") {
          ui.view = "duel";
          render();
        } else if (a === "clear") {
          if (window.confirm("清空已选成员？")) {
            S.clearSelection();
            syncPicked();
          }
        } else if (a === "undo") {
          S.undo();
          render();
        } else if (a === "leave") {
          ui.view = "pick";
          render();
          toast("对决进度已保存，回到挑人页");
        }
      });

      root.addEventListener("input", (e) => {
        if (e.target.id !== "vA-search") return;
        clearTimeout(ui.tm);
        ui.tm = setTimeout(() => {
          S.setQuery(e.target.value);
          renderRoster(snap());
        }, 120);
      });
      root.addEventListener("change", (e) => {
        if (e.target.id !== "vA-group") return;
        S.setGroup(e.target.value);
        render();
      });

      function syncPicked() {
        const s = snap();
        root.querySelectorAll(".pcard").forEach((el) => {
          const i = s.selected.indexOf(el.dataset.id);
          el.setAttribute("aria-pressed", i >= 0);
          el.dataset.order = i + 1;
          const ord = el.querySelector(".pcard-ord");
          if (ord) ord.textContent = i >= 0 ? i + 1 : "";
        });
        root.querySelectorAll("[data-gen]").forEach((head) => {
          const ms = secMembers.get(head.dataset.gen) || [];
          const picked = ms.filter((m) => s.selected.includes(m.id)).length;
          let pk = head.querySelector(".pk");
          if (picked && !pk) {
            pk = document.createElement("span");
            pk.className = "pk";
            head.appendChild(pk);
          }
          if (pk) {
            if (picked) pk.textContent = `已选 ${picked}`;
            else pk.remove();
          }
        });
        renderProgress(s);
        renderTray(s);
      }

      // 系列/档位/范围切换
      root.addEventListener("click", (e) => {
        const ser = e.target.closest("[data-series]");
        if (ser) {
          S.switchSeries(ser.dataset.series);
          return render();
        }
        const size = e.target.closest("[data-size]");
        if (size) {
          S.setSize(+size.dataset.size);
          return render();
        }
        const fil = e.target.closest("[data-filter]");
        if (fil) {
          S.setFilter(fil.dataset.filter);
          return render();
        }
      });

      document.addEventListener("keydown", (e) => {
        if (!root.isConnected) return;
        if (ui.view !== "duel" || e.target.closest("input, textarea")) return;
        if (e.key === "ArrowLeft") answer(0);
        else if (e.key === "ArrowRight") answer(1);
        else if (e.key === "z" || e.key === "Z" || e.key === "Backspace") {
          S.undo();
          render();
        }
      });

      render();
    },
  });
})();
