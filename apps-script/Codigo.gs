/**
 * Agenda Showroom · mails desde Gmail (Google Apps Script).
 *
 * Qué hace:
 *  1. Cuando una clienta reserva: le manda la confirmación y te avisa a vos.
 *  2. Cuando una clienta reprograma o cancela: te avisa.
 *  3. Todos los días a las 10: te manda las citas del próximo día de atención,
 *     cada una con su botón para mandar el recordatorio por WhatsApp.
 *
 * Configuración (Configuración del proyecto → Propiedades de la secuencia de comandos):
 *  SUPABASE_URL          https://raeuxuvshvpczwpnxirk.supabase.co
 *  SUPABASE_SERVICE_KEY  la clave secreta (service_role / secret) de Supabase. No la compartas.
 *  APP_URL               dirección de la agenda, por ejemplo https://turnos.egohmayorista.com.ar/
 *  SHOWROOM              egoh
 *  AVISOS_A              mail donde te llegan los avisos (si falta, se usa el de esta cuenta)
 */

const TZ = "America/Argentina/Buenos_Aires";
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const ACENTO = "#963B56";

/* ---------------- utilidades (sin dependencias de Google, se pueden probar aparte) ---------------- */
function ymd_(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function parseYmd_(s) {
  const p = String(s).split("-").map(Number);
  return new Date(p[0], p[1] - 1, p[2]);
}
function fechaLarga_(s) {
  const d = parseYmd_(s);
  return DIAS[d.getDay()] + " " + d.getDate() + " de " + MESES[d.getMonth()];
}
function esc_(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
// Próximo día de atención después de "hoy" (respeta días, feriados y fechas especiales).
function proximoDiaAtencion_(cfg, hoyYmd) {
  const d = parseYmd_(hoyYmd);
  for (let i = 0; i < 60; i++) {
    d.setDate(d.getDate() + 1);
    const f = ymd_(d);
    const feriado = (cfg.feriados || []).some((x) => f >= x.desde && f <= (x.hasta || x.desde));
    if (feriado) continue;
    if ((cfg.fechasEspeciales || []).some((x) => x.fecha === f)) return f;
    if ((cfg.dias || []).indexOf(d.getDay()) >= 0) return f;
  }
  return null;
}
function linkCita_(appUrl, c) {
  return appUrl.replace(/#.*$/, "").replace(/\/?$/, "/") + "#/cita/" + c.id + "." + c.token;
}
function prendasTxt_(c) {
  return (c.data.prendas || []).map((i) => "• " + i.nombre + " (talle " + i.talle + ")").join("\n");
}
function msgRecordatorio_(c, cfg, appUrl) {
  const nombre = String(c.data.nombre || "").split(" ")[0];
  let t = "¡Hola " + nombre + "! Te recordamos tu cita en " + cfg.nombre + " el " + fechaLarga_(c.fecha) + " a las " + c.hora + " hs.";
  if (c.tipo === "video") t += "\nEs por videollamada de WhatsApp: te llamamos a este número a la hora de la cita.";
  else t += "\nTe esperamos en " + cfg.direccion + ".";
  const pr = prendasTxt_(c);
  if (pr) t += "\n\nTenemos listas las prendas que elegiste:\n" + pr;
  t += "\n\nSi necesitás reprogramar o cancelar, entrá acá: " + linkCita_(appUrl, c) + "\n¡Gracias!";
  return t;
}
function waLink_(numero, texto) {
  return "https://wa.me/" + String(numero).replace(/\D/g, "") + "?text=" + encodeURIComponent(texto);
}

/* ---------------- HTML de los mails ---------------- */
function plantilla_(titulo, cuerpo) {
  return '<div style="font-family:Poppins,Arial,sans-serif;color:#1E1E1E;max-width:560px;margin:0 auto;padding:24px">' +
    '<h1 style="font-size:22px;margin:0 0 16px">' + esc_(titulo) + "</h1>" + cuerpo +
    '<p style="color:#6B6B6B;font-size:12px;margin-top:28px">Agenda Showroom</p></div>';
}
function boton_(texto, url) {
  return '<a href="' + esc_(url) + '" style="display:inline-block;background:' + ACENTO + ';color:#fff;text-decoration:none;padding:10px 18px;border-radius:999px;font-size:14px">' + esc_(texto) + "</a>";
}
function bloqueCita_(c, cfg) {
  const pr = (c.data.prendas || []).map((i) => "<li>" + esc_(i.nombre) + " · talle " + esc_(i.talle) + "</li>").join("");
  return '<div style="background:#F5F3F0;border-radius:14px;padding:16px;margin:12px 0">' +
    "<p style=\"margin:0 0 6px\"><b>" + esc_(fechaLarga_(c.fecha)) + " · " + esc_(c.hora) + " hs</b></p>" +
    "<p style=\"margin:0 0 6px\">" + (c.tipo === "video" ? "Videollamada por WhatsApp" : "Visita al showroom · " + esc_(cfg.direccion)) + "</p>" +
    (pr ? "<ul style=\"margin:8px 0 0;padding-left:18px\">" + pr + "</ul>" : "") + "</div>";
}
function mailConfirmacion_(c, cfg, appUrl) {
  const nombre = String(c.data.nombre || "").split(" ")[0];
  const como = c.tipo === "video"
    ? "<p>A la hora de la cita te llamamos por <b>videollamada de WhatsApp</b> al número que dejaste. Tené el celular a mano.</p>"
    : "<p>Te esperamos en <b>" + esc_(cfg.direccion) + "</b>.</p>";
  const minimo = cfg.compraMinima > 0 ? "<p style=\"color:#6B6B6B;font-size:13px\">Compra mínima $" + Number(cfg.compraMinima).toLocaleString("es-AR") + (cfg.compraMinimaNota ? " " + esc_(cfg.compraMinimaNota) : "") + ".</p>" : "";
  return {
    asunto: "Tu cita en " + cfg.nombre + ": " + fechaLarga_(c.fecha) + " a las " + c.hora + " hs",
    html: plantilla_("¡Listo, " + nombre + "!", "<p>Tu cita quedó confirmada.</p>" + bloqueCita_(c, cfg) + como + minimo +
      "<p>Si necesitás reprogramar o cancelar:</p><p>" + boton_("Ver mi cita", linkCita_(appUrl, c)) + "</p>")
  };
}
function mailRecordatorioClienta_(c, cfg, appUrl) {
  const nombre = String(c.data.nombre || "").split(" ")[0];
  const como = c.tipo === "video"
    ? "<p>A la hora de la cita te llamamos por <b>videollamada de WhatsApp</b>. Tené el celular a mano.</p>"
    : "<p>Te esperamos en <b>" + esc_(cfg.direccion) + "</b>.</p>";
  return {
    asunto: "Recordatorio: tu cita en " + cfg.nombre + " es el " + fechaLarga_(c.fecha) + " a las " + c.hora + " hs",
    html: plantilla_("¡Hola, " + nombre + "!", "<p>Te recordamos tu cita.</p>" + bloqueCita_(c, cfg) + como +
      "<p>Si no podés venir, avisanos desde acá:</p><p>" + boton_("Reprogramar o cancelar", linkCita_(appUrl, c)) + "</p>")
  };
}
function mailAvisoReserva_(c, cfg, appUrl) {
  const d = c.data;
  return {
    asunto: "Nueva reserva: " + d.nombre + " · " + fechaLarga_(c.fecha) + " " + c.hora + " hs",
    html: plantilla_("Nueva reserva", "<p><b>" + esc_(d.nombre) + "</b> · " + esc_(d.comoCompra || "") + (d.zona ? " · " + esc_(d.zona) : "") + "<br>WhatsApp +" + esc_(d.whatsapp) + (d.email ? " · " + esc_(d.email) : "") + "</p>" +
      bloqueCita_(c, cfg) + (d.queBusca ? "<p><i>Busca:</i> " + esc_(d.queBusca) + "</p>" : "") +
      "<p>" + boton_("Abrir el panel", appUrl.replace(/#.*$/, "") + "#/agenda") + "</p>")
  };
}
function mailAvisoCambio_(c, cfg, appUrl) {
  const cancelada = c.estado === "cancelada";
  return {
    asunto: (cancelada ? "Cita cancelada: " : "Cita reprogramada: ") + c.data.nombre,
    html: plantilla_(cancelada ? "Cancelaron una cita" : "Reprogramaron una cita",
      "<p><b>" + esc_(c.data.nombre) + "</b> " + (cancelada ? "canceló su cita. El horario quedó libre." : "cambió su cita. Ahora es:") + "</p>" +
      (cancelada ? "" : bloqueCita_(c, cfg)) + "<p>" + boton_("Abrir el panel", appUrl.replace(/#.*$/, "") + "#/agenda") + "</p>")
  };
}
function mailResumen_(citas, cfg, appUrl, fecha) {
  const filas = citas.map((c) => '<div style="border:1px solid #E0DDD8;border-radius:14px;padding:14px;margin:10px 0">' +
    "<p style=\"margin:0 0 4px\"><b>" + esc_(c.hora) + " · " + esc_(c.data.nombre) + "</b></p>" +
    "<p style=\"margin:0 0 10px;color:#6B6B6B;font-size:13px\">" + (c.tipo === "video" ? "Videollamada por WhatsApp" : "Visita al showroom") + " · " + (c.data.prendas || []).length + " prendas</p>" +
    boton_("Enviar recordatorio por WhatsApp", waLink_(c.data.whatsapp, msgRecordatorio_(c, cfg, appUrl))) + "</div>").join("");
  return {
    asunto: "Recordatorios: " + citas.length + (citas.length === 1 ? " cita el " : " citas el ") + fechaLarga_(fecha),
    html: plantilla_("Citas del " + fechaLarga_(fecha), "<p>Tocá cada botón desde el celular: se abre WhatsApp con el mensaje listo.</p>" + filas)
  };
}

/* ---------------- Supabase ---------------- */
function cfg_() {
  const p = PropertiesService.getScriptProperties().getProperties();
  if (!p.SUPABASE_URL || !p.SUPABASE_SERVICE_KEY || !p.APP_URL) throw new Error("Faltan propiedades: SUPABASE_URL, SUPABASE_SERVICE_KEY y APP_URL.");
  return { url: p.SUPABASE_URL.replace(/\/$/, ""), key: p.SUPABASE_SERVICE_KEY, app: p.APP_URL, slug: p.SHOWROOM || "egoh",
    avisos: p.AVISOS_A || Session.getEffectiveUser().getEmail() };
}
function sb_(conf, path, opts) {
  const o = opts || {};
  const res = UrlFetchApp.fetch(conf.url + "/rest/v1/" + path, {
    method: o.method || "get", contentType: "application/json", muteHttpExceptions: true,
    payload: o.body ? JSON.stringify(o.body) : undefined,
    // Claves nuevas (sb_secret_…) van solo en "apikey"; las viejas (JWT) también en Authorization.
    headers: conf.key.indexOf("sb_") === 0 ? { apikey: conf.key, Prefer: "return=representation" }
      : { apikey: conf.key, Authorization: "Bearer " + conf.key, Prefer: "return=representation" }
  });
  const code = res.getResponseCode();
  if (code >= 300) throw new Error("Supabase " + code + ": " + res.getContentText());
  const txt = res.getContentText();
  return txt ? JSON.parse(txt) : null;
}
function showroom_(conf) {
  const r = sb_(conf, "showrooms?slug=eq." + encodeURIComponent(conf.slug) + "&select=id,config");
  if (!r.length) throw new Error("No existe el showroom " + conf.slug);
  return r[0];
}
function enviar_(para, mail, responderA) {
  if (!para) return;
  GmailApp.sendEmail(para, mail.asunto, "Abrí este mail en un programa que muestre HTML.", { htmlBody: mail.html, name: "Agenda Showroom", replyTo: responderA || "" });
}

/* ---------------- 1 y 2: avisos que manda la agenda ---------------- */
// La agenda llama a esta dirección (POST) con { tipo: "reserva" | "cambio", id, token }.
function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    if (!/^[a-z0-9]{6,40}$/.test(body.id || "") || !/^[a-f0-9]{16,64}$/.test(body.token || "")) return salida_({ error: "datos" });
    const conf = cfg_();
    const s = showroom_(conf);
    const r = sb_(conf, "citas?showroom_id=eq." + s.id + "&id=eq." + body.id + "&token=eq." + body.token + "&select=id,fecha,hora,estado,tipo,token,data");
    if (!r.length) return salida_({ error: "no_encontrada" });
    const c = r[0];
    const cfg = s.config;
    if (body.tipo === "reserva") {
      if (c.data.mailConfirmacion) return salida_({ ok: true, repetido: true });
      if (c.data.email) enviar_(c.data.email, mailConfirmacion_(c, cfg, conf.app), conf.avisos);
      enviar_(conf.avisos, mailAvisoReserva_(c, cfg, conf.app));
      c.data.mailConfirmacion = new Date().toISOString();
      sb_(conf, "citas?showroom_id=eq." + s.id + "&id=eq." + c.id, { method: "patch", body: { data: c.data } });
    } else if (body.tipo === "cambio") {
      enviar_(conf.avisos, mailAvisoCambio_(c, cfg, conf.app));
    }
    return salida_({ ok: true });
  } catch (err) {
    console.error(err);
    return salida_({ error: String(err.message || err) });
  }
}
function salida_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/* ---------------- 3: resumen diario ---------------- */
function resumenDiario() {
  const conf = cfg_();
  const s = showroom_(conf);
  const hoy = Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd");
  const fecha = proximoDiaAtencion_(s.config, hoy);
  if (!fecha) return;
  const citas = sb_(conf, "citas?showroom_id=eq." + s.id + "&fecha=eq." + fecha + "&estado=eq.confirmada&select=id,fecha,hora,estado,tipo,token,data&order=hora");
  if (citas.length) enviar_(conf.avisos, mailResumen_(citas, s.config, conf.app, fecha));
  // Recordatorio automático por mail a cada clienta que dejó su email (una sola vez por cita).
  citas.forEach((c) => {
    if (!c.data.email || c.data.mailRecordatorio) return;
    try {
      enviar_(c.data.email, mailRecordatorioClienta_(c, s.config, conf.app), conf.avisos);
      c.data.mailRecordatorio = new Date().toISOString();
      sb_(conf, "citas?showroom_id=eq." + s.id + "&id=eq." + c.id, { method: "patch", body: { data: c.data } });
    } catch (err) { console.error("recordatorio " + c.id, err); }
  });
}

/* ---------------- 4: copia de seguridad semanal ---------------- */
// Guarda en tu Google Drive (carpeta "Agenda Showroom - copias") un archivo con todo: configuración, catálogo,
// clientas, citas y bloqueos. Se conservan las últimas 12 copias.
function copiaSemanal() {
  const conf = cfg_();
  const s = showroom_(conf);
  const tabla = (t) => sb_(conf, t + "?showroom_id=eq." + s.id + "&select=*");
  const datos = { fecha: new Date().toISOString(), showroom: conf.slug, config: s.config,
    productos: tabla("productos"), clientas: tabla("clientas"), citas: tabla("citas"), bloqueos: tabla("bloqueos") };
  const nombreCarpeta = "Agenda Showroom - copias";
  const it = DriveApp.getFoldersByName(nombreCarpeta);
  const carpeta = it.hasNext() ? it.next() : DriveApp.createFolder(nombreCarpeta);
  carpeta.createFile("copia-" + conf.slug + "-" + Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd") + ".json", JSON.stringify(datos, null, 1), "application/json");
  const archivos = [];
  const fs = carpeta.getFiles();
  while (fs.hasNext()) archivos.push(fs.next());
  archivos.sort((a, b) => b.getDateCreated() - a.getDateCreated()).slice(12).forEach((f) => f.setTrashed(true));
}

/* ---------------- instalación ---------------- */
// Ejecutar UNA vez: crea la tarea diaria de las 10 y la copia de seguridad de los lunes a las 8 (hora de Argentina).
function instalarTareaDiaria() {
  ScriptApp.getProjectTriggers().filter((t) => ["resumenDiario", "copiaSemanal"].indexOf(t.getHandlerFunction()) >= 0).forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("resumenDiario").timeBased().everyDays(1).atHour(10).inTimezone(TZ).create();
  ScriptApp.newTrigger("copiaSemanal").timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(8).inTimezone(TZ).create();
}
// Para probar: te manda a vos el resumen del próximo día de atención y los recordatorios a las clientas (si hay citas).
function probarResumen() { resumenDiario(); }
