// Panel: Clientas (lista / tabla) y Ficha de clienta.
(function () {
  "use strict";
  const EG = window.EG;
  const S = EG.S;
  const U = EG.ui;
  const P = EG.panel;
  const { esc, fechaLarga, icon: I } = EG;

  const fechaCorta = (ymd) => { if (!ymd) return "—"; const d = EG.parseYmd(ymd); return d.getDate() + " " + EG.MESES[d.getMonth()] + " " + String(d.getFullYear()).slice(2); };
  const desde = (iso) => { if (!iso) return "—"; const d = new Date(iso); return isNaN(d) ? "—" : EG.MESES[d.getMonth()] + " " + d.getFullYear(); };

  function lista() {
    const filtro = S.ui.clFiltro;
    const opciones = S.db.settings.opcionesComoCompra;
    const rows = S.db.clientas
      .map((c) => ({ c, st: EG.clientaStats(S.db, c) }))
      .filter((x) => !filtro || x.c.comoCompra === filtro)
      .sort((a, b) => (b.st.citas[0] ? b.st.citas[0].fecha : "").localeCompare(a.st.citas[0] ? a.st.citas[0].fecha : "") || a.c.nombre.localeCompare(b.c.nombre));
    return `${P.title("Clientas", U.plural(S.db.clientas.length, "clienta"), `<button type="button" class="btn sm light" data-act="cl.export">${I("download", 15)}Exportar</button><label class="btn sm light" style="cursor:pointer">${I("plus", 15)}Importar<input class="sr-only" type="file" accept=".xlsx,.csv" data-change="imp.archivo"></label>
        <button type="button" class="btn sm dark" data-act="mod.open" data-v="clienta">${I("user-plus", 15)}Nueva clienta</button>`)}
      <div class="stack" data-fscope>
        <label class="searchbox">${I("search", 16)}<span class="sr-only">Buscar clienta</span><input class="t" type="search" placeholder="Buscar por nombre, teléfono o email" value="${esc(S.ui.clQ)}" data-bind="clQ" data-filter=".crow"></label>
        <div class="pills scroll" role="group" aria-label="¿Cómo compra?"><button type="button" class="pill" data-act="cl.filtro" data-v="" aria-pressed="${!filtro}">Todas</button>${opciones.map((o) =>
          `<button type="button" class="pill" data-act="cl.filtro" data-v="${esc(o)}" aria-pressed="${filtro === o}">${esc(o)}</button>`).join("")}</div>
        ${rows.length
          ? `<div class="rows ctable"><div class="chead"><span>Clienta</span><span>Cómo compra</span><span>Zona</span><span>Visitas</span><span>Última visita</span></div>
            ${rows.map(({ c, st }) => `<button type="button" class="crow" data-act="cl.ver" data-v="${esc(c.id)}" data-s="${esc(c.nombre + " " + c.whatsapp + " " + c.email)}">
              <span class="c-mob">${U.avatar(c.nombre)}<span class="grow"><span class="rname">${esc(c.nombre)}${st.frecuente ? " ★" : ""}</span><span class="rsub">${esc([c.comoCompra, c.zona].filter(Boolean).join(" · ") || "+" + c.whatsapp)}</span></span>
                <span class="xs muted right num">${U.plural(st.visitas, "visita")}</span></span>
              <span class="c-col"><span class="c-av">${U.avatar(c.nombre)}<span class="grow"><span class="rname">${esc(c.nombre)}</span><span class="rsub num">+${esc(c.whatsapp)}</span></span>${st.frecuente ? '<span class="chip acc">Frecuente</span>' : ""}</span></span>
              <span class="c-col">${esc(c.comoCompra || "—")}</span><span class="c-col">${esc(c.zona || "—")}</span><span class="c-col num">${st.visitas}</span><span class="c-col num">${fechaCorta(st.ultima)}</span></button>`).join("")}</div>
            <p class="empty" data-fempty hidden>No hay clientas con ese dato.</p>`
          : `<p class="empty">${filtro ? "No hay clientas de este tipo." : "Todavía no hay clientas. Se crean solas con cada reserva, o cargalas con “Nueva clienta”."}</p>`}</div>`;
  }

  function ficha(c) {
    const st = EG.clientaStats(S.db, c);
    const hist = st.citas.map((a) => `<div class="card white stack sm"><div class="row between"><span class="b small">${esc(P.cap(fechaLarga(a.fecha)))} · ${esc(a.hora)} hs</span>${U.estadoChip(a)}</div>
        <span class="xs muted">${U.tipoTxt(a, true)}${a.origen === "manual" ? " · cargada a mano" : ""}</span>
        ${a.prendas.length ? `<ul class="list small">${a.prendas.map((i) => `<li>${esc(EG.itemName(i, S.prod))} · T${esc(i.talle)}${i.seLlevo === true ? ' <span class="chip ok">Se llevó</span>' : i.seLlevo === false ? ' <span class="muted xs">no</span>' : ""}</li>`).join("")}</ul>` : `<span class="small muted">Sin preselección</span>`}
        <button type="button" class="linkbtn" style="align-self:flex-start" data-act="ag.open" data-v="${esc(a.id)}">Ver cita</button></div>`).join("");
    return `<button type="button" class="back" data-act="cl.volver">${I("chevron-left", 16)}Clientas</button>
      <div class="ptitle"><div class="row nowrap">${U.avatar(c.nombre, "lg")}<div><h1>${esc(c.nombre)}</h1>
        <div class="row" style="margin-top:4px">${c.comoCompra ? `<span class="chip">${esc(c.comoCompra)}</span>` : ""}${st.frecuente ? `<span class="chip acc">${I("star", 12)}Clienta frecuente</span>` : ""}</div></div></div>
        <div class="row"><a class="btn sm" href="${esc(EG.waLink(c.whatsapp, "¡Hola " + c.nombre.split(" ")[0] + "!"))}" target="_blank" rel="noopener">${I("message-circle", 15)}Escribir por WhatsApp</a>
        <button type="button" class="btn sm dark" data-act="mod.open" data-v="reserva" data-c="${esc(c.id)}">${I("plus", 15)}Nueva reserva</button></div></div>
      <div class="stack lg"><div class="stats"><div class="stat"><span class="small muted">Visitas</span><b class="num">${st.visitas}</b></div>
          <div class="stat"><span class="small muted">Prendas llevadas</span><b class="num">${st.llevadas} <span class="small muted" style="font-weight:400">de ${st.elegidas}</span></b></div>
          <div class="stat"><span class="small muted">Faltazos</span><b class="num">${st.faltazos}</b></div></div>
      <div class="cols ficha"><div class="stack"><h2>Historial</h2>${hist || `<p class="empty">Todavía no tiene citas.</p>`}</div>
      <div class="stack">
        <div class="card stack sm"><h3>Contacto</h3><dl class="kv"><dt>WhatsApp</dt><dd class="num">+${esc(c.whatsapp)}</dd><dt>Email</dt><dd>${c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : "—"}</dd>
          <dt>Zona</dt><dd>${esc(c.zona || "—")}</dd><dt>Clienta desde</dt><dd>${desde(c.creada)}</dd></dl></div>
        <div class="card stack sm"><h3>Talles habituales</h3>${st.talles.length ? `<div class="row">${st.talles.map((t) => `<span class="chip dark">Talle ${esc(t)}</span>`).join("")}</div><p class="xs muted">Calculado con lo que eligió y lo que se llevó.</p>` : `<p class="small muted">Todavía no hay datos.</p>`}</div>
        <div class="card stack sm"><label class="f" for="cn-${esc(c.id)}"><h3>Notas</h3><textarea class="t" id="cn-${esc(c.id)}" data-cnote="${esc(c.id)}" placeholder="Preferencias, cómo paga, a quién le vende…">${esc(c.notas)}</textarea></label></div>
      </div></div></div>`;
  }

  P.VISTAS.clientas = () => {
    const c = S.ui.clienta && S.db.clientas.find((x) => x.id === S.ui.clienta);
    return c ? ficha(c) : lista();
  };

  const A = EG.actions;
  A["cl.filtro"] = (el) => { S.ui.clFiltro = el.dataset.v; };
  A["cl.ver"] = (el) => { S.ui.clienta = el.dataset.v; S.ui.open = null; if (S.ui.route !== "clientas") { S.go("clientas"); return false; } return "top"; };
  A["cl.volver"] = () => { S.ui.clienta = null; return "top"; };
  A["cl.export"] = () => {
    const rows = [["Nombre", "WhatsApp", "Email", "Zona", "Cómo compra", "Visitas", "Prendas llevadas", "Prendas elegidas", "Faltazos", "Última visita", "Clienta desde", "Notas"]];
    S.db.clientas.forEach((c) => {
      const st = EG.clientaStats(S.db, c);
      rows.push([c.nombre, c.whatsapp, c.email, c.zona, c.comoCompra, st.visitas, st.llevadas, st.elegidas, st.faltazos, st.ultima, String(c.creada || "").slice(0, 10), c.notas]);
    });
    U.download("clientas-" + EG.ymd(new Date()) + ".csv", EG.toCSV(rows));
    return false;
  };
})();
