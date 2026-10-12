// Importar citas o clientas desde otra agenda (Turnito u otra) o desde nuestra propia exportación.
// Lee .xlsx (sin librerías: descomprime el zip con DecompressionStream) y .csv.
(function () {
  "use strict";
  const EG = window.EG;
  const I = {};
  EG.importar = I;

  /* ---------- lectura de archivos ---------- */
  async function unzip(buf) {
    const dv = new DataView(buf), u8 = new Uint8Array(buf), files = {};
    let eocd = -1;
    for (let i = buf.byteLength - 22; i >= 0; i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error("zip");
    let p = dv.getUint32(eocd + 16, true);
    const n = dv.getUint16(eocd + 10, true);
    for (let k = 0; k < n; k++) {
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
      const nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
      const off = dv.getUint32(p + 42, true);
      const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nlen));
      p += 46 + nlen + xlen + clen;
      if (!/^xl\/(sharedStrings|worksheets\/sheet1)\.xml$/.test(name)) continue;
      const start = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true);
      const data = u8.subarray(start, start + csize);
      if (method === 0) files[name] = new TextDecoder().decode(data);
      else {
        const ds = new DecompressionStream("deflate-raw");
        const out = await new Response(new Blob([data]).stream().pipeThrough(ds)).arrayBuffer();
        files[name] = new TextDecoder().decode(out);
      }
    }
    return files;
  }
  const colIdx = (ref) => { let n = 0; for (const ch of ref.replace(/\d+/g, "")) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
  async function leerXlsx(buf) {
    const f = await unzip(buf);
    const xml = (t) => new DOMParser().parseFromString(t || "<x/>", "application/xml");
    const textos = Array.from(xml(f["xl/sharedStrings.xml"]).getElementsByTagName("si")).map((si) =>
      Array.from(si.getElementsByTagName("t")).map((t) => t.textContent).join(""));
    const filas = [];
    Array.from(xml(f["xl/worksheets/sheet1.xml"]).getElementsByTagName("row")).forEach((row) => {
      const out = [];
      Array.from(row.getElementsByTagName("c")).forEach((c) => {
        const t = c.getAttribute("t"), v = c.getElementsByTagName("v")[0], is = c.getElementsByTagName("is")[0];
        let val = v ? v.textContent : is ? is.textContent : "";
        if (t === "s") val = textos[+val] || "";
        out[colIdx(c.getAttribute("r") || "A")] = val;
      });
      filas.push(Array.from(out, (x) => (x == null ? "" : String(x))));
    });
    return filas;
  }
  function leerCsv(txt) {
    txt = txt.replace(/^﻿/, "");
    const sep = (txt.split("\n")[0].match(/;/g) || []).length > (txt.split("\n")[0].match(/,/g) || []).length ? ";" : ",";
    const filas = []; let fila = [], cel = "", q = false;
    for (let i = 0; i < txt.length; i++) {
      const ch = txt[i];
      if (q) { if (ch === '"') { if (txt[i + 1] === '"') { cel += '"'; i++; } else q = false; } else cel += ch; }
      else if (ch === '"') q = true;
      else if (ch === sep) { fila.push(cel); cel = ""; }
      else if (ch === "\n" || ch === "\r") { if (ch === "\r" && txt[i + 1] === "\n") i++; fila.push(cel); filas.push(fila); fila = []; cel = ""; }
      else cel += ch;
    }
    if (cel || fila.length) { fila.push(cel); filas.push(fila); }
    return filas.filter((f) => f.some((x) => String(x).trim()));
  }
  I.leer = async function (file) {
    if (/\.xlsx$/i.test(file.name)) return leerXlsx(await file.arrayBuffer());
    if (/\.(csv|txt)$/i.test(file.name)) return leerCsv(await file.text());
    throw new Error("formato");
  };

  /* ---------- interpretar filas ---------- */
  const norm = (s) => EG.normName(String(s || ""));
  const ALIAS = {
    fecha: ["fecha", "dia", "date"], hora: ["hora", "horario", "time"], nombre: ["nombre", "nombre del cliente", "cliente", "nombre y apellido"],
    email: ["correo", "email", "mail", "e-mail"], whatsapp: ["telefono", "whatsapp", "celular", "tel"], notas: ["nota", "notas"],
    estado: ["estado", "estado de la reserva"], zona: ["zona"], comoCompra: ["como compra"], tipo: ["tipo"], meet: ["google meet"]
  };
  function columnas(cab) {
    const idx = {};
    const h = cab.map(norm);
    Object.keys(ALIAS).forEach((k) => { const i = h.findIndex((x) => ALIAS[k].indexOf(x) >= 0); if (i >= 0) idx[k] = i; });
    return idx;
  }
  function fechaYmd(v) {
    v = String(v || "").trim();
    let m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[1] + "-" + m[2] + "-" + m[3];
    m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) return m[3] + "-" + m[2].padStart(2, "0") + "-" + m[1].padStart(2, "0");
    if (/^\d{5}(\.\d+)?$/.test(v)) { const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(+v) * 864e5); return d.toISOString().slice(0, 10); }
    return "";
  }
  function horaHm(v) {
    v = String(v || "").trim();
    const m = v.match(/^(\d{1,2}):(\d{2})/);
    if (m) return m[1].padStart(2, "0") + ":" + m[2];
    if (/^0?\.\d+$/.test(v)) { const min = Math.round(+v * 1440); return String(Math.floor(min / 60)).padStart(2, "0") + ":" + String(min % 60).padStart(2, "0"); }
    return "";
  }
  function estadoDe(v) {
    const e = norm(v);
    if (/cancel/.test(e)) return "cancelada";
    if (/asisti|presente/.test(e)) return "asistio";
    if (/no vino|ausente|no asisti/.test(e)) return "no_vino";
    return "confirmada";
  }
  // Devuelve { tipo: "citas" | "clientas", items: [...] } con el estado de cada fila frente a lo que ya hay.
  I.analizar = function (filas, db, settings) {
    if (filas.length < 2) return { tipo: "vacio", items: [] };
    const c = columnas(filas[0]);
    const val = (f, k) => (c[k] >= 0 ? String(f[c[k]] || "").trim() : "");
    const conFecha = c.fecha >= 0 && c.hora >= 0;
    const items = filas.slice(1).map((f) => {
      const d = { nombre: val(f, "nombre"), email: val(f, "email"), zona: val(f, "zona"), comoCompra: val(f, "comoCompra"), notas: val(f, "notas") };
      d.whatsapp = EG.normalizePhone(val(f, "whatsapp")) || "";
      if (conFecha) {
        d.fecha = fechaYmd(val(f, "fecha")); d.hora = horaHm(val(f, "hora")); d.estado = estadoDe(val(f, "estado"));
        d.tipo = /video/i.test(val(f, "tipo")) || val(f, "meet") ? "video" : "presencial";
      }
      let motivo = "";
      if (!d.nombre) motivo = "Falta el nombre";
      else if (!d.whatsapp) motivo = "Teléfono inválido";
      else if (conFecha && (!d.fecha || !d.hora)) motivo = "Fecha u hora inválida";
      else if (conFecha && db.appts.some((a) => a.fecha === d.fecha && a.hora === d.hora && a.whatsapp === d.whatsapp)) motivo = "Ya está cargada";
      else if (!conFecha && EG.clientaPorWa(db, d.whatsapp)) motivo = "Ya existe (se completan datos)";
      let aviso = "";
      if (!motivo && conFecha && d.estado === "confirmada" && db.appts.some((a) => a.fecha === d.fecha && a.estado !== "cancelada" && Math.abs(EG.toMin(a.hora) - EG.toMin(d.hora)) < settings.duracion)) aviso = "Se superpone con otra cita";
      return { d, motivo, aviso, ok: !motivo || /se completan/.test(motivo) };
    }).filter((x) => x.d.nombre || x.d.whatsapp);
    return { tipo: conFecha ? "citas" : "clientas", items };
  };
  I.aplicar = function (res, db) {
    let n = 0;
    res.items.filter((x) => x.ok && !x.fuera).forEach(({ d }) => {
      const cli = EG.upsertClienta(db, d, d.fecha ? d.fecha + "T" + d.hora : undefined);
      if (d.notas && !d.fecha && !cli.notas) cli.notas = d.notas;
      if (res.tipo === "citas") {
        db.appts.push({ id: EG.uid(), fecha: d.fecha, hora: d.hora, tipo: d.tipo, estado: d.estado, nombre: d.nombre, whatsapp: d.whatsapp,
          email: d.email, zona: d.zona, comoCompra: d.comoCompra, queBusca: "", prendas: [], notas: d.notas, sala: null,
          creada: new Date().toISOString(), clientaId: cli.id, origen: "importada" });
      }
      n++;
    });
    return n;
  };
})();
