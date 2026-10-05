// Piezas de interfaz compartidas entre la vista pública y el panel.
(function () {
  "use strict";
  const EG = window.EG;
  const { esc, icon: I } = EG;
  const U = (EG.ui = {});

  U.inicial = (nombre) => (String(nombre || "e").trim().charAt(0) || "e").toLowerCase() + ".";

  // Avatar con las iniciales; el color sale del nombre, así cada persona siempre tiene el mismo.
  const AV = ["#5a2b57", "#7c3aed", "#15803d", "#c2410c", "#0f766e", "#be185d", "#a16207", "#4338ca", "#b91c1c", "#0e7490"];
  U.avatar = (nombre) => {
    const n = String(nombre || "?").trim();
    const ini = n.split(/\s+/).slice(0, 2).map((w) => w.charAt(0)).join("").toUpperCase() || "?";
    let h = 0;
    for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) >>> 0;
    return `<span class="av" style="background:${AV[h % AV.length]}" aria-hidden="true">${esc(ini)}</span>`;
  };

  U.photo = (p) => {
    const src = EG.photoSrc(p);
    return src
      ? `<img src="${esc(src)}" alt="" loading="lazy" decoding="async">`
      : I("shirt", 34);
  };
  U.thumb = (p) => {
    const src = EG.photoSrc(p);
    return `<span>${src ? `<img src="${esc(src)}" alt="" loading="lazy" decoding="async">` : ""}</span>`;
  };

  // Chips de categoría. `action` es el data-act que cambia el filtro.
  U.cats = (active, action) =>
    `<div class="cats" role="group" aria-label="Categoría">${EG.CATEGORIAS.map(
      (c) => `<button type="button" data-act="${action}" data-v="${esc(c)}" aria-pressed="${c === active}">${esc(c)}</button>`
    ).join("")}</div>`;

  U.estadoChip = (a) =>
    ({
      confirmada: '<span class="chip">Confirmada</span>',
      asistio: '<span class="chip ok">Asistió</span>',
      no_vino: '<span class="chip warn">No vino</span>',
      cancelada: '<span class="chip bad">Cancelada</span>'
    }[a.estado] || "");

  U.tipoTxt = (a, corto) => (a.tipo === "video" ? "Videollamada" : corto ? "Presencial" : "Visita al showroom");

  // Copia al portapapeles. navigator.clipboard no existe fuera de https/localhost, por eso el plan B.
  U.copy = (text) => {
    const fallback = () => {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      return ok ? Promise.resolve() : Promise.reject(new Error("copy"));
    };
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text).catch(fallback);
    return fallback();
  };
})();
