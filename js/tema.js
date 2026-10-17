// Tema de marca: colores, tipografía y forma de la agenda de cada showroom (Perfil → Diseño de marca).
// Son opciones guiadas: se eligen de listas cerradas o con un selector de color, y se avisa si hay poco contraste.
(function (root) {
  "use strict";
  var EG = (root.EG = root.EG || {});

  // Pares de fuentes (alojadas en la app, licencia OFL): "texto" para todo y "titulo" para el nombre/logo en texto.
  EG.FUENTES = [
    { id: "clasica", nombre: "Clásica", texto: "Poppins", titulo: "Playfair Display", url: "Poppins:wght@400;500;600;700&family=Playfair+Display:wght@600" },
    { id: "moderna", nombre: "Moderna", texto: "DM Sans", titulo: "DM Serif Display", url: "DM+Sans:wght@400;500;600;700&family=DM+Serif+Display" },
    { id: "elegante", nombre: "Elegante", texto: "Montserrat", titulo: "Cormorant Garamond", url: "Montserrat:wght@400;500;600;700&family=Cormorant+Garamond:wght@600" },
    { id: "editorial", nombre: "Editorial", texto: "Lato", titulo: "Libre Baskerville", url: "Lato:wght@400;700&family=Libre+Baskerville:wght@700" },
    { id: "minimal", nombre: "Minimal", texto: "Work Sans", titulo: "Work Sans", url: "Work+Sans:wght@400;500;600;700" }
  ];
  EG.FORMAS = [
    { id: "redondeada", nombre: "Redondeada", rk: 1, pill: "999px" },
    { id: "suave", nombre: "Suave", rk: 0.55, pill: "12px" },
    { id: "recta", nombre: "Recta", rk: 0.15, pill: "3px" }
  ];
  // Paletas listas para elegir con un toque (color de marca, botones, fondo de tarjetas).
  EG.PALETAS = [
    { nombre: "Bordó", acento: "#963b56", boton: "#1e1e1e", tarjeta: "#f5f3f0", texto: "#1e1e1e" },
    { nombre: "Terracota", acento: "#b5523b", boton: "#2b2622", tarjeta: "#f6f1ec", texto: "#2b2622" },
    { nombre: "Oliva", acento: "#5f6b3a", boton: "#1f2418", tarjeta: "#f2f2ea", texto: "#1f2418" },
    { nombre: "Azul noche", acento: "#2f4a7a", boton: "#16213a", tarjeta: "#eef1f6", texto: "#16213a" },
    { nombre: "Rosa", acento: "#c2577f", boton: "#3a2230", tarjeta: "#f8eff3", texto: "#3a2230" },
    { nombre: "Negro", acento: "#1e1e1e", boton: "#1e1e1e", tarjeta: "#f3f3f3", texto: "#111111" }
  ];
  EG.TEMA_DEF = { acento: "#963b56", boton: "#1e1e1e", tarjeta: "#f5f3f0", texto: "#1e1e1e", fuente: "clasica", forma: "redondeada" };

  EG.tema = function (s) {
    var t = Object.assign({}, EG.TEMA_DEF, (s && s.tema) || {});
    ["acento", "boton", "tarjeta", "texto"].forEach(function (k) { if (!/^#[0-9a-f]{6}$/i.test(t[k])) t[k] = EG.TEMA_DEF[k]; });
    if (!EG.FUENTES.some(function (f) { return f.id === t.fuente; })) t.fuente = EG.TEMA_DEF.fuente;
    if (!EG.FORMAS.some(function (f) { return f.id === t.forma; })) t.forma = EG.TEMA_DEF.forma;
    return t;
  };

  /* ---------- color ---------- */
  function rgb(hex) { var n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function hex(c) { return "#" + c.map(function (v) { return Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0"); }).join(""); }
  function lum(h) {
    return rgb(h).map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); })
      .reduce(function (a, v, i) { return a + v * [0.2126, 0.7152, 0.0722][i]; }, 0);
  }
  EG.contraste = function (a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  // Texto que mejor se lee sobre un color (blanco o casi negro).
  EG.tintaSobre = function (h) { return EG.contraste(h, "#ffffff") >= EG.contraste(h, "#1e1e1e") ? "#ffffff" : "#1e1e1e"; };
  function mezclar(h, con, p) { var a = rgb(h), b = rgb(con); return hex(a.map(function (v, i) { return v + (b[i] - v) * p; })); }

  // Variables CSS del tema.
  EG.temaVars = function (t) {
    var f = EG.FUENTES.find(function (x) { return x.id === t.fuente; });
    var fo = EG.FORMAS.find(function (x) { return x.id === t.forma; });
    return {
      "--accent": t.acento, "--accent-soft": mezclar(t.acento, "#ffffff", 0.9), "--accent-ink": EG.tintaSobre(t.acento),
      "--btn": t.boton, "--btn-ink": EG.tintaSobre(t.boton),
      "--ink": t.texto, "--muted": mezclar(t.texto, "#ffffff", 0.35),
      "--card": t.tarjeta, "--img": mezclar(t.tarjeta, "#1e1e1e", 0.05), "--line": mezclar(t.tarjeta, "#1e1e1e", 0.1),
      "--font": '"' + f.texto + '", system-ui, -apple-system, "Segoe UI", sans-serif',
      "--serif": '"' + f.titulo + '", Georgia, "Times New Roman", serif',
      "--rk": String(fo.rk), "--r-pill": fo.pill
    };
  };
  // Avisos de legibilidad (para el editor).
  EG.temaAvisos = function (t) {
    var av = [];
    if (EG.contraste(t.acento, "#ffffff") < 3 && EG.contraste(t.acento, "#1e1e1e") < 3) av.push("El color de marca tiene poco contraste: los horarios y talles elegidos se pueden leer mal.");
    if (EG.contraste(t.boton, "#ffffff") < 3 && EG.contraste(t.boton, "#1e1e1e") < 3) av.push("El color de los botones tiene poco contraste con su texto.");
    if (EG.contraste(t.texto, "#ffffff") < 4.5) av.push("El color del texto es muy claro: cuesta leerlo sobre el fondo blanco.");
    if (EG.contraste(t.tarjeta, "#1e1e1e") < 7) av.push("El fondo de las tarjetas es oscuro: conviene un tono claro para que el texto se lea bien.");
    return av;
  };

  /* ---------- aplicar ---------- */
  // Las fuentes están alojadas en la app (css/fonts.css): el navegador baja solo la que se usa. No hay conexión con Google Fonts.
  EG.cargarFuente = function () {};
  // Aplica el tema a un elemento (por defecto, a toda la página).
  EG.aplicarTema = function (t, el) {
    var vars = EG.temaVars(t);
    var target = el || document.documentElement;
    Object.keys(vars).forEach(function (k) { target.style.setProperty(k, vars[k]); });
    EG.cargarFuente(t.fuente);
  };
  EG.temaStyle = function (t) {
    var vars = EG.temaVars(t);
    return Object.keys(vars).map(function (k) { return k + ":" + vars[k]; }).join(";");
  };
})(typeof window !== "undefined" ? window : globalThis);
