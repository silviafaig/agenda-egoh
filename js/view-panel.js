// Panel del showroom: Inicio, Agenda por día, Catálogo y Ajustes.
(function () {
  "use strict";
  const EG = window.EG;
  const S = EG.S;
  const U = EG.ui;
  const { esc, money, fechaLarga, DIAS, MESES, icon: I } = EG;

  const publicLink = () => location.href.split("#")[0] + "#/reservar";
  const hoyYmd = () => EG.ymd(new Date());
  const activas = (list) => list.filter((a) => a.estado !== "cancelada");
  const delDia = (d) => S.db.appts.filter((a) => a.fecha === d).sort((x, y) => x.hora.localeCompare(y.hora));

  /* ---------- estructura ---------- */
  const NAV = [["inicio", "house", "Inicio"], ["agenda", "calendar-days", "Agenda"], ["catalogo", "shirt", "Catálogo"], ["ajustes", "settings", "Ajustes"]];

  function chrome(body) {
    const s = S.db.settings;
    return `<header class="header"><button class="brand" type="button" data-act="nav" data-v="inicio"><span class="mark">a</span><b>Agenda Showroom</b></button>
        <button class="avatar-e" type="button" data-act="nav" data-v="ajustes" aria-label="Ajustes de ${esc(s.nombre)}">${esc(U.inicial(s.nombre))}</button></header>
      <main class="page">${EG.store.persistent ? "" : `<p class="notice bad" style="margin-bottom:14px">Este navegador no permite guardar datos: lo que cargues se pierde al cerrar la página.</p>`}${body}</main>
      <nav class="nav" aria-label="Secciones">${NAV.map((n) => `<button type="button" data-act="nav" data-v="${n[0]}" ${S.ui.route === n[0] ? 'aria-current="page"' : ""}>${I(n[1], 22)}<span>${n[2]}</span></button>`).join("")}</nav>`;
  }

  const resumen = (lista) => {
    const act = activas(lista);
    return `<div class="summary"><div class="card"><span class="label">Citas</span><b class="num">${act.length}</b></div>
      <div class="card"><span class="label">Video</span><b class="num">${act.filter((a) => a.tipo === "video").length}</b></div>
      <div class="card"><span class="label">Prendas a preparar</span><b class="num">${act.reduce((n, a) => n + a.prendas.length, 0)}</b></div></div>`;
  };

  /* ---------- Inicio ---------- */
  function inicio() {
    const s = S.db.settings;
    const hoy = hoyYmd();
    const ahora = (() => { const d = new Date(); return EG.toH(d.getHours() * 60 + d.getMinutes()); })();
    const futuras = activas(S.db.appts)
      .filter((a) => a.estado === "confirmada" && (a.fecha > hoy || (a.fecha === hoy && a.hora >= ahora)))
      .sort((x, y) => (x.fecha + x.hora).localeCompare(y.fecha + y.hora));
    const proximas = futuras.slice(0, 5);
    const sig = futuras[0];
    const deHoy = activas(delDia(hoy));
    const prendasHoy = deHoy.reduce((n, a) => n + a.prendas.length, 0);
    const kpi = (icono, titulo, valor, detalle) =>
      `<div class="kpi"><div class="row between nowrap" style="align-items:flex-start"><div><div style="font-size:16px;font-weight:700">${titulo}</div>
        <div class="small muted">${esc(fechaLarga(hoy))}</div></div><span class="tile">${I(icono, 19)}</span></div>
        <div class="big num">${valor}</div><p class="small muted">${detalle}</p></div>`;
    return `<div class="stack" style="gap:18px">
      <div><div class="kpis" aria-label="Resumen de hoy">
          ${kpi("calendar-days", "Citas de hoy", deHoy.length, deHoy.filter((a) => a.tipo === "video").length + " por videollamada")}
          ${kpi("shirt", "Prendas a preparar", prendasHoy, "para las citas de hoy")}
          ${kpi("clock", "Próximas citas", futuras.length, "confirmadas desde ahora")}
        </div><div class="dots" aria-hidden="true"><span class="on"></span><span></span><span></span></div></div>

      <div class="card flush">
        <div class="cardhead"><span class="avatar-e md">${esc(U.inicial(s.nombre))}</span>
          <div class="grow"><div class="cardtitle">${esc(s.nombre)}</div><div class="status"><i></i>Activa</div></div>
          <button type="button" class="iconbtn" data-act="nav" data-v="ajustes" aria-label="Ajustes del showroom">${I("settings", 17)}</button></div>
        <div class="linkrow">${I("link", 16)}<span title="${esc(publicLink())}">${esc(publicLink())}</span>
          <button type="button" data-act="inicio.copiar" aria-label="Copiar link">${I("copy", 15)}</button></div>
        <div class="cardpad stack" style="gap:12px">
          <p class="row muted small nowrap" style="align-items:flex-start">${I("map-pin", 15)}<span>${esc(s.direccion)}</span></p>
          <div class="nextbar"><div class="label">Próxima cita</div>
            <b>${sig ? esc(fechaLarga(sig.fecha)) + " " + esc(sig.hora) + " · " + esc(sig.nombre) : "Todavía no hay citas"}</b></div></div>
        <div class="statsfoot"><div><span>Citas hoy</span><b class="num">${deHoy.length}</b></div><div><span>Prendas a preparar hoy</span><b class="num">${prendasHoy}</b></div></div>
      </div>
      <p class="notice">Todavía no compartas este link con clientas: por ahora las reservas se guardan solo en este navegador y no te llegan a vos (eso se conecta en la etapa 2).</p>
      <button type="button" class="btn primary block" data-act="inicio.verPublica">${I("external-link", 17)}Ver como clienta</button>

      <h2>Próximas citas</h2>
      ${proximas.length
        ? `<div class="card flush">${proximas.map((a, i) => `<button type="button" class="rowitem rowbtn" ${i ? "" : 'style="border-top:0"'} data-act="inicio.ver" data-id="${esc(a.id)}" data-d="${esc(a.fecha)}">
            ${U.avatar(a.nombre)}<span class="grow"><span class="rname" style="display:block">${esc(a.nombre)}</span>
            <span class="rsub"><span>${esc(fechaLarga(a.fecha))} · ${esc(a.hora)} hs · ${U.tipoTxt(a, true)}</span></span></span>
            <span class="chip">${a.prendas.length} prenda${a.prendas.length === 1 ? "" : "s"}</span></button>`).join("")}</div>`
        : `<p class="card muted">No hay citas próximas. Cuando una clienta reserve, aparece acá con las prendas que eligió.</p>`}
    </div>`;
  }

  /* ---------- Agenda ---------- */
  function agendaDays() {
    const hoy = hoyYmd();
    const limite = new Date(); limite.setDate(limite.getDate() - 14);
    const set = new Set([hoy].concat(EG.nextDays(S.db.settings, 10)));
    S.db.appts.forEach((a) => { if (a.fecha >= EG.ymd(limite)) set.add(a.fecha); });
    return Array.from(set).sort();
  }

  function detalle(a) {
    const msg = EG.msgSeguimiento(a, S.db.settings, S.prod);
    const prendas = a.prendas.length
      ? a.prendas.map((i, ix) => {
          const p = S.prod(i.id);
          const on = (v) => (i.seLlevo === v ? "true" : "false");
          return `<div class="row" style="flex-wrap:nowrap"><span class="thumbs">${U.thumb(p)}</span>
            <span class="grow small"><b>${esc(EG.itemName(i, S.prod))}</b><br><span class="muted">Talle ${esc(i.talle)} · <span class="num">${EG.priceTxt(p)}</span></span></span>
            <button type="button" class="btn sm${i.seLlevo === true ? " primary" : ""}" data-act="agenda.take" data-a="${esc(a.id)}" data-i="${ix}" data-v="1" aria-pressed="${on(true)}">Se llevó</button>
            <button type="button" class="btn sm${i.seLlevo === false ? " primary" : ""}" data-act="agenda.take" data-a="${esc(a.id)}" data-i="${ix}" data-v="0" aria-pressed="${on(false)}">No</button></div>`;
        }).join("")
      : `<p class="small muted">No eligió prendas antes de la cita.</p>`;
    const estados = [["confirmada", "Confirmada"], ["asistio", "Asistió"], ["no_vino", "No vino"], ["cancelada", "Cancelada"]];
    return `<div class="stack">
      ${a.queBusca ? `<div><div class="label">Lo que busca</div><p>${esc(a.queBusca)}</p></div>` : ""}
      <div class="small"><div class="label">Contacto</div><p class="num">+${esc(a.whatsapp)} · <a href="mailto:${esc(a.email)}">${esc(a.email)}</a></p></div>
      <div><div class="label">Preselección · marcá qué se llevó</div><div class="stack" style="gap:10px;margin-top:8px">${prendas}</div></div>
      <label class="f" for="n-${esc(a.id)}">Notas de la visita<textarea class="t" id="n-${esc(a.id)}" data-note="${esc(a.id)}" placeholder="Qué le gustó, qué talle le quedó, qué colores pidió…">${esc(a.notas)}</textarea></label>
      <div><div class="label">Estado</div><div class="row" style="margin-top:8px">${estados.map((e) =>
        `<button type="button" class="btn sm${a.estado === e[0] ? " primary" : ""}" data-act="agenda.estado" data-a="${esc(a.id)}" data-v="${e[0]}" aria-pressed="${a.estado === e[0]}">${e[1]}</button>`).join("")}</div></div>
      ${a.estado === "asistio"
        ? `<div class="stack"><div class="label">Seguimiento</div><div class="mail small">${esc(msg)}</div>
            <div class="row"><a class="btn sm primary" href="${esc(EG.waLink(a.whatsapp, msg))}" target="_blank" rel="noopener">${I("message-circle", 16)}Enviar por WhatsApp</a>
            <button type="button" class="btn sm" data-act="agenda.copiar" data-a="${esc(a.id)}">${I("copy", 16)}Copiar mensaje</button>${S.ui.copied === a.id ? '<span class="small" style="color:var(--ok);font-weight:700">Copiado</span>' : ""}</div></div>`
        : ""}
    </div>`;
  }

  function apptCard(a) {
    const s = S.db.settings;
    const tot = EG.totalOf(a.prendas, S.prod);
    const priced = a.prendas.length > 0 && EG.allPriced(a.prendas, S.prod);
    const abierta = S.ui.open === a.id;
    const msg = EG.msgRecordatorio(a, s, S.prod);
    return `<article class="card flush"><div class="rowitem"><div class="time num">${esc(a.hora)}</div>${U.avatar(a.nombre)}
        <div class="grow"><div class="rname">${esc(a.nombre)}</div>
          <div class="rsub">${a.tipo === "video" ? I("video", 14) : I("map-pin", 14)}<span>${U.tipoTxt(a, true)} · ${esc(a.comoCompra)}</span></div></div></div>
      <div class="strip"><div class="thumbs">${a.prendas.slice(0, 5).map((i) => U.thumb(S.prod(i.id))).join("")}</div>
        <span class="small num">${a.prendas.length} prenda${a.prendas.length === 1 ? "" : "s"}${priced ? " · " + money(tot) : ""}</span>
        ${priced && s.compraMinima > 0 ? (tot >= s.compraMinima ? '<span class="chip ok">Llega al mínimo</span>' : '<span class="chip warn">Bajo el mínimo</span>') : ""}
        <span style="margin-left:auto">${U.estadoChip(a)}</span></div>
      <div class="actions">${a.tipo === "video" && a.sala ? `<a class="btn sm" href="${esc(EG.videoLink(a))}" target="_blank" rel="noopener">${I("video", 16)}Abrir videollamada</a>` : ""}
        <a class="btn sm" href="${esc(EG.waLink(a.whatsapp, msg))}" target="_blank" rel="noopener">${I("message-circle", 16)}Recordatorio por WhatsApp</a>
        <button type="button" class="btn sm" data-act="agenda.abrir" data-v="${esc(a.id)}" aria-expanded="${abierta}">${abierta ? "Cerrar" : "Ver detalle"}</button></div>
      ${abierta ? `<div class="cardpad" style="border-top:1px solid var(--line)">${detalle(a)}</div>` : ""}</article>`;
  }

  function agenda() {
    const dias = agendaDays();
    const hoy = hoyYmd();
    if (!S.ui.day || dias.indexOf(S.ui.day) < 0) S.ui.day = dias.indexOf(hoy) >= 0 ? hoy : dias[0];
    const lista = delDia(S.ui.day);
    return `<div class="stack"><div class="days" data-keepscroll="agenda" role="group" aria-label="Día">${dias.map((d) => {
        const x = EG.parseYmd(d);
        const n = activas(S.db.appts.filter((a) => a.fecha === d)).length;
        return `<button type="button" class="day" data-act="agenda.dia" data-v="${d}" aria-pressed="${S.ui.day === d}" aria-label="${esc(fechaLarga(d))}"><span class="small">${DIAS[x.getDay()]}</span><b>${x.getDate()}</b><span class="small daybtn-count">${n ? n + " cita" + (n > 1 ? "s" : "") : "libre"}</span></button>`;
      }).join("")}</div>
      <h2>${S.ui.day === hoy ? "Hoy, " : ""}${esc(fechaLarga(S.ui.day))}</h2>${resumen(lista)}
      ${lista.length ? lista.map(apptCard).join("") : `<p class="card muted">No hay citas este día. Cuando una clienta reserve, aparece acá con las prendas que eligió.</p>`}</div>`;
  }

  /* ---------- Catálogo ---------- */
  function fotoMsg() {
    const m = S.ui.fotoMsg;
    if (!m) return "";
    const lista = (t, arr) => (arr.length ? `<p class="small"><b>${t}</b></p><ul class="picked small">${arr.map((x) => `<li>${esc(x.archivo)} <span class="muted">– ${esc(x.motivo)}</span></li>`).join("")}</ul>` : "");
    return `<div class="card stack" role="status"><div class="row between"><b>${m.ok ? `Se actualizaron ${m.ok} foto${m.ok === 1 ? "" : "s"}.` : "No se actualizó ninguna foto."}</b>
      <button type="button" class="btn sm" data-act="cat.cerrarMsg">Cerrar</button></div>
      ${lista("No se usaron:", m.ignoradas)}${lista("No se pudieron cargar:", m.fallidas)}</div>`;
  }

  function formProd(e) {
    const src = e.fotoNueva || (e.id ? EG.photoSrc(S.prod(e.id)) : "");
    return `<form class="card stack" id="cat-form" novalidate><h3>${e.id ? "Editar prenda" : "Nueva prenda"}</h3>
      <label class="f" for="pf-nombre">Nombre<input class="t" id="pf-nombre" value="${esc(e.nombre)}" data-bind="editProd.nombre" placeholder="Ej: Bikini Cala Black" required></label>
      <label class="f" for="pf-cat">Categoría<select class="t" id="pf-cat" data-bind="editProd.categoria">${EG.CATEGORIAS.map((c) => `<option${e.categoria === c ? " selected" : ""}>${esc(c)}</option>`).join("")}</select></label>
      <label class="f" for="pf-precio">Precio mayorista<input class="t num" id="pf-precio" type="number" inputmode="numeric" min="0" step="100" value="${esc(e.precio)}" data-bind="editProd.precio" placeholder="Vacío = precio a confirmar"></label>
      <label class="f" for="pf-talles">Talles (separados por coma)<input class="t" id="pf-talles" value="${esc(e.tallesTxt)}" data-bind="editProd.tallesTxt" placeholder="1, 2, 3, 4, 5, 6"></label>
      <label class="f" for="pf-foto">Foto<input class="t" id="pf-foto" type="file" accept="image/*" data-change="cat.foto"></label>
      ${src ? `<img src="${esc(src)}" alt="Foto de la prenda" style="width:96px;border-radius:10px;aspect-ratio:4/5;object-fit:cover;object-position:center top">` : ""}
      ${S.ui.formErr ? `<p class="err" role="alert">${esc(S.ui.formErr)}</p>` : ""}
      <div class="row"><button class="btn primary" type="submit">Guardar</button><button class="btn" type="button" data-act="cat.cancelar">Cancelar</button>
        ${e.id ? `<button class="btn danger" type="button" data-act="cat.borrar">${I("trash-2", 16)}Quitar del catálogo</button>` : ""}</div></form>`;
  }

  function catalogo() {
    const lista = S.db.products.filter((p) => p.categoria === S.ui.catPanel);
    return `<div class="stack"><div class="row between"><h2>Catálogo</h2>
        <button type="button" class="btn sm primary" data-act="cat.nueva">${I("plus", 16)}Agregar prenda</button></div>
      <p class="small muted">Las clientas eligen de acá su preselección al reservar.</p>
      <div class="card stack"><div><b>Cargar fotos en masa</b><p class="small muted">Elegí varias fotos juntas: cada una se asigna a su prenda por el nombre del archivo, con el formato <b>Bikini_Modelo_Color_01.jpg</b> (por ejemplo <i>Bikini_Cala_Black_01.jpg</i>). Se usa la <b>_01</b>, salvo en Reversible Vela Malbec / Black, que usa la <b>_02</b>.</p></div>
        <label class="btn" style="cursor:pointer;align-self:flex-start">${I("image-plus", 16)}${S.ui.busy ? "Cargando fotos…" : "Elegir fotos"}
          <input class="sr-only" type="file" accept="image/*" multiple data-change="cat.masivo" ${S.ui.busy ? "disabled" : ""}></label></div>
      ${fotoMsg()}
      ${U.cats(S.ui.catPanel, "cat.filtro")}
      ${S.ui.editProd ? formProd(S.ui.editProd) : ""}
      ${lista.length
        ? `<div class="grid">${lista.map((p) => `<div class="prod"><div class="ph">${U.photo(p)}</div><div class="body"><h3>${esc(p.nombre)}</h3>
            <p class="small num muted">${EG.priceTxt(p)} · ${p.talles.length} talle${p.talles.length === 1 ? "" : "s"}</p>
            <button type="button" class="btn sm" data-act="cat.editar" data-v="${esc(p.id)}">Editar</button></div></div>`).join("")}</div>`
        : `<p class="card muted">Todavía no hay prendas en esta categoría. Usá “Agregar prenda” para cargar la primera.</p>`}</div>`;
  }

  /* ---------- Ajustes ---------- */
  function draftFrom(s) {
    const f = s.franjas;
    return {
      nombre: s.nombre, direccion: s.direccion, info: s.info, dias: s.dias.slice(),
      f1d: f[0] ? f[0][0] : "", f1h: f[0] ? f[0][1] : "", f2d: f[1] ? f[1][0] : "", f2h: f[1] ? f[1][1] : "",
      duracion: s.duracion, compraMinima: s.compraMinima, compraMinimaNota: s.compraMinimaNota || ""
    };
  }

  function ajustes() {
    if (!S.ui.settingsDraft) S.ui.settingsDraft = draftFrom(S.db.settings);
    const d = S.ui.settingsDraft;
    const t = (id, label, key, type, extra) => `<label class="f" for="${id}">${label}<input class="t${type === "number" ? " num" : ""}" id="${id}" type="${type}" value="${esc(d[key])}" data-bind="settingsDraft.${key}" ${extra || ""}></label>`;
    const seccion = (titulo, desc, cuerpo) => `<div class="card stack" style="gap:16px"><div class="sectionhead"><h3>${titulo}</h3><p>${desc}</p></div>${cuerpo}</div>`;
    return `<div class="stack" style="gap:16px">
      <div class="topactions"><button type="button" class="btn" data-act="inicio.verPublica">${I("external-link", 16)}Ver como clienta</button>
        <button class="btn primary" type="submit" form="aj-form">Guardar cambios</button></div>
      ${S.ui.settingsErr ? `<p class="notice bad" role="alert">${esc(S.ui.settingsErr)}</p>` : ""}
      <form class="stack" id="aj-form" novalidate style="gap:16px">
        ${seccion("Información básica", "Lo que ven las clientas en la página de reserva",
          t("aj-nombre", "Nombre del showroom", "nombre", "text") + t("aj-dir", "Dirección o zona", "direccion", "text") +
          `<label class="f" for="aj-info">Información para las clientas<textarea class="t" id="aj-info" data-bind="settingsDraft.info">${esc(d.info)}</textarea></label>`)}
        ${seccion("Horarios de atención", "Los días y franjas en las que se pueden reservar citas",
          `<div><div class="label">Días de atención</div><div class="row" style="margin-top:8px">${[1, 2, 3, 4, 5, 6, 0].map((n) =>
            `<button type="button" class="size" data-act="aj.dia" data-v="${n}" aria-pressed="${d.dias.indexOf(n) >= 0}">${DIAS[n]}</button>`).join("")}</div></div>
          <div class="grid">${t("aj-f1d", "Mañana desde", "f1d", "time")}${t("aj-f1h", "Mañana hasta", "f1h", "time")}${t("aj-f2d", "Tarde desde", "f2d", "time")}${t("aj-f2h", "Tarde hasta", "f2h", "time")}</div>` +
          t("aj-dur", "Duración de la cita (minutos)", "duracion", "number", 'min="10" step="5" inputmode="numeric"'))}
        ${seccion("Compra mínima", "Se le muestra a la clienta al reservar y al elegir prendas",
          `<div class="grid">${t("aj-min", "Compra mínima", "compraMinima", "number", 'min="0" step="1000" inputmode="numeric"')}${t("aj-nota", "Aclaración", "compraMinimaNota", "text", 'placeholder="Ej: por tiempo limitado"')}</div>`)}
      </form>
      <div class="card stack"><div class="sectionhead"><h3>Datos de prueba</h3><p>Para probar el panel sin esperar reservas reales. Todo queda solo en este navegador.</p></div>
        <div class="row"><button type="button" class="btn sm" data-act="aj.ejemplo">Cargar citas de ejemplo</button>
          <button type="button" class="btn sm danger" data-act="aj.reset">Volver a los datos iniciales</button></div></div></div>`;
  }

  /* ---------- vista ---------- */
  EG.views.panel = function () {
    const r = S.ui.route;
    const body = r === "agenda" ? agenda() : r === "catalogo" ? catalogo() : r === "ajustes" ? ajustes() : inicio();
    return chrome(body);
  };

  /* ---------- acciones ---------- */
  const A = EG.actions;
  A.nav = (el) => { S.go(el.dataset.v); return false; };

  A["inicio.copiar"] = () => {
    U.copy(publicLink()).then(() => S.toast("Link copiado.")).catch(() => S.toast("No se pudo copiar. Seleccionalo y copialo a mano."));
    return false;
  };
  A["inicio.verPublica"] = () => { S.ui.fromPanel = true; S.go("reservar"); return false; };
  A["inicio.ver"] = (el) => { S.ui.day = el.dataset.d; S.ui.open = el.dataset.id; S.go("agenda"); return false; };

  A["agenda.dia"] = (el) => { S.ui.day = el.dataset.v; S.ui.open = null; };
  A["agenda.abrir"] = (el) => { S.ui.open = S.ui.open === el.dataset.v ? null : el.dataset.v; };
  A["agenda.take"] = (el) => {
    const a = S.db.appts.find((x) => x.id === el.dataset.a);
    const it = a.prendas[+el.dataset.i];
    const val = el.dataset.v === "1";
    it.seLlevo = it.seLlevo === val ? null : val;
    S.save();
  };
  A["agenda.estado"] = (el) => {
    S.db.appts.find((x) => x.id === el.dataset.a).estado = el.dataset.v;
    S.save();
  };
  A["agenda.copiar"] = (el) => {
    const a = S.db.appts.find((x) => x.id === el.dataset.a);
    U.copy(EG.msgSeguimiento(a, S.db.settings, S.prod))
      .then(() => { S.ui.copied = a.id; S.render(); })
      .catch(() => S.toast("No se pudo copiar. Seleccioná el mensaje y copialo a mano."));
    return false;
  };

  A["cat.filtro"] = (el) => { S.ui.catPanel = el.dataset.v; };
  A["cat.nueva"] = () => {
    S.ui.formErr = "";
    S.ui.editProd = { id: null, nombre: "", categoria: S.ui.catPanel, precio: "", tallesTxt: S.ui.catPanel === "Bikinis SS27" ? EG.TALLES_BIKINI.join(", ") : "", fotoNueva: "" };
  };
  A["cat.editar"] = (el) => {
    const p = S.prod(el.dataset.v);
    S.ui.formErr = "";
    S.ui.editProd = { id: p.id, nombre: p.nombre, categoria: p.categoria, precio: p.precio || "", tallesTxt: p.talles.join(", "), fotoNueva: "" };
    return "top";
  };
  A["cat.cancelar"] = () => { S.ui.editProd = null; S.ui.formErr = ""; };
  A["cat.borrar"] = () => {
    const e = S.ui.editProd;
    if (!window.confirm("¿Quitar “" + e.nombre + "” del catálogo? Las citas que ya la tenían elegida conservan su nombre.")) return false;
    S.db.products = S.db.products.filter((p) => p.id !== e.id);
    EG.store.fotoDel(e.id);
    S.ui.editProd = null;
    S.save();
    S.toast("Prenda quitada del catálogo.");
  };
  A["cat.cerrarMsg"] = () => { S.ui.fotoMsg = null; };

  EG.changes["cat.foto"] = (input) => {
    const f = input.files[0];
    if (!f) return false;
    EG.resizeImage(f, 640, 0.82)
      .then((url) => { S.ui.editProd.fotoNueva = url; S.render(); })
      .catch(() => S.toast("No se pudo leer esa imagen."));
    return false;
  };

  // Carga masiva: cada archivo se asigna a su prenda por el nombre (ver EG.matchFotos).
  EG.bulkAssign = async function (files) {
    const list = Array.from(files);
    const r = EG.matchFotos(list.map((f) => f.name), S.db.products);
    const porNombre = new Map(list.map((f) => [f.name, f]));
    const fallidas = [];
    let ok = 0;
    for (const a of r.asignadas) {
      try {
        const url = await EG.resizeImage(porNombre.get(a.archivo), 640, 0.82);
        const p = S.prod(a.productoId);
        if (EG.store.fotoSet(p.id, url)) { p.foto = "local"; ok++; }
        else fallidas.push({ archivo: a.archivo, motivo: "el navegador no tiene espacio para guardarla" });
      } catch (e) {
        fallidas.push({ archivo: a.archivo, motivo: "no se pudo leer la imagen" });
      }
    }
    S.save();
    S.ui.busy = false;
    S.ui.fotoMsg = { ok, ignoradas: r.ignoradas, fallidas };
    S.render();
    return S.ui.fotoMsg;
  };
  EG.changes["cat.masivo"] = (input) => {
    if (!input.files.length) return false;
    const files = Array.from(input.files);
    S.ui.busy = true;
    S.ui.fotoMsg = null;
    S.render();
    EG.bulkAssign(files);
    return false;
  };

  EG.submits["cat-form"] = () => {
    const e = S.ui.editProd;
    const fail = (m) => { S.ui.formErr = m; };
    const nombre = e.nombre.trim();
    if (!nombre) return fail("Escribí el nombre de la prenda.");
    const talles = Array.from(new Set(String(e.tallesTxt).split(",").map((x) => x.trim()).filter(Boolean)));
    const datos = { nombre, categoria: e.categoria, precio: Math.max(0, Math.round(Number(e.precio) || 0)), talles: talles.length ? talles : ["Único"] };
    let p;
    if (e.id) { p = S.prod(e.id); Object.assign(p, datos); }
    else {
      p = Object.assign({ id: "p-" + EG.slug(nombre) + "-" + EG.uid(4), modelo: "", color: "", foto: "", fotoNum: 1 }, datos);
      S.db.products.push(p);
    }
    if (e.fotoNueva) {
      if (EG.store.fotoSet(p.id, e.fotoNueva)) p.foto = "local";
      else S.toast("La prenda se guardó, pero la foto no entró: el navegador se quedó sin espacio.");
    }
    S.ui.catPanel = p.categoria;
    S.ui.editProd = null;
    S.ui.formErr = "";
    S.save();
    S.toast("Prenda guardada.");
  };

  A["aj.dia"] = (el) => {
    const d = S.ui.settingsDraft, n = +el.dataset.v;
    d.dias = d.dias.indexOf(n) >= 0 ? d.dias.filter((x) => x !== n) : d.dias.concat(n);
  };
  A["aj.ejemplo"] = () => {
    const fecha = EG.nextDays(S.db.settings, 1)[0];
    if (!fecha) { S.toast("Configurá al menos un día de atención."); return false; }
    let n = 0;
    EG.sampleAppts(S.db.products, fecha).forEach((a) => {
      // now en el año 2000: así no se descartan horarios de hoy que ya pasaron
      if (EG.slotsFor(S.db.settings, S.db.appts, fecha, new Date(2000, 0, 1)).some((s) => s.h === a.hora && !s.off)) { S.db.appts.push(a); n++; }
    });
    S.save();
    S.ui.day = fecha;
    S.toast(n ? "Se cargaron " + n + " citas de ejemplo (mirá la pestaña Agenda)." : "Esos horarios ya están ocupados.");
  };
  A["aj.reset"] = () => {
    if (!window.confirm("Se borran las citas, los cambios del catálogo y los ajustes de este navegador, y vuelve todo a los datos iniciales. ¿Seguimos?")) return false;
    EG.store.clearAll();
    S.db = EG.seed();
    S.save();
    Object.assign(S.ui, { settingsDraft: null, editProd: null, open: null, day: null, fotoMsg: null, settingsErr: "" });
    S.toast("Listo: volvió todo a los datos iniciales.");
  };

  EG.submits["aj-form"] = () => {
    const d = S.ui.settingsDraft;
    const fail = (m) => { S.ui.settingsErr = m; };
    if (!d.nombre.trim()) return fail("Escribí el nombre del showroom.");
    if (!d.dias.length) return fail("Elegí al menos un día de atención.");
    const franjas = [];
    for (const par of [[d.f1d, d.f1h], [d.f2d, d.f2h]]) {
      if (!par[0] && !par[1]) continue;
      if (!par[0] || !par[1] || EG.toMin(par[1]) <= EG.toMin(par[0])) return fail("Revisá las franjas: la hora de fin tiene que ser posterior a la de inicio.");
      franjas.push(par);
    }
    if (!franjas.length) return fail("Cargá al menos una franja horaria.");
    const duracion = Math.round(Number(d.duracion));
    if (!(duracion >= 10)) return fail("La duración de la cita tiene que ser de al menos 10 minutos.");
    Object.assign(S.db.settings, {
      nombre: d.nombre.trim(), direccion: d.direccion.trim(), info: d.info.trim(), dias: d.dias.slice().sort(), franjas, duracion,
      compraMinima: Math.max(0, Math.round(Number(d.compraMinima) || 0)), compraMinimaNota: d.compraMinimaNota.trim()
    });
    S.save();
    S.ui.settingsErr = "";
    S.ui.settingsDraft = null;
    S.toast("Cambios guardados.");
  };
})();
