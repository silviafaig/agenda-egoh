// Vista pública (clienta): inicio con logo, tipo de cita, día y horario, preselección, datos, resumen
// y confirmación. También la página de la cita (#/cita/<id>) para reprogramar o cancelar.
(function () {
  "use strict";
  const EG = window.EG;
  const S = EG.S;
  const U = EG.ui;
  const { esc, money, fechaLarga, DIAS, MESES, icon: I } = EG;

  const R = EG.remote;
  const PASOS = ["Tipo de cita", "Día y horario", "Preselección", "Tus datos", "Resumen"];
  // "Recordar mis datos": se guardan solo en este celular/computadora, nunca en otro lado.
  const MIS_DATOS = "eg-mis-datos";
  const leerDatos = () => { try { return JSON.parse(localStorage.getItem(MIS_DATOS) || "null"); } catch (e) { return null; } };
  const guardarDatos = (b) => {
    try {
      if (b.recordar) localStorage.setItem(MIS_DATOS, JSON.stringify({ nombre: b.nombre.trim(), whatsapp: b.whatsapp.trim(), email: b.email.trim(), zona: b.zona.trim(), comoCompra: b.comoCompra }));
      else localStorage.removeItem(MIS_DATOS);
    } catch (e) { /* sin almacenamiento: no pasa nada */ }
  };
  const newBooking = () => {
    const d = leerDatos() || {};
    return { tipo: null, fecha: null, hora: null, prendas: [], nombre: d.nombre || "", whatsapp: d.whatsapp || "", email: d.email || "",
      zona: d.zona || "", comoCompra: d.comoCompra || "", queBusca: "", recordar: true };
  };
  S.ui.booking = newBooking();

  function resetBooking() {
    S.ui.booking = newBooking();
    S.ui.step = 0;
    S.ui.done = null;
    S.ui.formErr = "";
    S.ui.slotMsg = "";
    S.ui.q = "";
  }

  /* ---------- piezas ---------- */
  function top() {
    const s = S.db.settings;
    return `<header class="pubtop"><div class="in">
      ${S.ui.fromPanel ? `<button class="iconbtn sm" type="button" data-act="pub.backPanel" aria-label="Volver al panel">${I("arrow-left", 16)}</button>` : ""}
      ${U.logo(s)}${S.ui.fromPanel ? `<span class="chip right">Vista de clienta</span>` : ""}</div></header>`;
  }

  const minimoTxt = (s) => (s.compraMinima > 0 ? `Compra mínima ${money(s.compraMinima)}${s.compraMinimaNota ? " " + esc(s.compraMinimaNota) : ""}` : "");

  // Barrio: la última parte de la dirección ("Av. Federico Lacroze 2911 PB A, Colegiales" -> "Colegiales").
  const barrio = (s) => { const p = String(s.direccion || "").split(","); return p.length > 1 ? p[p.length - 1].trim() : ""; };

  function head(st, titulo, sub) {
    return `<div class="stack sm">
      ${st > 0 ? `<button type="button" class="back" data-act="pub.back">${I("chevron-left", 16)}Volver</button>` : ""}
      <div class="steps" aria-hidden="true">${PASOS.map((_, i) => `<span class="${i <= st ? "on" : ""}"></span>`).join("")}</div>
      <span class="stepnum">Paso ${st + 1} de ${PASOS.length} · ${PASOS[st]}</span>
      <h1>${titulo}</h1>${sub ? `<p class="muted">${sub}</p>` : ""}</div>`;
  }

  const contacto = (s) => (s.whatsappShowroom || s.instagram
    ? `<div class="row contacto">${s.instagram ? `<a class="btn xs" href="https://instagram.com/${encodeURIComponent(s.instagram)}" target="_blank" rel="noopener">${I("instagram", 14)}Instagram</a>` : ""}${s.whatsappShowroom ? `<a class="btn xs" href="${esc(EG.waLink(s.whatsappShowroom, "Hola, tengo una consulta"))}" target="_blank" rel="noopener">${I("message-circle", 14)}WhatsApp</a>` : ""}</div>`
    : "");
  const MOTIVOS = {
    ocupado: "Ese horario se acaba de ocupar. Elegí otro.", bloqueado: "Ese horario se acaba de ocupar. Elegí otro.",
    muy_pronto: "Ese horario está muy cerca: hay que reservar con más anticipación. Elegí otro.",
    muy_lejos: "Todavía no se puede reservar para esa fecha. Elegí una más cercana.",
    pausado: "En este momento no estamos tomando reservas.",
    fuera_de_plazo: "Ya pasó el plazo para hacer cambios online. Escribinos por WhatsApp.",
    limite_reprogramaciones: "Ya reprogramaste esta cita. Para otro cambio, escribinos por WhatsApp."
  };
  const P1 = (t) => t.charAt(0).toUpperCase() + t.slice(1);

  /* ---------- pasos ---------- */
  function stepTipo(s, b) {
    const portada = EG.imgSrc(s.portada, "portada");
    const opt = (v, ico, titulo, desc) =>
      `<button type="button" class="opt" data-act="pub.type" data-v="${v}" aria-pressed="${b.tipo === v}"><span class="oico">${I(ico, 20)}</span>
        <span><h3>${titulo}</h3><p>${desc}</p></span></button>`;
    return `${portada ? `<div class="portada" style="background-image:url('${esc(portada)}')" role="img" aria-label="Portada de ${esc(s.nombre)}"></div>` : ""}
      ${head(0, "¿Cómo querés conocer la colección?")}
      <div class="brief">
        ${b.tipo === "presencial" ? `<p>${I("map-pin", 16)}<span>${esc(s.direccion)}</span></p>` : ""}
        <p>${I("clock", 16)}<span>Solo con cita previa · ${esc(s.duracion)} min</span></p>
        ${s.compraMinima > 0 ? `<p>${I("shopping-bag", 16)}<span>${minimoTxt(s)}</span></p>` : ""}</div>
      ${contacto(s)}
      <div class="options">
        ${opt("presencial", "map-pin", "Visita al showroom", esc(s.duracion) + " min · Ves y probás las prendas en persona" + (barrio(s) ? " · " + esc(barrio(s)) : "") + ".")}
        ${opt("video", "video", "Videollamada", esc(s.duracion) + " min · Te mostramos las prendas en vivo por videollamada de WhatsApp.")}
      </div>
      <button type="button" class="btn dark block" data-act="pub.next" ${b.tipo ? "" : "disabled"}>Elegir día y horario</button>`;
  }

  function slotsHtml(s, fecha, sel, act, ignorarId) {
    const slots = EG.slotsCliente(s, S.db.appts, fecha, null, S.db.bloqueos, ignorarId);
    if (!slots.some((x) => !x.off)) return `<p class="empty">No quedan horarios este día. Probá con otro.</p>`;
    const grupo = (titulo, ico, lista) => (lista.length
      ? `<div class="slotgroup"><h4 class="row">${I(ico, 15)}${titulo}</h4><div class="slots" role="group" aria-label="${titulo}">${lista.map((x) =>
          `<button type="button" class="slot num" data-act="${act}" data-v="${x.h}" ${x.off ? "disabled" : ""} aria-pressed="${sel === x.h}" aria-label="${x.h}${x.off ? " (no disponible)" : ""}">${x.h}</button>`).join("")}</div></div>`
      : "");
    return `<div class="stack lg">${grupo("Mañana", "sun", slots.filter((x) => EG.toMin(x.h) < 13 * 60))}${grupo("Tarde", "sunset", slots.filter((x) => EG.toMin(x.h) >= 13 * 60))}</div>`;
  }

  // Días de atención que puede elegir la clienta: hasta el límite "Reservar hasta (días adelante)"; sin límite, 60 días.
  function diasCliente(s) {
    const lim = new Date(); lim.setDate(lim.getDate() + (EG.reglas(s).maxDias || 60));
    const tope = EG.ymd(lim);
    return EG.nextDays(s, 120).filter((d) => d <= tope);
  }
  function daysHtml(s, sel, act, ignorarId) {
    const dias = diasCliente(s);
    const libre = (d) => EG.slotsCliente(s, S.db.appts, d, null, S.db.bloqueos, ignorarId).some((x) => !x.off);
    return `<div class="days" data-keepscroll="dias" role="group" aria-label="Día">${dias.map((d) => {
      const x = EG.parseYmd(d);
      return `<button type="button" class="day" data-act="${act}" data-v="${d}" aria-pressed="${sel === d}" ${libre(d) ? "" : "disabled"} aria-label="${esc(fechaLarga(d))}"><span>${DIAS[x.getDay()]}</span><b>${x.getDate()}</b><span>${MESES[x.getMonth()]}</span></button>`;
    }).join("")}</div>`;
  }
  // Elige el primer día con lugar si el elegido ya no sirve.
  function fixFecha(s, obj, ignorarId) {
    const dias = diasCliente(s);
    const libre = (d) => EG.slotsCliente(s, S.db.appts, d, null, S.db.bloqueos, ignorarId).some((x) => !x.off);
    if (!obj.fecha || dias.indexOf(obj.fecha) < 0 || !libre(obj.fecha)) { obj.fecha = dias.find(libre) || dias[0] || null; obj.hora = null; }
    return dias;
  }

  function stepFecha(s, b) {
    const dias = fixFecha(s, b);
    if (!dias.length) return head(1, "Elegí día y horario") + `<p class="empty">Por ahora el showroom no tiene días de atención disponibles.</p>`;
    return `${head(1, "Elegí día y horario", (b.tipo === "video" ? "Videollamada" : "Visita al showroom") + " · " + esc(s.duracion) + " min")}
      ${S.ui.slotMsg ? `<p class="notice bad" role="alert">${esc(S.ui.slotMsg)}</p>` : ""}
      <div class="fecha2"><div class="stack"><h3>Día</h3>${daysHtml(s, b.fecha, "pub.date")}</div>
        <div class="stack"><h3>Horario · <span class="muted" style="font-weight:400">${esc(fechaLarga(b.fecha))}</span></h3>${slotsHtml(s, b.fecha, b.hora, "pub.time")}</div></div>
      <div class="stack sm"><button type="button" class="btn dark block" data-act="pub.next" ${b.hora ? "" : "disabled"}>Elegir prendas</button>
        <button type="button" class="btn block" data-act="pub.sinPrendas" ${b.hora ? "" : "disabled"}>Seguir sin elegir prendas</button></div>`;
  }

  function prodCard(p, b) {
    const sel = b.prendas.find((i) => i.id === p.id);
    return `<div class="prod${sel ? " sel" : ""}" data-card="${esc(p.id)}" data-s="${esc(p.nombre + " " + (p.modelo || ""))}"><div class="ph">${U.photo(p)}${sel ? `<span class="chip tag">Talle ${esc(sel.talle)}</span>` : ""}</div>
      <div class="body"><h3>${esc(p.nombre)}</h3>${EG.priceTxt(p) ? `<p class="num xs muted">${EG.priceTxt(p)}</p>` : ""}
      <div class="sizes" role="group" aria-label="Talles de ${esc(p.nombre)}">${p.talles.map((z) =>
        `<button type="button" class="size" data-act="pub.size" data-p="${esc(p.id)}" data-v="${esc(z)}" aria-label="Talle ${esc(z)}" aria-pressed="${!!sel && sel.talle === z}">${esc(z)}</button>`).join("")}</div></div></div>`;
  }

  function totales() {
    const s = S.db.settings, b = S.ui.booking;
    const n = b.prendas.length;
    const tot = EG.totalOf(b.prendas, S.prod);
    const priced = n > 0 && EG.allPriced(b.prendas, S.prod);
    const hayMin = s.compraMinima > 0;
    const pct = priced && hayMin ? Math.min(100, (tot / s.compraMinima) * 100) : 0;
    return `<div class="row between"><span><b>${U.plural(n, "prenda")}</b>${priced ? ` · <span class="num">${money(tot)}</span>` : ""}</span>
        ${hayMin ? `<span class="xs muted num">Mínimo ${money(s.compraMinima)}</span>` : ""}</div>
      ${priced && hayMin
        ? `<div class="meter" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}"><i style="width:${pct}%"></i></div>
           <p class="xs muted">${pct >= 100 ? "Tu selección ya llega a la compra mínima." : `Te faltan <span class="num">${money(s.compraMinima - tot)}</span> para la compra mínima. Podés sumar más en la cita.`}</p>`
        : n && hayMin ? `<p class="xs muted">Los precios se confirman en la cita.</p>` : ""}`;
  }
  function sideInner() {
    const b = S.ui.booking;
    return `<h3>Tu selección</h3>
      ${b.prendas.length
        ? `<div class="picked">${b.prendas.map((i) => `<div class="pickrow">${U.thumbs([i], 1)}<span class="grow">${esc(EG.itemName(i, S.prod))}<br><span class="muted xs">Talle ${esc(i.talle)}</span></span>
            <button type="button" class="iconbtn sm" data-act="pub.quitar" data-p="${esc(i.id)}" aria-label="Quitar ${esc(EG.itemName(i, S.prod))}">${I("x", 14)}</button></div>`).join("")}</div>`
        : `<p class="small muted">Tocá un talle para sumar una prenda.</p>`}
      <div class="divider"></div>${totales()}
      <button type="button" class="btn dark block" data-act="pub.next">${b.prendas.length ? "Seguir" : "Seguir sin elegir"}</button>`;
  }
  function stickyInner() {
    return totales() + `<button type="button" class="btn dark block" data-act="pub.next">${S.ui.booking.prendas.length ? "Seguir" : "Seguir sin elegir"}</button>`;
  }

  function stepPrendas(s, b) {
    const lista = S.db.products.filter((p) => p.categoria === S.ui.cat);
    return `${head(2, "Elegí las prendas que querés ver", `Las tenemos listas para tu ${b.tipo === "video" ? "videollamada" : "visita"}. Tocá un talle para sumarla; tocalo de nuevo para quitarla.`)}
      <div class="prendas2"><div class="stack" data-fscope>
        <label class="searchbox">${I("search", 16)}<span class="sr-only">Buscar por modelo</span><input class="t" type="search" placeholder="Buscar por modelo (ej: Cala)" value="${esc(S.ui.q)}" data-bind="q" data-filter="[data-card]"></label>
        ${U.cats(S.ui.cat, "pub.cat")}
        ${lista.length ? `<div class="grid">${lista.map((p) => prodCard(p, b)).join("")}</div><p class="empty" data-fempty hidden>No hay prendas con ese nombre en esta categoría.</p>` : `<p class="empty">Todavía no hay prendas en esta categoría.</p>`}
        <div class="sticky" id="sticky">${stickyInner()}</div></div>
        <aside class="sidepanel" id="sidepanel">${sideInner()}</aside></div>`;
  }

  function field(id, label, type, val, ac, extra) {
    return `<label class="f" for="${id}">${label}<input class="t" id="${id}" name="${id}" type="${type}" autocomplete="${ac}" value="${esc(val)}" data-bind="booking.${id}" ${extra || ""}></label>`;
  }
  function stepDatos(s, b) {
    return `${head(3, "Tus datos", "Los usamos solo para confirmarte la cita.")}
      <form class="stack lg" id="pub-form" novalidate><div class="fgrid two">
        ${field("nombre", "Nombre y apellido", "text", b.nombre, "name")}
        ${field("whatsapp", "WhatsApp", "tel", b.whatsapp, "tel", 'inputmode="tel" placeholder="11 5555 0101"')}
        ${field("email", "Email", "email", b.email, "email", 'inputmode="email" placeholder="tu@email.com"')}
        ${field("zona", "Zona", "text", b.zona, "address-level2", 'placeholder="Ej: Lanús"')}
        <div class="f full"><span>¿Cómo comprás?</span><div class="pills" role="group" aria-label="¿Cómo comprás?">${s.opcionesComoCompra.map((k) =>
          `<button type="button" class="pill" data-act="pub.como" data-v="${esc(k)}" aria-pressed="${b.comoCompra === k}">${esc(k)}</button>`).join("")}</div></div>
        <label class="f full" for="queBusca"><span>¿Qué estás buscando? <span class="hint">(opcional)</span></span><textarea class="t" id="queBusca" name="queBusca" data-bind="booking.queBusca" placeholder="Talles, colores, para qué temporada…">${esc(b.queBusca)}</textarea></label>
      </div>
      <label class="check"><input type="checkbox" data-bind="booking.recordar" ${b.recordar ? "checked" : ""}>Recordar mis datos en este dispositivo</label>
      ${S.ui.formErr ? `<p class="err" role="alert">${esc(S.ui.formErr)}</p>` : ""}
      <button class="btn dark block" type="submit">Ver resumen</button></form>`;
  }

  function antesDeVenir(s, tipo) {
    const li = (ico, txt) => `<p class="row nowrap small" style="align-items:flex-start">${I(ico, 15)}<span>${txt}</span></p>`;
    const minimo = s.compraMinima > 0 ? li("shopping-bag", minimoTxt(s)) : "";
    if (tipo === "video") {
      return `<div class="sumblock"><h3>Antes de la videollamada</h3>
        ${li("video", "Te llamamos por videollamada de WhatsApp al número que dejaste, a la hora de la cita.")}
        ${li("clock", "Dura " + esc(s.duracion) + " min. Conectate a horario.")}${minimo}</div>`;
    }
    return `<div class="sumblock"><h3>Antes de venir</h3>
      ${li("map-pin", esc(s.direccion))}${li("clock", "Solo con cita previa · " + esc(s.duracion) + " min")}${minimo}
      ${s.info ? li("info", esc(s.info)) : ""}</div>`;
  }

  function stepResumen(s, b) {
    const n = b.prendas.length;
    const priced = n > 0 && EG.allPriced(b.prendas, S.prod);
    const blk = (titulo, paso, cuerpo) => `<div class="sumblock white"><div class="cardhead"><h3>${titulo}</h3><button type="button" class="linkbtn" data-act="pub.goto" data-v="${paso}">Editar</button></div>${cuerpo}</div>`;
    return `${head(4, "Revisá tu cita")}
      <div class="resumen2"><div class="stack">
        ${blk("Tu cita", 1, `<dl class="kv"><dt>Tipo</dt><dd>${U.tipoTxt(b)}</dd><dt>Cuándo</dt><dd>${esc(P1(fechaLarga(b.fecha)))}, ${esc(b.hora)} hs</dd>${b.tipo === "presencial" ? `<dt>Dónde</dt><dd>${esc(s.direccion.split(",")[0])}</dd>` : ""}</dl>`)}
        ${blk("Prendas", 2, n
          ? `<div class="stack sm">${b.prendas.map((i) => `<div class="pickrow">${U.thumbs([i], 1)}<span class="grow">${esc(EG.itemName(i, S.prod))}<br><span class="muted xs">Talle ${esc(i.talle)}${EG.priceTxt(S.prod(i.id)) ? " · " + EG.priceTxt(S.prod(i.id)) : ""}</span></span></div>`).join("")}</div>${priced ? `<p class="small"><b>Total: <span class="num">${money(EG.totalOf(b.prendas, S.prod))}</span></b></p>` : ""}`
          : `<p class="small muted">Sin preselección: elegís en la cita.</p>`)}
        ${blk("Tus datos", 3, `<dl class="kv"><dt>Nombre</dt><dd>${esc(b.nombre)}</dd><dt>WhatsApp</dt><dd class="num">${esc(b.whatsapp)}</dd><dt>Email</dt><dd>${esc(b.email)}</dd>${b.zona ? `<dt>Zona</dt><dd>${esc(b.zona)}</dd>` : ""}<dt>Comprás</dt><dd>${esc(b.comoCompra)}</dd>${b.queBusca ? `<dt>Buscás</dt><dd>${esc(b.queBusca)}</dd>` : ""}</dl>`)}
      </div><div class="stack">${antesDeVenir(s, b.tipo)}
        ${S.ui.formErr ? `<p class="err" role="alert">${esc(S.ui.formErr)}</p>` : ""}
        <button type="button" class="btn dark block" data-act="pub.confirmar" ${S.ui.busy ? "disabled" : ""}>${S.ui.busy ? "Confirmando…" : "Confirmar cita"}</button></div></div>`;
  }

  function confirmacion(a) {
    const s = S.db.settings;
    return `<div class="pubwrap narrow"><div class="stack lg center" style="align-items:center">
        <span class="confirm-ico">${I("check", 28)}</span>
        <h1>¡Listo, ${esc(a.nombre.split(" ")[0])}!</h1>
        <p class="muted">Tu cita quedó confirmada para el <b style="color:var(--ink)">${esc(fechaLarga(a.fecha))} a las ${esc(a.hora)} hs</b>.</p></div>
      <div class="sumblock">${a.tipo === "video"
        ? `<h3 class="row">${I("video", 16)}Videollamada por WhatsApp</h3><p class="small">A la hora de la cita te llamamos por videollamada de WhatsApp al <b class="num">${esc(a.whatsapp)}</b>. Tené el celular a mano.</p>`
        : `<h3 class="row">${I("map-pin", 16)}Te esperamos en</h3><p class="small">${esc(s.direccion)}</p>
           <a class="btn dark sm" style="align-self:flex-start" href="${esc(U.mapsLink(s.direccion))}" target="_blank" rel="noopener">${I("navigation", 15)}Cómo llegar</a>`}</div>
      ${a.prendas.length ? `<div class="sumblock"><h3>Vamos a tener listas</h3><ul class="list small">${a.prendas.map((i) => `<li>${esc(EG.itemName(i, S.prod))} · talle ${esc(i.talle)}</li>`).join("")}</ul></div>` : ""}
      <p class="small muted center">${R.mails && a.email ? "Te mandamos la confirmación a tu mail, con un link por si necesitás reprogramar o cancelar. " : ""}Antes de la cita te escribimos por WhatsApp${R.mails && a.email ? "." : ", con un link por si necesitás reprogramar o cancelar."}</p>
      <div class="row" style="justify-content:center">${S.ui.fromPanel ? `<button type="button" class="btn dark" data-act="pub.seePanel">Ver la cita en el panel</button>` : ""}
        <button type="button" class="btn" data-act="pub.restart">Hacer otra reserva</button></div></div>`;
  }

  /* ---------- página de la cita: reprogramar o cancelar ---------- */
  function citaPage() {
    const s = S.db.settings;
    const wrap = (h) => top() + `<main class="pubwrap narrow">${h}</main>`;
    let a;
    if (R.on) {
      if (S.ui.citaRemota === undefined) {
        S.ui.citaRemota = null;
        R.verCita(S.ui.citaId, S.ui.citaToken || "")
          .then((d) => { S.ui.citaRemota = d || false; S.render(); })
          .catch(() => { S.ui.citaRemota = false; S.render(); });
      }
      if (S.ui.citaRemota === null) return wrap(`<p class="muted">Cargando tu cita…</p>`);
      a = S.ui.citaRemota || null;
    } else a = S.db.appts.find((x) => x.id === S.ui.citaId);
    if (!a) {
      return wrap(`<h1>No encontramos tu cita</h1><p class="muted">Revisá el link o escribinos por WhatsApp.</p>
        ${R.on ? "" : `<p class="notice soft">En esta versión de prueba las citas se guardan en el navegador del showroom: el link funciona solo en el mismo equipo.</p>`}
        <button type="button" class="btn dark" data-act="pub.nueva">Reservar una cita</button>`);
    }
    const c = S.ui.cita || (S.ui.cita = { modo: null, fecha: a.fecha, hora: null });
    const datos = `<div class="sumblock"><div class="cardhead"><h3>Tu cita</h3>${U.estadoChip(a)}</div>
      <dl class="kv"><dt>Tipo</dt><dd>${U.tipoTxt(a)}</dd><dt>Día</dt><dd>${esc(fechaLarga(a.fecha))}</dd><dt>Hora</dt><dd>${esc(a.hora)} hs</dd>
      ${a.tipo === "video" ? `<dt>Cómo</dt><dd>Te llamamos por videollamada de WhatsApp</dd>` : `<dt>Dónde</dt><dd>${esc(s.direccion)}</dd>`}</dl></div>`;
    if (a.estado === "cancelada") {
      return wrap(`<h1>Tu cita está cancelada</h1>${datos}<button type="button" class="btn dark" data-act="pub.nueva">Reservar otra cita</button>`);
    }
    if (a.estado !== "confirmada") return wrap(`<h1>Hola, ${esc(a.nombre.split(" ")[0])}</h1>${datos}`);
    const r = EG.reglas(s);
    const puede = EG.puedeCambiar(s, a), reprog = EG.puedeReprogramar(s, a);
    const plazoTxt = r.cambiosHoras > 0 ? `Los cambios online se pueden hacer hasta ${U.plural(r.cambiosHoras, "hora")} antes de la cita.` : "";
    let cuerpo = !puede
      ? `<div class="sumblock"><p class="small">${esc(plazoTxt)} Para cancelar o cambiar el horario, escribinos.</p>${contacto(s)}</div>`
      : `<div class="row">${reprog ? `<button type="button" class="btn dark" data-act="cita.modo" data-v="reprogramar">${I("calendar-days", 16)}Reprogramar</button>` : ""}
      <button type="button" class="btn danger" data-act="cita.modo" data-v="cancelar">Cancelar cita</button></div>
      ${!reprog ? `<p class="small muted">Ya reprogramaste esta cita. Para otro cambio, escribinos por WhatsApp.</p>` : plazoTxt ? `<p class="small muted">${esc(plazoTxt)}</p>` : ""}`;
    if (c.modo === "cancelar") {
      cuerpo = `<div class="sumblock"><h3>¿Cancelamos tu cita?</h3><p class="small muted">El horario queda libre para otra persona.</p>
        <div class="row"><button type="button" class="btn danger" data-act="cita.cancelar">Sí, cancelar</button><button type="button" class="btn" data-act="cita.modo" data-v="">No, volver</button></div></div>`;
    }
    if (c.modo === "reprogramar") {
      const dias = fixFecha(s, c, a.id);
      cuerpo = dias.length
        ? `<div class="stack lg"><h3>Elegí el nuevo día y horario</h3>${daysHtml(s, c.fecha, "cita.date", a.id)}${slotsHtml(s, c.fecha, c.hora, "cita.time", a.id)}
            <div class="row"><button type="button" class="btn dark" data-act="cita.guardar" ${c.hora ? "" : "disabled"}>Confirmar cambio</button><button type="button" class="btn" data-act="cita.modo" data-v="">Volver</button></div></div>`
        : `<p class="empty">No hay días disponibles por ahora.</p>`;
    }
    return wrap(`<h1>Hola, ${esc(a.nombre.split(" ")[0])}</h1>${datos}${cuerpo}`);
  }

  /* ---------- vista ---------- */
  EG.views.publico = function () {
    const ui = S.ui, s = S.db.settings, b = ui.booking, st = ui.step;
    if (ui.splash) return `<div class="splash">${U.logo(s, "xl")}</div>`;
    if (ui.route === "cita") return citaPage();
    if (ui.done) return top() + confirmacion(ui.done);
    if (!EG.reglas(s).abierta) {
      return top() + `<main class="pubwrap narrow"><h1>Por ahora no estamos tomando reservas</h1>
        <p class="muted">Volvé a entrar en unos días. Si tenés una consulta, escribinos.</p>${contacto(s)}</main>`;
    }
    const pasos = [stepTipo, stepFecha, stepPrendas, stepDatos, stepResumen];
    return top() + `<main class="pubwrap${st === 0 || st >= 3 ? " narrow" : ""}">${pasos[st](s, b)}</main>`;
  };

  /* ---------- acciones ---------- */
  const A = EG.actions;
  A["pub.type"] = (el) => { S.ui.booking.tipo = el.dataset.v; };
  A["pub.next"] = () => {
    const b = S.ui.booking, st = S.ui.step;
    if ((st === 0 && !b.tipo) || (st === 1 && !b.hora)) return false;
    S.ui.step = Math.min(4, st + 1);
    S.ui.formErr = "";
    return "top";
  };
  A["pub.sinPrendas"] = () => {
    const b = S.ui.booking;
    if (!b.hora) return false;
    b.prendas = []; S.ui.step = 3; S.ui.formErr = "";
    return "top";
  };
  A["pub.back"] = () => { S.ui.step = Math.max(0, S.ui.step - 1); S.ui.formErr = ""; return "top"; };
  A["pub.goto"] = (el) => { S.ui.step = +el.dataset.v; S.ui.formErr = ""; return "top"; };
  A["pub.date"] = (el) => { S.ui.booking.fecha = el.dataset.v; S.ui.booking.hora = null; S.ui.slotMsg = ""; };
  A["pub.time"] = (el) => { S.ui.booking.hora = el.dataset.v; S.ui.slotMsg = ""; };
  A["pub.cat"] = (el) => { S.ui.cat = el.dataset.v; };
  A["pub.como"] = (el) => { S.ui.booking.comoCompra = el.dataset.v; S.ui.formErr = ""; };

  function refreshPrendas(id) {
    const b = S.ui.booking;
    const sel = b.prendas.find((i) => i.id === id);
    const card = document.querySelector('[data-card="' + CSS.escape(id) + '"]');
    if (card) {
      card.classList.toggle("sel", !!sel);
      card.querySelectorAll(".size").forEach((btn) => btn.setAttribute("aria-pressed", String(!!sel && sel.talle === btn.dataset.v)));
      const ph = card.querySelector(".ph");
      let tag = ph.querySelector(".tag");
      if (sel) {
        if (!tag) { tag = document.createElement("span"); tag.className = "chip tag"; ph.appendChild(tag); }
        tag.textContent = "Talle " + sel.talle;
      } else if (tag) tag.remove();
    }
    const sticky = document.getElementById("sticky");
    if (sticky) sticky.innerHTML = stickyInner();
    const side = document.getElementById("sidepanel");
    if (side) side.innerHTML = sideInner();
  }
  // Sumar o quitar una prenda sin redibujar toda la grilla (evita parpadeo de las fotos).
  A["pub.size"] = (el) => {
    const b = S.ui.booking, id = el.dataset.p, talle = el.dataset.v;
    const ex = b.prendas.find((i) => i.id === id);
    if (ex && ex.talle === talle) b.prendas = b.prendas.filter((i) => i !== ex);
    else if (ex) ex.talle = talle;
    else b.prendas.push({ id, nombre: (S.prod(id) || {}).nombre || "", talle, seLlevo: null });
    refreshPrendas(id);
    return false;
  };
  A["pub.quitar"] = (el) => {
    S.ui.booking.prendas = S.ui.booking.prendas.filter((i) => i.id !== el.dataset.p);
    refreshPrendas(el.dataset.p);
    return false;
  };

  A["pub.restart"] = () => { resetBooking(); return "top"; };
  A["pub.nueva"] = () => { resetBooking(); S.go("reservar"); return false; };
  A["pub.backPanel"] = () => { resetBooking(); S.ui.fromPanel = false; S.go("inicio"); return false; };
  A["pub.seePanel"] = () => {
    const a = S.ui.done;
    S.ui.agDesde = ""; S.ui.agHasta = "";
    S.ui.open = a.id;
    resetBooking();
    S.ui.fromPanel = false;
    S.go("agenda");
    return false;
  };

  EG.submits["pub-form"] = () => {
    const ui = S.ui, b = ui.booking;
    const fail = (m) => { ui.formErr = m; };
    if (b.nombre.trim().length < 2) return fail("Escribí tu nombre y apellido.");
    if (!EG.normalizePhone(b.whatsapp)) return fail("Revisá el WhatsApp: escribilo con código de área, por ejemplo 11 5555 0101.");
    if (!/^\S+@\S+\.\S+$/.test(b.email.trim())) return fail("Revisá el email, parece incompleto.");
    if (!b.comoCompra) return fail("Elegí cómo comprás.");
    ui.formErr = "";
    ui.step = 4;
    return "top";
  };

  A["pub.confirmar"] = () => {
    const ui = S.ui, b = ui.booking, s = S.db.settings;
    const wa = EG.normalizePhone(b.whatsapp);
    if (!wa || !b.comoCompra) { ui.step = 3; return "top"; }
    if (!EG.isSlotFree(s, S.db.appts, b.fecha, b.hora, null, S.db.bloqueos) || !EG.dentroDePlazo(s, b.fecha, b.hora)) {
      b.hora = null;
      ui.step = 1;
      ui.slotMsg = "Ese horario se acaba de ocupar. Elegí otro.";
      return "top";
    }
    const datos = { nombre: b.nombre.trim(), whatsapp: wa, email: b.email.trim(), zona: b.zona.trim(), comoCompra: b.comoCompra };
    const prendas = b.prendas.map((i) => ({ id: i.id, nombre: EG.itemName(i, S.prod), talle: i.talle, seLlevo: null }));
    if (R.on) {
      if (ui.busy) return false;
      ui.busy = true;
      R.reservar(Object.assign({ fecha: b.fecha, hora: b.hora, tipo: b.tipo, queBusca: b.queBusca.trim(), prendas }, datos))
        .then(async (r) => {
          ui.busy = false;
          if (r.error) {
            await R.refreshOcupados().catch(() => {});
            b.hora = null; ui.step = 1;
            ui.slotMsg = MOTIVOS[r.error] || "Ese horario ya no está disponible. Elegí otro.";
          } else {
            R.notify("reserva", r.id, r.token);
            guardarDatos(b);
            ui.done = Object.assign({ id: r.id, _token: r.token, sala: r.sala, fecha: b.fecha, hora: b.hora, tipo: b.tipo, estado: "confirmada", prendas }, datos);
            if (R.panel) R.loadPanel().catch(() => {});
            else R.refreshOcupados().catch(() => {});
          }
          S.render({ top: true });
        })
        .catch((e) => { console.error("reservar", e); ui.busy = false; ui.formErr = "No pudimos confirmar la cita. Revisá tu conexión y probá de nuevo."; S.render(); });
      S.render();
      return false;
    }
    const c = EG.upsertClienta(S.db, datos);
    const a = Object.assign({
      id: EG.uid(), fecha: b.fecha, hora: b.hora, tipo: b.tipo, estado: "confirmada", queBusca: b.queBusca.trim(),
      prendas: b.prendas.map((i) => ({ id: i.id, nombre: EG.itemName(i, S.prod), talle: i.talle, seLlevo: null })),
      notas: "", sala: b.tipo === "video" ? "showroom-" + EG.uid(14) : null, creada: new Date().toISOString(),
      clientaId: c.id, origen: "clienta"
    }, datos);
    S.db.appts.push(a);
    S.save();
    guardarDatos(b);
    ui.done = a;
    return "top";
  };

  /* página de la cita */
  A["cita.modo"] = (el) => { const c = S.ui.cita; c.modo = el.dataset.v || null; c.hora = null; };
  A["cita.date"] = (el) => { S.ui.cita.fecha = el.dataset.v; S.ui.cita.hora = null; };
  A["cita.time"] = (el) => { S.ui.cita.hora = el.dataset.v; };
  A["cita.cancelar"] = () => {
    if (R.on) {
      R.cancelarCita(S.ui.citaId, S.ui.citaToken).then((r) => {
        if (r && r.ok) { R.notify("cambio", S.ui.citaId, S.ui.citaToken); S.ui.citaRemota.estado = "cancelada"; S.ui.cita = null; S.toast("Tu cita quedó cancelada."); }
        else S.toast(MOTIVOS[r && r.error] || "No se pudo cancelar. Escribinos por WhatsApp.");
        S.render();
      });
      return false;
    }
    const a = S.db.appts.find((x) => x.id === S.ui.citaId);
    if (!EG.puedeCambiar(S.db.settings, a)) { S.toast(MOTIVOS.fuera_de_plazo); return; }
    a.estado = "cancelada";
    S.ui.cita = null;
    S.save();
    S.toast("Tu cita quedó cancelada.");
  };
  A["cita.guardar"] = () => {
    if (R.on) {
      const a = S.ui.citaRemota, c = S.ui.cita;
      R.reprogramarCita(a.id, S.ui.citaToken, c.fecha, c.hora).then(async (r) => {
        if (r && r.ok) { R.notify("cambio", a.id, S.ui.citaToken); a.fecha = c.fecha; a.hora = c.hora; a.reprogramaciones = (Number(a.reprogramaciones) || 0) + 1; S.ui.cita = null; S.toast("Listo: tu cita quedó para el " + fechaLarga(a.fecha) + " a las " + a.hora + " hs."); }
        else { c.hora = null; await R.refreshOcupados().catch(() => {}); S.toast(MOTIVOS[r && r.error] || "Ese horario ya no está disponible. Elegí otro."); }
        S.render();
      });
      return false;
    }
    const a = S.db.appts.find((x) => x.id === S.ui.citaId), c = S.ui.cita, s = S.db.settings;
    if (!EG.isSlotFree(s, S.db.appts, c.fecha, c.hora, null, S.db.bloqueos, a.id) || !EG.dentroDePlazo(s, c.fecha, c.hora)) { S.toast("Ese horario ya no está disponible. Elegí otro."); c.hora = null; return; }
    if (!EG.puedeReprogramar(s, a)) { S.toast(MOTIVOS.limite_reprogramaciones); return; }
    a.reprogramaciones = (Number(a.reprogramaciones) || 0) + 1;
    a.fecha = c.fecha;
    a.hora = c.hora;
    S.ui.cita = null;
    S.save();
    S.toast("Listo: tu cita quedó para el " + fechaLarga(a.fecha) + " a las " + a.hora + " hs.");
  };
  window.addEventListener("hashchange", () => { S.ui.cita = null; S.ui.citaRemota = undefined; });
})();
