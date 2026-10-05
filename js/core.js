// Lógica pura de la agenda: fechas, disponibilidad de turnos, teléfonos, mensajes de
// WhatsApp y asignación de fotos por nombre de archivo. No toca el DOM ni el storage.
(function (root) {
  "use strict";
  var EG = (root.EG = root.EG || {});

  var DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  var DIAS_LARGOS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  var MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  EG.DIAS = DIAS;
  EG.MESES = MESES;

  /* ---------- texto y números ---------- */
  EG.esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  EG.money = function (n) {
    return "$" + Math.round(n).toLocaleString("es-AR");
  };
  EG.slug = function (s) {
    return String(s).toLowerCase().replace(/ \/ /g, "-").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  };
  EG.uid = function (len) {
    var n = len || 8;
    var a = new Uint8Array(n);
    if (root.crypto && root.crypto.getRandomValues) root.crypto.getRandomValues(a);
    else for (var i = 0; i < n; i++) a[i] = Math.floor(Math.random() * 256);
    var out = "";
    for (var j = 0; j < n; j++) out += (a[j] % 36).toString(36);
    return out;
  };

  /* ---------- fechas y horas ---------- */
  function pad(n) { return String(n).padStart(2, "0"); }
  EG.ymd = function (d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
  EG.parseYmd = function (s) {
    var p = String(s).split("-").map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
  };
  EG.fechaLarga = function (s) {
    var d = EG.parseYmd(s);
    return DIAS_LARGOS[d.getDay()] + " " + d.getDate() + " de " + MESES[d.getMonth()];
  };
  EG.toMin = function (h) {
    var p = String(h).split(":").map(Number);
    return p[0] * 60 + p[1];
  };
  EG.toH = function (m) { return pad(Math.floor(m / 60)) + ":" + pad(m % 60); };

  /* ---------- disponibilidad ---------- */
  // Próximos días hábiles (según los días de atención), empezando por hoy.
  EG.nextDays = function (settings, n, from) {
    var out = [];
    if (!settings.dias || !settings.dias.length) return out;
    var d = from ? new Date(from.getTime()) : new Date();
    d.setHours(0, 0, 0, 0);
    for (var guard = 0; out.length < n && guard < 800; guard++) {
      if (settings.dias.indexOf(d.getDay()) >= 0) out.push(EG.ymd(d));
      d.setDate(d.getDate() + 1);
    }
    return out;
  };

  function activa(a) { return a.estado !== "cancelada"; }

  // Turnos de un día. Un horario se ocupa una sola vez, sea presencial o videollamada:
  // cualquier cita no cancelada que se superponga lo deja sin disponibilidad.
  EG.slotsFor = function (settings, appts, date, now) {
    var cur = now || new Date();
    var dur = settings.duracion;
    var hoy = EG.ymd(cur);
    var ahora = cur.getHours() * 60 + cur.getMinutes();
    var out = [];
    (settings.franjas || []).forEach(function (f) {
      for (var m = EG.toMin(f[0]); m + dur <= EG.toMin(f[1]); m += dur) {
        var ocupado = appts.some(function (a) {
          if (a.fecha !== date || !activa(a)) return false;
          var s = EG.toMin(a.hora);
          return s < m + dur && m < s + dur;
        });
        var pasado = date < hoy || (date === hoy && m <= ahora);
        out.push({ h: EG.toH(m), off: ocupado || pasado, ocupado: ocupado });
      }
    });
    return out;
  };
  EG.isSlotFree = function (settings, appts, date, hora, now) {
    return EG.slotsFor(settings, appts, date, now).some(function (s) { return s.h === hora && !s.off; });
  };

  /* ---------- prendas y totales ---------- */
  EG.priceTxt = function (p) {
    return p && p.precio > 0 ? EG.money(p.precio) : "Precio a confirmar";
  };
  EG.totalOf = function (prendas, getProd) {
    return prendas.reduce(function (s, i) {
      var p = getProd(i.id);
      return s + (p ? p.precio || 0 : 0);
    }, 0);
  };
  EG.allPriced = function (prendas, getProd) {
    return prendas.every(function (i) {
      var p = getProd(i.id);
      return !!p && p.precio > 0;
    });
  };
  EG.itemName = function (it, getProd) {
    var p = getProd(it.id);
    return (p && p.nombre) || it.nombre || "Prenda";
  };

  /* ---------- WhatsApp ---------- */
  // Devuelve el número listo para wa.me (549 + código de área + número, sin el 15) o null.
  EG.normalizePhone = function (raw) {
    var s = String(raw == null ? "" : raw).trim();
    var d = s.replace(/\D/g, "");
    if (!d) return null;
    if (s.charAt(0) === "+" && d.slice(0, 2) !== "54") {
      return d.length >= 8 && d.length <= 15 ? d : null; // número de otro país
    }
    if (d.slice(0, 2) === "54") d = d.slice(2);
    if (d.charAt(0) === "9" && d.length === 11) d = d.slice(1);
    d = d.replace(/^0+/, "");
    if (d.length === 12) {
      for (var i = 2; i <= 4; i++) {
        if (d.slice(i, i + 2) === "15") { d = d.slice(0, i) + d.slice(i + 2); break; }
      }
    }
    return d.length === 10 ? "549" + d : null;
  };
  EG.waLink = function (phone, text) {
    return "https://wa.me/" + String(phone).replace(/\D/g, "") + "?text=" + encodeURIComponent(text);
  };
  EG.videoLink = function (a) { return "https://meet.jit.si/" + a.sala; };

  function linea(it, getProd, conPrecio) {
    var t = "• " + EG.itemName(it, getProd) + " (talle " + it.talle + ")";
    if (conPrecio) t += " – " + EG.priceTxt(getProd(it.id));
    return t;
  }
  EG.msgRecordatorio = function (a, settings, getProd) {
    var nombre = a.nombre.split(" ")[0];
    var t = "¡Hola " + nombre + "! Te recordamos tu cita en " + settings.nombre + " el " + EG.fechaLarga(a.fecha) + " a las " + a.hora + " hs.";
    if (a.tipo === "video") t += "\nEs por videollamada. Entrás desde este link: " + EG.videoLink(a);
    else t += "\nTe esperamos en " + settings.direccion + ".";
    if (a.prendas.length) {
      t += "\n\nTenemos listas las prendas que elegiste:\n" + a.prendas.map(function (i) { return linea(i, getProd, false); }).join("\n");
    }
    t += "\n\nSi no podés venir, avisanos así liberamos el horario. ¡Gracias!";
    return t;
  };
  EG.msgSeguimiento = function (a, settings, getProd) {
    var nombre = a.nombre.split(" ")[0];
    var pend = a.prendas.filter(function (i) { return i.seLlevo !== true; });
    var t = "¡Hola " + nombre + "! Gracias por tu visita a " + settings.nombre + ".";
    if (pend.length) {
      t += "\nTe dejo las prendas que viste y no llevaste, por si las querés sumar:\n" + pend.map(function (i) { return linea(i, getProd, true); }).join("\n");
    }
    t += "\n\nCualquier cosa, escribime por acá.";
    return t;
  };

  /* ---------- carga masiva de fotos ---------- */
  EG.normName = function (s) {
    return String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  };
  // "Bikini_Cala_Black_01.jpg" -> { key: "bikini cala black", nn: 1 }
  EG.parseFotoFile = function (filename) {
    var base = String(filename).replace(/\.[^.]+$/, "");
    var m = /^(.*?)[_\s-]+(\d{1,3})$/.exec(base);
    if (!m) return { key: EG.normName(base), nn: null };
    return { key: EG.normName(m[1]), nn: parseInt(m[2], 10) };
  };
  // Asigna cada archivo a su prenda por el nombre. Solo se usa la foto principal de cada
  // prenda (_01, salvo que la prenda indique otra en fotoNum); las demás se informan como ignoradas.
  EG.matchFotos = function (filenames, products) {
    var byKey = {};
    products.forEach(function (p) {
      var k = EG.normName(p.nombre);
      if (!byKey[k]) byKey[k] = p;
    });
    var asignadas = [];
    var ignoradas = [];
    filenames.forEach(function (name) {
      var f = EG.parseFotoFile(name);
      var p = byKey[f.key];
      if (!p) { ignoradas.push({ archivo: name, motivo: "no coincide con ninguna prenda" }); return; }
      var principal = p.fotoNum || 1;
      if (f.nn !== null && f.nn !== principal) {
        ignoradas.push({ archivo: name, motivo: "no es la foto principal (_" + String(principal).padStart(2, "0") + ")" });
        return;
      }
      asignadas.push({ archivo: name, productoId: p.id, nombre: p.nombre });
    });
    return { asignadas: asignadas, ignoradas: ignoradas };
  };
})(typeof window !== "undefined" ? window : globalThis);
