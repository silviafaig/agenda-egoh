// Datos iniciales de EGOH: configuración del showroom y catálogo de Bikinis SS27.
(function (root) {
  "use strict";
  var EG = (root.EG = root.EG || {});

  EG.CATEGORIAS = ["Bikinis SS27", "Colecciones anteriores", "Lencería", "Pijamas"];
  EG.TALLES_BIKINI = ["1", "2", "3", "4", "5", "6"];

  var BIKINIS_SS27 = [
    ["Cala", ["Black", "Malbec", "Moka", "Navy Blue", "Olive"]],
    ["Dolce", ["Cream Botanic", "Lemon Botanic", "Malbec", "Moka", "Navy Blue"]],
    ["Luce", ["Cream Botanic", "Lemon Botanic", "Moka Botanic"]],
    ["Mare", ["Black", "Malbec", "Moka", "Navy Blue", "Olive"]],
    ["Pietra", ["Black", "Malbec", "Moka", "Olive"]],
    ["Reversible Vela", ["Malbec / Black", "Moka / Cream"]],
    ["Sole", ["Moka Botanic", "Navy Blue", "Olive"]],
    ["Tropea", ["Black / Cream", "Malbec / Cream", "Navy Blue / Cream"]],
    ["Vita", ["Cream Botanic", "Lemon Botanic", "Moka Botanic"]]
  ];

  EG.defaultSettings = function () {
    return {
      nombre: "EGOH",
      direccion: "Av. Federico Lacroze 2911 PB A, Colegiales",
      info: "La visita es únicamente con cita previa y dura como máximo 30 minutos. Elegí antes las prendas que querés ver así las tenemos listas.",
      dias: [1, 2, 3, 4, 5],
      franjas: [["11:30", "13:00"], ["14:00", "16:30"]],
      duracion: 30,
      compraMinima: 40000,
      compraMinimaNota: "por tiempo limitado",
      feriados: [],
      fechasEspeciales: [],
      opcionesComoCompra: ["1ra compra", "Emprendimiento", "Revendedora", "Comercio", "Uso personal"],
      saludoNombre: "Sil",
      aceptaReservas: true,
      anticipacionMinHoras: 24,
      anticipacionMaxDias: 30,
      cambiosMinHoras: 24,
      maxReprogramaciones: 0,
      whatsappShowroom: "5491140354792",
      instagram: "egoh.ar",
      logo: "",
      portada: ""
    };
  };

  // Valores de arranque para un showroom nuevo (alta): genéricos, sin datos de EGOH.
  EG.settingsBase = function () {
    return {
      nombre: "", direccion: "", info: "Las visitas son únicamente con cita previa. Elegí antes las prendas que querés ver así las tenemos listas.",
      dias: [1, 2, 3, 4, 5], franjas: [["10:00", "13:00"], ["14:00", "18:00"]], duracion: 30,
      compraMinima: 0, compraMinimaNota: "", feriados: [], fechasEspeciales: [],
      opcionesComoCompra: ["1ra compra", "Emprendimiento", "Revendedora", "Comercio", "Uso personal"],
      saludoNombre: "", aceptaReservas: true, anticipacionMinHoras: 24, anticipacionMaxDias: 30, cambiosMinHoras: 24, maxReprogramaciones: 0,
      whatsappShowroom: "", instagram: "", logo: "", portada: "", mostrarPrecios: true,
      categorias: ["Colección actual"]
    };
  };
  // Categorías del catálogo: las del showroom (Catálogo → Categorías) o, si nunca se editaron, las de EGOH.
  EG.cats = function (settings) {
    var c = settings && settings.categorias;
    return Array.isArray(c) && c.length ? c : EG.CATEGORIAS;
  };

  EG.seedProducts = function () {
    var out = [];
    BIKINIS_SS27.forEach(function (m) {
      m[1].forEach(function (color) {
        var nombre = "Bikini " + m[0] + " " + color;
        var id = EG.slug(nombre);
        out.push({
          id: id,
          nombre: nombre,
          modelo: m[0],
          color: color,
          categoria: "Bikinis SS27",
          precio: 0,
          talles: EG.TALLES_BIKINI.slice(),
          foto: "fotos/" + id + ".jpg",
          // La foto de la card es la _01 de la carpeta de fotos, salvo esta prenda, que usa la _02.
          fotoNum: m[0] === "Reversible Vela" && color === "Malbec / Black" ? 2 : 1
        });
      });
    });
    return out;
  };

  EG.seed = function () {
    return { v: 2, settings: EG.defaultSettings(), products: EG.seedProducts(), appts: [], clientas: [], bloqueos: [] };
  };

  // Citas de ejemplo para probar el panel (se cargan a pedido desde Configuración).
  EG.sampleAppts = function (products, fecha) {
    function pick(ids) {
      return ids.filter(function (id) { return products.some(function (p) { return p.id === id; }); });
    }
    function prendas(ids, talle, llevo) {
      return pick(ids).map(function (id, i) {
        var p = products.filter(function (x) { return x.id === id; })[0];
        return { id: id, nombre: p.nombre, talle: talle[i % talle.length], seLlevo: llevo ? llevo[i % llevo.length] : null };
      });
    }
    return [
      {
        id: EG.uid(), fecha: fecha, hora: "11:30", tipo: "presencial", estado: "confirmada",
        nombre: "Carla Medina", whatsapp: "5491155550101", email: "carla@ejemplo.com", comoCompra: "Revendedora", zona: "Lanús", origen: "clienta",
        queBusca: "Busco talles grandes para mi local en Lanús.",
        prendas: prendas(["bikini-dolce-malbec", "bikini-mare-olive", "bikini-tropea-black-cream"], ["5", "6", "5"]),
        notas: "", sala: null, creada: new Date().toISOString()
      },
      {
        id: EG.uid(), fecha: fecha, hora: "14:30", tipo: "video", estado: "confirmada",
        nombre: "Julieta Paz", whatsapp: "5493515550202", email: "juli@ejemplo.com", comoCompra: "Comercio", zona: "Córdoba", origen: "clienta",
        queBusca: "Tengo una tienda en Córdoba. Quiero ver las texturas de cerca.",
        prendas: prendas(["bikini-vita-lemon-botanic", "bikini-cala-navy-blue", "bikini-sole-moka-botanic", "bikini-pietra-black"], ["3", "4", "3", "4"]),
        notas: "", sala: "showroom-" + EG.uid(14), creada: new Date().toISOString()
      },
      {
        id: EG.uid(), fecha: fecha, hora: "16:00", tipo: "presencial", estado: "asistio",
        nombre: "Romina Sosa", whatsapp: "5491155550303", email: "romi@ejemplo.com", comoCompra: "Emprendimiento", zona: "Caballito", origen: "manual",
        queBusca: "",
        prendas: prendas(["bikini-cala-black", "bikini-luce-cream-botanic"], ["3", "2"], [true, false]),
        notas: "Le encantó la Luce pero la quería en otro color.", sala: null, creada: new Date().toISOString()
      }
    ];
  };

  // Historial de ejemplo de las últimas semanas, para ver Clientas y Métricas con datos.
  // Es determinístico: siempre arma las mismas citas para las mismas fechas.
  EG.sampleHistory = function (products, settings, hoy) {
    var personas = [
      ["Carla Medina", "5491155550101", "carla@ejemplo.com", "Revendedora", "Lanús"],
      ["Julieta Paz", "5493515550202", "juli@ejemplo.com", "Comercio", "Córdoba"],
      ["Romina Sosa", "5491155550303", "romi@ejemplo.com", "Emprendimiento", "Caballito"],
      ["Lucía Ferro", "5491155550404", "lu@ejemplo.com", "Revendedora", "Quilmes"],
      ["Paula Ríos", "5492235550505", "pau@ejemplo.com", "Comercio", "Mar del Plata"],
      ["Sofía Lenz", "5491155550606", "sofi@ejemplo.com", "1ra compra", "Palermo"]
    ];
    var estados = ["asistio", "asistio", "asistio", "no_vino", "asistio", "cancelada", "asistio", "asistio", "no_vino", "asistio", "asistio", "asistio"];
    var out = [];
    var d = EG.parseYmd(hoy);
    var horas = ["11:30", "12:00", "14:00", "14:30", "15:30", "16:00", "12:30", "15:00"];
    for (var k = 0, n = 0; n < 12 && k < 60; k++) {
      d.setDate(d.getDate() - 1);
      var f = EG.ymd(d);
      if (!EG.diaAbierto(settings, f) || k % 2) continue;
      var per = personas[n % personas.length];
      var est = estados[n];
      var ids = [];
      for (var j = 0; j < 2 + (n % 3); j++) ids.push(products[(n * 5 + j * 7) % products.length]);
      out.push({
        id: EG.uid(), fecha: f, hora: horas[n % horas.length], tipo: n % 4 === 1 ? "video" : "presencial", estado: est,
        nombre: per[0], whatsapp: per[1], email: per[2], comoCompra: per[3], zona: per[4], queBusca: "", origen: n % 3 ? "clienta" : "manual",
        prendas: ids.map(function (p, j) {
          return { id: p.id, nombre: p.nombre, talle: String(2 + ((n + j) % 4)), seLlevo: est === "asistio" ? (n + j) % 3 !== 0 : null };
        }),
        notas: "", sala: n % 4 === 1 ? "showroom-" + EG.uid(14) : null, creada: f + "T10:00:00.000Z"
      });
      n++;
    }
    return out;
  };
})(typeof window !== "undefined" ? window : globalThis);
