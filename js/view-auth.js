// Etapa 2: ingreso al panel (email y contraseña), recuperar y cambiar contraseña.
(function () {
  "use strict";
  const EG = window.EG;
  const S = EG.S;
  const U = EG.ui;
  const R = EG.remote;
  const { esc, icon: I } = EG;
  const A = EG.actions;
  S.ui.auth = { modo: "login", email: "", clave: "", err: "", ok: "", busy: false };

  function caja(cuerpo) {
    return `<main class="pubwrap narrow" style="max-width:420px;padding-top:56px"><div class="stack lg">
      <div class="stack sm" style="align-items:flex-start">${U.logo(S.db.settings)}<span class="xs muted">Panel showroom</span></div>${cuerpo}</div></main>`;
  }

  EG.views.auth = function () {
    const a = S.ui.auth;
    const msg = (a.err ? `<p class="err" role="alert">${esc(a.err)}</p>` : "") + (a.ok ? `<p class="notice soft" role="status">${esc(a.ok)}</p>` : "");
    if (R.recovery) {
      return caja(`<h1>Nueva contraseña</h1>
        <form class="stack" id="auth-nueva" novalidate><label class="f" for="au-clave">Contraseña nueva <span class="hint">(mínimo 8 caracteres)</span><input class="t" id="au-clave" type="password" autocomplete="new-password" value="${esc(a.clave)}" data-bind="auth.clave"></label>
        ${msg}<button class="btn dark block" type="submit" ${a.busy ? "disabled" : ""}>Guardar contraseña</button></form>`);
    }
    if (R.user && R.sinAcceso) {
      return caja(`<h1>Sin acceso</h1><p class="muted">El usuario ${esc(R.user.email)} no tiene acceso a ningún showroom. Pedile a la dueña que te sume desde Configuración, o <a href="#/alta">creá tu propio showroom</a> si tenés un código de invitación.</p>
        <button type="button" class="btn" data-act="auth.salir">Salir</button>`);
    }
    if (a.modo === "recuperar") {
      return caja(`<h1>Recuperar contraseña</h1><p class="muted">Te mandamos un mail con un link para crear una contraseña nueva.</p>
        <form class="stack" id="auth-recuperar" novalidate><label class="f" for="au-email">Email<input class="t" id="au-email" type="email" autocomplete="email" value="${esc(a.email)}" data-bind="auth.email"></label>
        ${msg}<button class="btn dark block" type="submit" ${a.busy ? "disabled" : ""}>Enviar link</button>
        <button type="button" class="linkbtn" style="align-self:flex-start" data-act="auth.modo" data-v="login">Volver a ingresar</button></form>`);
    }
    return caja(`<h1>Ingresá a tu panel</h1>
      <form class="stack" id="auth-login" novalidate>
        <label class="f" for="au-email">Email<input class="t" id="au-email" type="email" autocomplete="email" value="${esc(a.email)}" data-bind="auth.email"></label>
        <label class="f" for="au-clave">Contraseña<input class="t" id="au-clave" type="password" autocomplete="current-password" value="${esc(a.clave)}" data-bind="auth.clave"></label>
        ${msg}<button class="btn dark block" type="submit" ${a.busy ? "disabled" : ""}>${a.busy ? "Ingresando…" : "Ingresar"}</button>
        <button type="button" class="linkbtn" style="align-self:flex-start" data-act="auth.modo" data-v="recuperar">Olvidé mi contraseña</button></form>
      <p class="xs muted">¿Tenés un código de invitación? <a href="#/alta">Creá la agenda de tu showroom</a></p>`);
  };

  const run = (fn) => {
    const a = S.ui.auth;
    a.busy = true; a.err = ""; a.ok = "";
    S.render();
    fn().catch((e) => { a.err = e.message === "Invalid login credentials" ? "El email o la contraseña no coinciden." : e.message; })
      .finally(() => { a.busy = false; S.render(); });
    return false;
  };
  A["auth.modo"] = (el) => { Object.assign(S.ui.auth, { modo: el.dataset.v, err: "", ok: "" }); };
  A["auth.salir"] = () => { R.logout().then(() => { R.sinAcceso = false; S.render(); }); return false; };
  EG.submits["auth-login"] = () => run(async () => {
    const a = S.ui.auth;
    await R.login(a.email.trim(), a.clave);
    a.clave = "";
    S.loading = true; S.render();
    try { await R.loadPanel(); } finally { S.loading = false; }
  });
  EG.submits["auth-recuperar"] = () => run(async () => {
    await R.recuperar(S.ui.auth.email.trim());
    S.ui.auth.ok = "Listo. Revisá tu mail (también la carpeta de spam).";
  });
  EG.submits["auth-nueva"] = () => run(async () => {
    const a = S.ui.auth;
    if (a.clave.length < 8) throw new Error("La contraseña tiene que tener al menos 8 caracteres.");
    await R.cambiarClave(a.clave);
    a.clave = "";
    R.recovery = false;
    await R.session();
    S.loading = true; S.render();
    try { await R.loadPanel(); } finally { S.loading = false; }
    S.toast("Contraseña guardada.");
  });
})();

