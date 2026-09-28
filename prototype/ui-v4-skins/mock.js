/* 原型 mock：真实成员与照片（worktree 内 img/ 齐全） */
(function () {
  var MEMBERS = [
    { id: "m14a7951a65", name: "岩立沙穂", meta: "现役 · 13期生", now: true },
    { id: "m81dc04e6ca", name: "福岡聖菜", meta: "现役 · 15期生", now: true },
    { id: "meafb93c105", name: "黒須遥香", meta: "现役 · 16期生", now: true },
    { id: "mc09f8cabf0", name: "伊藤理々杏", meta: "现役 · 3期生", now: true },
    { id: "mb4e489c64c", name: "岩本蓮加", meta: "现役 · 3期生", now: true },
    { id: "m86612318d7", name: "遠藤さくら", meta: "现役 · 4期生", now: true },
    { id: "m76f533326a", name: "大谷 映美里", meta: "现役 · 1期生", now: true },
    { id: "m85620333a9", name: "大場 花菜", meta: "现役 · 1期生", now: true },
    { id: "m6c2299a37d", name: "音嶋 莉沙", meta: "现役 · 1期生", now: true },
  ];

  function thumb(id) {
    return "../../img/thumb/" + id + ".webp";
  }

  function renderRoster() {
    var host = document.getElementById("roster");
    if (!host) return;
    host.innerHTML = MEMBERS.map(function (m) {
      return (
        '<button class="card" type="button">' +
        '<span class="ph"><img src="' +
        thumb(m.id) +
        '" alt="" loading="lazy"></span>' +
        '<span class="nm">' +
        m.name +
        "</span>" +
        '<span class="meta' +
        (m.now ? " now" : "") +
        '">' +
        m.meta +
        "</span>" +
        "</button>"
      );
    }).join("");
  }

  function renderTray() {
    var slots = document.getElementById("slots");
    if (!slots) return;
    var picked = MEMBERS.slice(0, 3);
    var html = picked
      .map(function (m) {
        return (
          '<li class="slot"><img src="' + thumb(m.id) + '" alt="' + m.name + '"></li>'
        );
      })
      .join("");
    for (var i = picked.length; i < 7; i++) {
      html += '<li class="slot empty-slot" aria-hidden="true"></li>';
    }
    slots.innerHTML = html;
  }

  function renderRank() {
    var host = document.getElementById("rank-list");
    if (!host) return;
    host.innerHTML = MEMBERS.slice(0, 3)
      .map(function (m, i) {
        return (
          '<li><span class="no">' +
          (i + 1) +
          '</span><span class="who">' +
          m.name +
          '</span><span class="meta">' +
          m.meta +
          "</span></li>"
        );
      })
      .join("");
  }

  renderRoster();
  renderTray();
  renderRank();
})();
