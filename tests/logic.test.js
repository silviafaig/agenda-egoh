"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

require("../js/core.js");
require("../js/seed.js");
require("../js/store.js");
const EG = globalThis.EG;

const lunes = new Date(2026, 9, 5, 10, 0); // lunes 5/10/2026, 10:00
const settings = EG.defaultSettings();
const getProd = (db) => (id) => db.products.find((p) => p.id === id);

function cita(over) {
  return Object.assign(
    { id: "a1", fecha: "2026-10-05", hora: "11:30", tipo: "presencial", estado: "confirmada", nombre: "Carla Medina",
      whatsapp: "5491155550101", prendas: [], sala: null },
    over
  );
}

test("esc escapa HTML", () => {
  assert.equal(EG.esc(`<img src=x onerror="a()">&'`), "&lt;img src=x onerror=&quot;a()&quot;&gt;&amp;&#39;");
  assert.equal(EG.esc(null), "");
});

test("nextDays salta fines de semana y no se cuelga sin días", () => {
  const sab = new Date(2026, 9, 3, 9, 0);
  assert.deepEqual(EG.nextDays(settings, 3, sab), ["2026-10-05", "2026-10-06", "2026-10-07"]);
  assert.deepEqual(EG.nextDays({ dias: [] }, 5, sab), []);
  assert.equal(EG.nextDays(settings, 10, sab).length, 10);
});

test("slotsFor genera los 8 turnos de EGOH", () => {
  const s = EG.slotsFor(settings, [], "2026-10-06", lunes);
  assert.deepEqual(s.map((x) => x.h), ["11:30", "12:00", "12:30", "14:00", "14:30", "15:00", "15:30", "16:00"]);
  assert.ok(s.every((x) => !x.off));
});

test("un horario se ocupa una sola vez, sea presencial o videollamada", () => {
  const video = cita({ tipo: "video", sala: "showroom-abc" });
  const s = EG.slotsFor(settings, [video], "2026-10-05", new Date(2026, 9, 5, 8, 0));
  assert.equal(s.find((x) => x.h === "11:30").off, true);
  assert.equal(s.find((x) => x.h === "12:00").off, false);
  assert.equal(EG.isSlotFree(settings, [video], "2026-10-05", "11:30", new Date(2026, 9, 5, 8, 0)), false);
});

test("una cita cancelada libera el horario", () => {
  const c = cita({ estado: "cancelada" });
  assert.equal(EG.isSlotFree(settings, [c], "2026-10-05", "11:30", new Date(2026, 9, 5, 8, 0)), true);
});

test("los horarios pasados de hoy quedan deshabilitados", () => {
  const s = EG.slotsFor(settings, [], "2026-10-05", new Date(2026, 9, 5, 12, 10));
  assert.deepEqual(s.filter((x) => x.off).map((x) => x.h), ["11:30", "12:00"]);
  assert.equal(EG.slotsFor(settings, [], "2026-10-04", new Date(2026, 9, 5, 12, 10)).every((x) => x.off), true);
});

test("si cambia la duración, una cita existente bloquea los turnos que se superponen", () => {
  const corto = Object.assign({}, settings, { duracion: 20, franjas: [["11:00", "12:00"]] });
  const s = EG.slotsFor(corto, [cita({ hora: "11:30" })], "2026-10-05", new Date(2026, 9, 5, 8, 0));
  assert.deepEqual(s.map((x) => [x.h, x.off]), [["11:00", false], ["11:20", true], ["11:40", true]]);
});

test("normalizePhone arma números válidos para wa.me", () => {
  assert.equal(EG.normalizePhone("11 5555 0101"), "5491155550101");
  assert.equal(EG.normalizePhone("011 15 5555 0101"), "5491155550101");
  assert.equal(EG.normalizePhone("+54 9 11 5555-0101"), "5491155550101");
  assert.equal(EG.normalizePhone("5491155550101"), "5491155550101");
  assert.equal(EG.normalizePhone("0351 15 555 0202"), "5493515550202");
  assert.equal(EG.normalizePhone("+598 99 123 456"), "59899123456");
  assert.equal(EG.normalizePhone("5555"), null);
  assert.equal(EG.normalizePhone("abc"), null);
});

