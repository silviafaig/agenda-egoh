// Estado, ruteo por hash, eventos y render. Las vistas se registran en EG.views / EG.actions / EG.submits / EG.changes.
(function () {
  "use strict";
  const EG = window.EG;
  const S = (EG.S = {});
  EG.views = {};
  EG.actions = {};
  EG.submits = {};
  EG.changes = {};

  const PANEL = ["inicio", "agenda", "catalogo", "ajustes"];

  S.db = EG.store.load();
  S.ui = {
    route: "inicio",
    fromPanel: false,
    // pública
    step: 0, formErr: "", slotMsg: "", done: null, cat: EG.CATEGORIAS[0],
    // panel
    day: null, open: null, copied: null, editProd: null, catPanel: EG.CATEGORIAS[0],
    settingsDraft: null, settingsErr: "", fotoMsg: null, busy: false
  };

  S.prod = (id) => S.db.products.find((p) => p.id === id);
  S.save = () => {
    const ok = EG.store.save(S.db);
    if (!ok) S.toast("No se pudo guardar: el navegador se quedó sin espacio.");
    return ok;
  };

  let toastTimer = null;
  S.toast = (msg) => {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 3200);
  };

  /* ---------- ruteo ---------- */
  function routeFromHash() {
    const h = location.hash.replace(/^#\/?/, "").split("?")[0];
    if (h === "reservar") return "reservar";
    return PANEL.indexOf(h) >= 0 ? h : "inicio";
  }
  S.go = (route) => {
    if (location.hash === "#/" + route) { S.ui.route = route; S.render({ top: true }); }
    else location.hash = "#/" + route;
  };
  window.addEventListener("hashchange", () => {
    S.ui.route = routeFromHash();
    S.ui.editProd = null;
    S.ui.settingsDraft = null;
    S.render({ top: true });
  });
  // Si otra pestaña del mismo navegador guardó datos, los recargamos para no pisarlos.
  window.addEventListener("storage", (e) => {
    if (e.key === "agenda-egoh:v1:datos") { S.db = EG.store.load(); S.render(); }
  });

  /* ---------- render ---------- */
  S.render = (opts) => {
    const app = document.getElementById("app");
    const y = window.scrollY;
    const keep = {};
    app.querySelectorAll("[data-keepscroll]").forEach((el) => { keep[el.dataset.keepscroll] = el.scrollLeft; });
    document.body.classList.toggle("is-public", S.ui.route === "reservar");
    app.innerHTML = S.ui.route === "reservar" ? EG.views.publico() : EG.views.panel();
    app.querySelectorAll("[data-keepscroll]").forEach((el) => {
      if (keep[el.dataset.keepscroll] !== undefined) el.scrollLeft = keep[el.dataset.keepscroll];
    });
    window.scrollTo(0, opts && opts.top ? 0 : y);
    document.title = S.ui.route === "reservar" ? S.db.settings.nombre + " – Reservá tu visita" : "Agenda Showroom";
  };

  /* ---------- eventos ---------- */
  function setPath(obj, path, value) {
    const parts = path.split(".");
    for (let i = 0; i < parts.length - 1; i++) obj = obj[parts[i]];
    obj[parts[parts.length - 1]] = value;
  }
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-act]");
    if (!el || el.disabled) return;
    const fn = EG.actions[el.dataset.act];
    if (!fn) return;
    const r = fn(el, e);
    if (r === false) return;
    S.render({ top: r === "top" });
  });
  // Puntos de los indicadores deslizables (se actualizan sin redibujar la pantalla).
  document.addEventListener("scroll", (e) => {
    const el = e.target;
    if (!el.classList || !el.classList.contains("kpis") || !el.firstElementChild) return;
    const i = Math.round(el.scrollLeft / (el.firstElementChild.offsetWidth + 14));
    el.parentNode.querySelectorAll(".dots span").forEach((d, k) => d.classList.toggle("on", k === i));
  }, true);
  document.addEventListener("input", (e) => {
    const t = e.target;
    if (t.dataset.note) {
      const a = S.db.appts.find((x) => x.id === t.dataset.note);
      if (a) { a.notas = t.value; S.save(); }
      return;
    }
    if (t.dataset.bind) setPath(S.ui, t.dataset.bind, t.type === "checkbox" ? t.checked : t.value);
  });
  document.addEventListener("change", (e) => {
    const t = e.target;
    if (t.dataset.bind && t.tagName === "SELECT") setPath(S.ui, t.dataset.bind, t.value);
    const fn = t.dataset.change && EG.changes[t.dataset.change];
    if (fn && fn(t) !== false) S.render();
  });
  document.addEventListener("submit", (e) => {
    e.preventDefault();
    const fn = EG.submits[e.target.id];
    if (!fn) return;
    const r = fn(e.target);
    if (r !== false) S.render({ top: r === "top" });
  });

  document.addEventListener("DOMContentLoaded", () => {
    S.ui.route = routeFromHash();
    S.render({ top: true });
  });
})();
