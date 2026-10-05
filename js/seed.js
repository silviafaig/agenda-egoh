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
      compraMinimaNota: "por tiempo limitado"
    };
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
    return { v: 1, settings: EG.defaultSettings(), products: EG.seedProducts(), appts: [] };
  };

  // Citas de ejemplo para probar el panel (se cargan a pedido desde Ajustes).
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
        nombre: "Carla Medina", whatsapp: "5491155550101", email: "carla@ejemplo.com", comoCompra: "Revendedora",
        queBusca: "Busco talles grandes para mi local en Lanús.",
        prendas: prendas(["bikini-dolce-malbec", "bikini-mare-olive", "bikini-tropea-black-cream"], ["5", "6", "5"]),
        notas: "", sala: null, creada: new Date().toISOString()
      },
      {
        id: EG.uid(), fecha: fecha, hora: "14:30", tipo: "video", estado: "confirmada",
        nombre: "Julieta Paz", whatsapp: "5493515550202", email: "juli@ejemplo.com", comoCompra: "Comercio",
        queBusca: "Tengo una tienda en Córdoba. Quiero ver las texturas de cerca.",
        prendas: prendas(["bikini-vita-lemon-botanic", "bikini-cala-navy-blue", "bikini-sole-moka-botanic", "bikini-pietra-black"], ["3", "4", "3", "4"]),
        notas: "", sala: "showroom-" + EG.uid(14), creada: new Date().toISOString()
      },
      {
        id: EG.uid(), fecha: fecha, hora: "16:00", tipo: "presencial", estado: "asistio",
        nombre: "Romina Sosa", whatsapp: "5491155550303", email: "romi@ejemplo.com", comoCompra: "Emprendimiento",
        queBusca: "",
        prendas: prendas(["bikini-cala-black", "bikini-luce-cream-botanic"], ["3", "2"], [true, false]),
        notas: "Le encantó la Luce pero la quería en otro color.", sala: null, creada: new Date().toISOString()
      }
    ];
  };
})(typeof window !== "undefined" ? window : globalThis);
