// Monedas: usd (base), bcv (bolívares, tasa BCV) y bin (USDT de Binance).
// Tasas: `usd_to_ves` = VES por 1 USD; `binance_to_ves` = VES por 1 USDT.
// Ej.: 1 USD = 850 VES y 1 USDT = 950 VES  →  850 VES = USD 1.00 = USDT 0.894.
// La API usa USD / VES / BINANCE.
export const CCY_TO_API = { usd: "USD", bcv: "VES", bin: "BINANCE" };
export const CCY_FROM_API = { USD: "usd", VES: "bcv", BINANCE: "bin" };
export const CCY_LABEL = {
  usd: "USD",
  bcv: "VES · BCV",
  bin: "USDT · Binance",
};
/** Prefijo corto del monto según la moneda. */
export const CCY_PREFIX = { usd: "USD", bcv: "VES", bin: "USDT" };
export const CCY_KEYS = ["usd", "bcv", "bin"];

/** Agrupa miles con `t` y decimales con `d`. */
export const grp = (n, t, d, dec = 2) => {
  const parts = Math.abs(n).toFixed(dec).split(".");
  return parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, t) + d + parts[1];
};

export const nTxt = (n, w) => `${n} ${n === 1 ? w : w + "s"}`;

export const compact = (n) =>
  n >= 1000
    ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(".0", "") + "k"
    : String(Math.round(n));

export const parseNum = (v) =>
  parseFloat(String(v ?? "").replace(",", ".")) || 0;
export const fmtIn = (v, dec = 2) => v.toFixed(dec).replace(".", ",");

/** Utilidades de conversión ligadas a las tasas vigentes. */
export function makeFx(rates) {
  const rate = Number(rates?.usd_to_ves) || 0;
  const rateB = Number(rates?.binance_to_ves) || 0;
  // FACT = unidades de cada moneda por 1 USD (USDT: rate / rateB, p. ej. 850/950 = 0.894)
  const FACT = {
    usd: 1,
    bcv: rate,
    bin: rateB > 0 && rate > 0 ? rate / rateB : 0,
  };
  const ready = (c) => FACT[c] > 0;
  const toUsd = (c, a) => (FACT[c] > 0 ? a / FACT[c] : 0);
  const fromUsd = (c, u) => u * FACT[c];
  const money = (c, v) =>
    c === "bcv"
      ? "VES " + grp(v, ".", ",")
      : c === "bin"
        ? "USDT " + grp(v, ",", ".", 3) // USDT con 3 decimales (p. ej. 0.894)
        : "USD " + grp(v, ",", ".");
  // Tasa en bolívares de cada moneda (1 USD = X VES; 1 USDT = Y VES)
  const rateShort = (c) =>
    c === "usd"
      ? "Base"
      : ready(c)
        ? grp(c === "bin" ? rateB : rate, ".", ",")
        : "Sin tasa";
  const rateTxt = (c) =>
    c === "usd"
      ? "Moneda base"
      : ready(c)
        ? "Tasa " + grp(c === "bin" ? rateB : rate, ".", ",")
        : "Sin tasa";
  return {
    rate,
    rateB,
    FACT,
    ready,
    toUsd,
    fromUsd,
    money,
    rateTxt,
    rateShort,
  };
}

/* ---------- fechas (YYYY-MM-DD) ---------- */
const pad = (n) => String(n).padStart(2, "0");
export const todayStr = () => toDateStr(new Date());
export const toDateStr = (dt) =>
  `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
const parse = (str) => {
  const [y, m, d] = String(str).slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
};
const startOfToday = () => {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate());
};
/** Días transcurridos desde la fecha (0 = hoy). */
export const daysAgo = (str) =>
  Math.round((startOfToday() - parse(str)) / 86400000);
/** Días que faltan para la fecha (negativo = vencida). */
export const daysUntil = (str) => -daysAgo(str);
export const dateNDaysAgo = (n) => {
  const t = startOfToday();
  t.setDate(t.getDate() - n);
  return toDateStr(t);
};
export const dlabel = (str) => {
  const d = daysAgo(str);
  if (d === 0) return "Hoy";
  if (d === 1) return "Ayer";
  const dt = parse(str);
  return `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}`;
};
export const dayMonth = (dt) =>
  `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}`;

/* ---------- utilidades para el selector de fecha ---------- */
export const parseDate = parse;
export const addDays = (str, n) => {
  const d = parse(str);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
};
/** 30/09/2026 */
export const fullDate = (str) => {
  const dt = parse(str);
  return `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()}`;
};
