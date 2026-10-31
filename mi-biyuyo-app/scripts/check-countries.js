/**
 * Comprueba, sin levantar nada, la configuración multi-país de la app:
 *  1. Que los países, monedas y modos coincidan con los de la API (mi-biyuyo-api/src/config/countries.js).
 *  2. Que cada país formatee y lea bien sus montos (símbolo, separadores y decimales).
 *
 *   npm run check:countries
 *
 * Usa Babel (ya instalado con Expo) para cargar los módulos ES de la app dentro de Node.
 */
const babel = require("@babel/core");
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "src");
const cache = {};

/** Carga un módulo de la app (ES → CommonJS con Babel) resolviendo sus imports relativos. */
function load(file) {
  const abs = path.resolve(file);
  if (cache[abs]) return cache[abs].exports;
  const code = babel.transformFileSync(abs, { presets: ["babel-preset-expo"], filename: abs }).code;
  const mod = { exports: {} };
  cache[abs] = mod;
  const req = (name) => {
    if (!name.startsWith(".")) return require(name);
    const base = path.resolve(path.dirname(abs), name);
    const target = [base, base + ".js", path.join(base, "index.js")].find((p) => fs.existsSync(p) && fs.statSync(p).isFile());
    return load(target);
  };
  new Function("module", "exports", "require", code)(mod, mod.exports, req);
  return mod.exports;
}

let pass = 0;
let fail = 0;
const check = (name, cond, extra) => {
  if (cond) pass++;
  else {
    fail++;
    console.log("  FALLA " + name + (extra !== undefined ? "  → " + JSON.stringify(extra) : ""));
  }
};

const { COUNTRIES, profileFor } = load(path.join(SRC, "config", "countries.js"));
const api = require("../../mi-biyuyo-api/src/config/countries").COUNTRIES;
const money = load(path.join(SRC, "utils", "money.js"));

/* 1) Mismos países, monedas y modos que la API */
console.log("== Países de la app y de la API");
const a = Object.keys(COUNTRIES).sort();
const b = Object.keys(api).sort();
check("mismos códigos de país", JSON.stringify(a) === JSON.stringify(b), { app: a.length, api: b.length });
for (const k of b) {
  if (!COUNTRIES[k]) continue;
  check(`${k}: nombre`, COUNTRIES[k].name === api[k].name, [COUNTRIES[k].name, api[k].name]);
  check(`${k}: moneda`, COUNTRIES[k].currency === api[k].currency, [COUNTRIES[k].currency, api[k].currency]);
  check(`${k}: modo`, COUNTRIES[k].mode === api[k].mode, [COUNTRIES[k].mode, api[k].mode]);
}

/* 2) Formato y lectura de montos por país */
console.log("== Formato de montos por país");
const escapeRe = (s) => s.replace(/[.*+?^${}()[\]\\]/g, "\\$&");
for (const k of a) {
  const p = COUNTRIES[k];
  if (p.mode !== "single") continue;
  money.setActiveProfile(profileFor({ country: k }));
  const text = money.formatLocal(1234567.5);
  const decimals = p.decimals === 0 ? "" : escapeRe(p.decimal) + "50";
  const num = `1${escapeRe(p.thousands)}234${escapeRe(p.thousands)}${p.decimals === 0 ? "568" : "567" + decimals}`;
  const re = p.symbolAfter ? new RegExp(`^${num} ${escapeRe(p.symbol)}$`) : new RegExp(`^${escapeRe(p.symbol)} ${num}$`);
  check(`${k}: formatLocal(1234567.5) = «${text}»`, re.test(text), text);
  check(`${k}: negativo con signo`, money.formatLocal(-9).startsWith("-"), money.formatLocal(-9));
  check(`${k}: formatLocal(0) sin signo`, !money.formatLocal(0).startsWith("-"));

  // Lo que escribe el usuario en un campo (con el separador de su país, con punto o con coma)
  const t = p.thousands;
  const d = p.decimal;
  check(`${k}: lee «1${t}500${t}000${p.decimals ? d + "50" : ""}»`, money.parseNum(`1${t}500${t}000${p.decimals ? d + "50" : ""}`) === (p.decimals ? 1500000.5 : 1500000));
  check(`${k}: lee «12,5» y «12.5»`, money.parseNum("12,5") === 12.5 && money.parseNum("12.5") === 12.5);
  check(`${k}: lee «1${t}234» como miles`, money.parseNum(`1${t}234`) === 1234);
  // Ida y vuelta: lo que se precarga en un campo se vuelve a leer igual
  const v = p.decimals === 0 ? 1234 : 1234.5;
  check(`${k}: fmtIn → parseNum`, money.parseNum(money.fmtIn(v)) === v, money.fmtIn(v));
}

// Venezuela (varias monedas): la lectura de números no cambió
money.setActiveProfile(profileFor({ country: "VE" }));
check("VE: coma o punto decimal", money.parseNum("12,5") === 12.5 && money.parseNum("12.5") === 12.5);
const fxVe = money.makeFx({ usd_to_ves: 100, binance_to_ves: 110 });
check("VE: formato USD / VES / USDT", fxVe.money("usd", 1234.5) === "USD 1,234.50" && fxVe.money("bcv", 1234.5) === "VES 1.234,50" && fxVe.money("bin", 1.5) === "USDT 1.500");

console.log(`\nResultado: ${pass} ok, ${fail} con fallas`);
process.exitCode = fail ? 1 : 0;
