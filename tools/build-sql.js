// Arma supabase/instalar.sql = esquema + fotos + datos iniciales de EGOH (un solo archivo para pegar en Supabase).
const fs = require("fs");
const path = require("path");
require("../js/core.js");
require("../js/seed.js");
const EG = globalThis.EG;
const root = path.join(__dirname, "..");
const q = (o) => "$j$" + JSON.stringify(o) + "$j$::jsonb";
const cfg = EG.defaultSettings();
const prods = EG.seedProducts();
let seed = `
/* ---------------- datos iniciales: EGOH ---------------- */
insert into showrooms (slug, config) values ('egoh', ${q(cfg)}) on conflict (slug) do nothing;
insert into miembros (showroom_id, email, rol, nombre)
  select id, 'ventas.egoh@gmail.com', 'duena', 'Sil' from showrooms where slug = 'egoh' on conflict do nothing;
insert into productos (showroom_id, id, orden, data)
  select s.id, p.id, p.orden, p.data from showrooms s, (values
${prods.map((p, i) => `    (${"'" + p.id + "'"}, ${i}, ${q(p)})`).join(",\n")}
  ) as p(id, orden, data) where s.slug = 'egoh' on conflict do nothing;
`;
const out = ["-- Agenda Showroom · instalación completa. Pegar todo en Supabase → SQL Editor → Run.",
  fs.readFileSync(path.join(root, "supabase/schema.sql"), "utf8"),
  fs.readFileSync(path.join(root, "supabase/storage.sql"), "utf8"), seed].join("\n");
fs.writeFileSync(path.join(root, "supabase/instalar.sql"), out);
fs.writeFileSync(path.join(root, "supabase/seed-egoh.sql"), seed);
console.log("ok", out.length);
