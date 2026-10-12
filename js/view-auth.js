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
      return caja(`<h1>Sin acceso</h1><p class="muted">El usuario ${esc(R.user.email)} no tiene acceso a ningún showroom. Pedile a la dueña que te sume desde Configuración.</p>
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
        <button type="button" class="linkbtn" style="align-self:flex-start" data-act="auth.modo" data-v="recuperar">Olvidé mi contraseña</button></form>`);
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
