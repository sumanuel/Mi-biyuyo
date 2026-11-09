// Importa tus datos de cobro desde un archivo de texto (NO se sube al repositorio) a la tabla
// payment_receivers. Formato del archivo:
//
//   pago móvil:
//   telefono:0414...
//   cedula:V...
//   banco:0102-venezuela
//
//   Zinli: correo@ejemplo.com
//   PayPal: correo@ejemplo.com
//
// Uso:  npm run receivers:import -- "D:/ruta/datos metodos de pago.txt"
// Con la rama develop o main usa la base de producción (.env); en las demás, la local.
// Si ya existe un método activo con ese nombre visible, se actualiza en lugar de duplicarlo.
require("../src/config/loadEnv");
const fs = require("fs");
const pool = require("../src/config/database");

const file = process.argv[2];
if (!file || !fs.existsSync(file)) {
  console.error("Uso: npm run receivers:import -- \"ruta/al/archivo.txt\"");
  process.exit(1);
}

const slug = (s) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

const FIELD = {
  telefono: "Teléfono",
  cedula: "Cédula",
  banco: "Banco",
  correo: "Correo",
  email: "Correo",
  cuenta: "N.º de cuenta",
  titular: "Titular",
};
const fieldLabel = (k) => FIELD[slug(k)] || k.charAt(0).toUpperCase() + k.slice(1);

function parse(text) {
  const out = [];
  let cur = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) {
      cur = null;
      continue;
    }
    const i = line.indexOf(":");
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    const value = line.slice(i + 1).trim();
    if (!value) {
      // «pago móvil:» abre un bloque; las líneas siguientes son sus datos
      cur = { label: key.charAt(0).toUpperCase() + key.slice(1), details: [] };
      out.push(cur);
    } else if (cur) {
      cur.details.push({ label: fieldLabel(key), value });
    } else {
      // «Zinli: correo@…» en una sola línea
      out.push({ label: key.charAt(0).toUpperCase() + key.slice(1), details: [{ label: "Correo", value }] });
    }
  }
  return out.filter((r) => r.details.length);
}

(async () => {
  const items = parse(fs.readFileSync(file, "utf8"));
  if (!items.length) throw new Error("No se encontró ningún método de cobro en el archivo");
  let order = 1;
  for (const it of items) {
    const method = slug(it.label);
    const { rows } = await pool.query(
      `SELECT id FROM payment_receivers WHERE method = $1 AND label = $2`,
      [method, it.label],
    );
    if (rows.length)
      await pool.query(
        `UPDATE payment_receivers SET details = $2, active = TRUE, sort_order = $3 WHERE id = $1`,
        [rows[0].id, JSON.stringify(it.details), order],
      );
    else
      await pool.query(
        `INSERT INTO payment_receivers (method, label, details, sort_order) VALUES ($1,$2,$3,$4)`,
        [method, it.label, JSON.stringify(it.details), order],
      );
    console.log(`✔ ${it.label} (${method}): ${it.details.length} dato(s)`);
    order++;
  }
})()
  .catch((e) => {
    console.error("Error:", e.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
