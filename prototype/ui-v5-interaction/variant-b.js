/* 方案 B · 对决驾驶舱：选人做效率增强（建议/只看已选/无折叠），对决做仪表盘（时间线/拖拽/断点续玩） */
(function () {
  "use strict";
  const api = window.PROTO.api;
  const { esc, S, CORE, toast, openProfile, cardHTML, fighterHTML, slotsHTML } =
    api;
  const FOLD = CORE.foldIndex(window.AKB_SIMPLIFIED || {});

  window.PROTO.register({
    key: "B",
    name: "对决驾驶舱",
    desc: "对决页当主角：VS 仪表盘、答题时间线（可回退到任意一步）、拖拽作答、断点续玩；选人页平铺无折叠 + 搜索建议",
    mount(root, api) {
      const ui = {
        view: "pick",
        onlyPicked: false,
        sug: [],
        answering: false,
        drag: null,
      };
      const snap = () => S.snapshot();

      /* ---------- 数据小工具 ---------- */
      function historyWinners() {
        const raw = api.rawDuel(snap().series);
        if (!raw || !raw.answers.length) return [];
        const out = [];
        for (let k = 1; k <= raw.answers.length; k++) {
          const r = CORE.replay(raw.order, raw.answers.slice(0, k - 1));
          if (r.done) break;
          out.push(raw.answers[k - 1] ? r.pair[0] : r.pair[1]);
        }
        return out;
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
      function topbarHTML(s) {
        return `<div class="vB-top">
          <div class="vB-row">
            <div class="seg">${["48g", "sakamichi", "love"]
              .map(
                (k) =>
                  `<button type="button" role="radio" aria-checked="${s.series === k}" data-series="${k}">${esc(api.namesFor(k, s.size).seriesLabel)}</button>`
              )
              .join("")}</div>
            <div class="seg">${[7, 16, 32]
              .map(
                (n) =>
                  `<button type="button" role="radio" aria-checked="${s.size === n}" data-size="${n}">${esc(api.namesFor(s.series, n).brand)}</button>`
              )
              .join("")}</div>
            <div class="seg">${[
              ["all", "全部"],
              ["current", "现役"],
              ["former", "已毕业"],
            ]
              .map(
                ([k, v]) =>
                  `<button type="button" role="radio" aria-checked="${s.filter === k}" data-filter="${k}">${v}</button>`
              )
              .join("")}</div>
          </div>
          <div class="vB-row">
            <div class="vB-search">
              <input id="vB-q" type="search" placeholder="搜索名字 / 假名 / 昵称，回车看全部结果" value="${esc(s.query)}" autocomplete="off">
              <div class="vB-sug" id="vB-sug" hidden></div>
            </div>
            <button type="button" class="chip ${ui.onlyPicked ? "on" : ""}" data-act="only">只看已选</button>
            <button type="button" class="chip" data-act="clear">清空</button>
          </div>
        </div>`;
      }

      function renderPickPhase(s) {
        const resume = s.duel
          ? `<div class="vB-resume" style="margin:12px 0">
              <p><b>继续上次对决？</b><br>第 ${s.duel.step} / 最多 ${s.duel.max} 题 · 已完成 ${s.duel.percent}%</p>
              <button type="button" class="btn primary" data-act="resume">继续对决</button>
              <button type="button" class="btn" data-act="drop">放弃</button>
            </div>`
          : "";
        root.innerHTML = `${topbarHTML(s)}<div class="wrap">${resume}<div id="vB-list"></div></div>
          <div class="vB-dock">
            <ol class="slots" id="vB-slots"></ol>
            <span class="muted" id="vB-count" style="font-weight:700"></span>
            <button type="button" class="btn primary" id="vB-start" data-act="start"></button>
          </div>`;
        renderList(s);
        renderDock(s);
      }

      function renderList(s) {
        const el = root.querySelector("#vB-list");
        if (!el) return;
        const q = CORE.normalizeName(s.query);
        const out = [];
        for (const node of CORE.groupSections(
          api.seriesGroups(s.series),
          "all"
        )) {
          const secs = node.sections
            .map((sec) => ({
              label: sec.label,
              ms: sec.members.filter(
                (m) =>
                  CORE.isVisible(m, s.filter) &&
                  (!ui.onlyPicked || s.selected.includes(m.id)) &&
                  (!q || CORE.haystack(m, FOLD).includes(q))
              ),
            }))
            .filter((x) => x.ms.length);
          if (!secs.length) continue;
          const all = secs.flatMap((x) => x.ms);
          const picked = all.filter((m) => s.selected.includes(m.id)).length;
          out.push(`<h3 class="vB-grp-h">${esc(node.group)}
            <span class="n">${all.length} 人</span>
            ${picked ? `<span class="pk">已选 ${picked}</span>` : ""}</h3>
            ${secs
              .map(
                (
                  x
                ) => `<p class="vB-gen-h">${esc(x.label)} · ${x.ms.length} 人</p>
              <div class="pcard-grid">${x.ms.map((m) => cardHTML(m)).join("")}</div>`
              )
              .join("")}`);
        }
        el.innerHTML =
          out.join("") ||
          `<p class="muted" style="margin:12px 2px">没有匹配的成员；试试清空搜索、切换「只看已选」，或换简体字/假名搜索</p>`;
      }

      function renderDock(s) {
        const slots = root.querySelector("#vB-slots");
        if (slots) slots.innerHTML = slotsHTML(s.selected, s.size);
        const count = root.querySelector("#vB-count");
        if (count) count.textContent = `${s.selected.length}/${s.size}`;
        const start = root.querySelector("#vB-start");
        if (start) {
          start.disabled = s.selected.length < s.size;
          start.textContent =
            s.selected.length < s.size
              ? `还差 ${s.size - s.selected.length} 位`
              : `开始对决（最多 ${CORE.worstCase(s.size)} 题）`;
        }
      }

      function syncPicked() {
        const s = snap();
        root.querySelectorAll(".pcard").forEach((el) => {
          const i = s.selected.indexOf(el.dataset.id);
          el.setAttribute("aria-pressed", i >= 0);
          const ord = el.querySelector(".pcard-ord");
          if (ord) ord.textContent = i >= 0 ? i + 1 : "";
        });
        if (ui.onlyPicked) return renderList(s);
        renderDock(s);
      }

      /* ---------- 对决驾驶舱 ---------- */
      function renderDuelPhase(s) {
        const d = s.duel;
        if (!d) {
          ui.view = "pick";
          return renderPickPhase(s);
        }
        const winners = historyWinners();
        const timeline = winners
          .map(
            (
              id,
              i
            ) => `<button type="button" class="vB-chip" data-chip="${i + 1}" title="回退到第 ${i + 1} 题之后">
              <img src="${api.thumbSrc(api.BY_ID.get(id))}" alt=""><span>${i + 1}</span></button>`
          )
          .join("");
        root.innerHTML = `<div class="wrap vB-cockpit">
          <div class="vB-instr">
            <span><b>${d.step}</b> / 最多 ${d.max} 题</span>
            <span class="muted">已完成 ${d.percent}% · 还剩约 ${d.remaining} 题 · 约 ${Math.max(1, Math.ceil(d.etaSeconds / 60))} 分钟</span>
            <span class="vA-save" style="margin-left:auto">进度已保存</span>
          </div>
          <div class="vB-timeline">
            ${winners.length ? `<button type="button" class="chip sm" data-chip="0" title="回退到开头">↺</button>${timeline}` : `<span class="muted" style="font-size:12px">答题轨迹会出现在这里，点缩略图可回退</span>`}
          </div>
          <div class="duel-row">
            <button type="button" class="fighter" data-side="0">${fighterHTML(api.BY_ID.get(d.pair[0]))}</button>
            <span class="vs">VS</span>
            <button type="button" class="fighter" data-side="1">${fighterHTML(api.BY_ID.get(d.pair[1]))}</button>
          </div>
          <p class="muted" style="font-size:12px;margin-top:8px">点选，或把卡片向上拖一点再松手；键盘 ← → 选择、Z 撤回</p>
          <div class="res-actions">
            <button type="button" class="btn" data-act="undo" ${d.canUndo ? "" : "disabled"}>撤回上一题</button>
            <button type="button" class="btn" data-act="leave">保存并离开</button>
          </div>
        </div>`;
      }

      function answer(side) {
        if (ui.answering) return;
        const s = snap();
        if (s.phase !== "duel") return;
        ui.answering = true;
        const win = root.querySelector(`[data-side="${side}"]`);
        const lose = root.querySelector(`[data-side="${side === 0 ? 1 : 0}"]`);
        if (win) win.classList.add("picked");
        if (lose) lose.classList.add("dim");
        setTimeout(() => {
          ui.answering = false;
          S.answer(side === 0);
          render();
        }, 170);
      }

      /* ---------- 结果 ---------- */
      function renderResultPhase(s) {
        const winners = historyWinners();
        const groups = new Set(
          (s.ranking || []).map((id) => (api.BY_ID.get(id) || {}).group)
        );
        root.innerHTML = `<div class="wrap"><div id="vB-result"></div></div>`;
        api.renderResult(root.querySelector("#vB-result"), {
          extraHTML: `<div class="vB-instr"><span>本次共 <b>${winners.length}</b> 题</span>
            <span class="muted">覆盖 ${groups.size} 个团体 · 全部对比已完成</span></div>`,
          onRestart: () => {
            S.abandonDuel();
            ui.view = "pick";
            render();
          },
          onResort: () => {
            S.startDuel(CORE.shuffle(snap().ranking.slice()));
            ui.view = "duel";
            render();
          },
        });
      }

      /* ---------- 事件 ---------- */
      root.addEventListener("click", (e) => {
        const info = e.target.closest(".pcard-i");
        if (info) return openProfile(info.dataset.info);
        const sug = e.target.closest("[data-sug]");
        if (sug) {
          const id = sug.dataset.sug;
          root.querySelector("#vB-sug").hidden = true;
          const card = root.querySelector(`.pcard[data-id="${id}"]`);
          if (card) {
            card.scrollIntoView({ block: "center", behavior: "smooth" });
            card.classList.add("flash");
            setTimeout(() => card.classList.remove("flash"), 900);
          } else {
            S.setQuery(api.BY_ID.get(id).name);
            root.querySelector("#vB-q").value = api.BY_ID.get(id).name;
            renderList(snap());
          }
          return;
        }
        const sugAll = e.target.closest('[data-act="sug-all"]');
        if (sugAll) {
          root.querySelector("#vB-sug").hidden = true;
          renderList(snap());
          return;
        }
        const card = e.target.closest(".pcard");
        if (card) {
          if (!S.toggleSelect(card.dataset.id))
            toast(`已选满 ${snap().size} 位；点底部头像可先移除一位`);
          return syncPicked();
        }
        const rm = e.target.closest("[data-remove]");
        if (rm) {
          S.toggleSelect(rm.dataset.remove);
          return syncPicked();
        }
        const chip = e.target.closest("[data-chip]");
        if (chip) {
          const keep = +chip.dataset.chip;
          const total = historyWinners().length;
          for (let i = 0; i < total - keep; i++) S.undo();
          toast(keep ? `已回退到第 ${keep} 题之后` : "已回退到开头");
          return render();
        }
        const side = e.target.closest("[data-side]");
        if (side) {
          if (e.detail === 0 || !ui.suppressClick)
            return answer(+side.dataset.side);
          return;
        }
        const act = e.target.closest("[data-act]");
        if (!act) return;
        const a = act.dataset.act;
        if (a === "start") {
          if (!api.beginDuel()) return;
          ui.view = "duel";
          render();
        } else if (a === "resume") {
          ui.view = "duel";
          render();
        } else if (a === "drop") {
          S.abandonDuel();
          render();
        } else if (a === "leave") {
          ui.view = "pick";
          render();
          toast("对决进度已保存；回到选人页可点「继续对决」");
        } else if (a === "undo") {
          S.undo();
          render();
        } else if (a === "clear") {
          if (window.confirm("清空已选成员？")) {
            S.clearSelection();
            syncPicked();
          }
        } else if (a === "only") {
          ui.onlyPicked = !ui.onlyPicked;
          render();
        }
      });

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

      root.addEventListener("input", (e) => {
        if (e.target.id !== "vB-q") return;
        clearTimeout(ui.tm);
        const v = e.target.value;
        ui.tm = setTimeout(() => {
          S.setQuery(v);
          const q = CORE.normalizeName(v);
          const box = root.querySelector("#vB-sug");
          if (!q) {
            box.hidden = true;
            return renderList(snap());
          }
          const hits = [];
          for (const g of api.seriesGroups(snap().series))
            for (const m of g.members)
              if (
                CORE.isVisible(m, snap().filter) &&
                CORE.haystack(m, FOLD).includes(q)
              )
                hits.push(m);
          ui.sug = hits;
          box.innerHTML = hits.length
            ? hits
                .slice(0, 7)
                .map(
                  (m) => `<button type="button" data-sug="${m.id}">
                    <img src="${api.thumbSrc(m)}" alt=""><span><b>${esc(m.name)}</b><span class="g">　${esc(m.group)} · ${esc(m.generation)}</span></span></button>`
                )
                .join("") +
              `<button type="button" class="all" data-act="sug-all">查看全部 ${hits.length} 条结果</button>`
            : `<button type="button" disabled>没有匹配；试试简体字或假名</button>`;
          box.hidden = false;
        }, 140);
      });

      // 拖拽作答（上拖 = 选它）
      root.addEventListener("pointerdown", (e) => {
        const f = e.target.closest(".fighter");
        if (!f) return;
        ui.drag = { el: f, y0: e.clientY, moved: false };
        f.setPointerCapture(e.pointerId);
      });
      root.addEventListener("pointermove", (e) => {
        if (!ui.drag) return;
        const dy = e.clientY - ui.drag.y0;
        if (Math.abs(dy) > 8) ui.drag.moved = true;
        if (dy < 0) {
          ui.drag.el.style.transform = `translateY(${Math.max(dy, -70)}px)`;
          ui.drag.el.classList.add("dragging");
        }
      });
      root.addEventListener("pointerup", (e) => {
        if (!ui.drag) return;
        const { el, y0, moved } = ui.drag;
        const dy = e.clientY - y0;
        ui.drag = null;
        el.style.transform = "";
        el.classList.remove("dragging");
        ui.suppressClick = true;
        setTimeout(() => (ui.suppressClick = false), 400);
        if (dy < -56) answer(+el.dataset.side);
        else if (!moved) answer(+el.dataset.side);
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