test("waLink codifica el mensaje", () => {
  assert.equal(EG.waLink("+54 9 11 5555 0101", "Hola ¿qué tal?\nChau"), "https://wa.me/5491155550101?text=Hola%20%C2%BFqu%C3%A9%20tal%3F%0AChau");
});

test("totales y precios", () => {
  const db = EG.seed();
  const g = getProd(db);
  const items = [{ id: "bikini-cala-black", talle: "3" }, { id: "bikini-mare-olive", talle: "4" }];
  assert.equal(EG.allPriced(items, g), false);
  assert.equal(EG.priceTxt(g("bikini-cala-black")), "Precio a confirmar");
  g("bikini-cala-black").precio = 15000;
  g("bikini-mare-olive").precio = 26000;
  assert.equal(EG.allPriced(items, g), true);
  assert.equal(EG.totalOf(items, g), 41000);
  assert.equal(EG.money(41000), "$41.000");
});

test("mensaje de recordatorio: presencial y videollamada", () => {
  const db = EG.seed();
  const g = getProd(db);
  const pres = cita({ prendas: [{ id: "bikini-cala-moka", talle: "4" }] });
  const m1 = EG.msgRecordatorio(pres, db.settings, g);
  assert.match(m1, /^¡Hola Carla! Te recordamos tu cita en EGOH el lunes 5 de oct a las 11:30 hs\./);
  assert.match(m1, /Te esperamos en Av\. Federico Lacroze 2911 PB A, Colegiales\./);
  assert.match(m1, /• Bikini Cala Moka \(talle 4\)/);
  const vid = cita({ tipo: "video", sala: "showroom-xyz" });
  const m2 = EG.msgRecordatorio(vid, db.settings, g);
  assert.match(m2, /Es por videollamada\. Entrás desde este link: https:\/\/meet\.jit\.si\/showroom-xyz/);
  assert.doesNotMatch(m2, /Tenemos listas/);
});

test("mensaje de seguimiento: solo las prendas que no se llevó", () => {
  const db = EG.seed();
  const g = getProd(db);
  const a = cita({
    estado: "asistio",
    prendas: [
      { id: "bikini-cala-black", talle: "3", seLlevo: true },
      { id: "bikini-luce-cream-botanic", talle: "2", seLlevo: false },
      { id: "bikini-sole-olive", talle: "4", seLlevo: null }
    ]
  });
  const m = EG.msgSeguimiento(a, db.settings, g);
  assert.match(m, /Gracias por tu visita a EGOH\./);
  assert.doesNotMatch(m, /Cala Black/);
  assert.match(m, /• Bikini Luce Cream Botanic \(talle 2\) – Precio a confirmar/);
  assert.match(m, /• Bikini Sole Olive \(talle 4\)/);
});

test("una prenda borrada del catálogo se sigue mostrando por su nombre guardado", () => {
  const a = cita({ prendas: [{ id: "ya-no-existe", nombre: "Bikini Vieja", talle: "2" }] });
  assert.match(EG.msgRecordatorio(a, settings, () => undefined), /• Bikini Vieja \(talle 2\)/);
});

test("parseFotoFile y matchFotos asignan por nombre de archivo", () => {
  assert.deepEqual(EG.parseFotoFile("Bikini_Cala_Black_01.jpg"), { key: "bikini cala black", nn: 1 });
  assert.deepEqual(EG.parseFotoFile("Bikini_Tropea_Navy_Blue_Cream_01.JPG"), { key: "bikini tropea navy blue cream", nn: 1 });
  const db = EG.seed();
  const r = EG.matchFotos(
    [
      "Bikini_Cala_Black_01.jpg",
      "Bikini_Cala_Black_02.jpg",
      "Bikini_Tropea_Black_Cream_01.jpg",
      "Bikini_Reversible_Vela_Malbec_Black_01.jpg",
      "Bikini_Reversible_Vela_Malbec_Black_02.jpg",
      "Bikini_Pietra_Navy_Blue_01.jpg",
      "foto-suelta.png"
    ],
    db.products
  );
  assert.deepEqual(r.asignadas.map((x) => x.productoId), ["bikini-cala-black", "bikini-tropea-black-cream", "bikini-reversible-vela-malbec-black"]);
  assert.equal(r.asignadas[2].archivo, "Bikini_Reversible_Vela_Malbec_Black_02.jpg");
  assert.deepEqual(r.ignoradas.map((x) => x.archivo), ["Bikini_Cala_Black_02.jpg", "Bikini_Reversible_Vela_Malbec_Black_01.jpg", "Bikini_Pietra_Navy_Blue_01.jpg", "foto-suelta.png"]);
  assert.match(r.ignoradas[1].motivo, /_02/);
});

