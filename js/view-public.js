// Vista pública (clienta): tipo de cita, día y horario, preselección de prendas, datos y confirmación.
(function () {
  "use strict";
  const EG = window.EG;
  const S = EG.S;
  const U = EG.ui;
  const { esc, money, fechaLarga, DIAS, MESES, icon: I } = EG;

  const COMO_COMPRA = ["1ra compra", "Emprendimiento", "Revendedora", "Comercio", "Uso personal"];
  const newBooking = () => ({ tipo: null, fecha: null, hora: null, prendas: [], nombre: "", whatsapp: "", email: "", comoCompra: "", queBusca: "" });
  S.ui.booking = newBooking();

  function resetBooking() {
    S.ui.booking = newBooking();
    S.ui.step = 0;
    S.ui.done = null;
    S.ui.formErr = "";
    S.ui.slotMsg = "";
  }

  /* ---------- piezas ---------- */
  function header() {
    const s = S.db.settings;
    return `<header class="header"><div class="brand">
      ${S.ui.fromPanel ? `<button class="iconbtn" type="button" data-act="pub.backPanel" aria-label="Volver al panel">${I("chevron-left", 20)}</button>` : ""}
      <span class="avatar-e">${esc(U.inicial(s.nombre))}</span><b>${esc(s.nombre)}</b></div></header>`;
  }

  const perfil = (s) =>
    `<div class="pubhead"><span class="avatar-e lg">${esc(U.inicial(s.nombre))}</span><h1>${esc(s.nombre)}</h1></div>`;

  function infoBloque(s) {
    const minimo = s.compraMinima > 0
      ? `<p class="infoline">${I("shopping-bag", 16)}<span>Compra mínima <b>${money(s.compraMinima)}</b>${s.compraMinimaNota ? " (" + esc(s.compraMinimaNota) + ")" : ""}</span></p>`
      : "";
    return `<div class="softbox"><h3 style="font-size:15px;margin-bottom:5px">Visita al showroom</h3>
        <p class="infoline muted small">${I("map-pin", 15)}<span>${esc(s.direccion)}</span></p></div>
      <div class="stack" style="gap:10px"><h2>Información</h2><p class="infoline">${I("info", 16)}<span>${esc(s.info)}</span></p>${minimo}</div>`;
  }

  const stepsBar = (st) => `<div class="steps" aria-hidden="true">${[0, 1, 2, 3].map((i) => `<span class="${i <= st ? "on" : ""}"></span>`).join("")}</div>`;

  const opt = (v, ico, titulo, desc, sel) =>
    `<button type="button" class="opt" data-act="pub.type" data-v="${v}" aria-pressed="${sel}"><span class="ico-wrap">${I(ico, 20)}</span><span><h3>${titulo}</h3><span class="small muted">${desc}</span></span></button>`;

  /* ---------- pasos ---------- */
  function stepTipo(s, b) {
    return `<h2>¿Cómo querés conocer la colección?</h2><div class="choice">
      ${opt("presencial", "map-pin", "Visita al showroom", s.duracion + " min · Ves y tocás las prendas en persona", b.tipo === "presencial")}
      ${opt("video", "video", "Videollamada", s.duracion + " min · Te mostramos las prendas en vivo, desde donde estés", b.tipo === "video")}
      </div><button type="button" class="btn primary block" data-act="pub.next" ${b.tipo ? "" : "disabled"}>Elegir día y horario</button>`;
  }

  function stepFecha(s, b) {
    const dias = EG.nextDays(s, 10);
    if (!dias.length) return `<h2>Elegí día y horario</h2><p class="softbox muted">Por ahora el showroom no tiene días de atención disponibles.</p>`;
    const libre = (d) => EG.slotsFor(s, S.db.appts, d).some((x) => !x.off);
    if (!b.fecha || dias.indexOf(b.fecha) < 0) b.fecha = dias.find(libre) || dias[0];
    const slots = EG.slotsFor(s, S.db.appts, b.fecha);
    return `<h2>Elegí día y horario</h2>
      <div class="days" data-keepscroll="dias" role="group" aria-label="Día">${dias.map((d) => {
        const x = EG.parseYmd(d);
        return `<button type="button" class="day" data-act="pub.date" data-v="${d}" aria-pressed="${b.fecha === d}" ${libre(d) ? "" : "disabled"} aria-label="${esc(fechaLarga(d))}"><span class="small">${DIAS[x.getDay()]}</span><b>${x.getDate()}</b><span class="small">${MESES[x.getMonth()]}</span></button>`;
      }).join("")}</div>
      ${S.ui.slotMsg ? `<p class="notice bad" role="alert">${esc(S.ui.slotMsg)}</p>` : ""}
      ${slots.some((x) => !x.off)
        ? `<div class="slots" role="group" aria-label="Horario">${slots.map((x) => `<button type="button" class="slot num" data-act="pub.time" data-v="${x.h}" ${x.off ? "disabled" : ""} aria-pressed="${b.hora === x.h}">${x.h}</button>`).join("")}</div>`
        : `<p class="softbox muted">No quedan horarios este día. Probá con otro.</p>`}
      <button type="button" class="btn primary block" data-act="pub.next" ${b.hora ? "" : "disabled"}>Elegir prendas</button>`;
  }

  function prodCard(p, b) {
    const sel = b.prendas.find((i) => i.id === p.id);
    return `<div class="prod${sel ? " sel" : ""}" data-card="${esc(p.id)}"><div class="ph">${U.photo(p)}${sel ? `<span class="chip tag">Elegida · T${esc(sel.talle)}</span>` : ""}</div>
      <div class="body"><h3>${esc(p.nombre)}</h3><p class="num small muted">${EG.priceTxt(p)}</p>
      <div class="sizes" role="group" aria-label="Talles de ${esc(p.nombre)}">${p.talles.map((z) =>
        `<button type="button" class="size" data-act="pub.size" data-p="${esc(p.id)}" data-v="${esc(z)}" aria-label="Talle ${esc(z)}" aria-pressed="${!!sel && sel.talle === z}">${esc(z)}</button>`).join("")}</div></div></div>`;
  }

  function stickyInner() {
    const s = S.db.settings, b = S.ui.booking;
    const n = b.prendas.length;
    const tot = EG.totalOf(b.prendas, S.prod);
    const priced = n > 0 && EG.allPriced(b.prendas, S.prod);
    const hayMinimo = s.compraMinima > 0;
    const pct = priced && hayMinimo ? Math.min(100, (tot / s.compraMinima) * 100) : 0;
    const cuando = b.tipo === "video" ? "llamada" : "visita";
    return `<div class="row between"><span class="small"><b>${n}</b> prenda${n === 1 ? "" : "s"}${priced ? ` · <span class="num">${money(tot)}</span>` : ""}</span>
      ${hayMinimo ? `<span class="small muted num">Compra mínima ${money(s.compraMinima)}</span>` : ""}</div>
      ${priced && hayMinimo
        ? `<div class="meter${pct >= 100 ? " full" : ""}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}"><i style="width:${pct}%"></i></div>
           <p class="small ${pct >= 100 ? "" : "muted"}">${pct >= 100 ? "Tu selección ya llega a la compra mínima." : `Te faltan <span class="num">${money(s.compraMinima - tot)}</span> para la compra mínima. Podés sumar más en la ${cuando}.`}</p>`
        : ""}
      <button type="button" class="btn primary block" data-act="pub.next">${n ? "Seguir" : "Seguir sin elegir"}</button>`;
  }

  function stepPrendas(s, b) {
    const lista = S.db.products.filter((p) => p.categoria === S.ui.cat);
    return `<div><h2>Elegí las prendas que querés ver</h2>
      <p class="muted small">Las tenemos listas para tu ${b.tipo === "video" ? "videollamada" : "visita"}. Tocá un talle para sumarla; tocalo de nuevo para quitarla.</p></div>
      ${U.cats(S.ui.cat, "pub.cat")}
      ${lista.length ? `<div class="grid">${lista.map((p) => prodCard(p, b)).join("")}</div>` : `<p class="softbox muted">Todavía no hay prendas en esta categoría.</p>`}
      <div class="sticky stack" id="sticky">${stickyInner()}</div>`;
  }

  function field(id, label, type, val, ac, extra) {
    return `<label class="f" for="${id}">${label}<input class="t" id="${id}" name="${id}" type="${type}" autocomplete="${ac}" value="${esc(val)}" data-bind="booking.${id}" ${extra || ""}></label>`;
  }

  function stepDatos(s, b) {
    const n = b.prendas.length;
    const priced = n > 0 && EG.allPriced(b.prendas, S.prod);
    return `<h2>Tus datos</h2><form class="stack" id="pub-form" novalidate>
      ${field("nombre", "Nombre y apellido", "text", b.nombre, "name")}
      ${field("whatsapp", "WhatsApp (con código de área)", "tel", b.whatsapp, "tel", 'inputmode="tel" placeholder="11 5555 0101"')}
      ${field("email", "Email", "email", b.email, "email", 'inputmode="email"')}
      <label class="f" for="comoCompra">¿Cómo comprás?<select class="t" id="comoCompra" name="comoCompra" data-bind="booking.comoCompra">
        <option value="" ${b.comoCompra ? "" : "selected"} disabled>Elegí una opción</option>${COMO_COMPRA.map((k) => `<option${b.comoCompra === k ? " selected" : ""}>${k}</option>`).join("")}</select></label>
      <label class="f" for="queBusca">¿Qué estás buscando? (opcional)<textarea class="t" id="queBusca" name="queBusca" data-bind="booking.queBusca" placeholder="Talles, colores, para qué temporada…">${esc(b.queBusca)}</textarea></label>
      ${S.ui.formErr ? `<p class="err" role="alert">${esc(S.ui.formErr)}</p>` : ""}
      <div class="softbox stack small"><div class="label">Resumen</div><dl class="kv">
        <dt>Cita</dt><dd>${U.tipoTxt({ tipo: b.tipo })}</dd>
        <dt>Cuándo</dt><dd>${esc(fechaLarga(b.fecha))}, ${esc(b.hora)} hs</dd>
        <dt>Prendas</dt><dd>${n}${priced ? ` · <span class="num">${money(EG.totalOf(b.prendas, S.prod))}</span>` : ""}${n
          ? `<ul class="picked">${b.prendas.map((i) => `<li>${esc(EG.itemName(i, S.prod))} · talle ${esc(i.talle)}</li>`).join("")}</ul>` : ""}</dd></dl></div>
      <button class="btn primary block" type="submit">Confirmar cita</button></form>`;
  }

  function confirmacion(a) {
    const s = S.db.settings;
    return `<span class="chip ok" style="align-self:flex-start">${I("circle-check", 14)} Cita confirmada</span>
      <h2 style="font-size:26px;font-weight:800;letter-spacing:-.02em">¡Listo, ${esc(a.nombre.split(" ")[0])}!</h2>
      <dl class="kv"><dt>Cita</dt><dd>${U.tipoTxt(a)}</dd>
        <dt>Cuándo</dt><dd>${esc(fechaLarga(a.fecha))}, ${esc(a.hora)} hs</dd>
        ${a.tipo === "video"
          ? `<dt>Link</dt><dd><a href="${esc(EG.videoLink(a))}" target="_blank" rel="noopener">${esc(EG.videoLink(a))}</a></dd>`
          : `<dt>Dónde</dt><dd>${esc(s.direccion)}</dd>`}
        <dt>Prendas</dt><dd>${a.prendas.length ? a.prendas.length + " elegida" + (a.prendas.length === 1 ? "" : "s") : "Sin preselección"}</dd></dl>
      <div class="row">${S.ui.fromPanel ? `<button type="button" class="btn primary grow" data-act="pub.seePanel">Ver la cita en el panel</button>` : ""}
        <button type="button" class="btn ${S.ui.fromPanel ? "" : "primary "}grow" data-act="pub.restart">Nueva reserva</button></div>`;
  }

  /* ---------- vista ---------- */
  EG.views.publico = function () {
    const ui = S.ui, s = S.db.settings, b = ui.booking, st = ui.step;
    const card = (cabecera, cuerpo) =>
      header() + `<main class="page public"><div class="pubcard">${cabecera}<div class="pubbody">${cuerpo}</div></div></main>`;
    if (ui.done) return card(perfil(s), confirmacion(ui.done));
    let h = "";
    if (st === 0) h += infoBloque(s);
    h += stepsBar(st);
    if (st > 0) h += `<button type="button" class="btn sm" data-act="pub.back" style="align-self:flex-start">${I("chevron-left", 16)}Volver</button>`;
    if (st === 0) h += stepTipo(s, b);
    if (st === 1) h += stepFecha(s, b);
    if (st === 2) h += stepPrendas(s, b);
    if (st === 3) h += stepDatos(s, b);
    return card(st === 0 ? perfil(s) : "", h);
  };

  /* ---------- acciones ---------- */
  const A = EG.actions;
  A["pub.type"] = (el) => { S.ui.booking.tipo = el.dataset.v; };
  A["pub.next"] = () => {
    const b = S.ui.booking, st = S.ui.step;
    if ((st === 0 && !b.tipo) || (st === 1 && !b.hora)) return false;
    S.ui.step = st + 1;
    S.ui.formErr = "";
    return "top";
  };
  A["pub.back"] = () => { S.ui.step = Math.max(0, S.ui.step - 1); S.ui.formErr = ""; return "top"; };
  A["pub.date"] = (el) => { S.ui.booking.fecha = el.dataset.v; S.ui.booking.hora = null; S.ui.slotMsg = ""; };
  A["pub.time"] = (el) => { S.ui.booking.hora = el.dataset.v; S.ui.slotMsg = ""; };
  A["pub.cat"] = (el) => { S.ui.cat = el.dataset.v; };

  // Sumar o quitar una prenda sin redibujar toda la grilla (evita parpadeo de las fotos).
  A["pub.size"] = (el) => {
    const b = S.ui.booking, id = el.dataset.p, talle = el.dataset.v;
    const ex = b.prendas.find((i) => i.id === id);
    if (ex && ex.talle === talle) b.prendas = b.prendas.filter((i) => i !== ex);
    else if (ex) ex.talle = talle;
    else b.prendas.push({ id, nombre: (S.prod(id) || {}).nombre || "", talle, seLlevo: null });
    const card = document.querySelector('[data-card="' + CSS.escape(id) + '"]');
    const sel = b.prendas.find((i) => i.id === id);
    if (card) {
      card.classList.toggle("sel", !!sel);
      card.querySelectorAll(".size").forEach((btn) => btn.setAttribute("aria-pressed", String(!!sel && sel.talle === btn.dataset.v)));
      const ph = card.querySelector(".ph");
      let tag = ph.querySelector(".tag");
      if (sel) {
        if (!tag) { tag = document.createElement("span"); tag.className = "chip tag"; ph.appendChild(tag); }
        tag.textContent = "Elegida · T" + sel.talle;
      } else if (tag) tag.remove();
    }
    const sticky = document.getElementById("sticky");
    if (sticky) sticky.innerHTML = stickyInner();
    return false;
  };

  A["pub.restart"] = () => { resetBooking(); return "top"; };
  A["pub.backPanel"] = () => { resetBooking(); S.ui.fromPanel = false; S.go("inicio"); return false; };
  A["pub.seePanel"] = () => {
    const a = S.ui.done;
    S.ui.day = a.fecha;
    S.ui.open = a.id;
    resetBooking();
    S.ui.fromPanel = false;
    S.go("agenda");
    return false;
  };

  EG.submits["pub-form"] = () => {
    const ui = S.ui, b = ui.booking, s = S.db.settings;
    const fail = (m) => { ui.formErr = m; };
    if (b.nombre.trim().length < 2) return fail("Escribí tu nombre.");
    const wa = EG.normalizePhone(b.whatsapp);
    if (!wa) return fail("Revisá el WhatsApp: escribilo con código de área, por ejemplo 11 5555 0101.");
    if (!b.comoCompra) return fail("Elegí cómo comprás.");
    if (!/^\S+@\S+\.\S+$/.test(b.email.trim())) return fail("Revisá el email, parece incompleto.");
    if (!EG.isSlotFree(s, S.db.appts, b.fecha, b.hora)) {
      b.hora = null;
      ui.step = 1;
      ui.formErr = "";
      ui.slotMsg = "Ese horario se acaba de ocupar. Elegí otro.";
      return "top";
    }
    ui.formErr = "";
    const a = {
      id: EG.uid(), fecha: b.fecha, hora: b.hora, tipo: b.tipo, estado: "confirmada",
      nombre: b.nombre.trim(), whatsapp: wa, email: b.email.trim(), comoCompra: b.comoCompra, queBusca: b.queBusca.trim(),
      prendas: b.prendas.map((i) => ({ id: i.id, nombre: EG.itemName(i, S.prod), talle: i.talle, seLlevo: null })),
      notas: "", sala: b.tipo === "video" ? "showroom-" + EG.uid(14) : null, creada: new Date().toISOString()
    };
    S.db.appts.push(a);
    S.save();
    ui.done = a;
    return "top";
  };
})();
