/* 方案 C · 选人工作台：桌面三栏（过滤 / 画廊 / 已选板），移动端底部抽屉；对决与结果保持紧凑标准形态 */
(function () {
  "use strict";
  const api = window.PROTO.api;
  const { esc, S, CORE, toast, openProfile, cardHTML, fighterHTML } = api;
  const FOLD = CORE.foldIndex(window.AKB_SIMPLIFIED || {});

  window.PROTO.register({
    key: "C",
    name: "选人工作台",
    desc: "桌面三栏工作台：左侧过滤（带人数/已选）、中间大画廊（无折叠）、右侧已选板与团体覆盖；移动端折叠为抽屉",
    mount(root, api) {
      const ui = {
        view: "pick",
        onlyPicked: false,
        sheet: false,
        answering: false,
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

      /* ---------- 选人（三栏） ---------- */
      function segHTML(items, attr, cur) {
        return `<div class="seg" style="width:100%;justify-content:space-between">${items
          .map(
            ([k, label]) =>
              `<button type="button" role="radio" aria-checked="${cur === k}" ${attr}="${k}">${esc(label)}</button>`
          )
          .join("")}</div>`;
      }

      function renderPickPhase(s) {
        const nodes = CORE.groupSections(api.seriesGroups(s.series), "all");
        const pickedByGroup = new Map();
        s.selected.forEach((id) => {
          const m = api.BY_ID.get(id);
          if (m)
            pickedByGroup.set(m.group, (pickedByGroup.get(m.group) || 0) + 1);
        });
        const railGroups = `<div class="vC-group">
          <button type="button" class="${s.group === "all" ? "on" : ""}" data-group="all">全部团体<span class="n">${api.seriesCount(s.series)}</span></button>
          ${nodes
            .map(
              (
                n
              ) => `<button type="button" class="${s.group === n.group ? "on" : ""}" data-group="${esc(n.group)}">
                ${esc(n.group)}<span class="n">${n.sections.reduce((a, x) => a + x.members.length, 0)}</span>
                ${pickedByGroup.get(n.group) ? `<span class="pk">${pickedByGroup.get(n.group)}</span>` : ""}</button>`
            )
            .join("")}
        </div>`;
        const board = boardHTML(s);
        root.innerHTML = `<div class="vC">
          <aside class="vC-rail">
            <h3>系列</h3>${segHTML(
              [
                ["48g", "48 Group"],
                ["sakamichi", "坂道"],
                ["love", "等爱"],
              ],
              "data-series",
              s.series
            )}
            <h3>档位</h3>${segHTML(
              [
                [7, api.namesFor(s.series, 7).brand],
                [16, api.namesFor(s.series, 16).brand],
                [32, api.namesFor(s.series, 32).brand],
              ],
              "data-size",
              s.size
            )}
            <h3>范围</h3>${segHTML(
              [
                ["all", "全部"],
                ["current", "现役"],
                ["former", "已毕业"],
              ],
              "data-filter",
              s.filter
            )}
            <h3>团体</h3>${railGroups}
            <label class="chip" style="display:flex;align-items:center;gap:8px;cursor:pointer">
              <input type="checkbox" data-act="only" ${ui.onlyPicked ? "checked" : ""}> 只看已选
            </label>
          </aside>
          <main class="vC-gallery">
            <div class="vC-top vC-mobile-only">
              <div class="vB-row">
                ${segHTML(
                  [
                    ["48g", "48G"],
                    ["sakamichi", "坂道"],
                    ["love", "等爱"],
                  ],
                  "data-series",
                  s.series
                )}
                ${segHTML(
                  [
                    [7, api.namesFor(s.series, 7).brand],
                    [16, api.namesFor(s.series, 16).brand],
                    [32, api.namesFor(s.series, 32).brand],
                  ],
                  "data-size",
                  s.size
                )}
              </div>
              <div class="vB-row">
                ${segHTML(
                  [
                    ["all", "全部"],
                    ["current", "现役"],
                    ["former", "已毕业"],
                  ],
                  "data-filter",
                  s.filter
                )}
                <label class="field" style="flex:1"><select data-act="group">${[
                  ["all", "全部团体"],
                  ...nodes.map((n) => [n.group, n.group]),
                ]
                  .map(
                    ([k, v]) =>
                      `<option value="${esc(k)}" ${s.group === k ? "selected" : ""}>${esc(v)}</option>`
                  )
                  .join("")}</select></label>
              </div>
              <input type="search" id="vC-q" placeholder="搜索名字（汉字/假名/昵称）" value="${esc(s.query)}">
            </div>
            <div id="vC-gallery"></div>
          </main>
          <aside class="vC-board">
            <div id="vC-board">${board}</div>
          </aside>
          <button type="button" class="vC-fab" data-act="sheet">已选 ${s.selected.length}/${s.size}</button>
        </div>
        <div class="vC-sheet" id="vC-sheet" hidden><div class="vC-sheet-in" id="vC-sheet-in"></div></div>`;
        renderGallery(s);
      }

      function boardHTML(s) {
        const picked = s.selected;
        const pct = Math.round((picked.length / s.size) * 100);
        const cover = new Map();
        picked.forEach((id) => {
          const m = api.BY_ID.get(id);
          if (m) cover.set(m.group, (cover.get(m.group) || 0) + 1);
        });
        return `<h3>已选 ${picked.length} / ${s.size}</h3>
          <div style="height:8px;background:var(--line);border-radius:999px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:var(--pink)"></div>
          </div>
          ${cover.size ? `<div class="vC-cover">${[...cover.entries()].map(([g, n]) => `<span class="chip">${esc(g)} <b>${n}</b></span>`).join("")}</div>` : `<p class="vC-empty">还没有选人。点画廊里的卡片开始挑。</p>`}
          <ol class="vC-board-list">${picked
            .map((id, i) => {
              const m = api.BY_ID.get(id);
              return `<li><span class="no" style="color:var(--pink);font-weight:900">${i + 1}</span>
                <img src="${api.thumbSrc(m)}" alt=""><span>${esc(m.name)}</span>
                <button type="button" class="x" data-remove="${m.id}" aria-label="移除 ${esc(m.name)}">×</button></li>`;
            })
            .join("")}</ol>
          <div class="res-actions">
            <button type="button" class="btn primary big" data-act="start" ${picked.length >= s.size ? "" : "disabled"}>${
              picked.length >= s.size
                ? `开始对决（最多 ${CORE.worstCase(s.size)} 题）`
                : `还差 ${s.size - picked.length} 位`
            }</button>
            <button type="button" class="btn" data-act="clear" ${picked.length ? "" : "disabled"}>清空</button>
          </div>`;
      }

      function renderGallery(s) {
        const el = root.querySelector("#vC-gallery");
        if (!el) return;
        const q = CORE.normalizeName(s.query);
        const out = [];
        for (const node of CORE.groupSections(
          api.seriesGroups(s.series),
          s.group
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
          out.push(`<h3 class="vC-grp-h">${esc(node.group)}<span class="n">${all.length} 人</span></h3>
            ${secs
              .map(
                (
                  x
                ) => `<p class="vC-gen-h">${esc(x.label)} · ${x.ms.length} 人</p>
                <div class="pcard-grid">${x.ms.map((m) => cardHTML(m)).join("")}</div>`
              )
              .join("")}`);
        }
        el.innerHTML =
          out.join("") || `<p class="vC-empty">没有匹配的成员。</p>`;
      }

      function refresh() {
        const s = snap();
        root.querySelectorAll(".pcard").forEach((el) => {
          const i = s.selected.indexOf(el.dataset.id);
          el.setAttribute("aria-pressed", i >= 0);
          const ord = el.querySelector(".pcard-ord");
          if (ord) ord.textContent = i >= 0 ? i + 1 : "";
        });
        const b = root.querySelector("#vC-board");
        if (b) b.innerHTML = boardHTML(s);
        const fab = root.querySelector(".vC-fab");
        if (fab) fab.textContent = `已选 ${s.selected.length}/${s.size}`;
        const sheetIn = root.querySelector("#vC-sheet-in");
        if (sheetIn && !root.querySelector("#vC-sheet").hidden)
          sheetIn.innerHTML = boardHTML(s);
        if (ui.onlyPicked) renderGallery(s);
      }

      /* ---------- 对决 / 结果（紧凑标准形态） ---------- */
      function renderDuelPhase(s) {
        const d = s.duel;
        if (!d) {
          ui.view = "pick";
          return renderPickPhase(s);
        }
        root.innerHTML = `<div class="wrap">
          <div class="vB-instr" style="margin-top:12px">
            <span><b>${d.step}</b> / 最多 ${d.max} 题</span>
            <span class="muted">已完成 ${d.percent}% · 还剩约 ${d.remaining} 题 · 约 ${Math.max(1, Math.ceil(d.etaSeconds / 60))} 分钟</span>
          </div>
          <div class="duel-row" style="margin-top:12px">
            <button type="button" class="fighter" data-side="0">${fighterHTML(api.BY_ID.get(d.pair[0]))}</button>
            <span class="vs">VS</span>
            <button type="button" class="fighter" data-side="1">${fighterHTML(api.BY_ID.get(d.pair[1]))}</button>
          </div>
          <div class="res-actions" style="margin-top:12px">
            <button type="button" class="btn" data-act="undo" ${d.canUndo ? "" : "disabled"}>撤回上一题</button>
            <button type="button" class="btn" data-act="leave">回到工作台</button>
          </div>
        </div>`;
      }

      function answer(side) {
        if (ui.answering) return;
        if (snap().phase !== "duel") return;
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

      function renderResultPhase() {
        root.innerHTML = `<div class="wrap"><div id="vC-result"></div></div>`;
        api.renderResult(root.querySelector("#vC-result"), {
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
        const fil = e.target.closest("[data-filter]");
        if (fil) {
          S.setFilter(fil.dataset.filter);
          return render();
        }
        const card = e.target.closest(".pcard");
        if (card) {
          if (!S.toggleSelect(card.dataset.id))
            toast(`已选满 ${snap().size} 位；先在右侧已选板移除一位`);
          return refresh();
        }
        const rm = e.target.closest("[data-remove]");
        if (rm) {
          S.toggleSelect(rm.dataset.remove);
          return refresh();
        }
        const side = e.target.closest("[data-side]");
        if (side) return answer(+side.dataset.side);
        const act = e.target.closest("[data-act]");
        if (!act) return;
        const a = act.dataset.act;
        if (a === "only") {
          ui.onlyPicked = act.checked;
          return renderGallery(snap());
        }
        if (a === "start") {
          if (!api.beginDuel()) return;
          ui.view = "duel";
          return render();
        }
        if (a === "clear") {
          if (window.confirm("清空已选成员？")) {
            S.clearSelection();
            refresh();
          }
          return;
        }
        if (a === "undo") {
          S.undo();
          return render();
        }
        if (a === "leave") {
          ui.view = "pick";
          return render();
        }
        if (a === "sheet") {
          const sheet = root.querySelector("#vC-sheet");
          sheet.hidden = false;
          root.querySelector("#vC-sheet-in").innerHTML = boardHTML(snap());
          return;
        }
      });

      root.addEventListener("change", (e) => {
        if (e.target.matches('select[data-act="group"]')) {
          S.setGroup(e.target.value);
          render();
        }
      });
      root.addEventListener("input", (e) => {
        if (e.target.id !== "vC-q") return;
        clearTimeout(ui.tm);
        ui.tm = setTimeout(() => {
          S.setQuery(e.target.value);
          renderGallery(snap());
        }, 140);
      });
      root.addEventListener("click", (e) => {
        if (e.target.closest("#vC-sheet") && !e.target.closest(".vC-sheet-in"))
          root.querySelector("#vC-sheet").hidden = true;
      });

      document.addEventListener("keydown", (e) => {
        if (!root.isConnected) return;
        if (ui.view !== "duel" || e.target.closest("input, textarea, select"))
          return;
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
