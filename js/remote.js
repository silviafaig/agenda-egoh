// Etapa 2: datos en Supabase. Si js/config.js no define EG_CONFIG, la app sigue en modo local (navegador).
// Estrategia: se carga todo el showroom en S.db (son pocos datos) y cada S.save() sincroniza solo lo que cambió.
(function () {
  "use strict";
  const EG = window.EG;
  const cfg = window.EG_CONFIG;
  const R = (EG.remote = { on: false, panel: false, user: null, showroom: null, rol: null, error: "" });
  if (!cfg || !cfg.supabaseUrl || !window.supabase) return;

  R.on = true;
  const sb = (R.client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  }));
  R.slug = (new URLSearchParams(location.search).get("s") || cfg.showroom || "").toLowerCase();

  const snap = { citas: new Map(), clientas: new Map(), bloqueos: new Map(), productos: new Map(), config: "" };
  const S = () => EG.S;

  /* ---------- mapeo filas <-> objetos de la app ---------- */
  const citaRow = (a) => {
    const data = Object.assign({}, a);
    ["id", "fecha", "hora", "estado", "tipo", "_token"].forEach((k) => delete data[k]);
    return { showroom_id: R.showroom.id, id: a.id, fecha: a.fecha, hora: a.hora, estado: a.estado, tipo: a.tipo, data };
  };
  const citaObj = (r) => Object.assign({}, r.data, { id: r.id, fecha: r.fecha, hora: r.hora, estado: r.estado, tipo: r.tipo, _token: r.token });
  const clientaRow = (c) => ({ showroom_id: R.showroom.id, id: c.id, whatsapp: c.whatsapp, data: c });
  const bloqueoRow = (b) => ({ showroom_id: R.showroom.id, id: b.id, fecha: b.fecha, data: b });
  const prodRow = (p, i) => ({ showroom_id: R.showroom.id, id: p.id, orden: i, data: p });
  const key = (o) => JSON.stringify(o);

  function remember(db) {
    snap.citas = new Map(db.appts.map((a) => [a.id, key(citaRow(a))]));
    snap.clientas = new Map(db.clientas.map((c) => [c.id, key(clientaRow(c))]));
    snap.bloqueos = new Map(db.bloqueos.map((b) => [b.id, key(bloqueoRow(b))]));
    snap.productos = new Map(db.products.map((p, i) => [p.id, key(prodRow(p, i))]));
    snap.config = key(db.settings);
  }

  /* ---------- carga ---------- */
  async function loadShowroom() {
    const { data, error } = await sb.from("showrooms").select("id, slug, config").eq("slug", R.slug).maybeSingle();
    if (error || !data) throw new Error(error ? error.message : "No existe el showroom “" + R.slug + "”.");
    R.showroom = data;
    const pr = await sb.from("productos").select("id, orden, data").eq("showroom_id", data.id).order("orden");
    if (pr.error) throw new Error(pr.error.message);
    return { v: 2, settings: Object.assign(EG.defaultSettings(), data.config), products: pr.data.map((r) => r.data), appts: [], clientas: [], bloqueos: [] };
  }

  // Vista pública: solo horarios ocupados, sin datos de otras clientas.
  R.loadPublic = async function () {
    const db = await loadShowroom();
    await R.refreshOcupados(db);
    EG.S.db = db;
    R.panel = false;
  };
  R.refreshOcupados = async function (db) {
    const d = db || EG.S.db;
    const hoy = EG.ymd(new Date());
    const fin = new Date(); fin.setDate(fin.getDate() + 60);
    const { data, error } = await sb.rpc("ocupados", { p_slug: R.slug, p_desde: hoy, p_hasta: EG.ymd(fin) });
    if (error) throw new Error(error.message);
    d.appts = data.filter((r) => !r.es_bloqueo).map((r) => ({ id: r.id, fecha: r.fecha, hora: r.hora, estado: "confirmada", tipo: "presencial", prendas: [], nombre: "" }));
    d.bloqueos = data.filter((r) => r.es_bloqueo).map((r) => ({ id: r.id, fecha: r.fecha, desde: r.desde || "", hasta: r.hasta || "" }));
  };

  // Panel: todo el showroom de la persona logueada.
  R.loadPanel = async function () {
    const mine = await sb.rpc("mis_showrooms");
    if (mine.error) throw new Error(mine.error.message);
    const m = mine.data.find((x) => x.slug === R.slug) || mine.data[0];
    if (!m) { R.sinAcceso = true; return false; }
    R.slug = m.slug;
    R.rol = m.rol;
    R.nombre = m.nombre;
    const db = await loadShowroom();
    const sid = R.showroom.id;
    const [ci, cl, bl, mi] = await Promise.all([
      sb.from("citas").select("id, fecha, hora, estado, tipo, token, data").eq("showroom_id", sid),
      sb.from("clientas").select("data").eq("showroom_id", sid),
      sb.from("bloqueos").select("data").eq("showroom_id", sid),
      sb.from("miembros").select("email, rol, nombre").eq("showroom_id", sid)
    ]);
    const err = [ci, cl, bl, mi].find((x) => x.error);
    if (err) throw new Error(err.error.message);
    db.appts = ci.data.map(citaObj);
    db.clientas = cl.data.map((r) => r.data);
    db.bloqueos = bl.data.map((r) => r.data);
    R.miembros = mi.data;
    EG.migrate(db);
    EG.S.db = db;
    remember(db);
    R.panel = true;
    return true;
  };

  /* ---------- guardar: solo lo que cambió ---------- */
  let timer = null, running = null, pending = false;
  R.sync = function (inmediato) {
    if (!R.panel) return Promise.resolve();
    clearTimeout(timer);
    return new Promise((resolve) => { timer = setTimeout(() => resolve(flush()), inmediato ? 0 : 500); });
  };
  async function flush() {
    if (running) { pending = true; return running; }
    running = doFlush().catch((e) => { EG.S.toast("No se pudo guardar en la nube: " + e.message + ". Revisá la conexión."); });
    await running;
    running = null;
    if (pending) { pending = false; return flush(); }
  }
  async function syncTable(table, list, toRow, map, select) {
    const sid = R.showroom.id;
    const rows = list.map(toRow);
    const changed = rows.filter((r) => map.get(r.id) !== key(r));
    const ids = new Set(rows.map((r) => r.id));
    const removed = Array.from(map.keys()).filter((id) => !ids.has(id));
    if (changed.length) {
      const q = sb.from(table).upsert(changed);
      const res = select ? await q.select(select) : await q;
      if (res.error) throw new Error(res.error.message);
      changed.forEach((r) => map.set(r.id, key(r)));
      if (select && res.data) return res.data;
    }
    if (removed.length) {
      const res = await sb.from(table).delete().eq("showroom_id", sid).in("id", removed);
      if (res.error) throw new Error(res.error.message);
      removed.forEach((id) => map.delete(id));
    }
    return null;
  }
  async function doFlush() {
    const db = EG.S.db;
    if (key(db.settings) !== snap.config) {
      const res = await sb.from("showrooms").update({ config: db.settings }).eq("id", R.showroom.id);
      if (res.error) throw new Error(res.error.message);
      snap.config = key(db.settings);
    }
    await syncTable("clientas", db.clientas, clientaRow, snap.clientas);
    await syncTable("productos", db.products, prodRow, snap.productos);
    await syncTable("bloqueos", db.bloqueos, bloqueoRow, snap.bloqueos);
    const tokens = await syncTable("citas", db.appts, citaRow, snap.citas, "id, token");
    if (tokens) tokens.forEach((t) => { const a = db.appts.find((x) => x.id === t.id); if (a) a._token = t.token; });
  }

  /* ---------- fotos (Storage) ---------- */
  R.subirFoto = async function (nombre, dataUrl) {
    const blob = await (await fetch(dataUrl)).blob();
    const path = R.showroom.id + "/" + nombre + "-" + Date.now() + ".jpg";
    const { error } = await sb.storage.from("fotos").upload(path, blob, { contentType: "image/jpeg" });
    if (error) throw new Error(error.message);
    return sb.storage.from("fotos").getPublicUrl(path).data.publicUrl;
  };

  /* ---------- clientas: reservar y su cita ---------- */
  R.reservar = async function (datos) {
    const { data, error } = await sb.rpc("reservar", { p_slug: R.slug, p: datos });
    if (error) throw new Error(error.message);
    return data;
  };
  R.verCita = async function (id, token) {
    const { data, error } = await sb.rpc("ver_cita", { p_id: id, p_token: token });
    if (error) throw new Error(error.message);
    return data;
  };
  R.cancelarCita = async (id, token) => (await sb.rpc("cancelar_cita", { p_id: id, p_token: token })).data;
  R.reprogramarCita = async (id, token, fecha, hora) => (await sb.rpc("reprogramar_cita", { p_id: id, p_token: token, p_fecha: fecha, p_hora: hora })).data;

  /* ---------- mails (Apps Script) ---------- */
  R.mails = !!cfg.avisosUrl;
  R.notify = function (tipo, id, token) {
    if (!cfg.avisosUrl || !id || !token) return;
    // no-cors: el navegador no espera la respuesta; el script valida id + token antes de mandar nada.
    fetch(cfg.avisosUrl, { method: "POST", mode: "no-cors", body: JSON.stringify({ tipo, id, token }) }).catch(() => {});
  };

  /* ---------- sesión ---------- */
  R.session = async function () {
    const { data } = await sb.auth.getSession();
    R.user = data.session ? data.session.user : null;
    return R.user;
  };
  R.login = async (email, password) => {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    R.user = data.user;
  };
  R.logout = async () => { await sb.auth.signOut(); R.user = null; R.panel = false; };
  R.recuperar = async (email) => {
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    if (error) throw error;
  };
  R.cambiarClave = async (password) => {
    const { error } = await sb.auth.updateUser({ password });
    if (error) throw error;
  };
  R.invitar = async (email, nombre) => {
    const { error } = await sb.from("miembros").insert({ showroom_id: R.showroom.id, email: email.toLowerCase(), rol: "editora", nombre });
    if (error) throw error;
    R.miembros.push({ email: email.toLowerCase(), rol: "editora", nombre });
  };
  R.quitarMiembro = async (email) => {
    const { error } = await sb.from("miembros").delete().eq("showroom_id", R.showroom.id).eq("email", email);
    if (error) throw error;
    R.miembros = R.miembros.filter((m) => m.email !== email);
  };
  sb.auth.onAuthStateChange((ev) => {
    if (ev === "PASSWORD_RECOVERY") { R.recovery = true; if (EG.S.render) EG.S.render(); }
  });
})();
