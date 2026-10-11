// Piezas de interfaz compartidas entre la vista pública y el panel.
(function () {
  "use strict";
  const EG = window.EG;
  const { esc, icon: I } = EG;
  const U = (EG.ui = {});

  // Logo: la imagen cargada en Perfil público o, si no hay, el nombre en serif ("egoh.").
  U.logo = (s, cls, act) => {
    const src = s.logo ? EG.store.fotoGet("logo") : "";
    const inner = src ? `<img src="${esc(src)}" alt="${esc(s.nombre)}">` : esc(String(s.nombre || "").toLowerCase()) + ".";
    return act
      ? `<button type="button" class="logo ${cls || ""}" data-act="${act}" data-v="inicio" aria-label="${esc(s.nombre)}">${inner}</button>`
      : `<span class="logo ${cls || ""}">${inner}</span>`;
  };

  U.iniciales = (nombre) => String(nombre || "?").trim().split(/\s+/).slice(0, 2).map((w) => w.charAt(0)).join("").toUpperCase() || "?";
  U.avatar = (nombre, cls) => `<span class="av ${cls || ""}" aria-hidden="true">${esc(U.iniciales(nombre))}</span>`;

  U.photo = (p) => {
    const src = EG.photoSrc(p);
    return src ? `<img src="${esc(src)}" alt="" loading="lazy" decoding="async">` : I("shirt", 30);
  };
  U.thumb = (p) => {
    const src = EG.photoSrc(p);
    return `<span>${src ? `<img src="${esc(src)}" alt="" loading="lazy" decoding="async">` : ""}</span>`;
  };
  U.thumbs = (prendas, max) => {
    const n = max || 4;
    const extra = prendas.length - n;
    return `<span class="thumbs">${prendas.slice(0, n).map((i) => U.thumb(EG.S.prod(i.id))).join("")}${extra > 0 ? `<span class="more">+${extra}</span>` : ""}</span>`;
  };

  // Píldoras de categoría. `action` es el data-act que cambia el filtro.
  U.cats = (active, action) =>
    `<div class="pills scroll" role="group" aria-label="Categoría" data-keepscroll="cats">${EG.CATEGORIAS.map(
      (c) => `<button type="button" class="pill" data-act="${action}" data-v="${esc(c)}" aria-pressed="${c === active}">${esc(c)}</button>`
    ).join("")}</div>`;

  U.ESTADOS = [["confirmada", "Confirmada"], ["asistio", "Asistió"], ["no_vino", "No vino"], ["cancelada", "Cancelada"]];
  U.estadoChip = (a) =>
    ({
      confirmada: '<span class="chip accent">Confirmada</span>',
      asistio: '<span class="chip ok">Asistió</span>',
      no_vino: '<span class="chip warn">No vino</span>',
      cancelada: '<span class="chip bad">Cancelada</span>'
    }[a.estado] || "");

  U.tipoTxt = (a, corto) => (a.tipo === "video" ? "Videollamada" : corto ? "Presencial" : "Visita al showroom");
  U.mapsLink = (dir) => "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(dir);
  U.plural = (n, uno, varios) => n + " " + (n === 1 ? uno : varios || uno + "s");

  // Código QR como SVG (librería qrcode-generator, MIT, en js/vendor).
  U.qrSvg = (text) => {
    if (!window.qrcode) return "";
    const q = window.qrcode(0, "M");
    q.addData(text);
    q.make();
    return q.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
  };
  U.qrPng = (text, size) => {
    const q = window.qrcode(0, "M");
    q.addData(text);
    q.make();
    const n = q.getModuleCount(), m = 4, px = Math.floor((size || 800) / (n + m * 2));
    const c = document.createElement("canvas");
    c.width = c.height = px * (n + m * 2);
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = "#1e1e1e";
    for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) ctx.fillRect((k + m) * px, (r + m) * px, px, px);
    return c.toDataURL("image/png");
  };

  // Descarga un archivo (texto o data URL) sin servidor.
  U.download = (filename, content, type) => {
    const a = document.createElement("a");
    let url = content;
    if (!/^data:/.test(content)) url = URL.createObjectURL(new Blob(["﻿" + content], { type: type || "text/csv;charset=utf-8" }));
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (url !== content) setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

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
  U.copyToast = (text, ok) =>
    U.copy(text).then(() => EG.S.toast(ok || "Copiado.")).catch(() => EG.S.toast("No se pudo copiar. Seleccionalo y copialo a mano."));
})();