test("el catálogo inicial tiene las 33 prendas SS27 con su foto en el repo", () => {
  const db = EG.seed();
  assert.equal(db.products.length, 33);
  assert.equal(new Set(db.products.map((p) => p.id)).size, 33);
  const nombres = db.products.map((p) => p.nombre);
  assert.ok(nombres.includes("Bikini Reversible Vela Malbec / Black"));
  assert.ok(nombres.includes("Bikini Tropea Navy Blue / Cream"));
  assert.ok(db.products.every((p) => p.talles.join() === "1,2,3,4,5,6" && p.precio === 0 && p.categoria === "Bikinis SS27"));
  assert.equal(db.products.find((p) => p.id === "bikini-reversible-vela-malbec-black").fotoNum, 2);
  for (const p of db.products) {
    assert.ok(fs.existsSync(path.join(__dirname, "..", p.foto)), "falta " + p.foto);
  }
});

test("configuración inicial de EGOH", () => {
  const s = EG.defaultSettings();
  assert.equal(s.nombre, "EGOH");
  assert.equal(s.compraMinima, 40000);
  assert.equal(s.compraMinimaNota, "por tiempo limitado");
  assert.deepEqual(s.dias, [1, 2, 3, 4, 5]);
  assert.deepEqual(s.franjas, [["11:30", "13:00"], ["14:00", "16:30"]]);
});

test("las citas de ejemplo usan prendas del catálogo", () => {
  const db = EG.seed();
  const citas = EG.sampleAppts(db.products, "2026-10-05");
  assert.equal(citas.length, 3);
  for (const c of citas) for (const i of c.prendas) assert.ok(db.products.some((p) => p.id === i.id), i.id);
  assert.ok(citas.filter((c) => c.tipo === "video").every((c) => /^showroom-/.test(c.sala)));
});

test("store: guarda, recupera, se recupera de datos corruptos y maneja fotos", () => {
  const mem = {};
  const storage = {
    getItem: (k) => (k in mem ? mem[k] : null),
    setItem: (k, v) => { mem[k] = String(v); },
    removeItem: (k) => { delete mem[k]; },
    key: (i) => Object.keys(mem)[i] || null,
    get length() { return Object.keys(mem).length; }
  };
  const st = EG.createStore(storage, true);
  const db = st.load();
  assert.equal(db.products.length, 33);
  db.appts.push(cita());
  db.settings.compraMinima = 50000;
  assert.equal(st.save(db), true);
  const again = st.load();
  assert.equal(again.appts.length, 1);
  assert.equal(again.settings.compraMinima, 50000);

  assert.equal(st.fotoSet("p1", "data:image/jpeg;base64,AAA"), true);
  assert.equal(st.fotoGet("p1"), "data:image/jpeg;base64,AAA");
  st.fotoDel("p1");
  assert.equal(st.fotoGet("p1"), null);

  mem["agenda-egoh:v1:datos"] = "{no es json";
  assert.equal(st.load().appts.length, 0);

  st.fotoSet("p2", "x");
  st.save(db);
  st.clearAll();
  assert.equal(st.load().appts.length, 0);
  assert.equal(st.fotoGet("p2"), null);
});

test("store: completa ajustes nuevos que falten en datos viejos", () => {
  const mem = { "agenda-egoh:v1:datos": JSON.stringify({ v: 1, settings: { nombre: "EGOH" }, products: [], appts: [] }) };
  const storage = { getItem: (k) => (k in mem ? mem[k] : null), setItem() {}, removeItem() {}, key: () => null, length: 0 };
  const db = EG.createStore(storage, true).load();
  assert.equal(db.settings.duracion, 30);
  assert.equal(db.settings.compraMinima, 40000);
});
