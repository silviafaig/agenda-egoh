// Panel: Métricas por período (semana, mes o personalizado), comparadas con el período anterior.
(function () {
  "use strict";
  const EG = window.EG;
  const S = EG.S;
  const U = EG.ui;
  const P = EG.panel;
  const { esc, money, DIAS, MESES, icon: I } = EG;

  function periodo() {
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    if (S.ui.metPer === "mes") {
      const d = new Date(hoy.getFullYear(), hoy.getMonth(), 1), h = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
      return [EG.ymd(d), EG.ymd(h), "Este mes"];
    }
    if (S.ui.metPer === "custom") {
      const d = S.ui.metDesde || P.addDays(EG.ymd(hoy), -29), h = S.ui.metHasta || EG.ymd(hoy);
      return [d, h < d ? d : h, "Período elegido"];
    }
    const lun = new Date(hoy.getTime()); lun.setDate(lun.getDate() - ((lun.getDay() + 6) % 7));
    return [EG.ymd(lun), P.addDays(EG.ymd(lun), 6), "Esta semana"];
  }
  const corta = (ymd) => { const d = EG.parseYmd(ymd); return d.getDate() + " " + MESES[d.getMonth()]; };

  function delta(a, b, invertir) {
    if (a === b) return `<span class="delta">= que el período anterior</span>`;
    const sube = a > b;
    const bueno = invertir ? !sube : sube;
    return `<span class="delta ${bueno ? "up" : "down"}">${sube ? "▲" : "▼"} ${Math.abs(a - b)} vs. anterior (${b})</span>`;
  }
  const stat = (label, val, prev, opts) => {
    const o = opts || {};
    return `<div class="stat"><span class="small muted">${label}</span><b class="num">${o.fmt ? o.fmt(val) : val}${o.suf || ""}</b>${prev === undefined ? "" : delta(val, prev, o.invertir)}</div>`;
  };
  const dual = (e, l, max) => `<span class="dual" aria-label="${e} elegidas, ${l} llevadas"><span class="meter"><i style="width:${max ? (e / max) * 100 : 0}%"></i></span><span class="meter"><i class="alt" style="width:${max ? (l / max) * 100 : 0}%"></i></span></span>`;
  const cnt = (e, l) => `<span class="xs num muted" style="min-width:74px;text-align:right">${e} · ${l}</span>`;

  function prendasTree(m) {
    if (!m.prendas.length) return `<p class="small muted">Todavía no hay prendas elegidas en este período.</p>`;
    const max = m.prendas[0].elegidas;
    return `<div class="legend"><span><i style="background:var(--accent)"></i>Elegidas</span><span><i style="background:var(--ink)"></i>Llevadas</span><span>Números: elegidas · llevadas</span></div>
      <div>${m.prendas.map((mod) => `<details class="tree"><summary><span class="nm b">${esc(mod.nombre)}</span>${dual(mod.elegidas, mod.llevadas, max)}${cnt(mod.elegidas, mod.llevadas)}</summary>
        <div class="lvl">${mod.colores.map((c) => `<details class="tree"><summary><span class="nm">${esc(c.nombre)}</span>${dual(c.elegidas, c.llevadas, max)}${cnt(c.elegidas, c.llevadas)}</summary>
          ${c.talles.map((t) => `<div class="tleaf"><span class="small">Talle ${esc(t.nombre)}</span>${dual(t.elegidas, t.llevadas, max)}${cnt(t.elegidas, t.llevadas)}</div>`).join("")}</details>`).join("")}</div></details>`).join("")}</div>`;
  }

  function bars(items, fmt) {
    const max = Math.max(1, ...items.map((x) => x.n));
    return `<div class="bars">${items.map((x) => `<div class="barrow"><span>${esc(x.label)}</span><span class="meter"><i style="width:${(x.n / max) * 100}%"></i></span><span class="num small">${fmt ? fmt(x) : x.n}</span></div>`).join("")}</div>`;
  }

  P.VISTAS.metricas = () => {
    const [desde, hasta, nombre] = periodo();
    const [pd, ph] = EG.periodoAnterior(desde, hasta);
    const m = EG.metricas(S.db, desde, hasta, S.prod);
    const p = EG.metricas(S.db, pd, ph, S.prod);
    const per = S.ui.metPer;
    const c = m.citas, pc = p.citas;
    const dias = [1, 2, 3, 4, 5, 6, 0].map((i) => ({ label: DIAS[i], n: m.dias[i] })).filter((x, i) => x.n || i < 5);
    const totalCl = m.clientas.nuevas + m.clientas.vuelven;
    return `${P.title("Métricas", `${nombre} · ${corta(desde)} al ${corta(hasta)} · comparado con ${corta(pd)} al ${corta(ph)}`)}
      <div class="toolbar"><div class="seg" role="group" aria-label="Período">
        <button type="button" data-act="met.per" data-v="semana" aria-pressed="${per === "semana"}">Semana</button>
        <button type="button" data-act="met.per" data-v="mes" aria-pressed="${per === "mes"}">Mes</button>
        <button type="button" data-act="met.per" data-v="custom" aria-pressed="${per === "custom"}">Personalizado</button></div>
        ${per === "custom" ? `<div class="daterange"><input class="t num" type="date" value="${desde}" data-change="met.desde" aria-label="Desde"><span class="muted">a</span><input class="t num" type="date" value="${hasta}" data-change="met.hasta" aria-label="Hasta"></div>` : ""}</div>
      <div class="stack lg">
        <section class="stack"><h2>Citas</h2><div class="stats" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr))">
          ${stat("Visitas reservadas", c.visitas, pc.visitas)}${stat("Confirmadas (por venir)", c.confirmadas)}${stat("Asistencias", c.asistencias, pc.asistencias)}
          ${stat("Cancelaciones", c.cancelaciones, pc.cancelaciones, { invertir: true })}${stat("Faltazos", c.faltazos, pc.faltazos, { invertir: true })}
          ${stat("Conversión", c.conversion, pc.conversion, { suf: "%" })}</div>
          <p class="xs muted">Conversión: asistencias en las que se llevó al menos una prenda, sobre el total de asistencias.</p></section>
        <section class="stack"><h2>Montos</h2>${m.montos.activos
          ? `<div class="stats">${stat("Preseleccionado", m.montos.preseleccionado, undefined, { fmt: money })}${stat("Vendido", m.montos.vendido, undefined, { fmt: money })}${stat("Ticket promedio", m.montos.ticket, undefined, { fmt: money })}</div>
             <p class="xs muted">Solo cuenta las prendas que tienen precio cargado.</p>`
          : `<p class="empty">Se activan cuando las prendas tengan precio. <button type="button" class="linkbtn" data-act="nav" data-v="catalogo">Cargar precios</button></p>`}</section>
        <div class="mgrid">
          <section class="card stack"><h3>Presencial vs. videollamada</h3>
            <dl class="kv"><dt>${I("map-pin", 14)} Presencial</dt><dd><b class="num">${U.plural(m.tipo.presencial.citas, "cita")}</b> · ${m.tipo.presencial.conversion}% conversión</dd>
            <dt>${I("video", 14)} Videollamada</dt><dd><b class="num">${U.plural(m.tipo.video.citas, "cita")}</b> · ${m.tipo.video.conversion}% conversión</dd></dl></section>
          <section class="card stack"><h3>Clientas nuevas y las que vuelven</h3>
            ${totalCl ? `${bars([{ label: "Nuevas", n: m.clientas.nuevas }, { label: "Vuelven", n: m.clientas.vuelven }])}` : `<p class="small muted">Sin citas en el período.</p>`}</section>
          <section class="card stack"><h3>Tipo de clienta</h3>
            ${m.tiposClienta.length ? bars(m.tiposClienta.map((t) => ({ label: t.nombre, n: t.citas, conv: t.conversion })), (x) => x.n + " · " + x.conv + "%") + `<p class="xs muted">Citas · conversión</p>` : `<p class="small muted">Sin citas en el período.</p>`}</section>
          <section class="card stack full"><h3>Prendas: elegidas contra llevadas</h3>
            ${m.alertas.length ? `<div class="notice">${I("triangle-alert", 15)} Se eligen mucho y se llevan poco: ${m.alertas.map((a) => `<b>${esc(a.nombre)}</b> (${a.llevadas} de ${a.elegidas})`).join(", ")}.</div>` : ""}
            <p class="xs muted">Tocá un modelo para ver sus colores, y un color para ver sus talles.</p>${prendasTree(m)}</section>
          <section class="card stack"><h3>Días más pedidos</h3>${bars(dias)}</section>
          <section class="card stack"><h3>Horarios más pedidos</h3>${m.horas.length ? bars(m.horas.map((h) => ({ label: h.h, n: h.n }))) : `<p class="small muted">Sin citas en el período.</p>`}</section>
        </div></div>`;
  };

  const A = EG.actions;
  A["met.per"] = (el) => { S.ui.metPer = el.dataset.v; };
  EG.changes["met.desde"] = (t) => { S.ui.metDesde = t.value; };
  EG.changes["met.hasta"] = (t) => { S.ui.metHasta = t.value; };
})();