// Alta de un showroom nuevo con código de invitación (#/alta).
(function () {
  "use strict";
  const EG = window.EG;
  const S = EG.S;
  const R = EG.remote;
  const { esc, icon: I } = EG;
  const A = EG.actions;
  const PEND = "eg-alta-pendiente";
  S.ui.alta = { codigo: "", nombre: "", slug: "", slugTocado: false, yo: "", email: "", clave: "", modo: "nueva", slugOk: null, err: "", ok: "", esperando: false, busy: false };

  const leerPend = () => { try { return JSON.parse(localStorage.getItem(PEND) || "null"); } catch (e) { return null; } };
  const guardarPend = (p) => { try { p ? localStorage.setItem(PEND, JSON.stringify(p)) : localStorage.removeItem(PEND); } catch (e) { /* sin storage */ } };
  const irAlPanel = (slug) => { location.href = R.productoBase() + "?s=" + encodeURIComponent(slug) + "#/inicio"; };
  const slugDe = (t) => EG.slug(String(t).normalize("NFD").replace(/[\u0300-\u036f]/g, "")).replace(/[^a-z0-9-]/g, "").slice(0, 40).replace(/^-+|-+$/g, "");

  // Si la persona vuelve desde el mail de confirmación, se crea el showroom que había pedido.
  EG.altaPendiente = async function () {
    const p = leerPend();
    if (!p || !R.user) return;
    const a = S.ui.alta;
    try {
      const r = await R.crearShowroom(p.codigo, p.slug, p.nombre, p.yo);
      if (r && r.ok) { guardarPend(null); irAlPanel(r.slug); return; }
      Object.assign(a, p, { err: (r && r.error) || "No se pudo crear el showroom.", esperando: false });
      guardarPend(null);
    } catch (e) { a.err = e.message; }
  };

  function slugInfo() {
    const a = S.ui.alta;
    if (!a.slug) return "";
    const link = R.productoBase() + "?s=" + a.slug;
    const estado = a.slugOk === true ? `<span class="xs" style="color:var(--ok)">${I("check", 12)} Disponible</span>` : a.slugOk === false ? `<span class="xs" style="color:var(--bad)">No disponible: probá con otro</span>` : `<span class="xs muted">Verificando…</span>`;
    return `<span class="xs muted ellipsis">${esc(link)}</span>${estado}`;
  }
  // Actualiza solo el link y su estado (sin redibujar la pantalla, así no se pierde un toque en otro botón).
  function pintarSlug() {
    const inp = document.getElementById("al-slug"), info = document.getElementById("al-slug-info");
    if (inp && inp.value !== S.ui.alta.slug) inp.value = S.ui.alta.slug;
    if (info) info.innerHTML = slugInfo();
  }
  EG.views.alta = function () {
    const a = S.ui.alta;
    if (!R.on) return `<main class="pubwrap narrow"><h1>Alta de showroom</h1><p class="muted">El alta funciona solo en la versión conectada a la nube.</p></main>`;
    const head = `<div class="stack sm"><span class="logo" style="font-size:22px">agenda showroom.</span><span class="xs muted">Creá la agenda de tu showroom</span></div>`;
    const caja = (h) => `<main class="pubwrap narrow" style="max-width:460px;padding-top:48px"><div class="stack lg">${head}${h}</div></main>`;
    const msg = (a.err ? `<p class="err" role="alert">${esc(a.err)}</p>` : "") + (a.ok ? `<p class="notice soft" role="status">${esc(a.ok)}</p>` : "");
    if (a.esperando) {
      return caja(`<h1>Revisá tu mail</h1><p class="muted">Te mandamos un mail a <b>${esc(a.email)}</b>. Abrilo y tocá el link para confirmar: tu agenda se crea sola y entrás a tu panel.</p>
        <p class="xs muted">Abrí el link en este mismo navegador. Si no lo ves, buscalo en Spam o Promociones.</p>`);
    }
    const f = (id, label, key, type, extra, ayuda) => `<label class="f" for="${id}"><span>${label}${ayuda ? ` <span class="hint">${ayuda}</span>` : ""}</span><input class="t" id="${id}" type="${type || "text"}" value="${esc(a[key])}" data-bind="alta.${key}" ${extra || ""}></label>`;
    const datosShowroom = `${f("al-codigo", "Código de invitación", "codigo", "text", 'autocomplete="off" style="text-transform:uppercase" maxlength="20"')}
      ${f("al-nombre", "Nombre del showroom", "nombre", "text", 'data-change="alta.nombre" maxlength="60" placeholder="Ej: Lola Dots"')}
      <label class="f" for="al-slug"><span>Link de tu agenda <span class="hint">(solo letras, números y guiones)</span></span><input class="t" id="al-slug" value="${esc(a.slug)}" data-bind="alta.slug" data-change="alta.slug" maxlength="40" autocomplete="off">
        <span class="row between" id="al-slug-info">${slugInfo()}</span></label>
      ${f("al-yo", "Tu nombre", "yo", "text", 'maxlength="40" placeholder="Así te saluda el panel"')}`;
    if (R.user) {
      return caja(`<h1>Creá tu showroom</h1><p class="small muted">Vas a crearlo con tu cuenta <b>${esc(R.user.email)}</b>.</p>
        <form class="stack" id="alta-form" novalidate>${datosShowroom}${msg}
        <button class="btn dark block" type="submit" ${a.busy ? "disabled" : ""}>${a.busy ? "Creando…" : "Crear mi agenda"}</button></form>
        <button type="button" class="linkbtn" style="align-self:flex-start" data-act="alta.salir">Usar otra cuenta</button>`);
    }
    const cuenta = a.modo === "cuenta";
    return caja(`<h1>Creá tu showroom</h1><p class="small muted">Necesitás un código de invitación. Si no lo tenés, pedilo por WhatsApp.</p>
      <form class="stack" id="alta-form" novalidate>${datosShowroom}
        <div class="stack sm"><span class="label">${cuenta ? "Ingresá con tu cuenta" : "Tu cuenta para entrar al panel"}</span>
        ${f("al-email", "Email", "email", "email", 'autocomplete="email"')}
        ${f("al-clave", "Contraseña", "clave", "password", `autocomplete="${cuenta ? "current-password" : "new-password"}"`, cuenta ? "" : "(mínimo 8 caracteres)")}</div>
        ${msg}<button class="btn dark block" type="submit" ${a.busy ? "disabled" : ""}>${a.busy ? "Un momento…" : cuenta ? "Ingresar y crear mi agenda" : "Crear mi agenda"}</button>
        <button type="button" class="linkbtn" style="align-self:flex-start" data-act="alta.modo">${cuenta ? "No tengo cuenta: crear una" : "Ya tengo cuenta"}</button></form>`);
  };

  let tSlug = null;
  const revisarSlug = () => {
    const a = S.ui.alta;
    a.slugOk = null;
    clearTimeout(tSlug);
    if (!a.slug) return;
    const pedido = a.slug;
    tSlug = setTimeout(() => {
      R.slugDisponible(pedido).then((ok) => { if (S.ui.alta.slug === pedido) { S.ui.alta.slugOk = ok; pintarSlug(); } }).catch(() => {});
    }, 350);
  };
  EG.changes["alta.nombre"] = () => {
    const a = S.ui.alta;
    if (!a.slugTocado) { a.slug = slugDe(a.nombre); revisarSlug(); }
    pintarSlug();
    return false;
  };
  EG.changes["alta.slug"] = () => {
    const a = S.ui.alta;
    a.slugTocado = true;
    a.slug = slugDe(a.slug);
    revisarSlug();
    pintarSlug();
    return false;
  };
  A["alta.modo"] = () => { const a = S.ui.alta; a.modo = a.modo === "cuenta" ? "nueva" : "cuenta"; a.err = ""; };
  A["alta.salir"] = () => { R.logout().then(() => S.render()); return false; };

  EG.submits["alta-form"] = () => {
    const a = S.ui.alta;
    a.err = ""; a.ok = "";
    a.codigo = a.codigo.trim().toUpperCase();
    a.slug = slugDe(a.slug || a.nombre);
    a.nombre = a.nombre.trim();
    if (!a.codigo) { a.err = "Escribí tu código de invitación."; return; }
    if (a.nombre.length < 2) { a.err = "Escribí el nombre de tu showroom."; return; }
    if (a.slug.length < 3) { a.err = "Elegí un link de al menos 3 letras."; return; }
    if (a.slugOk === false) { a.err = "Ese link no está disponible: probá con otro."; return; }
    const pedido = { codigo: a.codigo, slug: a.slug, nombre: a.nombre, yo: a.yo.trim() };
    if (!R.user) {
      if (!/^\S+@\S+\.\S+$/.test(a.email.trim())) { a.err = "Revisá el email."; return; }
      if (a.clave.length < 8) { a.err = "La contraseña tiene que tener al menos 8 caracteres."; return; }
    }
    a.busy = true;
    S.render();
    (async () => {
      if (!R.user && a.modo === "cuenta") {
        await R.login(a.email.trim(), a.clave);
      } else if (!R.user) {
        const r = await R.registrar(a.email.trim(), a.clave, R.productoBase() + "?s=" + encodeURIComponent(a.slug) + "#/alta");
        if (r.yaExistia) { a.modo = "cuenta"; a.err = "Ese email ya tiene cuenta: escribí tu contraseña y tocá “Ingresar y crear mi agenda”."; return; }
        if (!r.sesion) { guardarPend(pedido); a.esperando = true; return; }
      }
      const r = await R.crearShowroom(pedido.codigo, pedido.slug, pedido.nombre, pedido.yo);
      if (r && r.ok) { a.clave = ""; irAlPanel(r.slug); return; }
      a.err = (r && r.error) || "No se pudo crear el showroom.";
    })().catch((e) => {
      a.err = e.message === "Invalid login credentials" ? "El email o la contraseña no coinciden." : /already registered/i.test(e.message) ? "Ese email ya tiene cuenta: tocá “Ya tengo cuenta”." : e.message;
    }).finally(() => { a.busy = false; S.render(); });
    return false;
  };
})();
