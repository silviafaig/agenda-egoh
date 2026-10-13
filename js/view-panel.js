// Panel del showroom: estructura (menú lateral / barra inferior), Inicio, Agenda, detalle de cita,
// y las ventanas de Nueva reserva, Bloquear horario, QR y Nueva clienta.
(function () {
  "use strict";
  const EG = window.EG;
  const S = EG.S;
  const U = EG.ui;
  const { esc, money, fechaLarga, DIAS, MESES, icon: I } = EG;
  const P = (EG.panel = {}); // piezas compartidas con las otras vistas del panel

  const hoyYmd = () => EG.ymd(new Date());
  const addDays = (ymd, n) => { const d = EG.parseYmd(ymd); d.setDate(d.getDate() + n); return EG.ymd(d); };
  const activas = (list) => list.filter((a) => a.estado !== "cancelada");
  const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  P.addDays = addDays;
  P.cap = cap;

  /* ---------- menú ---------- */
  const MENU = [
    ["General", [["inicio", "house", "Inicio"], ["agenda", "calendar-days", "Agenda"], ["clientas", "users", "Clientas"], ["metricas", "chart-column", "Métricas"], ["catalogo", "shirt", "Catálogo"]]],
    ["Mi negocio", [["perfil", "store", "Perfil público"], ["horarios", "clock", "Horarios y disponibilidad"], ["reglas", "scroll-text", "Reglas de compra"], ["compartir", "share-2", "Compartir"], ["integraciones", "plug", "Integraciones"]]],
    ["Cuenta", [["configuracion", "settings", "Configuración"], ["ayuda", "circle-help", "Ayuda"]]]
  ];
  const BOTTOM = [["inicio", "house", "Inicio"], ["agenda", "calendar-days", "Agenda"], ["clientas", "users", "Clientas"], ["mas", "ellipsis", "Más"]];

  function menuHtml(skip) {
    const r = S.ui.route;
    return `<nav class="menu" aria-label="Menú">${MENU.map((g) => {
      const items = g[1].filter((it) => !skip || skip.indexOf(it[0]) < 0);
      return items.length ? `<div class="grp">${g[0]}</div>${items.map((it) =>
        `<button type="button" data-act="nav" data-v="${it[0]}" ${r === it[0] ? 'aria-current="page"' : ""}>${I(it[1], 18)}<span>${it[2]}</span>${it[0] === "integraciones" ? '<span class="soon">Pronto</span>' : ""}</button>`).join("")}` : "";
    }).join("")}
      <button type="button" class="out" data-act="logout">${I("log-out", 18)}<span>Cerrar sesión</span></button></nav>`;
  }

  function chrome(body) {
    const s = S.db.settings, r = S.ui.route;
    const enBottom = BOTTOM.some((b) => b[0] === r);
    return `<aside class="side"><div class="sidebrand">${U.logo(s, "", "nav")}<span class="xs muted">Panel showroom</span></div>${menuHtml()}</aside>
      <header class="ptop">${U.logo(s, "", "nav")}<button type="button" class="iconbtn" data-act="verPublica" aria-label="Ver como clienta">${I("external-link", 17)}</button></header>
      <main class="pmain">${EG.store.persistent ? "" : `<p class="notice bad" style="margin-bottom:14px">Este navegador no permite guardar datos: lo que cargues se pierde al cerrar la página.</p>`}${body}</main>
      <nav class="bnav" aria-label="Secciones">${BOTTOM.map((b) => `<button type="button" data-act="nav" data-v="${b[0]}" ${r === b[0] || (b[0] === "mas" && !enBottom) ? 'aria-current="page"' : ""}>${I(b[1], 22)}<span>${b[2]}</span></button>`).join("")}</nav>
      ${S.ui.modal ? modal() : ""}`;
  }

  // Etiqueta chica arriba del título, como en Figma.
  const EYEBROW = { inicio: "Inicio", agenda: "Agenda", clientas: "Clientas", metricas: "Métricas", catalogo: "Catálogo",
    perfil: "Mi negocio", horarios: "Mi negocio", reglas: "Mi negocio", compartir: "Mi negocio", integraciones: "Mi negocio",
    configuracion: "Cuenta", ayuda: "Cuenta", mas: "Menú" };
  P.title = (titulo, sub, acciones) =>
    `<div class="ptitle"><div><span class="label">${EYEBROW[S.ui.route] || ""}</span><h1>${titulo}</h1>${sub ? `<p class="sub">${sub}</p>` : ""}</div>${acciones ? `<div class="row">${acciones}</div>` : ""}</div>`;

  /* ---------- recordatorios: citas del próximo día de atención ---------- */
  P.porRecordar = () => {
    const s = S.db.settings, hoy = hoyYmd();
    const prox = EG.nextDays(s, 2).find((d) => d > hoy);
    if (!prox) return { fecha: null, citas: [], etiqueta: "" };
    const etiqueta = prox === addDays(hoy, 1) ? "mañana" : "el " + fechaLarga(prox);
    const citas = S.db.appts.filter((a) => a.fecha === prox && a.estado === "confirmada").sort((x, y) => x.hora.localeCompare(y.hora));
    const de = prox === addDays(hoy, 1) ? "de mañana" : "del " + fechaLarga(prox);
    return { fecha: prox, etiqueta, de, citas: citas.filter((a) => !a.recordatorio), todas: citas };
  };

  /* ---------- tarjeta de cita ---------- */
  P.apptCard = (a, opts) => {
    const o = opts || {};
    const x = EG.parseYmd(a.fecha);
    const n = a.prendas.length;
    return `<button type="button" class="acard" data-act="ag.open" data-v="${esc(a.id)}" data-s="${esc(a.nombre + " " + a.whatsapp)}" ${S.ui.open === a.id ? 'aria-current="true"' : ""}>
      <span class="acard-top"><span class="acard-time"><b class="num">${esc(a.hora)}</b><span class="xs muted">${o.fecha && a.fecha !== hoyYmd() ? DIAS[x.getDay()] + " " + x.getDate() : esc(S.db.settings.duracion) + " min"}</span></span>
        <span class="grow"><span class="rname">${esc(a.nombre)}</span><span class="rsub">${a.tipo === "video" ? I("video", 13) : I("map-pin", 13)}<span>${U.tipoTxt(a, true)}${a.comoCompra ? " · " + esc(a.comoCompra) : ""}</span></span></span>
        ${o.estado === false ? "" : U.estadoChip(a)}${I("chevron-right", 16)}</span>
      ${n ? `<span class="acard-prendas">${U.thumbs(a.prendas, 4)}<span class="xs muted">${U.plural(n, "prenda")}</span></span>` : ""}</button>`;
  };

  /* ---------- filas de cita ---------- */
  P.apptRow = (a, opts) => {
    const o = opts || {};
    return `<button type="button" class="rowitem" data-act="ag.open" data-v="${esc(a.id)}" data-s="${esc(a.nombre + " " + a.whatsapp)}" ${S.ui.open === a.id ? 'aria-current="true"' : ""}>
      <span class="time num">${o.fecha ? `<span class="xs muted" style="display:block;font-weight:400">${DIAS[EG.parseYmd(a.fecha).getDay()]} ${EG.parseYmd(a.fecha).getDate()}</span>` : ""}${esc(a.hora)}</span>
      ${U.avatar(a.nombre)}<span class="grow"><span class="rname">${esc(a.nombre)}</span>
      <span class="rsub">${a.tipo === "video" ? I("video", 13) : I("map-pin", 13)}<span>${U.tipoTxt(a, true)}${a.comoCompra ? " · " + esc(a.comoCompra) : ""}</span></span></span>
      ${a.prendas.length ? U.thumbs(a.prendas, 3) : ""}${U.estadoChip(a)}</button>`;
  };

  /* ---------- Inicio ---------- */
  function inicio() {
    const s = S.db.settings;
    const hoy = hoyYmd();
    const d = new Date();
    const ahora = EG.toH(d.getHours() * 60 + d.getMinutes());
    const quien = EG.remote.on ? EG.remote.nombre : s.saludoNombre;
    const saludo = "Hola" + (quien ? ", " + esc(quien) : "");
    const MESES_L = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    const fechaHoy = cap(fechaLarga(hoy).split(" ")[0]) + " " + d.getDate() + " de " + MESES_L[d.getMonth()] + " de " + d.getFullYear();
    const deHoy = activas(S.db.appts.filter((a) => a.fecha === hoy));
    const futuras = S.db.appts
      .filter((a) => a.estado === "confirmada" && (a.fecha > hoy || (a.fecha === hoy && a.hora >= ahora)))
      .sort((x, y) => (x.fecha + x.hora).localeCompare(y.fecha + y.hora));
    const sinMarcar = S.db.appts.filter((a) => a.estado === "confirmada" && a.fecha < hoy);
    const sinPrecio = !S.db.products.some((p) => p.precio > 0);
    const avisos = [];
    const rec = P.porRecordar();
    if (S.db.settings.aceptaReservas === false) avisos.push([I("ban", 17), "Las reservas están pausadas: las clientas no pueden reservar desde tu link.", "nav", "Abrir", "horarios"]);
    if (rec.citas.length) avisos.push([I("message-circle", 17), `${U.plural(rec.citas.length, "cita")} ${rec.citas.length === 1 ? "es" : "son"} ${rec.etiqueta}: mandá ${rec.citas.length === 1 ? "el recordatorio" : "los recordatorios"} por WhatsApp.`, "mod.open", "Enviar", "recordatorios"]);
    if (sinMarcar.length) avisos.push([I("circle-alert", 17), `${U.plural(sinMarcar.length, "cita")} de días anteriores sin marcar asistencia.`, "aviso.sinMarcar", "Revisar"]);
    const vidHoy = deHoy.filter((a) => a.tipo === "video" && a.estado === "confirmada").length;
    if (vidHoy) avisos.push([I("video", 17), `Hoy tenés ${U.plural(vidHoy, "videollamada")}.`, "nav", "Ver", "agenda"]);
    if (sinPrecio) avisos.push([I("info", 17), "Las prendas todavía no tienen precio: los montos de Métricas se activan al cargarlos.", "nav", "Catálogo", "catalogo"]);
    const avisosHtml = (cls) => `<div class="card stack ${cls}"><h3>Avisos</h3>${avisos.length
      ? avisos.map((x) => `<div class="row nowrap" style="align-items:flex-start">${x[0]}<span class="grow small">${x[1]}</span><button type="button" class="btn xs" data-act="${x[2]}" data-v="${x[4] || ""}">${x[3]}</button></div>`).join("")
      : `<p class="small muted">Todo al día.</p>`}</div>`;
    const link = S.publicLink();
    const compartir = `<div class="card stack"><h3>Compartí tu agenda</h3><p class="small muted">Las clientas reservan desde este link.</p>
      <div class="row nowrap" style="background:var(--bg);border-radius:999px;padding:6px 6px 6px 14px">${I("link", 15)}<span class="grow ellipsis small" title="${esc(link)}">${esc(link)}</span>
        <button type="button" class="btn xs dark" data-act="copiarLink">Copiar</button></div>
      <div class="row"><button type="button" class="btn sm" data-act="mod.open" data-v="qr">${I("qr-code", 15)}Ver QR</button><button type="button" class="btn sm" data-act="verPublica">${I("external-link", 15)}Ver como clienta</button></div></div>`;
    const prox = futuras.slice(0, 6);
    const pres = prox.filter((a) => a.tipo !== "video").length;
    return `${P.title(saludo, fechaHoy, `<button type="button" class="btn sm" data-act="nav" data-v="agenda">${I("calendar-days", 15)}Ver agenda</button>`)}
      <div class="stack lg">
        <div class="stats"><div class="stat bordered"><b class="num">${deHoy.length}</b><span class="small muted">Citas de hoy</span></div>
          <div class="stat bordered"><b class="num">${deHoy.filter((a) => a.tipo === "video").length}</b><span class="small muted">Videollamadas</span></div>
          <div class="stat bordered"><b class="num">${deHoy.reduce((n, a) => n + a.prendas.length, 0)}</b><span class="small muted">Prendas a preparar</span></div></div>
        ${avisosHtml("only-mob")}
        <div class="cols"><div class="stack">
          <div class="row between"><h2>Próximas citas</h2><span class="small muted">${prox.length && prox[0].fecha === hoy ? "Hoy" : ""}</span></div>
          ${prox.length ? `<div class="alist">${prox.map((a) => P.apptCard(a, { fecha: true, estado: false })).join("")}</div>
            <p class="xs muted">${U.plural(prox.length, "cita")} · ${U.plural(pres, "presencial", "presenciales")} · ${U.plural(prox.length - pres, "videollamada")}</p>` : `<p class="empty">No hay citas próximas. Cuando una clienta reserve, aparece acá con las prendas que eligió.</p>`}
          ${!S.db.appts.length && !EG.remote.on ? `<div class="card stack sm"><h3>¿Querés ver el panel con datos?</h3><p class="small muted">Cargá citas y clientas de ejemplo para probar Agenda, Clientas y Métricas. Las podés borrar después desde Configuración.</p>
            <button type="button" class="btn sm dark" style="align-self:flex-start" data-act="conf.ejemplo">Cargar datos de ejemplo</button></div>` : ""}
          ${EG.remote.on ? "" : `<p class="notice soft">Versión de prueba: las reservas se guardan solo en este navegador.</p>`}
        </div><div class="stack">${compartir}${avisosHtml("only-desk")}</div></div></div>`;
  }

  /* ---------- Agenda ---------- */
  function rango() {
    const hoy = hoyYmd();
    let desde = S.ui.agDesde || hoy, hasta = S.ui.agHasta || addDays(hoy, 13);
    const ab = S.ui.open && S.db.appts.find((a) => a.id === S.ui.open);
    if (ab && ab.fecha < desde) desde = ab.fecha;
    if (ab && ab.fecha > hasta) hasta = ab.fecha;
    if (hasta < desde) hasta = desde;
    return [desde, hasta];
  }

  function lista(desde, hasta) {
    const citas = S.db.appts.filter((a) => a.fecha >= desde && a.fecha <= hasta);
    const bloqs = S.db.bloqueos.filter((b) => b.fecha >= desde && b.fecha <= hasta);
    const fechas = Array.from(new Set(citas.map((a) => a.fecha).concat(bloqs.map((b) => b.fecha)))).sort();
    if (!fechas.length) return `<p class="empty">No hay citas entre esas fechas.</p>`;
    const total = activas(citas).length;
    return `<div class="stack" data-fscope><div class="row between"><h2>Citas por día</h2><span class="small muted">${U.plural(total, "cita")}</span></div>
      <p class="empty" data-fempty hidden>No hay citas con ese nombre o teléfono.</p>${fechas.map((f) => {
      const del = citas.filter((a) => a.fecha === f).sort((x, y) => x.hora.localeCompare(y.hora));
      const bl = bloqs.filter((b) => b.fecha === f);
      return `<div class="alist"><div class="aday"><span>${esc(cap(fechaLarga(f)))}${f === hoyYmd() ? " · hoy" : ""}</span><span>${U.plural(activas(del).length, "cita")}</span></div>
        ${bl.map((b) => `<div class="blockrow">${I("ban", 15)}<span class="grow">${b.desde ? esc(b.desde) + " a " + esc(b.hasta) : "Día completo"} · Bloqueado${b.motivo ? " · " + esc(b.motivo) : ""}</span>
          <button type="button" class="iconbtn sm" data-act="ag.desbloquear" data-v="${esc(b.id)}" aria-label="Quitar bloqueo">${I("x", 14)}</button></div>`).join("")}
        ${del.map((a) => P.apptCard(a)).join("")}</div>`;
    }).join("")}</div>`;
  }

  function semana() {
    const s = S.db.settings;
    const base = new Date(); base.setHours(0, 0, 0, 0);
    const finde = base.getDay() === 0 || base.getDay() === 6 ? 7 : 0; // sábado o domingo: arranca en la semana que viene
    base.setDate(base.getDate() - ((base.getDay() + 6) % 7) + finde + S.ui.week * 7); // lunes
    const dias = [0, 1, 2, 3, 4].map((i) => addDays(EG.ymd(base), i));
    const horas = new Set();
    dias.forEach((f) => EG.franjasDe(s, f).forEach((fr) => { for (let m = EG.toMin(fr[0]); m + s.duracion <= EG.toMin(fr[1]); m += s.duracion) horas.add(EG.toH(m)); }));
    const filas = Array.from(horas).sort();
    const ahora = new Date();
    const celda = (f, h) => {
      const a = S.db.appts.find((x) => x.fecha === f && x.hora === h && x.estado !== "cancelada");
      if (a) return `<button type="button" class="cell appt${a.estado !== "confirmada" ? " done" : ""}" data-act="ag.open" data-v="${esc(a.id)}">${esc(a.nombre.split(" ")[0])}${a.tipo === "video" ? " · video" : ""}</button>`;
      if (!EG.diaAbierto(s, f)) return `<span class="cell closed"></span>`;
      const sl = EG.slotsFor(s, S.db.appts, f, ahora, S.db.bloqueos).find((x) => x.h === h);
      if (!sl) return `<span class="cell closed"></span>`;
      if (sl.bloqueado) return `<span class="cell blk">Bloqueado</span>`;
      if (sl.off) return `<span class="cell closed"></span>`;
      return `<button type="button" class="cell free" data-act="ag.slot" data-f="${f}" data-h="${h}" aria-label="Reservar ${esc(fechaLarga(f))} ${h}">+ Reservar</button>`;
    };
    const d0 = EG.parseYmd(dias[0]), d4 = EG.parseYmd(dias[4]);
    return `<div class="row between" style="margin-bottom:10px"><div class="row"><button type="button" class="iconbtn sm" data-act="ag.week" data-v="-1" aria-label="Semana anterior">${I("chevron-left", 15)}</button>
        <b class="small">${d0.getDate()} ${MESES[d0.getMonth()]} – ${d4.getDate()} ${MESES[d4.getMonth()]}</b>
        <button type="button" class="iconbtn sm" data-act="ag.week" data-v="1" aria-label="Semana siguiente">${I("chevron-right", 15)}</button></div>
        ${S.ui.week ? `<button type="button" class="linkbtn" data-act="ag.week" data-v="0">Esta semana</button>` : ""}</div>
      <div class="week" data-keepscroll="week"><table><thead><tr><th></th>${dias.map((f) => { const x = EG.parseYmd(f); return `<th>${DIAS[x.getDay()]} ${x.getDate()}${f === hoyYmd() ? " · hoy" : ""}</th>`; }).join("")}</tr></thead>
      <tbody>${filas.length ? filas.map((h) => `<tr><td class="num">${h}</td>${dias.map((f) => `<td>${celda(f, h)}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="6" class="muted">Sin horarios configurados.</td></tr>`}</tbody></table></div>`;
  }

  function agenda() {
    const [desde, hasta] = rango();
    const abierta = S.ui.open && S.db.appts.find((a) => a.id === S.ui.open);
    if (abierta) return detalle(abierta);
    const vista = S.ui.agendaVista;
    const tools = `<div class="toolbar"><div class="seg" role="group" aria-label="Vista">
        <button type="button" data-act="ag.vista" data-v="lista" aria-pressed="${vista === "lista"}">${I("list", 14)} Lista</button>
        <button type="button" data-act="ag.vista" data-v="calendario" aria-pressed="${vista === "calendario"}">${I("calendar-range", 14)} Calendario</button></div>
      ${vista === "lista" ? `<div class="daterange"><input class="t num" type="date" value="${desde}" data-change="ag.desde" aria-label="Desde"><span class="muted">a</span><input class="t num" type="date" value="${hasta}" data-change="ag.hasta" aria-label="Hasta"></div>
        <label class="searchbox">${I("search", 16)}<span class="sr-only">Buscar</span><input class="t" type="search" placeholder="Buscar por nombre o teléfono" value="${esc(S.ui.agQ)}" data-bind="agQ" data-filter=".alist .acard"></label>` : ""}
      <button type="button" class="btn sm light" data-act="ag.export">${I("download", 15)}Exportar</button>
      <label class="btn sm light" style="cursor:pointer">${I("plus", 15)}Importar<input class="sr-only" type="file" accept=".xlsx,.csv" data-change="imp.archivo"></label></div>`;
    return `${P.title("Agenda", "Organizá tus citas y prepará cada visita.", `<button type="button" class="btn sm dark" data-act="mod.open" data-v="reserva">${I("plus", 15)}Nueva reserva</button>
        <button type="button" class="btn sm" data-act="mod.open" data-v="bloqueo">${I("ban", 15)}Bloquear horario</button>`)}
      ${tools}${vista === "lista" ? lista(desde, hasta) : semana()}`;
  }

  /* ---------- Detalle de cita (pantalla completa, como en Figma) ---------- */
  const MESES_L = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  function fechaCompleta(ymd) {
    const d = EG.parseYmd(ymd);
    return cap(fechaLarga(ymd).split(" ")[0]) + " " + d.getDate() + " de " + MESES_L[d.getMonth()] + " de " + d.getFullYear();
  }
  function detalle(a) {
    const s = S.db.settings;
    const msgRec = EG.msgRecordatorio(a, s, S.prod, S.citaLink(a));
    const msgSeg = EG.msgSeguimiento(a, s, S.prod);
    const c = a.clientaId && S.db.clientas.find((x) => x.id === a.clientaId);
    const visitas = c ? EG.clientaStats(S.db, c).visitas : 0;
    const fin = EG.toH(EG.toMin(a.hora) + s.duracion);
    const campo = (label, val) => (val ? `<div class="stack sm" style="gap:2px"><span class="xs muted">${label}</span><span class="small">${val}</span></div>` : "");
    const prendas = a.prendas.length
      ? a.prendas.map((i, ix) => {
          const p = S.prod(i.id);
          const estado = i.seLlevo === true ? "Se llevó" : i.seLlevo === false ? "No se la llevó" : "Sin registrar";
          return `<div class="dprenda"><span class="dph">${U.photo(p)}</span><div class="stack sm"><h3>${esc(EG.itemName(i, S.prod))}</h3>
            <span class="small muted">Talle ${esc(i.talle)}${EG.priceTxt(p) ? ` · <span class="num">${EG.priceTxt(p)}</span>` : ""}</span>
            <div class="pills"><button type="button" class="pill" data-act="ag.take" data-a="${esc(a.id)}" data-i="${ix}" data-v="1" aria-pressed="${i.seLlevo === true}">Se llevó</button>
            <button type="button" class="pill" data-act="ag.take" data-a="${esc(a.id)}" data-i="${ix}" data-v="0" aria-pressed="${i.seLlevo === false}">No</button></div>
            <span class="xs muted">${estado}</span></div></div>`;
        }).join("")
      : `<p class="empty">No eligió prendas antes de la cita.</p>`;
    return `<button type="button" class="back" data-act="ag.close">${I("arrow-left", 16)}Volver a Agenda</button>
      <div class="ptitle"><div><span class="label">Agenda / Detalle de cita</span><h1>Detalle de cita</h1>
        <p class="sub">${esc(fechaCompleta(a.fecha))} · ${esc(a.hora)} – ${esc(fin)}</p>
        <div class="row" style="margin-top:6px"><span class="small row" style="gap:5px">${a.tipo === "video" ? I("video", 15) : I("map-pin", 15)}${U.tipoTxt(a, true)}</span>${U.estadoChip(a)}${a.origen === "manual" ? '<span class="chip">Cargada a mano</span>' : ""}</div></div></div>
      ${S.ui.avisar === a.id ? `<div class="notice soft stack sm" style="color:var(--ink);margin-bottom:16px"><b>Reserva guardada.</b><span class="small">Mandale la confirmación a ${esc(a.nombre.split(" ")[0])}:</span>
        <a class="btn sm dark" style="align-self:flex-start" href="${esc(EG.waLink(a.whatsapp, EG.msgConfirmacion(a, s, S.prod, S.citaLink(a))))}" target="_blank" rel="noopener" data-act="ag.avisado">${I("message-circle", 15)}Enviar confirmación por WhatsApp</a></div>` : ""}
      <div class="cols"><div class="stack lg">
        <section class="card bordered stack"><div class="row nowrap">${U.avatar(a.nombre)}<div class="grow"><h3>${esc(a.nombre)}</h3><span class="xs muted">${visitas ? U.plural(visitas, "visita") + " anterior" + (visitas === 1 ? "" : "es") : "Primera visita"}</span></div>
            ${c ? `<button type="button" class="linkbtn" data-act="cl.ver" data-v="${esc(c.id)}">Ver ficha</button>` : ""}</div>
          <div class="dgrid">${campo("WhatsApp", `<span class="num">+${esc(a.whatsapp)}</span>`)}${campo("Email", a.email ? `<a href="mailto:${esc(a.email)}">${esc(a.email)}</a>` : "")}
            ${campo("¿Cómo comprás?", esc(a.comoCompra))}${campo("Zona", esc(a.zona))}${campo("Lo que busca", esc(a.queBusca))}</div></section>
        <section class="stack"><div class="row between"><h2>Prendas elegidas</h2><span class="small muted">${U.plural(a.prendas.length, "prenda")}</span></div>${prendas}
          ${a.prendas.length ? `<p class="xs muted">Marcá qué se llevó al finalizar la cita.</p>` : ""}</section>
        ${a.estado === "asistio"
          ? `<section class="card bordered stack"><h3>Seguimiento</h3><div class="mail">${esc(msgSeg)}</div>
              <div class="row"><a class="btn sm dark" href="${esc(EG.waLink(a.whatsapp, msgSeg))}" target="_blank" rel="noopener">${I("message-circle", 15)}Enviar por WhatsApp</a>
              <button type="button" class="btn sm" data-act="ag.copiarSeg" data-a="${esc(a.id)}">${I("copy", 15)}Copiar</button></div></section>`
          : ""}
      </div><div class="stack lg">
        <section class="card bordered stack"><h3>Estado</h3>
          <select class="t" aria-label="Estado de la cita" data-change="ag.estadoSel" data-a="${esc(a.id)}">${U.ESTADOS.map((e) => `<option value="${e[0]}"${a.estado === e[0] ? " selected" : ""}>${e[1]}</option>`).join("")}</select>
          <p class="xs muted">La asistencia se registra después de la visita.</p></section>
        <section class="stack"><label class="f" for="n-${esc(a.id)}"><h3>Notas de la visita</h3><textarea class="t" id="n-${esc(a.id)}" data-note="${esc(a.id)}" placeholder="Escribí cómo fue la visita, qué le gustó y qué quedó pendiente…">${esc(a.notas)}</textarea></label>
          <button type="button" class="btn sm" style="align-self:flex-end" data-act="ag.notas">Guardar notas</button></section>
        <section class="card bordered stack"><h3>${a.tipo === "video" ? "Videollamada" : "Visita al showroom"}</h3>
          <p class="small muted">${esc(cap(fechaLarga(a.fecha)))} · ${esc(a.hora)} – ${esc(fin)}</p>
          ${a.tipo === "video" ? `<a class="btn dark block" href="${esc("https://wa.me/" + a.whatsapp)}" target="_blank" rel="noopener">${I("video", 15)}Videollamada por WhatsApp</a>
            <p class="xs muted">Abre el chat con ${esc(a.nombre.split(" ")[0])}: tocá el ícono de la cámara para llamarla.</p>` : ""}
          ${a.estado === "confirmada" ? `<a class="btn block" href="${esc(EG.waLink(a.whatsapp, msgRec))}" target="_blank" rel="noopener" data-act="rec.enviado" data-v="${esc(a.id)}">${I("message-circle", 15)}${a.recordatorio ? "Reenviar recordatorio" : "Recordatorio por WhatsApp"}</a>
            <p class="xs muted">El recordatorio incluye el horario y el link para reprogramar o cancelar.</p>` : ""}</section>
        <section class="stack sm"><button type="button" class="btn sm danger" style="align-self:flex-start" data-act="ag.eliminar" data-a="${esc(a.id)}">${I("trash-2", 14)}${S.ui.confirmar === "cita-" + a.id ? "Sí, eliminar definitivamente" : "Eliminar cita"}</button>
          <p class="xs muted">${S.ui.confirmar === "cita-" + a.id ? "Tocá de nuevo para confirmar. Se borra del todo y el horario queda libre. Si la clienta avisó que no viene, mejor usá Estado → Cancelada." : "Para reservas de prueba o cargadas por error."}</p></section>
      </div></div>`;
  }

  /* ---------- ventanas ---------- */
  const mf = (id, label, key, type, extra) =>
    `<label class="f" for="${id}"><span>${label}</span><input class="t" id="${id}" type="${type || "text"}" value="${esc(S.ui.modal[key])}" data-bind="modal.${key}" ${extra || ""}></label>`;
  const mhead = (titulo) => `<div class="grab"></div><div class="mhead"><h2>${titulo}</h2><button type="button" class="iconbtn sm" data-act="mod.close" aria-label="Cerrar">${I("x", 15)}</button></div>`;
  const comoSelect = (key, val) => `<label class="f" for="m-${key}">¿Cómo compra?<select class="t" id="m-${key}" data-bind="modal.${key}"><option value="">Sin dato</option>${S.db.settings.opcionesComoCompra.map((k) => `<option${val === k ? " selected" : ""}>${esc(k)}</option>`).join("")}</select></label>`;

  function modalReserva(m) {
    const s = S.db.settings;
    const sl = m.fecha ? EG.slotsFor(s, S.db.appts, m.fecha, new Date(), S.db.bloqueos) : [];
    const cli = m.clientaId && S.db.clientas.find((c) => c.id === m.clientaId);
    const clientas = S.db.clientas.slice().sort((a, b) => a.nombre.localeCompare(b.nombre));
    return `<form class="modal" id="mod-reserva" novalidate role="dialog" aria-modal="true" aria-label="Nueva reserva">${mhead("Nueva reserva")}
      <div class="stack sm"><span class="label">Tipo de cita</span><div class="seg"><button type="button" data-act="mod.set" data-k="tipo" data-v="presencial" aria-pressed="${m.tipo === "presencial"}">Presencial</button><button type="button" data-act="mod.set" data-k="tipo" data-v="video" aria-pressed="${m.tipo === "video"}">Videollamada</button></div></div>
      <label class="f" for="m-fecha">Día<input class="t num" id="m-fecha" type="date" value="${esc(m.fecha)}" data-bind="modal.fecha" data-change="mod.fecha"></label>
      <label class="check"><input type="checkbox" data-bind="modal.libre" data-change="mod.libre" ${m.libre ? "checked" : ""}>Horario libre (cualquier día y hora, aunque ya haya pasado o esté ocupado)</label>
      ${m.libre ? `<label class="f" for="m-hora" style="max-width:180px">Hora<input class="t num" id="m-hora" type="time" step="300" value="${esc(m.hora || "")}" data-bind="modal.hora"></label>`
      : m.fecha ? (sl.length ? `<div class="stack sm"><span class="label">Horario</span><div class="slots">${sl.map((x) => `<button type="button" class="slot num" data-act="mod.set" data-k="hora" data-v="${x.h}" ${x.off ? "disabled" : ""} aria-pressed="${m.hora === x.h}">${x.h}</button>`).join("")}</div></div>` : `<p class="small muted">Ese día no hay atención.</p>`) : ""}
      <div class="stack sm"><span class="label">Clienta</span>
        ${cli ? `<div class="row nowrap card" style="padding:10px 12px">${U.avatar(cli.nombre)}<span class="grow"><span class="rname">${esc(cli.nombre)}</span><span class="rsub num">+${esc(cli.whatsapp)}</span></span><button type="button" class="linkbtn" data-act="mod.set" data-k="clientaId" data-v="">Cambiar</button></div>`
        : `<div class="seg"><button type="button" data-act="mod.set" data-k="modoCli" data-v="buscar" aria-pressed="${m.modoCli === "buscar"}">Buscar clienta</button><button type="button" data-act="mod.set" data-k="modoCli" data-v="nueva" aria-pressed="${m.modoCli === "nueva"}">Nueva clienta</button></div>
          ${m.modoCli === "buscar"
            ? `<div class="stack sm" data-fscope><label class="searchbox">${I("search", 16)}<span class="sr-only">Buscar clienta</span><input class="t" type="search" placeholder="Nombre o teléfono" value="${esc(m.cq)}" data-bind="modal.cq" data-filter=".pickbox .rowitem"></label>
                ${clientas.length ? `<div class="pickbox" data-keepscroll="pickcli">${clientas.map((c) => `<button type="button" class="rowitem" data-act="mod.set" data-k="clientaId" data-v="${esc(c.id)}" data-s="${esc(c.nombre + " " + c.whatsapp + " " + c.email)}">${U.avatar(c.nombre)}<span class="grow"><span class="rname">${esc(c.nombre)}</span><span class="rsub num">+${esc(c.whatsapp)}</span></span></button>`).join("")}</div><p class="small muted" data-fempty hidden>No hay clientas con ese dato. Cargala como nueva.</p>` : `<p class="small muted">Todavía no hay clientas. Cargala como nueva.</p>`}</div>`
            : `<div class="fgrid two">${mf("m-nombre", "Nombre y apellido", "nombre")}${mf("m-wa", "WhatsApp", "whatsapp", "tel", 'inputmode="tel" placeholder="11 5555 0101"')}${mf("m-email", "Email", "email", "email")}${mf("m-zona", "Zona", "zona", "text", 'placeholder="Ej: Lanús"')}<div class="full">${comoSelect("comoCompra", m.comoCompra)}</div></div>`}`}</div>
      <div class="stack sm" data-fscope><span class="label">Prendas <span style="text-transform:none;letter-spacing:0">(opcional)${m.prendas.length ? " · " + U.plural(m.prendas.length, "elegida") : ""}</span></span>
        <label class="searchbox">${I("search", 16)}<span class="sr-only">Buscar prenda</span><input class="t" type="search" placeholder="Buscar prenda" value="${esc(m.pq)}" data-bind="modal.pq" data-filter=".pickbox .rowitem"></label>
        <div class="pickbox" data-keepscroll="pickprod">${S.db.products.map((p) => { const sel = m.prendas.find((i) => i.id === p.id); return `<div class="rowitem" data-s="${esc(p.nombre)}">${U.thumbs([{ id: p.id }], 1)}<span class="grow small">${esc(p.nombre)}</span>
          <div class="sizes">${p.talles.map((z) => `<button type="button" class="size" data-act="mod.size" data-p="${esc(p.id)}" data-v="${esc(z)}" aria-pressed="${!!sel && sel.talle === z}" aria-label="${esc(p.nombre)} talle ${esc(z)}">${esc(z)}</button>`).join("")}</div></div>`; }).join("")}</div></div>
      <label class="f" for="m-notas">Notas<textarea class="t" id="m-notas" data-bind="modal.notas" placeholder="Opcional">${esc(m.notas)}</textarea></label>
      <label class="check"><input type="checkbox" data-bind="modal.avisar" ${m.avisar ? "checked" : ""}>Avisarle por WhatsApp al guardar</label>
      ${m.err ? `<p class="err" role="alert">${esc(m.err)}</p>` : ""}
      <div class="row" style="justify-content:flex-end"><button type="button" class="btn" data-act="mod.close">Cancelar</button><button type="submit" class="btn dark">Guardar reserva</button></div></form>`;
  }

  function modalBloqueo(m) {
    const choque = m.fecha ? activas(S.db.appts.filter((a) => a.fecha === m.fecha && (m.modo === "dia" || (m.desde && m.hasta && EG.toMin(a.hora) < EG.toMin(m.hasta) && EG.toMin(a.hora) + S.db.settings.duracion > EG.toMin(m.desde))))) : [];
    return `<form class="modal" id="mod-bloqueo" novalidate role="dialog" aria-modal="true" aria-label="Bloquear horario">${mhead("Bloquear horario")}
      <div class="seg"><button type="button" data-act="mod.set" data-k="modo" data-v="horario" aria-pressed="${m.modo === "horario"}">Un horario</button><button type="button" data-act="mod.set" data-k="modo" data-v="dia" aria-pressed="${m.modo === "dia"}">Día completo</button></div>
      <div class="fgrid two"><div class="full">${mf("b-fecha", "Día", "fecha", "date", 'data-change="mod.fecha"')}</div>
        ${m.modo === "horario" ? mf("b-desde", "Desde", "desde", "time", 'data-change="mod.fecha"') + mf("b-hasta", "Hasta", "hasta", "time", 'data-change="mod.fecha"') : ""}
        <div class="full">${mf("b-motivo", 'Motivo <span class="hint">Lo ves solo vos</span>', "motivo", "text", 'placeholder="Ej: médico, feria, inventario"')}</div></div>
      ${choque.length ? `<p class="notice">Ya hay ${U.plural(choque.length, "cita")} en ese horario (${choque.map((a) => esc(a.hora + " " + a.nombre.split(" ")[0])).join(", ")}). El bloqueo no las cancela: avisales vos.</p>` : ""}
      ${m.err ? `<p class="err" role="alert">${esc(m.err)}</p>` : ""}
      <div class="row" style="justify-content:flex-end"><button type="button" class="btn" data-act="mod.close">Cancelar</button><button type="submit" class="btn dark">Bloquear</button></div></form>`;
  }

  function modalQr() {
    const link = S.publicLink();
    return `<div class="modal" role="dialog" aria-modal="true" aria-label="Código QR">${mhead("Código QR de tu agenda")}
      <div class="stack" style="align-items:center"><div class="qr">${U.qrSvg(link)}</div><p class="small muted center" style="overflow-wrap:anywhere">${esc(link)}</p></div>
      <div class="row" style="justify-content:center"><button type="button" class="btn dark" data-act="qr.descargar">${I("download", 15)}Descargar QR</button><button type="button" class="btn" data-act="copiarLink">${I("copy", 15)}Copiar link</button></div></div>`;
  }

  function modalClienta(m) {
    return `<form class="modal" id="mod-clienta" novalidate role="dialog" aria-modal="true" aria-label="Nueva clienta">${mhead("Nueva clienta")}
      <div class="fgrid two">${mf("c-nombre", "Nombre y apellido", "nombre")}${mf("c-wa", "WhatsApp", "whatsapp", "tel", 'inputmode="tel" placeholder="11 5555 0101"')}${mf("c-email", "Email", "email", "email")}${mf("c-zona", "Zona", "zona", "text", 'placeholder="Ej: Lanús"')}
        <div class="full">${comoSelect("comoCompra", m.comoCompra)}</div>
        <label class="f full" for="c-notas">Notas<textarea class="t" id="c-notas" data-bind="modal.notas">${esc(m.notas)}</textarea></label></div>
      ${m.err ? `<p class="err" role="alert">${esc(m.err)}</p>` : ""}
      <div class="row" style="justify-content:flex-end"><button type="button" class="btn" data-act="mod.close">Cancelar</button><button type="submit" class="btn dark">Guardar clienta</button></div></form>`;
  }

  function modalRecordatorios() {
    const r = P.porRecordar(), s = S.db.settings;
    const lista = r.todas || [];
    return `<div class="modal" role="dialog" aria-modal="true" aria-label="Recordatorios">${mhead("Recordatorios por WhatsApp")}
      <p class="small muted">Citas ${esc(r.de || "")}. Tocá “Enviar” en cada una: se abre WhatsApp con el mensaje listo, con el link para reprogramar o cancelar. Si tocaste “Enviar” y no lo mandaste, usá “Desmarcar”.</p>
      ${lista.length ? `<div class="rows">${lista.map((a) => `<div class="rowitem"><span class="time num">${esc(a.hora)}</span><span class="grow"><span class="rname">${esc(a.nombre)}</span><span class="rsub">${U.tipoTxt(a, true)}</span></span>
        ${a.recordatorio ? `<span class="chip ok">${I("check", 12)}Enviado</span><button type="button" class="linkbtn xs" data-act="rec.desmarcar" data-v="${esc(a.id)}">Desmarcar</button>` : ""}
        <a class="btn xs ${a.recordatorio ? "" : "dark"}" href="${esc(EG.waLink(a.whatsapp, EG.msgRecordatorio(a, s, S.prod, S.citaLink(a))))}" target="_blank" rel="noopener" data-act="rec.enviado" data-v="${esc(a.id)}">${a.recordatorio ? "Reenviar" : "Enviar"}</a></div>`).join("")}</div>`
        : `<p class="empty">No hay citas para recordar.</p>`}
      <div class="row" style="justify-content:flex-end"><button type="button" class="btn" data-act="mod.close">Listo</button></div></div>`;
  }

  P.MODALES = P.MODALES || {}; // ventanas que agregan otras pantallas (ej.: cambio de precios en Catálogo)
  function modal() {
    const m = S.ui.modal;
    const body = m.kind === "reserva" ? modalReserva(m) : m.kind === "bloqueo" ? modalBloqueo(m) : m.kind === "qr" ? modalQr() : m.kind === "clienta" ? modalClienta(m) : m.kind === "recordatorios" ? modalRecordatorios() : P.MODALES[m.kind] ? P.MODALES[m.kind](m) : "";
    return `<div class="overlay">${body}</div>`;
  }

  P.openReserva = (preset) => {
    const prox = EG.nextDays(S.db.settings, 1)[0] || hoyYmd();
    S.ui.modal = Object.assign({ kind: "reserva", tipo: "presencial", fecha: prox, hora: null, clientaId: null, modoCli: S.db.clientas.length ? "buscar" : "nueva", cq: "", pq: "",
      nombre: "", whatsapp: "", email: "", zona: "", comoCompra: "", prendas: [], notas: "", avisar: true, err: "" }, preset || {});
  };

  /* ---------- vista ---------- */
  const VISTAS = { inicio, agenda };
  P.VISTAS = VISTAS;
  EG.views.panel = function () {
    const v = VISTAS[S.ui.route] || inicio;
    return chrome(v());
  };
  VISTAS.mas = () => `${P.title("Más")}<div class="mascard">${menuHtml(["inicio", "agenda", "clientas"])}</div>`;

  /* ---------- acciones ---------- */
  const A = EG.actions;
  A.nav = (el) => { S.ui.open = null; S.ui.clienta = null; S.go(el.dataset.v || "inicio"); return false; };
  A.verPublica = () => { S.ui.fromPanel = true; S.go("reservar"); return false; };
  A.copiarLink = () => { U.copyToast(S.publicLink(), "Link copiado."); return false; };
  A.logout = () => {
    if (!EG.remote.on) { S.toast("En la versión de prueba no hay sesión."); return false; }
    EG.remote.logout().then(() => { S.go("inicio"); S.render(); });
    return false;
  };
  A["aviso.sinMarcar"] = () => {
    const pend = S.db.appts.filter((a) => a.estado === "confirmada" && a.fecha < hoyYmd()).sort((x, y) => x.fecha.localeCompare(y.fecha));
    S.ui.agendaVista = "lista";
    S.ui.agDesde = pend[0].fecha;
    S.ui.agHasta = addDays(hoyYmd(), -1);
    S.ui.open = pend[0].id;
    S.go("agenda");
    return false;
  };

  A["ag.open"] = (el) => { S.ui.open = el.dataset.v; if (S.ui.route !== "agenda") { S.go("agenda"); return false; } return "top"; };
  A["ag.notas"] = () => { S.save(); S.toast("Notas guardadas."); return false; };
  EG.changes["ag.estadoSel"] = (t) => { S.db.appts.find((x) => x.id === t.dataset.a).estado = t.value; S.save(); };
  A["ag.eliminar"] = (el) => {
    const id = el.dataset.a;
    if (S.ui.confirmar !== "cita-" + id) { S.ui.confirmar = "cita-" + id; return; }
    S.ui.confirmar = null;
    S.db.appts = S.db.appts.filter((a) => a.id !== id);
    S.ui.open = null;
    S.save();
    S.toast("Cita eliminada.");
    return "top";
  };
  A["ag.close"] = () => { S.ui.open = null; S.ui.avisar = null; return "top"; };
  // Marca la cita como recordada (el link abre WhatsApp igual, porque no se cancela el click).
  // Vuelve a dejar la cita como pendiente de recordatorio (por ejemplo, si se tocó "Enviar" sin mandarlo).
  A["rec.desmarcar"] = (el) => {
    const a = S.db.appts.find((x) => x.id === el.dataset.v);
    if (a) { delete a.recordatorio; S.save(); }
  };
  A["rec.enviado"] = (el) => {
    const a = S.db.appts.find((x) => x.id === el.dataset.v);
    if (a) { a.recordatorio = new Date().toISOString(); S.save(); }
    setTimeout(() => S.render(), 300);
    return false;
  };
  A["ag.avisado"] = () => { setTimeout(() => { S.ui.avisar = null; S.render(); }, 300); return false; };
  A["ag.vista"] = (el) => { S.ui.agendaVista = el.dataset.v; };
  A["ag.week"] = (el) => { const v = +el.dataset.v; S.ui.week = v === 0 ? 0 : S.ui.week + v; };
  A["ag.slot"] = (el) => { P.openReserva({ fecha: el.dataset.f, hora: el.dataset.h }); };
  EG.changes["ag.desde"] = (t) => { S.ui.agDesde = t.value; S.ui.open = null; };
  EG.changes["ag.hasta"] = (t) => { S.ui.agHasta = t.value; S.ui.open = null; };
  A["ag.desbloquear"] = (el) => { S.db.bloqueos = S.db.bloqueos.filter((b) => b.id !== el.dataset.v); S.save(); S.toast("Bloqueo quitado."); };
  A["ag.take"] = (el) => {
    const a = S.db.appts.find((x) => x.id === el.dataset.a);
    const it = a.prendas[+el.dataset.i];
    const val = el.dataset.v === "1";
    it.seLlevo = it.seLlevo === val ? null : val;
    S.save();
  };
  A["ag.estado"] = (el) => { S.db.appts.find((x) => x.id === el.dataset.a).estado = el.dataset.v; S.save(); };
  A["ag.copiarSeg"] = (el) => { const a = S.db.appts.find((x) => x.id === el.dataset.a); U.copyToast(EG.msgSeguimiento(a, S.db.settings, S.prod), "Mensaje copiado."); return false; };
  /* exportar: ventana con período, estados, bloqueos y columnas (como Turnito) */
  const COLS = [
    ["id", "ID", (a) => a.id], ["fecha", "Fecha", (a) => a.fecha], ["hora", "Hora", (a) => a.hora], ["tipo", "Tipo", (a) => U.tipoTxt(a, true)],
    ["estado", "Estado", (a) => (Object.fromEntries(U.ESTADOS))[a.estado]], ["nombre", "Nombre", (a) => a.nombre], ["whatsapp", "WhatsApp", (a) => a.whatsapp],
    ["email", "Email", (a) => a.email], ["zona", "Zona", (a) => a.zona], ["comoCompra", "Cómo compra", (a) => a.comoCompra],
    ["prendas", "Prendas", (a) => (a.prendas || []).map((i) => EG.itemName(i, S.prod) + " T" + i.talle).join(" | ")],
    ["seLlevo", "Se llevó", (a) => (a.prendas || []).filter((i) => i.seLlevo === true).map((i) => EG.itemName(i, S.prod) + " T" + i.talle).join(" | ")],
    ["queBusca", "Busca", (a) => a.queBusca], ["notas", "Notas", (a) => a.notas], ["origen", "Origen", (a) => (a.origen === "manual" ? "Carga manual" : a.origen === "importada" ? "Importada" : "Clienta")]
  ];
  const PERIODOS = [["hoy", "Hoy"], ["semana", "Esta semana"], ["mes", "Este mes"], ["30", "Últimos 30 días"], ["custom", "Personalizado"]];
  function rangoExp(m) {
    const hoy = hoyYmd(), d = EG.parseYmd(hoy);
    if (m.per === "hoy") return [hoy, hoy];
    if (m.per === "semana") { const lun = addDays(hoy, -((d.getDay() + 6) % 7)); return [lun, addDays(lun, 6)]; }
    if (m.per === "mes") { const f = new Date(d.getFullYear(), d.getMonth() + 1, 0); return [hoy.slice(0, 8) + "01", EG.ymd(f)]; }
    if (m.per === "30") return [addDays(hoy, -29), hoy];
    return [m.desde || hoy, m.hasta || m.desde || hoy];
  }
  const citasExp = (m) => { const [de, ha] = rangoExp(m); return S.db.appts.filter((a) => a.fecha >= de && a.fecha <= ha && m.est[a.estado]).sort((x, y) => (x.fecha + x.hora).localeCompare(y.fecha + y.hora)); };
  const bloqExp = (m) => { const [de, ha] = rangoExp(m); return m.bloq ? S.db.bloqueos.filter((b) => b.fecha >= de && b.fecha <= ha) : []; };
  P.MODALES.exportar = (m) => {
    const n = citasExp(m).length + bloqExp(m).length, nc = COLS.filter((c) => m.cols[c[0]]).length;
    const chip = (act, k, on, txt) => `<button type="button" class="pill" data-act="${act}" data-v="${k}" aria-pressed="${on}">${txt}</button>`;
    return `<div class="modal" role="dialog" aria-modal="true" aria-label="Exportar citas">${mhead("Exportar citas")}
      <div class="stack sm"><span class="label">Período</span><div class="pills">${PERIODOS.map(([k, t]) => chip("exp.per", k, m.per === k, t)).join("")}</div>
        ${m.per === "custom" ? `<div class="fgrid two">${mf("e-desde", "Desde", "desde", "date", 'data-change="exp.ref"')}${mf("e-hasta", "Hasta", "hasta", "date", 'data-change="exp.ref"')}</div>` : ""}</div>
      <div class="stack sm"><span class="label">Estado</span><div class="pills">${U.ESTADOS.map(([k, t]) => chip("exp.est", k, !!m.est[k], t)).join("")}</div></div>
      <label class="check"><input type="checkbox" ${m.bloq ? "checked" : ""} data-change="exp.bloq">Incluir horarios bloqueados</label>
      <div class="stack sm"><div class="row between"><span class="label">Columnas</span><button type="button" class="linkbtn" data-act="exp.todas">${nc === COLS.length ? "Deseleccionar todas" : "Seleccionar todas"}</button></div>
        <div class="pills">${COLS.map(([k, t]) => chip("exp.col", k, !!m.cols[k], t)).join("")}</div></div>
      <div class="row between"><span class="small"><b>A exportar:</b> ${U.plural(n, "fila")}</span>
        <button type="button" class="btn dark" data-act="exp.bajar" ${n && nc ? "" : "disabled"}>${I("download", 15)}Exportar</button></div></div>`;
  };
  /* importar desde Turnito u otra agenda (.xlsx o .csv) */
  EG.changes["imp.archivo"] = (input) => {
    const f = input.files[0];
    if (!f) return false;
    EG.importar.leer(f)
      .then((filas) => {
        const res = EG.importar.analizar(filas, S.db, S.db.settings);
        if (!res.items.length) { S.toast("No encontramos citas ni clientas en ese archivo."); return; }
        S.ui.modal = { kind: "importar", archivo: f.name, res };
        S.render();
      })
      .catch(() => S.toast("No pudimos leer ese archivo. Tiene que ser .xlsx o .csv."));
    input.value = "";
    return false;
  };
  P.MODALES.importar = (m) => {
    const r = m.res, citas = r.tipo === "citas";
    const van = r.items.filter((x) => x.ok && !x.fuera).length;
    return `<div class="modal" role="dialog" aria-modal="true" aria-label="Importar">${mhead(citas ? "Importar citas" : "Importar clientas")}
      <p class="small muted">${esc(m.archivo)} · ${U.plural(r.items.length, "fila")}. Revisá la lista y destildá lo que no quieras cargar.</p>
      <div class="pickbox" data-keepscroll="pickimp" style="max-height:340px">${r.items.map((x, i) => `<label class="rowitem" style="cursor:pointer;align-items:flex-start">
        <input type="checkbox" ${x.ok && !x.fuera ? "checked" : ""} ${x.ok ? "" : "disabled"} data-change="imp.toggle" data-v="${i}" style="margin-top:3px">
        <span class="grow small"><b>${esc(x.d.nombre || "Sin nombre")}</b>${citas ? ` · ${esc(x.d.fecha ? fechaLarga(x.d.fecha) : "?")} ${esc(x.d.hora)} · ${esc((Object.fromEntries(U.ESTADOS))[x.d.estado] || "")}` : ""}
          <span class="rsub num">${x.d.whatsapp ? "+" + esc(x.d.whatsapp) : ""}${x.d.email ? " · " + esc(x.d.email) : ""}</span>
          ${x.motivo ? `<span class="xs muted">${esc(x.motivo)}</span>` : ""}${x.aviso ? `<span class="xs" style="color:var(--accent)">${esc(x.aviso)}</span>` : ""}</span></label>`).join("")}</div>
      ${citas ? `<p class="xs muted">Las citas importadas ocupan su horario y las clientas se suman a Clientas.</p>` : ""}
      <div class="row" style="justify-content:flex-end"><button type="button" class="btn" data-act="mod.close">Cancelar</button>
        <button type="button" class="btn dark" data-act="imp.aplicar" ${van ? "" : "disabled"}>Importar ${U.plural(van, citas ? "cita" : "clienta")}</button></div></div>`;
  };
  EG.changes["imp.toggle"] = (el) => { const x = S.ui.modal.res.items[+el.dataset.v]; x.fuera = !el.checked; return true; };
  A["imp.aplicar"] = () => {
    const r = S.ui.modal.res, n = EG.importar.aplicar(r, S.db);
    S.ui.modal = null;
    S.save();
    S.toast(n ? "Listo: se importaron " + U.plural(n, r.tipo === "citas" ? "cita" : "clienta") + "." : "No se importó nada.");
  };
  A["ag.export"] = () => {
    S.ui.modal = { kind: "exportar", per: "mes", desde: "", hasta: "", bloq: false,
      est: { confirmada: true, asistio: true, no_vino: true, cancelada: false }, cols: Object.fromEntries(COLS.map((c) => [c[0], c[0] !== "id"])) };
  };
  A["exp.per"] = (el) => { S.ui.modal.per = el.dataset.v; };
  A["exp.est"] = (el) => { const e = S.ui.modal.est; e[el.dataset.v] = !e[el.dataset.v]; };
  A["exp.col"] = (el) => { const c = S.ui.modal.cols; c[el.dataset.v] = !c[el.dataset.v]; };
  A["exp.todas"] = () => { const c = S.ui.modal.cols, todas = COLS.every((x) => c[x[0]]); COLS.forEach((x) => { c[x[0]] = !todas; }); };
  EG.changes["exp.bloq"] = (el) => { S.ui.modal.bloq = el.checked; };
  EG.changes["exp.ref"] = () => true;
  A["exp.bajar"] = () => {
    const m = S.ui.modal, [de, ha] = rangoExp(m), cols = COLS.filter((c) => m.cols[c[0]]);
    const rows = [cols.map((c) => c[1])];
    citasExp(m).forEach((a) => rows.push(cols.map((c) => c[2](a) || "")));
    bloqExp(m).forEach((b) => rows.push(cols.map((c) => ({ fecha: b.fecha, hora: b.desde ? b.desde + "–" + b.hasta : "Día completo", estado: "Bloqueado", notas: b.motivo || "" })[c[0]] || "")));
    U.download("citas-" + de + "-a-" + ha + ".csv", EG.toCSV(rows));
    S.ui.modal = null;
  };

  /* ventanas */
  A["mod.open"] = (el) => {
    const k = el.dataset.v;
    if (k === "reserva") P.openReserva(el.dataset.c ? { clientaId: el.dataset.c } : null);
    else if (k === "bloqueo") S.ui.modal = { kind: "bloqueo", modo: "horario", fecha: hoyYmd(), desde: "", hasta: "", motivo: "", err: "" };
    else if (k === "clienta") S.ui.modal = { kind: "clienta", nombre: "", whatsapp: "", email: "", zona: "", comoCompra: "", notas: "", err: "" };
    else S.ui.modal = { kind: k };
  };
  A["mod.close"] = () => { S.ui.modal = null; };
  A["mod.set"] = (el) => {
    const m = S.ui.modal;
    m[el.dataset.k] = el.dataset.v;
    if (el.dataset.k === "fecha") m.hora = null;
    m.err = "";
  };
  EG.changes["mod.fecha"] = () => { if (S.ui.modal.kind === "reserva" && !S.ui.modal.libre) S.ui.modal.hora = null; };
  EG.changes["mod.libre"] = () => { S.ui.modal.hora = null; return true; };
  A["mod.size"] = (el) => {
    const m = S.ui.modal, id = el.dataset.p, talle = el.dataset.v;
    const ex = m.prendas.find((i) => i.id === id);
    if (ex && ex.talle === talle) m.prendas = m.prendas.filter((i) => i !== ex);
    else if (ex) ex.talle = talle;
    else m.prendas.push({ id, nombre: (S.prod(id) || {}).nombre || "", talle, seLlevo: null });
  };
  A["qr.descargar"] = () => { U.download("qr-agenda-" + EG.slug(S.db.settings.nombre) + ".png", U.qrPng(S.publicLink(), 900)); return false; };

  EG.submits["mod-reserva"] = () => {
    const m = S.ui.modal, s = S.db.settings;
    const fail = (t) => { m.err = t; };
    if (!m.fecha || !m.hora) return fail("Elegí el día y el horario.");
    if (m.libre && !/^\d{2}:\d{2}$/.test(m.hora)) return fail("Escribí la hora, por ejemplo 16:00.");
    let c;
    if (m.clientaId) c = S.db.clientas.find((x) => x.id === m.clientaId);
    else {
      if (m.modoCli === "buscar") return fail("Elegí una clienta o cargala como nueva.");
      if (m.nombre.trim().length < 2) return fail("Escribí el nombre de la clienta.");
      const wa = EG.normalizePhone(m.whatsapp);
      if (!wa) return fail("Revisá el WhatsApp: con código de área, por ejemplo 11 5555 0101.");
      c = EG.upsertClienta(S.db, { nombre: m.nombre, whatsapp: wa, email: m.email, zona: m.zona, comoCompra: m.comoCompra });
    }
    if (!m.libre && !EG.isSlotFree(s, S.db.appts, m.fecha, m.hora, new Date(), S.db.bloqueos)) return fail("Ese horario ya no está libre. Elegí otro.");
    const a = {
      id: EG.uid(), fecha: m.fecha, hora: m.hora, tipo: m.tipo, estado: "confirmada",
      nombre: c.nombre, whatsapp: c.whatsapp, email: c.email, zona: c.zona, comoCompra: c.comoCompra, queBusca: "",
      prendas: m.prendas.map((i) => ({ id: i.id, nombre: i.nombre, talle: i.talle, seLlevo: null })),
      notas: m.notas.trim(), sala: m.tipo === "video" ? "showroom-" + EG.uid(14) : null, creada: new Date().toISOString(),
      clientaId: c.id, origen: "manual"
    };
    S.db.appts.push(a);
    S.save();
    S.ui.avisar = m.avisar ? a.id : null;
    S.ui.modal = null;
    S.ui.open = a.id;
    S.toast("Reserva guardada.");
    if (S.ui.route !== "agenda") { S.go("agenda"); return false; }
  };
  EG.submits["mod-bloqueo"] = () => {
    const m = S.ui.modal;
    const fail = (t) => { m.err = t; };
    if (!m.fecha) return fail("Elegí el día.");
    if (m.modo === "horario" && (!m.desde || !m.hasta || EG.toMin(m.hasta) <= EG.toMin(m.desde))) return fail("Revisá el horario: “hasta” tiene que ser después de “desde”.");
    S.db.bloqueos.push({ id: "b-" + EG.uid(8), fecha: m.fecha, desde: m.modo === "horario" ? m.desde : "", hasta: m.modo === "horario" ? m.hasta : "", motivo: m.motivo.trim() });
    S.save();
    S.ui.modal = null;
    S.toast("Horario bloqueado.");
  };
  EG.submits["mod-clienta"] = () => {
    const m = S.ui.modal;
    const fail = (t) => { m.err = t; };
    if (m.nombre.trim().length < 2) return fail("Escribí el nombre.");
    const wa = EG.normalizePhone(m.whatsapp);
    if (!wa) return fail("Revisá el WhatsApp: con código de área, por ejemplo 11 5555 0101.");
    if (EG.clientaPorWa(S.db, wa)) return fail("Ya hay una clienta con ese WhatsApp.");
    const c = EG.upsertClienta(S.db, { nombre: m.nombre, whatsapp: wa, email: m.email, zona: m.zona, comoCompra: m.comoCompra });
    c.notas = m.notas.trim();
    S.save();
    S.ui.modal = null;
    S.ui.clienta = c.id;
    S.toast("Clienta guardada.");
    return "top";
  };
})();
