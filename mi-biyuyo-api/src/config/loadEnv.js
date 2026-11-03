/**
 * Carga las variables de entorno según la rama de git en la que se trabaja:
 *  - develop y main  → `.env` (producción)
 *  - cualquier otra rama → `.env.localdb` (base de datos local)
 * Sin carpeta .git (servidor desplegado) siempre usa `.env`.
 */
const fs = require("fs");
const path = require("path");

const PRODUCTION_BRANCHES = ["develop", "main"];

function currentBranch() {
  let dir = path.resolve(__dirname, "..", "..");
  for (let i = 0; i < 4; i++) {
    const head = path.join(dir, ".git", "HEAD");
    if (fs.existsSync(head)) {
      const m = fs.readFileSync(head, "utf8").match(/^ref: refs\/heads\/(.+)\s*$/);
      return m ? m[1] : "(desacoplada)";
    }
    dir = path.dirname(dir);
  }
  return null;
}

const branch = currentBranch();

// Si el entorno ya trae la base definida (p. ej. `migrate:prod` precarga .env.production con
// `-r dotenv/config`), dotenv no pisa esos valores: se respetan y se avisa con el host real.
if (process.env.DB_HOST) {
  const isLocalHost = ["localhost", "127.0.0.1", "::1"].includes(process.env.DB_HOST);
  console.log(`[env] variables ya definidas en el entorno → ${isLocalHost ? "base LOCAL" : "base REMOTA"} (${process.env.DB_HOST}); no se carga ningún .env por rama`);
  module.exports = { branch, local: isLocalHost };
  return;
}

const local = branch !== null && !PRODUCTION_BRANCHES.includes(branch);
const file = path.resolve(__dirname, "..", "..", local ? ".env.localdb" : ".env");

if (local && !fs.existsSync(file)) {
  console.error(`[env] La rama «${branch}» usa la base local pero falta ${path.basename(file)}. No se inicia para no tocar producción.`);
  process.exit(1);
}

require("dotenv").config({ path: file });
if (branch !== null) console.log(`[env] rama «${branch}» → ${path.basename(file)} (${local ? "base LOCAL" : "producción"})`);

module.exports = { branch, local };
