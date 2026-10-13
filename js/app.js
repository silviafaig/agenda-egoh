// Estado, ruteo por hash, eventos y render. Las vistas se registran en EG.views / EG.actions / EG.submits / EG.changes.
(function () {
  "use strict";
  const EG = window.EG;
  const S = (EG.S = {});
  EG.views = {};
  EG.actions = {};
  EG.submits = {};
  EG.changes = {};

  // Secciones del panel. "mas" es el menú completo en mobile.
  const PANEL = ["inicio", "agenda", "clientas", "metricas", "catalogo", "perfil", "horarios", "reglas", "compartir", "integraciones", "configuracion", "ayuda", "mas"];
  EG.PANEL = PANEL;

  const R = EG.remote;
  // Modo nube (etapa 2): los datos llegan de Supabase al arrancar. Modo local: del navegador.
  S.db = R.on ? { v: 2, settings: EG.defaultSettings(), products: [], appts: [], clientas: [], bloqueos: [] } : EG.store.load();
  S.ui = {
    route: "inicio",
    fromPanel: false,
    splash: false, splashShown: false,
    // pública
    step: 0, formErr: "", slotMsg: "", done: null, cat: EG.CATEGORIAS[0], q: "",
    citaId: null, cita: null,
    // panel
    open: null, copied: null, editProd: null, catPanel: EG.CATEGORIAS[0],
    draft: null, draftErr: "", fotoMsg: null, busy: false, modal: null,
    agendaVista: "lista", agQ: "", agDesde: "", agHasta: "", week: 0,
    clienta: null, clQ: "", clFiltro: "", metPer: "semana", metDesde: "", metHasta: ""
  };

  S.prod = (id) => S.db.products.find((p) => p.id === id);
  S.save = () => {
    if (R.on) { R.sync(); return true; }
    const ok = EG.store.save(S.db);
    if (!ok) S.toast("No se pudo guardar: el navegador se quedó sin espacio.");
    return ok;
  };
  // Links para compartir: la dirección definitiva (config.appUrl); en la computadora local, la dirección actual.
  const base = () => {
    const c = window.EG_CONFIG || {};
    return c.appUrl && !/^localhost|^127\./.test(location.hostname) && location.protocol !== "file:" ? c.appUrl.replace(/\/?$/, "/") : location.href.split("#")[0];
  };
  S.publicLink = () => base() + "#/reservar";
  S.citaLink = (a) => base() + "#/cita/" + a.id + (a._token ? "." + a._token : "");

  let toastTimer = null;
  S.toast = (msg) => {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 3200);
  };

  /* ---------- ruteo ---------- */
  const isPublic = (r) => r === "reservar" || r === "cita";
  function routeFromHash() {
    const h = location.hash.replace(/^#\/?/, "").split("?")[0];
    const parts = h.split("/");
    if (parts[0] === "reservar") return "reservar";
    if (parts[0] === "cita") { const t = String(parts[1] || "").split("."); S.ui.citaId = t[0] || null; S.ui.citaToken = t[1] || ""; return "cita"; }
    return PANEL.indexOf(parts[0]) >= 0 ? parts[0] : "inicio";
  }
  S.go = (route) => {
    if (location.hash === "#/" + route) { S.ui.route = route; S.render({ top: true }); }
    else location.hash = "#/" + route;
  };
  function enterRoute() {
    S.ui.route = routeFromHash();
    S.ui.editProd = null;
    S.ui.draft = null;
    S.ui.draftErr = "";
    S.ui.modal = null;
    S.ui.confirmar = null;
    if (S.ui.route === "reservar" && !S.ui.splashShown) {
      S.ui.splash = true;
      S.ui.splashShown = true;
      setTimeout(() => { S.ui.splash = false; S.render({ top: true }); }, 1800);
    }
  }
  // En modo nube, antes de mostrar una pantalla se cargan los datos que necesita.
  S.loading = false;
  async function ensureData() {
    if (!R.on) return;
    const pub = isPublic(S.ui.route);
    try {
      if (pub) {
        if (!R.panel && !R.publicLoaded) { S.loading = true; S.render(); await R.loadPublic(); R.publicLoaded = true; }
      } else if (!R.panel) {
        S.loading = true; S.render();
        const user = await R.session();
        if (user) await R.loadPanel();
      }
    } catch (e) {
      R.error = /fetch|network/i.test(e.message) ? "No pudimos conectarnos. Revisá tu conexión a internet y probá de nuevo." : e.message;
    }
    S.loading = false;
  }
  S.ensureData = ensureData;
  window.addEventListener("hashchange", async () => { enterRoute(); await ensureData(); S.render({ top: true }); });
  // Si otra pestaña del mismo navegador guardó datos, los recargamos para no pisarlos.
  window.addEventListener("storage", (e) => {
    if (!R.on && e.key === "agenda-egoh:v1:datos") { S.db = EG.store.load(); S.render(); }
  });

  /* ---------- filtros en el lugar (no redibujan, así no se pierde el foco) ---------- */
  function applyFilter(input) {
    const q = EG.normName(input.value);
    const scope = input.closest("[data-fscope]") || document;
    let visibles = 0;
    scope.querySelectorAll(input.dataset.filter).forEach((el) => {
      const ok = !q || EG.normName(el.dataset.s || el.textContent).indexOf(q) >= 0;
      el.hidden = !ok;
      if (ok) visibles++;
    });
    const empty = scope.querySelector("[data-fempty]");
    if (empty) empty.hidden = visibles > 0;
  }

  /* ---------- render ---------- */
  S.render = (opts) => {
    const app = document.getElementById("app");
    const y = window.scrollY;
    const keep = {};
    app.querySelectorAll("[data-keepscroll]").forEach((el) => { keep[el.dataset.keepscroll] = [el.scrollLeft, el.scrollTop]; });
    const pub = isPublic(S.ui.route);
    document.body.classList.toggle("is-public", pub);
    app.innerHTML = S.loading ? `<div class="splash" aria-busy="true"></div>`
      : R.on && R.error && !(pub && R.publicLoaded) ? `<main class="pubwrap narrow"><h1>No se pudo cargar</h1><p class="muted">${EG.esc(R.error)}</p><button type="button" class="btn dark" onclick="location.reload()">Reintentar</button></main>`
      : pub ? EG.views.publico() : R.on && (!R.user || !R.panel || R.recovery) ? EG.views.auth() : EG.views.panel();
    app.querySelectorAll("[data-keepscroll]").forEach((el) => {
      const k = keep[el.dataset.keepscroll];
      if (k) { el.scrollLeft = k[0]; el.scrollTop = k[1]; }
    });
    app.querySelectorAll("input[data-filter]").forEach((el) => { if (el.value) applyFilter(el); });
    window.scrollTo(0, opts && opts.top ? 0 : y);
    document.title = pub ? S.db.settings.nombre + " · Reservá tu cita" : "Agenda Showroom · " + S.db.settings.nombre;
  };

  /* ---------- eventos ---------- */
  function setPath(obj, path, value) {
    const parts = path.split(".");
    for (let i = 0; i < parts.length - 1; i++) obj = obj[parts[i]];
    obj[parts[parts.length - 1]] = value;
  }
  document.addEventListener("click", (e) => {
    if (e.target.classList && e.target.classList.contains("overlay")) { S.ui.modal = null; S.render(); return; }
    const el = e.target.closest("[data-act]");
    if (!el || el.disabled) return;
    const fn = EG.actions[el.dataset.act];
    if (!fn) return;
    const r = fn(el, e);
    if (r === false) return;
    S.render({ top: r === "top" });
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && S.ui.modal) { S.ui.modal = null; S.render(); }
  });
  document.addEventListener("input", (e) => {
    const t = e.target;
    if (t.dataset.note) {
      const a = S.db.appts.find((x) => x.id === t.dataset.note);
      if (a) { a.notas = t.value; S.save(); }
      return;
    }
    if (t.dataset.seg) {
      const a = S.db.appts.find((x) => x.id === t.dataset.seg);
      if (a) {
        a.seguimiento = t.value; S.save();
        const link = document.querySelector('[data-seglink="' + a.id + '"]');
        if (link) link.href = EG.waLink(a.whatsapp, t.value);
      }
      return;
    }
    if (t.dataset.cnote) {
      const c = S.db.clientas.find((x) => x.id === t.dataset.cnote);
      if (c) { c.notas = t.value; S.save(); }
      return;
    }
    if (t.dataset.bind) setPath(S.ui, t.dataset.bind, t.type === "checkbox" ? t.checked : t.value);
    if (t.dataset.filter) applyFilter(t);
  });
  document.addEventListener("change", (e) => {
    const t = e.target;
    if (t.dataset.bind && (t.tagName === "SELECT" || t.type === "checkbox" || t.type === "date" || t.type === "time")) {
      setPath(S.ui, t.dataset.bind, t.type === "checkbox" ? t.checked : t.value);
    }
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

  document.addEventListener("DOMContentLoaded", async () => {
    enterRoute();
    await ensureData();
    S.render({ top: true });
  });
})();
