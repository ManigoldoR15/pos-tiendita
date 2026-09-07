// Vuelca a JSON todas las tablas de public + los usuarios de auth.
// Lee SB_URL, SB_KEY y OUT_DIR del entorno. Sale con codigo != 0 si algo falla.
import fs from 'node:fs/promises';
import path from 'node:path';

const URL_ = process.env.SB_URL, KEY = process.env.SB_KEY, OUT = process.env.OUT_DIR;
if (!URL_ || !KEY || !OUT) { console.error('faltan SB_URL, SB_KEY u OUT_DIR'); process.exit(2); }

const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const fallas = [];

const spec = await (await fetch(`${URL_}/rest/v1/`, { headers: H })).json();
const tablas = Object.keys(spec.definitions || spec.components?.schemas || {}).sort();
if (!tablas.length) { console.error('el OpenAPI no devolvio tablas'); process.exit(3); }
console.log(`tablas expuestas: ${tablas.length}`);

await fs.mkdir(path.join(OUT, 'datos'), { recursive: true });
const resumen = [];

for (const t of tablas) {
  const filas = [];
  let desde = 0;
  const lote = 1000;
  for (;;) {
    const r = await fetch(`${URL_}/rest/v1/${t}?select=*`, {
      headers: { ...H, Range: `${desde}-${desde + lote - 1}`, 'Range-Unit': 'items' },
    });
    if (!r.ok) { fallas.push(`${t}: HTTP ${r.status}`); console.error(`  ! ${t}: HTTP ${r.status}`); break; }
    const b = await r.json();
    filas.push(...b);
    if (b.length < lote) break;
    desde += lote;
  }
  await fs.writeFile(path.join(OUT, 'datos', `${t}.json`), JSON.stringify(filas, null, 2));
  resumen.push({ tabla: t, filas: filas.length });
  console.log(`  ${t}: ${filas.length}`);
}

const usuarios = [];
for (let page = 1; ; page++) {
  const r = await fetch(`${URL_}/auth/v1/admin/users?page=${page}&per_page=1000`, { headers: H });
  if (!r.ok) { fallas.push(`auth.users: HTTP ${r.status}`); console.error(`  ! auth.users: HTTP ${r.status}`); break; }
  const b = await r.json();
  usuarios.push(...(b.users || []));
  if (!b.users || b.users.length < 1000) break;
}
await fs.writeFile(path.join(OUT, 'datos', '_auth_users.json'), JSON.stringify(usuarios, null, 2));
resumen.push({ tabla: 'auth.users', filas: usuarios.length });
console.log(`  auth.users: ${usuarios.length}`);

const total = resumen.reduce((a, b) => a + b.filas, 0);
await fs.writeFile(path.join(OUT, 'resumen.json'), JSON.stringify(
  { generado: new Date().toISOString(), proyecto: URL_, total_filas: total, fallas, tablas: resumen }, null, 2));

if (fallas.length) { console.error(`${fallas.length} tabla(s) fallaron`); process.exit(4); }
if (total === 0) { console.error('cero filas en toda la base: respaldo sospechoso'); process.exit(5); }
console.log(`total de filas: ${total}`);
