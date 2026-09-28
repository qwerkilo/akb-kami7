/* 皮肤切换（原型）：默认原版，选择记忆在 localStorage */
(function () {
  var KEY = "akb-skin-proto";
  var root = document.documentElement;

  function current() {
    try {
      return localStorage.getItem(KEY) || "classic";
    } catch (_) {
      return "classic";
    }
  }

  function paint(skin) {
    root.dataset.skin = skin;
    document.querySelectorAll("[data-skin-set]").forEach(function (b) {
      b.setAttribute("aria-checked", String(b.dataset.skinSet === skin));
    });
    document.querySelectorAll("[data-skin-choice]").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.skinChoice === skin));
    });
  }

  function setSkin(skin) {
    paint(skin);
    try {
      localStorage.setItem(KEY, skin);
    } catch (_) {}
    var fab = document.getElementById("skin-fab");
    var pop = document.getElementById("skin-pop");
    if (pop && !pop.hidden) {
      pop.hidden = true;
      if (fab) fab.setAttribute("aria-expanded", "false");
    }
  }

  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-skin-set],[data-skin-choice]");
    if (btn) {
      setSkin(btn.dataset.skinSet || btn.dataset.skinChoice);
      return;
    }
    var fab = e.target.closest("#skin-fab");
    if (fab) {
      var pop = document.getElementById("skin-pop");
      if (!pop) return;
      var open = pop.hidden;
      pop.hidden = !open;
      fab.setAttribute("aria-expanded", String(open));
      return;
    }
    var pop = document.getElementById("skin-pop");
    if (pop && !pop.hidden && !e.target.closest("#skin-pop")) {
      pop.hidden = true;
      var f = document.getElementById("skin-fab");
      if (f) f.setAttribute("aria-expanded", "false");
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      var pop = document.getElementById("skin-pop");
      if (pop && !pop.hidden) {
        pop.hidden = true;
        var fab = document.getElementById("skin-fab");
        if (fab) {
          fab.setAttribute("aria-expanded", "false");
          fab.focus();
        }
      }
      return;
    }
    var group = e.target.closest('[role="radiogroup"].seg-skin');
    if (!group) return;
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    var items = Array.prototype.slice.call(group.querySelectorAll("button"));
    var idx = items.indexOf(e.target);
    if (idx < 0) return;
    e.preventDefault();
    var next = items[(idx + (e.key === "ArrowRight" ? 1 : items.length - 1)) % items.length];
    next.focus();
    setSkin(next.dataset.skinSet);
  });

  paint(current());
})();
