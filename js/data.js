// Lógica pura de clientas, métricas, migración de datos y exportación CSV. No toca el DOM.
(function (root) {
  "use strict";
  var EG = (root.EG = root.EG || {});

  EG.COMO_COMPRA = ["1ra compra", "Emprendimiento", "Revendedora", "Comercio", "Uso personal"];

  /* ---------- migración: datos de la v1 a la v2 ---------- */
  // Suma lo que falta (clientas, bloqueos, feriados, fechas especiales, opciones de "¿Cómo comprás?")
  // y crea las clientas a partir de las citas que ya había. Se puede correr varias veces.
  EG.migrate = function (db) {
    var def = EG.defaultSettings();
    Object.keys(def).forEach(function (k) { if (db.settings[k] === undefined) db.settings[k] = def[k]; });
    if (!Array.isArray(db.clientas)) db.clientas = [];
    if (!Array.isArray(db.bloqueos)) db.bloqueos = [];
    db.appts.forEach(function (a) {
      if (!a.origen) a.origen = "clienta";
      if (a.zona === undefined) a.zona = "";
      if (!a.clientaId && a.whatsapp) {
        var c = EG.upsertClienta(db, a, a.creada || a.fecha);
        a.clientaId = c.id;
      }
    });
    db.v = 2;
    return db;
  };

  /* ---------- clientas ---------- */
  EG.clientaPorWa = function (db, wa) {
    return db.clientas.filter(function (c) { return c.whatsapp === wa; })[0] || null;
  };
  // Crea o actualiza la clienta (se identifica por el WhatsApp). Los datos nuevos completan o pisan
  // a los anteriores solo si vienen con contenido; las notas nunca se pisan.
  EG.upsertClienta = function (db, d, cuando) {
    var c = EG.clientaPorWa(db, d.whatsapp);
    if (!c) {
      c = { id: "c-" + EG.uid(10), nombre: "", whatsapp: d.whatsapp, email: "", zona: "", comoCompra: "", notas: "", creada: cuando || new Date().toISOString() };
      db.clientas.push(c);
    }
    ["nombre", "email", "zona", "comoCompra"].forEach(function (k) {
      if (d[k] && String(d[k]).trim()) c[k] = String(d[k]).trim();
    });
    if (cuando && cuando < c.creada) c.creada = cuando;
    return c;
  };
  EG.citasDe = function (db, c) {
    return db.appts
      .filter(function (a) { return a.clientaId === c.id || (!a.clientaId && a.whatsapp === c.whatsapp); })
      .sort(function (x, y) { return (y.fecha + y.hora).localeCompare(x.fecha + x.hora); });
  };
  function topTalles(lista) {
    var n = {};
    lista.forEach(function (t) { n[t] = (n[t] || 0) + 1; });
    return Object.keys(n).sort(function (a, b) { return n[b] - n[a] || a.localeCompare(b); }).slice(0, 2);
  }
  EG.clientaStats = function (db, c) {
    var citas = EG.citasDe(db, c);
    var asistio = citas.filter(function (a) { return a.estado === "asistio"; });
    var elegidas = 0, llevadas = 0, talles = [];
    asistio.forEach(function (a) {
      a.prendas.forEach(function (i) {
        elegidas++;
        if (i.seLlevo === true) { llevadas++; talles.push(i.talle, i.talle); } // lo llevado pesa doble
        else talles.push(i.talle);
      });
    });
    citas.forEach(function (a) { if (a.estado !== "asistio" && a.estado !== "cancelada") a.prendas.forEach(function (i) { talles.push(i.talle); }); });
    return {
      citas: citas,
      visitas: asistio.length,
      faltazos: citas.filter(function (a) { return a.estado === "no_vino"; }).length,
      elegidas: elegidas,
      llevadas: llevadas,
      ultima: asistio.length ? asistio[0].fecha : "",
      talles: topTalles(talles),
      frecuente: asistio.length >= 3
    };
  };

  /* ---------- métricas ---------- */
  function rango(desde, hasta) {
    return function (a) { return a.fecha >= desde && a.fecha <= hasta; };
  }
  function pct(a, b) { return b ? Math.round((a / b) * 100) : 0; }
  function compro(a) { return a.prendas.some(function (i) { return i.seLlevo === true; }); }
  EG.periodoAnterior = function (desde, hasta) {
    var d = EG.parseYmd(desde), h = EG.parseYmd(hasta);
    var dias = Math.round((h - d) / 864e5) + 1;
    var nh = new Date(d.getTime()); nh.setDate(nh.getDate() - 1);
    var nd = new Date(nh.getTime()); nd.setDate(nd.getDate() - dias + 1);
    return [EG.ymd(nd), EG.ymd(nh)];
  };
  EG.metricas = function (db, desde, hasta, getProd) {
    var todas = db.appts;
    var citas = todas.filter(rango(desde, hasta));
    var activas = citas.filter(function (a) { return a.estado !== "cancelada"; });
    var asist = citas.filter(function (a) { return a.estado === "asistio"; });
    var conCompra = asist.filter(compro);
    var precio = function (id) { var p = getProd(id); return p && p.precio > 0 ? p.precio : 0; };
    var hayPrecios = db.products.some(function (p) { return p.precio > 0; });
    var pre = 0, vend = 0;
    activas.forEach(function (a) { a.prendas.forEach(function (i) { pre += precio(i.id); if (i.seLlevo === true) vend += precio(i.id); }); });

    var tipo = function (t) {
      var as = asist.filter(function (a) { return a.tipo === t; });
      return { citas: activas.filter(function (a) { return a.tipo === t; }).length, conversion: pct(as.filter(compro).length, as.length) };
    };

    // Prendas: modelo → color → talle, elegidas contra llevadas.
    var modelos = {};
    activas.forEach(function (a) {
      a.prendas.forEach(function (i) {
        var p = getProd(i.id) || {};
        var mod = p.modelo || p.nombre || i.nombre || "Prenda";
        var col = p.color || "—";
        var m = (modelos[mod] = modelos[mod] || { nombre: mod, elegidas: 0, llevadas: 0, colores: {} });
        var c = (m.colores[col] = m.colores[col] || { nombre: col, id: i.id, elegidas: 0, llevadas: 0, talles: {} });
        var t = (c.talles[i.talle] = c.talles[i.talle] || { nombre: i.talle, elegidas: 0, llevadas: 0 });
        var llevo = i.seLlevo === true ? 1 : 0;
        m.elegidas++; c.elegidas++; t.elegidas++;
        m.llevadas += llevo; c.llevadas += llevo; t.llevadas += llevo;
      });
    });
    var ordenar = function (obj) { return Object.keys(obj).map(function (k) { return obj[k]; }).sort(function (a, b) { return b.elegidas - a.elegidas || a.nombre.localeCompare(b.nombre); }); };
    var prendas = ordenar(modelos).map(function (m) {
      return { nombre: m.nombre, elegidas: m.elegidas, llevadas: m.llevadas, colores: ordenar(m.colores).map(function (c) {
        return { nombre: c.nombre, id: c.id, elegidas: c.elegidas, llevadas: c.llevadas, talles: ordenar(c.talles) };
      }) };
    });
    var alertas = [];
    prendas.forEach(function (m) {
      m.colores.forEach(function (c) {
        if (c.elegidas >= 3 && c.llevadas / c.elegidas < 0.34) alertas.push({ nombre: m.nombre + " " + c.nombre, id: c.id, elegidas: c.elegidas, llevadas: c.llevadas });
      });
    });

    var tipos = {};
    activas.forEach(function (a) { var k = a.comoCompra || "Sin dato"; (tipos[k] = tipos[k] || []).push(a); });
    var tiposClienta = Object.keys(tipos).map(function (k) {
      var as = tipos[k].filter(function (a) { return a.estado === "asistio"; });
      return { nombre: k, citas: tipos[k].length, conversion: pct(as.filter(compro).length, as.length) };
    }).sort(function (a, b) { return b.citas - a.citas; });

    var dias = [0, 0, 0, 0, 0, 0, 0], horas = {};
    activas.forEach(function (a) { dias[EG.parseYmd(a.fecha).getDay()]++; horas[a.hora] = (horas[a.hora] || 0) + 1; });

    var nuevas = 0, vuelven = 0, vistas = {};
    activas.forEach(function (a) {
      var key = a.clientaId || a.whatsapp;
      if (vistas[key]) return;
      vistas[key] = true;
      var antes = todas.some(function (x) { return (x.clientaId || x.whatsapp) === key && x.fecha < desde && x.estado !== "cancelada"; });
      if (antes) vuelven++; else nuevas++;
    });

    return {
      citas: {
        visitas: activas.length,
        confirmadas: citas.filter(function (a) { return a.estado === "confirmada"; }).length,
        asistencias: asist.length,
        cancelaciones: citas.filter(function (a) { return a.estado === "cancelada"; }).length,
        faltazos: citas.filter(function (a) { return a.estado === "no_vino"; }).length,
        conversion: pct(conCompra.length, asist.length)
      },
      montos: { activos: hayPrecios, preseleccionado: pre, vendido: vend, ticket: conCompra.length ? Math.round(vend / conCompra.length) : 0 },
      tipo: { presencial: tipo("presencial"), video: tipo("video") },
      prendas: prendas,
      alertas: alertas,
      tiposClienta: tiposClienta,
      dias: dias,
      horas: Object.keys(horas).sort().map(function (h) { return { h: h, n: horas[h] }; }),
      clientas: { nuevas: nuevas, vuelven: vuelven }
    };
  };

  /* ---------- CSV ---------- */
  EG.toCSV = function (rows) {
    return rows.map(function (r) {
      return r.map(function (v) {
        var s = String(v == null ? "" : v);
        if (/^[=+\-@]/.test(s)) s = "'" + s; // evita fórmulas al abrirlo en Excel
        return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(",");
    }).join("\r\n");
  };
})(typeof window !== "undefined" ? window : globalThis);
