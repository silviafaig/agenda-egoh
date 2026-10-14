// Panel: Catálogo, Mi negocio (Perfil público, Horarios y disponibilidad, Reglas de compra, Compartir,
// Integraciones) y Cuenta (Configuración, Ayuda).
(function () {
  "use strict";
  const EG = window.EG;
  const S = EG.S;
  const U = EG.ui;
  const P = EG.panel;
  const { esc, money, fechaLarga, DIAS, icon: I } = EG;
  const A = EG.actions;
  EG.SOPORTE_WA = "5491153836089"; // soporte de la app (Sil)

  const sec = (titulo, desc, cuerpo) => `<section class="card stack"><div><h3>${titulo}</h3>${desc ? `<p class="small muted">${desc}</p>` : ""}</div>${cuerpo}</section>`;
  const fld = (id, label, key, type, extra) => `<label class="f" for="${id}"><span>${label}</span><input class="t${type === "number" ? " num" : ""}" id="${id}" type="${type || "text"}" value="${esc(S.ui.draft[key])}" data-bind="draft.${key}" ${extra || ""}></label>`;
  const errHtml = () => (S.ui.draftErr ? `<p class="notice bad" role="alert">${esc(S.ui.draftErr)}</p>` : "");
  const wrap = (h) => `<div class="stack lg" style="max-width:760px">${h}</div>`;

  /* ---------- Catálogo ---------- */
  function fotoMsg() {
    const m = S.ui.fotoMsg;
    if (!m) return "";
    const lista = (t, arr) => (arr.length ? `<p class="small b">${t}</p><ul class="list small">${arr.map((x) => `<li>${esc(x.archivo)} <span class="muted">– ${esc(x.motivo)}</span></li>`).join("")}</ul>` : "");
    return `<div class="card stack" role="status"><div class="row between"><b>${m.ok ? `Se actualizaron ${U.plural(m.ok, "foto")}.` : "No se actualizó ninguna foto."}</b>
      <button type="button" class="btn xs" data-act="cat.cerrarMsg">Cerrar</button></div>${lista("No se usaron:", m.ignoradas)}${lista("No se pudieron cargar:", m.fallidas)}</div>`;
  }
  function formProd(e) {
    const src = e.fotoNueva || (e.id ? EG.photoSrc(S.prod(e.id)) : "");
    return `<form class="card stack" id="cat-form" novalidate><h3>${e.id ? "Editar prenda" : "Nueva prenda"}</h3>
      <div class="fgrid two">
        <label class="f full" for="pf-nombre">Nombre<input class="t" id="pf-nombre" value="${esc(e.nombre)}" data-bind="editProd.nombre" placeholder="Ej: Bikini Cala Black" required></label>
        <label class="f" for="pf-cat">Categoría<select class="t" id="pf-cat" data-bind="editProd.categoria">${EG.CATEGORIAS.map((c) => `<option${e.categoria === c ? " selected" : ""}>${esc(c)}</option>`).join("")}</select></label>
        <label class="f" for="pf-precio">Precio mayorista<input class="t num" id="pf-precio" type="number" inputmode="numeric" min="0" step="100" value="${esc(e.precio)}" data-bind="editProd.precio" placeholder="Vacío o 0 = no se muestra"></label>
        <label class="f" for="pf-modelo">Modelo <span class="hint">para Métricas</span><input class="t" id="pf-modelo" value="${esc(e.modelo)}" data-bind="editProd.modelo" placeholder="Ej: Cala"></label>
        <label class="f" for="pf-color">Color<input class="t" id="pf-color" value="${esc(e.color)}" data-bind="editProd.color" placeholder="Ej: Black"></label>
        <label class="f full" for="pf-talles">Talles (separados por coma)<input class="t" id="pf-talles" value="${esc(e.tallesTxt)}" data-bind="editProd.tallesTxt" placeholder="1, 2, 3, 4, 5, 6"></label>
        <label class="f full" for="pf-foto">Foto<input class="t" id="pf-foto" type="file" accept="image/*" data-change="cat.foto"></label></div>
      ${src ? `<img src="${esc(src)}" alt="Foto de la prenda" style="width:96px;border-radius:12px;aspect-ratio:4/5;object-fit:cover;object-position:center top">` : ""}
      ${S.ui.formErr ? `<p class="err" role="alert">${esc(S.ui.formErr)}</p>` : ""}
      <div class="row"><button class="btn dark" type="submit">Guardar</button><button class="btn" type="button" data-act="cat.cancelar">Cancelar</button>
        ${e.id ? `<button class="btn danger right" type="button" data-act="cat.borrar">${I("trash-2", 15)}${S.ui.confirmar === "borrar" ? "Sí, quitar del catálogo" : "Quitar del catálogo"}</button>` : ""}</div>
      ${S.ui.confirmar === "borrar" ? `<p class="small muted">Tocá de nuevo para confirmar. Las citas que ya la tenían elegida conservan su nombre.</p>` : ""}</form>`;
  }
  P.VISTAS.catalogo = () => {
    const lista = S.db.products.filter((p) => p.categoria === S.ui.catPanel);
    return `${P.title("Catálogo", "Las clientas eligen de acá su preselección al reservar.", `<label class="btn sm" style="cursor:pointer">${I("image-plus", 15)}${S.ui.busy ? "Cargando fotos…" : "Cargar fotos en masa"}
          <input class="sr-only" type="file" accept="image/*" multiple data-change="cat.masivo" ${S.ui.busy ? "disabled" : ""}></label>
        <button type="button" class="btn sm" data-act="precios.abrir">${I("pencil", 15)}Cambiar precios</button>
        <button type="button" class="btn sm dark" data-act="cat.nueva">${I("plus", 15)}Agregar prenda</button>`)}
      <div class="stack lg" data-fscope>
        <p class="notice soft">Carga masiva: elegí varias fotos juntas y cada una se asigna a su prenda por el nombre del archivo, con el formato <b>Bikini_Modelo_Color_01.jpg</b> (por ejemplo <i>Bikini_Cala_Black_01.jpg</i>). Se usa la <b>_01</b>, salvo en Reversible Vela Malbec / Black, que usa la <b>_02</b>.</p>
        ${fotoMsg()}<label class="searchbox">${I("search", 16)}<span class="sr-only">Buscar prenda</span><input class="t" type="search" placeholder="Buscar prenda por nombre" value="${esc(S.ui.catQ || "")}" data-bind="catQ" data-filter="[data-pcard]"></label>
        ${U.cats(S.ui.catPanel, "cat.filtro")}
        ${S.ui.editProd ? formProd(S.ui.editProd) : ""}
        ${lista.length
          ? `<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(160px,1fr))">${lista.map((p) => `<div class="prod" data-pcard data-s="${esc(p.nombre + " " + (p.modelo || ""))}"><div class="ph">${U.photo(p)}</div><div class="body"><h3>${esc(p.nombre)}</h3>
              <p class="xs num muted">${EG.priceTxt(p) ? EG.priceTxt(p) + " · " : ""}${U.plural(p.talles.length, "talle")}</p>
              <button type="button" class="btn xs" style="align-self:flex-start" data-act="cat.editar" data-v="${esc(p.id)}">${I("pencil", 13)}Editar</button></div></div>`).join("")}</div><p class="empty" data-fempty hidden>No hay prendas con ese nombre en esta categoría.</p>`
          : `<p class="empty">Todavía no hay prendas en esta categoría. Usá “Agregar prenda” para cargar la primera.</p>`}</div>`;
  };

  A["cat.filtro"] = (el) => { S.ui.catPanel = el.dataset.v; };

  /* ---------- Cambio de precios masivo ---------- */
  const MODOS = [["fijo", "Precio fijo"], ["subir", "Subir %"], ["bajar", "Bajar %"], ["monto", "Sumar o restar $"]];
  // Prendas que coinciden con la búsqueda (nombre o modelo) y la categoría.
  EG.preciosCoinciden = (prods, q, cat) => {
    const n = EG.normName(q || "");
    return prods.filter((p) => (!cat || p.categoria === cat) && (!n || EG.normName(p.nombre + " " + (p.modelo || "")).indexOf(n) >= 0));
  };
  // Precio nuevo (en pesos, sin centavos). null = no cambia (por ejemplo, % sobre una prenda sin precio).
  EG.precioNuevo = (precio, modo, valor) => {
    const v = Number(valor), act = Number(precio) || 0;
    if (valor === "" || valor == null || isNaN(v)) return null;
    let r;
    if (modo === "fijo") r = v;
    else if (modo === "subir") { if (!act) return null; r = act * (1 + v / 100); }
    else if (modo === "bajar") { if (!act) return null; r = act * (1 - v / 100); }
    else if (modo === "monto") { if (!act) return null; r = act + v; }
    else return null;
    return Math.max(0, Math.round(r));
  };
  P.MODALES.precios = (m) => {
    const lista = EG.preciosCoinciden(S.db.products, m.q, m.cat);
    const elegidas = lista.filter((p) => !m.fuera[p.id]);
    const cambios = elegidas.map((p) => ({ p, nuevo: EG.precioNuevo(p.precio, m.modo, m.valor) })).filter((x) => x.nuevo !== null && x.nuevo !== (Number(x.p.precio) || 0));
    const ph = { fijo: "Ej: 25000", subir: "Ej: 10", bajar: "Ej: 15", monto: "Ej: 2000 o -2000" }[m.modo];
    return `<div class="modal" id="mod-precios" role="dialog" aria-modal="true" aria-label="Cambiar precios"><div class="grab"></div>
      <div class="mhead"><h2>Cambiar precios</h2><button type="button" class="iconbtn sm" data-act="mod.close" aria-label="Cerrar">${I("x", 15)}</button></div>
      <div class="fgrid two">
        <label class="f" for="pr-q">Nombre o modelo<input class="t" id="pr-q" type="search" placeholder="Ej: Cala (vacío = todas)" value="${esc(m.q)}" data-bind="modal.q" data-change="precios.ref"></label>
        <label class="f" for="pr-cat">Categoría<select class="t" id="pr-cat" data-bind="modal.cat" data-change="precios.ref"><option value="">Todas</option>${EG.CATEGORIAS.map((c) => `<option${m.cat === c ? " selected" : ""}>${esc(c)}</option>`).join("")}</select></label></div>
      <div class="stack sm"><span class="label">Cambio</span><div class="seg" style="flex-wrap:wrap">${MODOS.map(([k, t]) => `<button type="button" data-act="mod.set" data-k="modo" data-v="${k}" aria-pressed="${m.modo === k}">${t}</button>`).join("")}</div>
        <label class="f" for="pr-v" style="max-width:220px"><span>${m.modo === "fijo" ? "Precio nuevo ($)" : m.modo === "monto" ? "Monto ($)" : "Porcentaje (%)"}</span><input class="t num" id="pr-v" type="number" inputmode="decimal" placeholder="${ph}" value="${esc(m.valor)}" data-bind="modal.valor" data-change="precios.ref"></label>
        ${m.modo !== "fijo" ? `<p class="xs muted">Las prendas sin precio no cambian.</p>` : ""}</div>
      <div class="stack sm"><span class="label">${U.plural(lista.length, "prenda")} · ${elegidas.length} elegidas · ${U.plural(cambios.length, "cambio")}</span>
        ${lista.length ? `<div class="pickbox" data-keepscroll="pickprecios">${lista.map((p) => {
          const nuevo = EG.precioNuevo(p.precio, m.modo, m.valor), on = !m.fuera[p.id];
          return `<label class="rowitem" style="cursor:pointer"><input type="checkbox" ${on ? "checked" : ""} data-change="precios.toggle" data-v="${esc(p.id)}" aria-label="${esc(p.nombre)}">
            <span class="grow small">${esc(p.nombre)}</span><span class="small num muted">${p.precio > 0 ? money(p.precio) : "Sin precio"}</span>
            ${on && nuevo !== null ? `<span class="small num b">→ ${money(nuevo)}</span>` : ""}</label>`; }).join("")}</div>`
          : `<p class="small muted">No hay prendas con ese nombre.</p>`}</div>
      <p class="xs muted">Escribí y tocá Enter (o salí del campo) para ver la vista previa.</p>
      <div class="row" style="justify-content:flex-end"><button type="button" class="btn" data-act="mod.close">Cancelar</button>
        <button type="button" class="btn dark" data-act="precios.aplicar" ${cambios.length ? "" : "disabled"}>Aplicar a ${U.plural(cambios.length, "prenda")}</button></div></div>`;
  };
  A["precios.abrir"] = () => { S.ui.modal = { kind: "precios", q: "", cat: S.ui.catPanel, modo: "subir", valor: "", fuera: {} }; };
  EG.changes["precios.ref"] = () => true;
  EG.changes["precios.toggle"] = (el) => { const f = S.ui.modal.fuera; if (el.checked) delete f[el.dataset.v]; else f[el.dataset.v] = true; return true; };
  A["precios.aplicar"] = () => {
    const m = S.ui.modal;
    let n = 0;
    EG.preciosCoinciden(S.db.products, m.q, m.cat).forEach((p) => {
      if (m.fuera[p.id]) return;
      const nuevo = EG.precioNuevo(p.precio, m.modo, m.valor);
      if (nuevo !== null && nuevo !== (Number(p.precio) || 0)) { p.precio = nuevo; n++; }
    });
    S.ui.modal = null;
    if (n) { S.save(); S.toast("Precios actualizados en " + U.plural(n, "prenda") + "."); }
  };
  A["cat.nueva"] = () => {
    S.ui.formErr = "";
    S.ui.editProd = { id: null, nombre: "", categoria: S.ui.catPanel, precio: "", modelo: "", color: "", tallesTxt: S.ui.catPanel === "Bikinis SS27" ? EG.TALLES_BIKINI.join(", ") : "", fotoNueva: "" };
  };
  A["cat.editar"] = (el) => {
    const p = S.prod(el.dataset.v);
    S.ui.formErr = "";
    S.ui.editProd = { id: p.id, nombre: p.nombre, categoria: p.categoria, precio: p.precio || "", modelo: p.modelo || "", color: p.color || "", tallesTxt: p.talles.join(", "), fotoNueva: "" };
    return "top";
  };
  A["cat.cancelar"] = () => { S.ui.editProd = null; S.ui.formErr = ""; S.ui.confirmar = null; };
  A["cat.borrar"] = () => {
    const e = S.ui.editProd;
    if (S.ui.confirmar !== "borrar") { S.ui.confirmar = "borrar"; return; }
    S.ui.confirmar = null;
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
    EG.resizeImage(f, 640, 0.82).then((url) => { S.ui.editProd.fotoNueva = url; S.render(); }).catch(() => S.toast("No se pudo leer esa imagen."));
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
        try { p.foto = await EG.guardarFoto(p.id, url); ok++; }
        catch (e) { fallidas.push({ archivo: a.archivo, motivo: EG.remote.on ? "no se pudo subir" : "el navegador no tiene espacio para guardarla" }); }
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
    const datos = { nombre, categoria: e.categoria, modelo: e.modelo.trim(), color: e.color.trim(), precio: Math.max(0, Math.round(Number(e.precio) || 0)), talles: talles.length ? talles : ["Único"] };
    let p;
    if (e.id) { p = S.prod(e.id); Object.assign(p, datos); }
    else {
      p = Object.assign({ id: "p-" + EG.slug(nombre) + "-" + EG.uid(4), foto: "", fotoNum: 1 }, datos);
      S.db.products.push(p);
    }
    if (e.fotoNueva) {
      EG.guardarFoto(p.id, e.fotoNueva).then((ref) => { p.foto = ref; S.save(); S.render(); })
        .catch(() => S.toast("La prenda se guardó, pero la foto no se pudo guardar."));
    }
    S.ui.catPanel = p.categoria;
    S.ui.editProd = null;
    S.ui.formErr = "";
    S.save();
    S.toast("Prenda guardada.");
  };

  /* ---------- Perfil público ---------- */
  function imgPicker(label, key, act, w) {
    const d = S.ui.draft;
    const src = d[key + "Nuevo"] || (!d[key + "Quitar"] ? EG.imgSrc(S.db.settings[key], key) : "");
    return `<div class="f"><span>${label}</span><div class="row">${src ? `<img src="${esc(src)}" alt="" style="width:${w}px;max-height:90px;object-fit:${key === "logo" ? "contain" : "cover"};border-radius:12px;background:var(--bg);border:1px solid var(--line)">` : ""}
      <label class="btn sm" style="cursor:pointer">${I("image-plus", 15)}${src ? "Cambiar" : "Subir imagen"}<input class="sr-only" type="file" accept="image/*" data-change="${act}"></label>
      ${src ? `<button type="button" class="btn sm light" data-act="perfil.quitar" data-v="${key}">Quitar</button>` : ""}</div></div>`;
  }
  P.VISTAS.perfil = () => {
    const s = S.db.settings;
    if (!S.ui.draft) S.ui.draft = { nombre: s.nombre, direccion: s.direccion, info: s.info, whatsappShowroom: s.whatsappShowroom ? "+" + s.whatsappShowroom : "", instagram: s.instagram ? "@" + s.instagram : "" };
    const d = S.ui.draft;
    return `${P.title("Perfil público", "Lo que ven las clientas al reservar.", `<button type="button" class="btn sm" data-act="verPublica">${I("external-link", 15)}Ver como clienta</button><button type="submit" form="perfil-form" class="btn sm dark">Guardar cambios</button>`)}
      ${wrap(`${errHtml()}<form class="stack lg" id="perfil-form" novalidate>
        ${sec("Imagen", "Si no subís un logo, se muestra el nombre en letra serif (“" + esc(String(s.nombre).toLowerCase()) + ".”).", imgPicker("Logo", "logo", "perfil.logo", 120) + imgPicker("Portada", "portada", "perfil.portada", 220))}
        ${sec("Datos del showroom", "", `${fld("pp-nombre", "Nombre del showroom", "nombre")}${fld("pp-dir", "Dirección", "direccion")}
          <label class="f" for="pp-info">Texto informativo<textarea class="t" id="pp-info" data-bind="draft.info">${esc(d.info)}</textarea></label>`)}
        ${sec("Contacto", "Aparecen como botones en tu página de reservas. Dejalos vacíos para no mostrarlos.", `${fld("pp-wa", "WhatsApp del showroom", "whatsappShowroom", "tel", 'inputmode="tel" placeholder="11 5555 0101"')}${fld("pp-ig", "Instagram", "instagram", "text", 'placeholder="@tumarca"')}`)}</form>`)}`;
  };
  const leerImg = (key, maxW) => (input) => {
    const f = input.files[0];
    if (!f) return false;
    EG.resizeImage(f, maxW, 0.85).then((url) => { S.ui.draft[key + "Nuevo"] = url; S.ui.draft[key + "Quitar"] = false; S.render(); }).catch(() => S.toast("No se pudo leer esa imagen."));
    return false;
  };
  EG.changes["perfil.logo"] = leerImg("logo", 480);
  EG.changes["perfil.portada"] = leerImg("portada", 1400);
  A["perfil.quitar"] = (el) => { const k = el.dataset.v; S.ui.draft[k + "Nuevo"] = ""; S.ui.draft[k + "Quitar"] = true; };
  EG.submits["perfil-form"] = () => {
    const d = S.ui.draft, s = S.db.settings;
    if (!d.nombre.trim()) { S.ui.draftErr = "Escribí el nombre del showroom."; return; }
    const wa = String(d.whatsappShowroom || "").trim() ? EG.normalizePhone(d.whatsappShowroom) : "";
    if (wa === null) { S.ui.draftErr = "Revisá el WhatsApp: escribilo con código de área, por ejemplo 11 5555 0101."; return; }
    for (const k of ["logo", "portada"]) {
      if (d[k + "Nuevo"]) {
        EG.guardarFoto(k, d[k + "Nuevo"]).then((ref) => { s[k] = ref; S.save(); S.render(); })
          .catch((e) => S.toast("La imagen no se pudo guardar" + (e && e.message ? ": " + e.message : ".")));
      } else if (d[k + "Quitar"]) { if (s[k] === "local") EG.store.fotoDel(k); s[k] = ""; }
    }
    Object.assign(s, { nombre: d.nombre.trim(), direccion: d.direccion.trim(), info: d.info.trim(), whatsappShowroom: wa, instagram: EG.igUser(d.instagram) });
    S.save();
    S.ui.draft = null;
    S.ui.draftErr = "";
    S.toast("Cambios guardados.");
  };

  /* ---------- Horarios y disponibilidad ---------- */
  /* ---------- Diseño de marca (tema) ---------- */
  function vistaPrevia(t) {
    const s = S.db.settings;
    const logo = EG.imgSrc(s.logo, "logo");
    const p = S.db.products.find((x) => EG.photoSrc(x)) || S.db.products[0];
    return `<div class="card bordered" style="background:#fff;padding:16px;${esc(EG.temaStyle(t))};font-family:var(--font);color:var(--ink)" aria-label="Vista previa">
      <div class="stack" style="pointer-events:none">
        <div class="row between">${logo ? `<img src="${esc(logo)}" alt="" style="height:30px;object-fit:contain">` : `<span class="logo" style="font-size:22px">${esc(String(s.nombre || "").toLowerCase())}.</span>`}<span class="xs muted">Paso 2 de 5</span></div>
        <h2 style="font-family:var(--font)">Elegí día y horario</h2>
        <div class="days">${[["Mar", 14], ["Mié", 15], ["Jue", 16]].map((d, i) => `<button type="button" class="day" aria-pressed="${i === 1}"><span>${d[0]}</span><b>${d[1]}</b><span>oct</span></button>`).join("")}</div>
        <div class="slots" style="grid-template-columns:repeat(3,1fr)">${["11:30", "12:00", "12:30"].map((h, i) => `<button type="button" class="slot num" aria-pressed="${i === 0}">${h}</button>`).join("")}</div>
        ${p ? `<div class="row nowrap" style="background:var(--card);padding:10px;border-radius:calc(14px * var(--rk))"><span style="width:56px;height:56px;flex:none;border-radius:calc(10px * var(--rk));overflow:hidden;background:var(--img)">${U.photo(p)}</span>
          <div class="stack sm"><span class="small">${esc(p.nombre)}</span><div class="sizes">${p.talles.slice(0, 4).map((z, i) => `<button type="button" class="size" aria-pressed="${i === 1}">${esc(z)}</button>`).join("")}</div></div></div>` : ""}
        <div class="row"><span class="pill" aria-pressed="true">Revendedora</span><span class="pill">Comercio</span></div>
        <button type="button" class="btn dark block">Confirmar cita</button>
      </div></div>`;
  }
  P.VISTAS.diseno = () => {
    if (!S.ui.draft) S.ui.draft = { tema: EG.tema(S.db.settings) };
    const t = S.ui.draft.tema;
    EG.FUENTES.forEach((f) => EG.cargarFuente(f.id));
    const avisos = EG.temaAvisos(t);
    const color = (k, label, ayuda) => `<label class="f" for="t-${k}"><span>${label}</span><span class="row nowrap"><input type="color" id="t-${k}" value="${esc(t[k])}" data-change="dis.color" data-k="${k}" style="width:48px;height:38px;padding:0;border:1px solid var(--line);border-radius:8px;background:none">
      <span class="xs muted">${ayuda}</span></span></label>`;
    return `${P.title("Diseño de marca", "Elegí los colores, la tipografía y la forma de tu agenda. Se aplican a la página de reserva y al panel.", `<button type="button" class="btn sm" data-act="dis.reset">Volver al diseño original</button><button type="submit" form="dis-form" class="btn sm dark">Guardar cambios</button>`)}
      <form class="cols" id="dis-form" novalidate><div class="stack lg">
        ${sec("Colores", "Tocá una combinación sugerida o elegí cada color; después podés retocar cualquiera.", `<div class="stack sm"><span class="label">Combinaciones sugeridas</span><div class="row">${EG.PALETAS.map((pa, i) => `<button type="button" class="pill" data-act="dis.paleta" data-v="${i}" aria-pressed="${t.acento === pa.acento && t.boton === pa.boton && t.tarjeta === pa.tarjeta && t.texto === pa.texto}" style="display:inline-flex;gap:6px;align-items:center">
          <span style="display:inline-flex">${[pa.acento, pa.boton, pa.tarjeta].map((c) => `<span style="width:14px;height:14px;border-radius:50%;background:${c};border:1px solid rgba(0,0,0,.12);margin-right:-3px"></span>`).join("")}</span><span style="margin-left:4px">${esc(pa.nombre)}</span></button>`).join("")}</div></div>
          <div class="fgrid two">${color("acento", "Color de marca", "Día, horario y talle elegidos")}${color("boton", "Botones", "Botón principal")}${color("tarjeta", "Fondo de tarjetas", "Recuadros y secciones")}${color("texto", "Texto", "Títulos y textos")}</div>`)}
        ${sec("Tipografía", "Pares de fuentes que combinan: una para los textos y otra para títulos y nombre.", `<div class="fgrid two">${EG.FUENTES.map((f) => `<button type="button" class="opt" data-act="dis.fuente" data-v="${f.id}" aria-pressed="${t.fuente === f.id}" style="text-align:left">
          <span class="stack sm" style="gap:2px"><span style="font-family:'${f.titulo}',serif;font-size:20px;line-height:1.1">${esc(f.nombre)}</span><span style="font-family:'${f.texto}',sans-serif;font-size:13px">${esc(f.texto)}${f.titulo !== f.texto ? " + " + esc(f.titulo) : ""}</span></span></button>`).join("")}</div>`)}
        ${sec("Forma", "Cómo se ven los botones y las tarjetas.", `<div class="seg" style="align-self:flex-start">${EG.FORMAS.map((fo) => `<button type="button" data-act="dis.forma" data-v="${fo.id}" aria-pressed="${t.forma === fo.id}">${esc(fo.nombre)}</button>`).join("")}</div>`)}
        ${avisos.length ? `<div class="notice warn stack sm">${avisos.map((a) => `<span class="small">${esc(a)}</span>`).join("")}</div>` : ""}
      </div><div class="stack"><h3>Vista previa</h3>${vistaPrevia(t)}<p class="xs muted">Así se ve la página de reserva. Los cambios se aplican al guardar.</p></div></form>`;
  };
  EG.changes["dis.color"] = (el) => { if (/^#[0-9a-f]{6}$/i.test(el.value)) S.ui.draft.tema[el.dataset.k] = el.value.toLowerCase(); };
  A["dis.paleta"] = (el) => { const pa = EG.PALETAS[+el.dataset.v]; Object.assign(S.ui.draft.tema, { acento: pa.acento, boton: pa.boton, tarjeta: pa.tarjeta, texto: pa.texto }); };
  A["dis.fuente"] = (el) => { S.ui.draft.tema.fuente = el.dataset.v; };
  A["dis.forma"] = (el) => { S.ui.draft.tema.forma = el.dataset.v; };
  A["dis.reset"] = () => { S.ui.draft.tema = Object.assign({}, EG.TEMA_DEF); };
  EG.submits["dis-form"] = () => {
    S.db.settings.tema = Object.assign({}, S.ui.draft.tema);
    S.save();
    S.ui.draft = null;
    S.toast("Diseño guardado.");
  };

  P.VISTAS.horarios = () => {
    const s = S.db.settings;
    if (!S.ui.draft) {
      const f = s.franjas;
      S.ui.draft = { dias: s.dias.slice(), f1d: f[0] ? f[0][0] : "", f1h: f[0] ? f[0][1] : "", f2d: f[1] ? f[1][0] : "", f2h: f[1] ? f[1][1] : "", duracion: s.duracion,
        fd: "", fh: "", fm: "", ed: "", e1d: "", e1h: "", e2d: "", e2h: "", ferr: "", eerr: "",
        acepta: s.aceptaReservas !== false, minH: s.anticipacionMinHoras ?? 0, maxD: s.anticipacionMaxDias ?? 0, cambH: s.cambiosMinHoras ?? 0, maxR: s.maxReprogramaciones ?? 0 };
    }
    const d = S.ui.draft;
    const hoy = EG.ymd(new Date());
    const feriados = s.feriados.slice().sort((a, b) => a.desde.localeCompare(b.desde));
    const esp = s.fechasEspeciales.slice().sort((a, b) => a.fecha.localeCompare(b.fecha));
    return `${P.title("Horarios y disponibilidad", "Cuándo se pueden reservar citas.", `<button type="submit" form="hor-form" class="btn sm dark">Guardar cambios</button>`)}
      ${wrap(`${errHtml()}<form class="stack lg" id="hor-form" novalidate>
        ${sec("Recepción de reservas", d.acepta ? "Las clientas pueden reservar desde tu link." : "Tu página muestra “Por ahora no estamos tomando reservas”. Las citas ya agendadas siguen igual.", `<div class="seg" style="align-self:flex-start"><button type="button" data-act="hor.acepta" data-v="1" aria-pressed="${d.acepta}">Abiertas</button><button type="button" data-act="hor.acepta" data-v="0" aria-pressed="${!d.acepta}">Pausadas</button></div>`)}
        ${sec("Días de atención", "", `<div class="pills">${[1, 2, 3, 4, 5, 6, 0].map((n) => `<button type="button" class="pill" data-act="hor.dia" data-v="${n}" aria-pressed="${d.dias.indexOf(n) >= 0}">${DIAS[n]}</button>`).join("")}</div>`)}
        ${sec("Franjas horarias", "Dejá la tarde vacía si atendés en un solo turno.", `<div class="fgrid two">${fld("h-f1d", "Mañana desde", "f1d", "time")}${fld("h-f1h", "Mañana hasta", "f1h", "time")}${fld("h-f2d", "Tarde desde", "f2d", "time")}${fld("h-f2h", "Tarde hasta", "f2h", "time")}</div>
          ${fld("h-dur", "Duración de la cita (minutos)", "duracion", "number", 'min="10" step="5" inputmode="numeric" style="max-width:160px"')}`)}
        ${sec("Anticipación", "Con 0 no hay límite. Desde el panel podés agendar siempre, sin estas reglas.", `<div class="fgrid two">${fld("h-minh", "Reservar con al menos (horas)", "minH", "number", 'min="0" step="1" inputmode="numeric"')}${fld("h-maxd", "Reservar hasta (días adelante)", "maxD", "number", 'min="0" step="1" inputmode="numeric"')}</div>`)}
        ${sec("Cancelar y reprogramar", "Lo que la clienta puede hacer sola desde el link de su cita. Con 0 no hay límite.", `<div class="fgrid two">${fld("h-camb", "Hasta cuántas horas antes", "cambH", "number", 'min="0" step="1" inputmode="numeric"')}${fld("h-maxr", "Veces que puede reprogramar", "maxR", "number", 'min="0" step="1" inputmode="numeric"')}</div>`)}</form>
        ${sec("Feriados y vacaciones", "Esos días no se puede reservar.", `${feriados.length ? `<div class="rows">${feriados.map((f) => `<div class="rowitem"><span class="grow small"><b>${esc(fechaLarga(f.desde))}${f.hasta && f.hasta !== f.desde ? " al " + esc(fechaLarga(f.hasta)) : ""}</b>${f.motivo ? " · " + esc(f.motivo) : ""}${(f.hasta || f.desde) < hoy ? ' <span class="muted">(ya pasó)</span>' : ""}</span>
            <button type="button" class="iconbtn sm" data-act="hor.quitarFeriado" data-v="${esc(f.desde + "|" + (f.hasta || ""))}" aria-label="Quitar">${I("x", 14)}</button></div>`).join("")}</div>` : `<p class="small muted">No hay fechas cargadas.</p>`}
          <div class="fgrid two">${fld("h-fd", "Desde", "fd", "date")}${fld("h-fh", 'Hasta <span class="hint">vacío = un solo día</span>', "fh", "date")}<div class="full">${fld("h-fm", "Motivo", "fm", "text", 'placeholder="Ej: Feriado, vacaciones de invierno"')}</div></div>
          ${d.ferr ? `<p class="err">${esc(d.ferr)}</p>` : ""}<button type="button" class="btn sm" style="align-self:flex-start" data-act="hor.addFeriado">${I("plus", 15)}Agregar</button>`)}
        ${sec("Fechas especiales", "Un día con otro horario (por ejemplo, un sábado de liquidación).", `${esp.length ? `<div class="rows">${esp.map((f) => `<div class="rowitem"><span class="grow small"><b>${esc(fechaLarga(f.fecha))}</b> · ${f.franjas.map((x) => esc(x[0] + " a " + x[1])).join(" y ")}</span>
            <button type="button" class="iconbtn sm" data-act="hor.quitarEsp" data-v="${esc(f.fecha)}" aria-label="Quitar">${I("x", 14)}</button></div>`).join("")}</div>` : `<p class="small muted">No hay fechas especiales.</p>`}
          <div class="fgrid two"><div class="full">${fld("h-ed", "Día", "ed", "date")}</div>${fld("h-e1d", "Desde", "e1d", "time")}${fld("h-e1h", "Hasta", "e1h", "time")}${fld("h-e2d", 'Segunda franja desde <span class="hint">opcional</span>', "e2d", "time")}${fld("h-e2h", "Hasta", "e2h", "time")}</div>
          ${d.eerr ? `<p class="err">${esc(d.eerr)}</p>` : ""}<button type="button" class="btn sm" style="align-self:flex-start" data-act="hor.addEsp">${I("plus", 15)}Agregar</button>`)}`)}`;
  };
  const franjaOk = (a, b) => a && b && EG.toMin(b) > EG.toMin(a);
  A["hor.acepta"] = (el) => { S.ui.draft.acepta = el.dataset.v === "1"; };
  A["hor.dia"] = (el) => { const d = S.ui.draft, n = +el.dataset.v; d.dias = d.dias.indexOf(n) >= 0 ? d.dias.filter((x) => x !== n) : d.dias.concat(n); };
  A["hor.addFeriado"] = () => {
    const d = S.ui.draft;
    if (!d.fd) { d.ferr = "Elegí la fecha."; return; }
    if (d.fh && d.fh < d.fd) { d.ferr = "La fecha “hasta” tiene que ser posterior."; return; }
    S.db.settings.feriados.push({ desde: d.fd, hasta: d.fh && d.fh !== d.fd ? d.fh : "", motivo: d.fm.trim() });
    Object.assign(d, { fd: "", fh: "", fm: "", ferr: "" });
    S.save();
    S.toast("Fecha agregada.");
  };
  A["hor.quitarFeriado"] = (el) => {
    const [de, ha] = el.dataset.v.split("|");
    S.db.settings.feriados = S.db.settings.feriados.filter((f) => !(f.desde === de && (f.hasta || "") === ha));
    S.save();
  };
  A["hor.addEsp"] = () => {
    const d = S.ui.draft;
    if (!d.ed) { d.eerr = "Elegí el día."; return; }
    if (!franjaOk(d.e1d, d.e1h)) { d.eerr = "Revisá el horario: “hasta” tiene que ser después de “desde”."; return; }
    const fr = [[d.e1d, d.e1h]];
    if (d.e2d || d.e2h) { if (!franjaOk(d.e2d, d.e2h)) { d.eerr = "Revisá la segunda franja."; return; } fr.push([d.e2d, d.e2h]); }
    S.db.settings.fechasEspeciales = S.db.settings.fechasEspeciales.filter((f) => f.fecha !== d.ed).concat({ fecha: d.ed, franjas: fr });
    Object.assign(d, { ed: "", e1d: "", e1h: "", e2d: "", e2h: "", eerr: "" });
    S.save();
    S.toast("Fecha especial agregada.");
  };
  A["hor.quitarEsp"] = (el) => { S.db.settings.fechasEspeciales = S.db.settings.fechasEspeciales.filter((f) => f.fecha !== el.dataset.v); S.save(); };
  EG.submits["hor-form"] = () => {
    const d = S.ui.draft;
    const fail = (m) => { S.ui.draftErr = m; return "top"; };
    if (!d.dias.length) return fail("Elegí al menos un día de atención.");
    const franjas = [];
    for (const par of [[d.f1d, d.f1h], [d.f2d, d.f2h]]) {
      if (!par[0] && !par[1]) continue;
      if (!franjaOk(par[0], par[1])) return fail("Revisá las franjas: la hora de fin tiene que ser posterior a la de inicio.");
      franjas.push(par);
    }
    if (!franjas.length) return fail("Cargá al menos una franja horaria.");
    const duracion = Math.round(Number(d.duracion));
    if (!(duracion >= 10)) return fail("La duración de la cita tiene que ser de al menos 10 minutos.");
    const ent = (v) => Math.max(0, Math.round(Number(v) || 0));
    Object.assign(S.db.settings, { dias: d.dias.slice().sort(), franjas, duracion, aceptaReservas: !!d.acepta,
      anticipacionMinHoras: ent(d.minH), anticipacionMaxDias: ent(d.maxD), cambiosMinHoras: ent(d.cambH), maxReprogramaciones: ent(d.maxR) });
    S.save();
    S.ui.draft = null;
    S.ui.draftErr = "";
    S.toast("Horarios guardados.");
  };

  /* ---------- Reglas de compra ---------- */
  P.VISTAS.reglas = () => {
    const s = S.db.settings;
    if (!S.ui.draft) S.ui.draft = { compraMinima: s.compraMinima, nota: s.compraMinimaNota || "", precios: EG.verPrecios(s), opciones: s.opcionesComoCompra.slice(), nueva: "" };
    const d = S.ui.draft;
    return `${P.title("Reglas de compra", "Se muestran a la clienta al reservar.", `<button type="submit" form="reg-form" class="btn sm dark">Guardar cambios</button>`)}
      ${wrap(`${errHtml()}<form class="stack lg" id="reg-form" novalidate>
        ${sec("Compra mínima", "Poné 0 si no hay mínimo.", `<div class="fgrid two">${fld("r-min", "Monto", "compraMinima", "number", 'min="0" step="1000" inputmode="numeric"')}${fld("r-nota", "Aclaración", "nota", "text", 'placeholder="Ej: por tiempo limitado"')}</div>
          ${Number(d.compraMinima) > 0 ? `<p class="small muted">La clienta ve: “Compra mínima ${money(Number(d.compraMinima))}${d.nota ? " " + esc(d.nota) : ""}”.</p>` : ""}`)}
        ${sec("Precios", "Si lo apagás, las clientas no ven precios ni totales al reservar. Los precios quedan guardados en el Catálogo y en Métricas.", `<label class="check"><input type="checkbox" data-bind="draft.precios" ${d.precios ? "checked" : ""}>Mostrar precios a las clientas</label>`)}
        ${sec("Opciones de “¿Cómo comprás?”", "La clienta elige una al reservar.", `<div class="row">${d.opciones.map((o, i) => `<span class="chip" style="padding:6px 8px 6px 12px;font-size:13px">${esc(o)}<button type="button" class="iconbtn sm" style="width:22px;height:22px;border:0" data-act="reg.quitar" data-v="${i}" aria-label="Quitar ${esc(o)}">${I("x", 12)}</button></span>`).join("")}</div>
          <div class="row nowrap"><input class="t" style="max-width:280px" placeholder="Nueva opción" value="${esc(d.nueva)}" data-bind="draft.nueva" aria-label="Nueva opción"><button type="button" class="btn sm" data-act="reg.agregar">${I("plus", 15)}Agregar</button></div>`)}</form>`)}`;
  };
  A["reg.quitar"] = (el) => { S.ui.draft.opciones.splice(+el.dataset.v, 1); };
  A["reg.agregar"] = () => {
    const d = S.ui.draft, v = d.nueva.trim();
    if (v && d.opciones.indexOf(v) < 0) d.opciones.push(v);
    d.nueva = "";
  };
  EG.submits["reg-form"] = () => {
    const d = S.ui.draft;
    if (!d.opciones.length) { S.ui.draftErr = "Dejá al menos una opción de “¿Cómo comprás?”."; return "top"; }
    Object.assign(S.db.settings, { compraMinima: Math.max(0, Math.round(Number(d.compraMinima) || 0)), compraMinimaNota: d.nota.trim(), mostrarPrecios: !!d.precios, opcionesComoCompra: d.opciones.slice() });
    S.save();
    S.ui.draft = null;
    S.ui.draftErr = "";
    S.toast("Reglas guardadas.");
  };

  /* ---------- Compartir ---------- */
  const textoCompartir = () => {
    const s = S.db.settings;
    return "Reservá tu cita en " + s.nombre + " (visita al showroom o videollamada de " + s.duracion + " min) y elegí antes las prendas que querés ver: " + S.publicLink();
  };
  P.VISTAS.compartir = () => {
    const link = S.publicLink();
    return `${P.title("Compartir", "Mandá tu agenda por WhatsApp o ponela en Instagram.")}
      ${wrap(`${EG.remote.on ? "" : `<p class="notice">Versión de prueba: las reservas quedan solo en este navegador.</p>`}
        ${sec("Link de la agenda", "", `<div class="row nowrap" style="background:var(--bg);border-radius:999px;padding:6px 6px 6px 14px">${I("link", 15)}<span class="grow ellipsis small">${esc(link)}</span><button type="button" class="btn xs dark" data-act="copiarLink">Copiar</button></div>`)}
        ${sec("Código QR", "Para imprimir en el showroom o subir a una historia.", `<div class="row" style="align-items:flex-end;gap:18px"><div class="qr">${U.qrSvg(link)}</div><button type="button" class="btn sm dark" data-act="qr.descargar">${I("download", 15)}Descargar QR</button></div>`)}
        ${sec("Texto listo para Instagram y WhatsApp", "", `<div class="mail">${esc(textoCompartir())}</div><button type="button" class="btn sm" style="align-self:flex-start" data-act="comp.texto">${I("copy", 15)}Copiar texto</button>`)}`)}`;
  };
  A["comp.texto"] = () => { U.copyToast(textoCompartir(), "Texto copiado."); return false; };

  /* ---------- Integraciones ---------- */
  P.VISTAS.integraciones = () => `${P.title("Integraciones")}${wrap(`<section class="card stack"><div class="row between"><h3 class="row">${I("calendar-days", 18)}Google Calendar con Meet</h3><span class="chip">Próximamente</span></div>
      <p class="small muted">Cada cita va a aparecer en tu calendario de Google, y las videollamadas van a tener link de Meet.</p></section>`)}`;

  /* ---------- Configuración ---------- */
  P.VISTAS.configuracion = () => {
    const R = EG.remote;
    if (!R.on) {
      return `${P.title("Configuración")}${wrap(`
      ${sec("Datos de prueba", "Para probar el panel sin esperar reservas reales. Todo queda solo en este navegador.", `<div class="row"><button type="button" class="btn sm" data-act="conf.ejemplo">Cargar datos de ejemplo</button>
        <button type="button" class="btn sm danger" data-act="conf.reset">${S.ui.confirmar === "reset" ? "Sí, borrar todo" : "Volver a los datos iniciales"}</button></div>
        ${S.ui.confirmar === "reset" ? `<p class="small muted">Se borran las citas, las clientas, los cambios del catálogo y la configuración de este navegador. Tocá “Sí, borrar todo” para confirmar.</p>` : ""}`)}`)}`;
    }
    if (!S.ui.draft) S.ui.draft = { clave: "", invEmail: "", invNombre: "", err: "" };
    const d = S.ui.draft;
    const duena = R.rol === "duena";
    return `${P.title("Configuración")}${wrap(`
      ${sec("Tu cuenta", "", `<dl class="kv"><dt>Email</dt><dd>${esc(R.user.email)}</dd><dt>Rol</dt><dd>${duena ? "Dueña" : "Puede editar"}</dd></dl>
        <form class="row nowrap" id="conf-clave" novalidate style="align-items:flex-end"><label class="f grow" for="cf-clave">Contraseña nueva<input class="t" id="cf-clave" type="password" autocomplete="new-password" value="${esc(d.clave)}" data-bind="draft.clave" placeholder="Mínimo 8 caracteres"></label>
          <button class="btn sm" type="submit">Cambiar</button></form>`)}
      ${sec("Personas con acceso", duena ? "Sumá a alguien de tu equipo. Después creale el usuario en Supabase (Authentication → Add user) con ese mismo email." : "", `<div class="rows">${R.miembros.map((m) => `<div class="rowitem">${U.avatar(m.nombre || m.email)}<span class="grow"><span class="rname">${esc(m.nombre || m.email)}</span><span class="rsub">${esc(m.email)}</span></span>
          <span class="chip">${m.rol === "duena" ? "Dueña" : "Puede editar"}</span>${duena && m.rol !== "duena" ? `<button type="button" class="iconbtn sm" data-act="conf.quitar" data-v="${esc(m.email)}" aria-label="Quitar acceso">${I("x", 14)}</button>` : ""}</div>`).join("")}</div>
        ${duena ? `<form class="fgrid two" id="conf-invitar" novalidate><label class="f" for="cf-inv">Email<input class="t" id="cf-inv" type="email" value="${esc(d.invEmail)}" data-bind="draft.invEmail"></label>
          <label class="f" for="cf-invn">Nombre<input class="t" id="cf-invn" value="${esc(d.invNombre)}" data-bind="draft.invNombre" placeholder="Ej: Mely"></label>
          <button class="btn sm" type="submit" style="align-self:flex-start">${I("user-plus", 15)}Sumar</button></form>` : ""}
        ${d.err ? `<p class="err">${esc(d.err)}</p>` : ""}`)}`)}`;
  };
  EG.submits["conf-clave"] = () => {
    const d = S.ui.draft;
    if (d.clave.length < 8) { d.err = "La contraseña tiene que tener al menos 8 caracteres."; return; }
    EG.remote.cambiarClave(d.clave).then(() => { d.clave = ""; d.err = ""; S.toast("Contraseña cambiada."); S.render(); })
      .catch((e) => { d.err = e.message; S.render(); });
    return false;
  };
  EG.submits["conf-invitar"] = () => {
    const d = S.ui.draft;
    if (!/^\S+@\S+\.\S+$/.test(d.invEmail.trim())) { d.err = "Revisá el email."; return; }
    EG.remote.invitar(d.invEmail.trim(), d.invNombre.trim()).then(() => { d.invEmail = ""; d.invNombre = ""; d.err = ""; S.toast("Listo. Ahora creale el usuario en Supabase."); S.render(); })
      .catch((e) => { d.err = e.message; S.render(); });
    return false;
  };
  A["conf.quitar"] = (el) => {
    EG.remote.quitarMiembro(el.dataset.v).then(() => { S.toast("Acceso quitado."); S.render(); }).catch((e) => S.toast(e.message));
    return false;
  };
  A["conf.ejemplo"] = () => {
    const s = S.db.settings;
    const fecha = EG.nextDays(s, 1)[0];
    if (!fecha) { S.toast("Configurá al menos un día de atención."); return false; }
    let n = 0;
    const agregar = (a) => {
      if (!EG.isSlotFree(s, S.db.appts, a.fecha, a.hora, new Date(2000, 0, 1), S.db.bloqueos)) return;
      const c = EG.upsertClienta(S.db, a, a.creada);
      a.clientaId = c.id;
      S.db.appts.push(a);
      n++;
    };
    EG.sampleHistory(S.db.products, s, EG.ymd(new Date())).forEach(agregar);
    EG.sampleAppts(S.db.products, fecha).forEach(agregar);
    S.save();
    S.toast(n ? "Se cargaron " + n + " citas de ejemplo." : "Esos horarios ya están ocupados.");
  };
  A["conf.reset"] = () => {
    if (S.ui.confirmar !== "reset") { S.ui.confirmar = "reset"; return; }
    S.ui.confirmar = null;
    EG.store.clearAll();
    S.db = EG.seed();
    S.save();
    Object.assign(S.ui, { draft: null, editProd: null, open: null, clienta: null, fotoMsg: null, draftErr: "" });
    S.toast("Listo: volvió todo a los datos iniciales.");
  };

  /* ---------- Ayuda ---------- */
  const FAQ = [
    ["¿Cómo reservan las clientas?", "Entran al link de tu agenda (lo encontrás en Compartir), eligen visita o videollamada, el día y el horario, las prendas que quieren ver y dejan sus datos."],
    ["¿Cómo les mando el recordatorio?", "En Agenda, abrí la cita y tocá “Recordatorio por WhatsApp”. Se abre WhatsApp con el mensaje armado, que incluye el link para reprogramar o cancelar. Lo enviás vos, así no tiene costo."],
    ["¿Cómo bloqueo un horario o un día?", "En Agenda, “Bloquear horario”. Para feriados o vacaciones usá Horarios y disponibilidad."],
    ["¿Cómo funciona la videollamada?", "A la hora de la cita llamás a la clienta por videollamada de WhatsApp. En el detalle de la cita, “Videollamada por WhatsApp” te abre el chat con ella: ahí tocás el ícono de la cámara."],
    ["¿Cómo cargo las fotos de las prendas?", "En Catálogo, “Cargar fotos en masa”: elegís todas juntas y cada una se asigna por el nombre del archivo."],
    ["¿Por qué no me llegan las reservas de otras personas?", "En esta primera etapa los datos se guardan en este navegador. En la etapa 2 se conecta la base de datos y las reservas llegan desde cualquier celular."]
  ];
  P.VISTAS.ayuda = () => `${P.title("Ayuda")}${wrap(`<div class="rows">${FAQ.map((f) => `<details class="tree" style="padding:0 14px"><summary style="grid-template-columns:1fr"><span class="nm b">${esc(f[0])}</span></summary><p class="small muted" style="padding:0 0 14px 16px">${esc(f[1])}</p></details>`).join("")}</div>
      <section class="card stack"><h3>¿Necesitás algo más?</h3><a class="btn sm dark" style="align-self:flex-start" href="${esc(EG.waLink(EG.SOPORTE_WA, "Hola, tengo una consulta sobre la Agenda Showroom"))}" target="_blank" rel="noopener">${I("message-circle", 15)}Escribinos por WhatsApp</a></section>`)}`;
})();
