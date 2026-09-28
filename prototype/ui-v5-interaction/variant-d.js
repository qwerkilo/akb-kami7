/* 方案 D · 手势卡组：移动优先。点选 / 长按看简介 / 上拖卡片作答，动效与触觉反馈；结果逐名揭晓 */
(function () {
  "use strict";
  const api = window.PROTO.api;
  const { esc, S, CORE, toast, openProfile, cardHTML, fighterHTML } = api;
  const FOLD = CORE.foldIndex(window.AKB_SIMPLIFIED || {});

  const buzz = (ms) => {
    try {
      navigator.vibrate && navigator.vibrate(ms);
    } catch (_) {}
  };

  window.PROTO.register({
    key: "D",
    name: "手势卡组",
    desc: "移动优先：点选、长按看简介、把卡片上拖作答，配触觉反馈与转场动效；结果逐名揭晓",
    mount(root, api) {
      const ui = {
        view: "pick",
        sheet: false,
        peek: null,
        press: null,
        suppressClick: false,
        answering: false,
        drag: null,
      };
      const snap = () => S.snapshot();

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
        const nodes = CORE.groupSections(api.seriesGroups(s.series), "all");
        root.innerHTML = `<div class="vD-top">
          <div class="vD-scroll">${["48g", "sakamichi", "love"]
            .map(
              (k) =>
                `<button type="button" class="chip ${s.series === k ? "on" : ""}" data-series="${k}">${esc(api.namesFor(k, s.size).seriesLabel)}</button>`
            )
            .join("")}
            <span style="flex:1"></span>
            ${[7, 16, 32]
              .map(
                (n) =>
                  `<button type="button" class="chip ${s.size === n ? "on" : ""}" data-size="${n}">${esc(api.namesFor(s.series, n).brand)}</button>`
              )
              .join("")}
          </div>
          <div class="vD-scroll">
            <button type="button" class="chip ${s.group === "all" ? "on" : ""}" data-group="all">全部</button>
            ${nodes
              .map(
                (n) =>
                  `<button type="button" class="chip ${s.group === n.group ? "on" : ""}" data-group="${esc(n.group)}">${esc(n.group)}</button>`
              )
              .join("")}
          </div>
          <input id="vD-q" type="search" placeholder="搜索名字（汉字/假名/昵称）" value="${esc(s.query)}" autocomplete="off">
          <p class="muted" style="font-size:12px">点卡片选中 · 长按看简介 · 右下角查看已选</p>
        </div>
        <div class="wrap"><div class="vD-grid" id="vD-grid"></div></div>
        <button type="button" class="vD-puck" data-act="sheet">
          <span class="thumbs" id="vD-thumbs"></span><span id="vD-count"></span>
        </button>
        <div class="vD-sheet" id="vD-sheet" hidden><div class="vD-sheet-in" id="vD-sheet-in"></div></div>
        <div class="vD-peek" id="vD-peek" hidden><div class="vD-peek-in" id="vD-peek-in"></div></div>`;
        renderGrid(s);
        renderPuck(s);
      }

      function renderGrid(s) {
        const el = root.querySelector("#vD-grid");
        const q = CORE.normalizeName(s.query);
        const ms = [];
        for (const g of api.seriesGroups(s.series)) {
          if (s.group !== "all" && g.group !== s.group) continue;
          for (const m of g.members)
            if (
              CORE.isVisible(m, s.filter) &&
              (!q || CORE.haystack(m, FOLD).includes(q))
            )
              ms.push(m);
        }
        el.innerHTML =
          ms
            .map((m) => {
              const i = s.selected.indexOf(m.id);
              return `<button type="button" class="vD-card" data-id="${m.id}" aria-pressed="${i >= 0}">
                <img src="${api.thumbSrc(m)}" alt="" loading="lazy" decoding="async">
                ${i >= 0 ? `<span class="ord">${i + 1}</span>` : ""}
                <span class="cap"><b>${esc(m.name)}</b><span>${esc(m.group)} · ${esc(m.generation)}${m.status === "current" ? " · 现役" : ""}</span></span>
              </button>`;
            })
            .join("") ||
          `<p class="muted">没有匹配的成员；试试简体字（如「樱」）或假名。</p>`;
      }

      function renderPuck(s) {
        const thumbs = root.querySelector("#vD-thumbs");
        if (!thumbs) return;
        thumbs.innerHTML = s.selected
          .slice(-4)
          .map((id) => {
            const m = api.BY_ID.get(id);
            return `<img src="${api.thumbSrc(m)}" alt="">`;
          })
          .join("");
        root.querySelector("#vD-count").textContent =
          `已选 ${s.selected.length}/${s.size}`;
      }

      function syncPicked() {
        const s = snap();
        root.querySelectorAll(".vD-card").forEach((el) => {
          const i = s.selected.indexOf(el.dataset.id);
          const was = el.getAttribute("aria-pressed") === "true";
          el.setAttribute("aria-pressed", i >= 0);
          let ord = el.querySelector(".ord");
          if (i >= 0 && !ord) {
            ord = document.createElement("span");
            ord.className = "ord";
            el.appendChild(ord);
          }
          if (ord) {
            if (i >= 0) ord.textContent = i + 1;
            else ord.remove();
          }
          if (i >= 0 && !was) buzz(10);
        });
        renderPuck(s);
        const sheet = root.querySelector("#vD-sheet");
        if (sheet && !sheet.hidden)
          root.querySelector("#vD-sheet-in").innerHTML = sheetHTML(s);
      }

      function sheetHTML(s) {
        return `<h3 style="font-size:15px">已选 ${s.selected.length} / ${s.size}</h3>
          <ol class="vC-board-list">${
            s.selected
              .map((id, i) => {
                const m = api.BY_ID.get(id);
                return `<li><span style="color:var(--pink);font-weight:900">${i + 1}</span>
                <img src="${api.thumbSrc(m)}" alt=""><span>${esc(m.name)}</span>
                <button type="button" class="x" data-remove="${m.id}" aria-label="移除 ${esc(m.name)}">×</button></li>`;
              })
              .join("") || `<p class="muted">还没有选人</p>`
          }</ol>
          <div class="res-actions">
            <button type="button" class="btn primary big" data-act="start" ${s.selected.length >= s.size ? "" : "disabled"}>${
              s.selected.length >= s.size
                ? `开始对决（最多 ${CORE.worstCase(s.size)} 题）`
                : `还差 ${s.size - s.selected.length} 位`
            }</button>
            <button type="button" class="btn" data-act="clear" ${s.selected.length ? "" : "disabled"}>清空</button>
          </div>`;
      }

      function openPeek(id) {
        const m = api.BY_ID.get(id);
        if (!m) return;
        ui.peek = id;
        const rows = CORE.profileRows(m, api.t, "zh", api.I18N.values).slice(
          0,
          4
        );
        const el = root.querySelector("#vD-peek");
        root.querySelector("#vD-peek-in").innerHTML = `
          <img src="${api.thumbSrc(m)}" alt="">
          <div style="flex:1">
            <b style="font-size:18px">${esc(m.name)}</b>
            <p class="muted" style="font-size:12px">${esc(m.kana || "")}</p>
            <p style="margin:4px 0 8px"><span class="chip">${esc(m.group)}${m.generation ? " · " + esc(m.generation) : ""}</span></p>
            <dl class="pp-fields" style="margin:0 0 10px">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
            <div class="res-actions">
              <button type="button" class="btn sm" data-act="peek-full">完整资料</button>
              <button type="button" class="btn sm primary" data-act="peek-toggle">${snap().selected.includes(id) ? "取消选中" : "选中 TA"}</button>
            </div>
          </div>`;
        el.hidden = false;
      }
      function closePeek() {
        const el = root.querySelector("#vD-peek");
        if (el) el.hidden = true;
        ui.peek = null;
      }

      /* ---------- 对决 ---------- */
      function renderDuelPhase(s) {
        const d = s.duel;
        if (!d) {
          ui.view = "pick";
          return renderPickPhase(s);
        }
        const pct = Math.round(((d.step - 1) / d.max) * 100);
        root.innerHTML = `<div class="wrap">
          <div style="display:flex;align-items:center;gap:10px;margin-top:10px">
            <div style="flex:1;height:8px;background:var(--line);border-radius:999px;overflow:hidden">
              <div style="height:100%;width:${pct}%;background:var(--pink);transition:width .25s"></div>
            </div>
            <span class="muted" style="font-size:12px">${d.step} / 最多 ${d.max} 题</span>
          </div>
          <p class="muted" style="font-size:12px;margin-top:6px">还剩约 ${d.remaining} 题 · 约 ${Math.max(1, Math.ceil(d.etaSeconds / 60))} 分钟 · 进度自动保存</p>
          <div class="vD-deck vD-enter" style="margin-top:10px">
            <button type="button" class="vD-fighter" data-side="0">
              <span class="hint">松开 = 选 TA</span>
              <img src="${api.fullSrc(api.BY_ID.get(d.pair[0]))}" alt="">
              <span class="cap"><b>${esc(api.BY_ID.get(d.pair[0]).name)}</b><span>${esc(api.BY_ID.get(d.pair[0]).group)} · ${esc(api.BY_ID.get(d.pair[0]).generation)}</span></span>
            </button>
            <button type="button" class="vD-fighter" data-side="1">
              <span class="hint">松开 = 选 TA</span>
              <img src="${api.fullSrc(api.BY_ID.get(d.pair[1]))}" alt="">
              <span class="cap"><b>${esc(api.BY_ID.get(d.pair[1]).name)}</b><span>${esc(api.BY_ID.get(d.pair[1]).group)} · ${esc(api.BY_ID.get(d.pair[1]).generation)}</span></span>
            </button>
          </div>
          <p class="muted" style="font-size:12px;margin-top:8px;text-align:center">把卡片向上拖，或直接点选</p>
          <div class="res-actions" style="justify-content:center;margin-top:10px">
            <button type="button" class="btn sm" data-act="undo" ${d.canUndo ? "" : "disabled"}>撤回</button>
            <button type="button" class="btn sm" data-act="leave">离开（已保存）</button>
          </div>
        </div>`;
      }

      function answer(side, cardEl) {
        if (ui.answering) return;
        if (snap().phase !== "duel") return;
        ui.answering = true;
        buzz(12);
        const win = cardEl || root.querySelector(`[data-side="${side}"]`);
        const lose = root.querySelector(`[data-side="${side === 0 ? 1 : 0}"]`);
        if (win) win.classList.add("win");
        if (lose) lose.classList.add("lose");
        setTimeout(() => {
          ui.answering = false;
          S.answer(side === 0);
          render();
        }, 320);
      }

      /* ---------- 结果 ---------- */
      function renderResultPhase() {
        root.innerHTML = `<div class="wrap"><div id="vD-result"></div></div>`;
        api.renderResult(root.querySelector("#vD-result"), {
          reveal: true,
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
        if (ui.suppressClick) return;
        const gb = e.target.closest("[data-group]");
        if (gb) {
          S.setGroup(gb.dataset.group);
          return render();
        }
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
        const card = e.target.closest(".vD-card");
        if (card) {
          if (!S.toggleSelect(card.dataset.id))
            toast(`已选满 ${snap().size} 位；先去掉一位再选`);
          return syncPicked();
        }
        const rm = e.target.closest("[data-remove]");
        if (rm) {
          S.toggleSelect(rm.dataset.remove);
          return syncPicked();
        }
        const side = e.target.closest(".vD-fighter");
        if (side && e.detail !== 0) return; // 指针交互在 pointerup 处理
        if (side) return answer(+side.dataset.side);
        const act = e.target.closest("[data-act]");
        if (!act) return;
        const a = act.dataset.act;
        if (a === "sheet") {
          const sheet = root.querySelector("#vD-sheet");
          sheet.hidden = false;
          root.querySelector("#vD-sheet-in").innerHTML = sheetHTML(snap());
        } else if (a === "start") {
          if (!api.beginDuel()) return;
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
        } else if (a === "peek-full") {
          const id = ui.peek;
          closePeek();
          openProfile(id);
        } else if (a === "peek-toggle") {
          S.toggleSelect(ui.peek);
          closePeek();
          syncPicked();
        }
      });

      // 背景点击关闭抽屉
      root.addEventListener("click", (e) => {
        const sheet = e.target.closest("#vD-sheet");
        if (sheet && !e.target.closest(".vD-sheet-in")) sheet.hidden = true;
        const peek = e.target.closest("#vD-peek");
        if (peek && !e.target.closest(".vD-peek-in")) closePeek();
      });

      root.addEventListener("input", (e) => {
        if (e.target.id !== "vD-q") return;
        clearTimeout(ui.tm);
        ui.tm = setTimeout(() => {
          S.setQuery(e.target.value);
          renderGrid(snap());
        }, 140);
      });

      // 长按看简介 / 上拖作答
      root.addEventListener("pointerdown", (e) => {
        const card = e.target.closest(".vD-card");
        if (card) {
          ui.press = {
            el: card,
            y: e.clientY,
            x: e.clientX,
            id: card.dataset.id,
          };
          ui.press.tm = setTimeout(() => {
            ui.suppressClick = true;
            setTimeout(() => (ui.suppressClick = false), 500);
            openPeek(ui.press.id);
            ui.press = null;
          }, 450);
          return;
        }
        const f = e.target.closest(".vD-fighter");
        if (f) {
          ui.drag = { el: f, y: e.clientY, moved: false };
          f.setPointerCapture(e.pointerId);
        }
      });
      root.addEventListener("pointermove", (e) => {
        if (ui.press) {
          if (
            Math.abs(e.clientY - ui.press.y) > 10 ||
            Math.abs(e.clientX - ui.press.x) > 10
          ) {
            clearTimeout(ui.press.tm);
            ui.press = null;
          }
        }
        if (ui.drag) {
          const dy = e.clientY - ui.drag.y;
          if (Math.abs(dy) > 8) ui.drag.moved = true;
          if (dy < 0) {
            ui.drag.el.style.transform = `translateY(${Math.max(dy, -80)}px) rotate(${dy / 60}deg)`;
            ui.drag.el.classList.add("dragging");
          }
        }
      });
      root.addEventListener("pointerup", (e) => {
        if (ui.press) {
          clearTimeout(ui.press.tm);
          ui.press = null;
        }
        if (!ui.drag) return;
        const { el, y, moved } = ui.drag;
        const dy = e.clientY - y;
        ui.drag = null;
        el.style.transform = "";
        el.classList.remove("dragging");
        if (dy < -56) return answer(+el.dataset.side, el);
        if (!moved) {
          ui.suppressClick = true;
          setTimeout(() => (ui.suppressClick = false), 350);
          return answer(+el.dataset.side, el);
        }
      });

      document.addEventListener("keydown", (e) => {
        if (!root.isConnected) return;
        if (ui.view !== "duel" || e.target.closest("input, textarea")) return;
        if (e.key === "ArrowLeft") answer(0);
        else if (e.key === "ArrowRight") answer(1);
        else if (e.key === "z" || e.key === "Z") {
          S.undo();
          render();
        }
      });

      render();
    },
  });
})();
