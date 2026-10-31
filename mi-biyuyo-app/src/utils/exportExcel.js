import { Platform } from "react-native";
import * as XLSX from "xlsx";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { KIND_LABEL, META, isDebtType } from "./ledger";
import { CCY_LABEL, ENT_CCY_LABEL, getActiveProfile, todayStr } from "./money";

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const FMT_MONEY = "#,##0.00";
const FMT_USDT = "#,##0.000";
const FMT_DATE = "dd/mm/yyyy";

/** Celda numérica con formato; null si no hay valor. */
const num = (v, z = FMT_MONEY) =>
  v === null || v === undefined || Number.isNaN(Number(v))
    ? null
    : { t: "n", v: Number(v), z };

/** Fecha YYYY-MM-DD como fecha de Excel (número de serie con formato de fecha). */
const dateCell = (str) => {
  if (!str) return null;
  const [y, m, d] = String(str).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return String(str);
  return { t: "n", v: Date.UTC(y, m - 1, d) / 86400000 + 25569, z: FMT_DATE };
};

const text = (v) => (v === null || v === undefined ? "" : String(v));

/** Hoja a partir de filas, con anchos de columna y filtro en el encabezado. */
function sheetOf(header, rows, widths) {
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  ws["!cols"] = widths.map((wch) => ({ wch }));
  if (rows.length) {
    ws["!autofilter"] = {
      ref: XLSX.utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: rows.length, c: header.length - 1 },
      }),
    };
  }
  return ws;
}

const inRange = (date, from, to) => !!date && date >= from && date <= to;

/**
 * Libro de Excel con lo registrado entre `from` y `to` (YYYY-MM-DD, ambos incluidos):
 * Resumen, Movimientos, Abonos, Transferencias, Ítems y Entidades (saldos de hoy).
 * Los montos van como números (se pueden sumar y filtrar en Excel).
 *  - Venezuela (varias monedas): montos en USD, VES y USDT, los guardados el día de cada movimiento.
 *  - Países de una sola moneda: una sola columna de monto, en la moneda del país y con sus decimales.
 */
export function buildWorkbook(model, { from, to }) {
  const { fx } = model;
  const single = !!fx.single;
  const prof = getActiveProfile();
  const cur = prof.currency; // código de la moneda del país (solo se usa en modo single)
  const FM = single ? (prof.decimals === 0 ? "#,##0" : FMT_MONEY) : FMT_MONEY;

  // Columnas de monto de un valor {usd, bcv, bin}: 3 en Venezuela, 1 en el resto
  const amts = (v) =>
    single ? [num(v.usd, FM)] : [num(v.usd), num(v.bcv), num(v.bin, FMT_USDT)];
  const amtHead = single
    ? [`Monto (${cur})`]
    : ["Monto USD", "Monto VES (BCV)", "Monto USDT (Binance)"];
  const amtWide = single ? [16] : [14, 18, 20];
  // Columnas solo de Venezuela (moneda del registro y monto en esa moneda)
  const own = (list) => (single ? [] : list);

  const moves = model.moves
    .filter((m) => inRange(m.date, from, to))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.ts - b.ts));

  /* ---------- Movimientos ---------- */
  const movRows = moves.map((m) => {
    const debt = isDebtType(m.type);
    return [
      dateCell(m.date),
      META[m.type].label,
      m.cat.name,
      m.hasDesc ? m.title : "",
      m.person || "",
      m.ent && !(debt && m.cash === false) ? model.entName(m.ent) : "",
      ...own([
        CCY_LABEL[m.ccy],
        num(
          m.amount != null ? m.amount : m.val[m.ccy],
          m.ccy === "bin" ? FMT_USDT : FMT_MONEY,
        ),
      ]),
      ...amts(m.val),
      debt ? (model.pendOf(m) <= 0.005 ? "Saldada" : "Pendiente") : "",
      debt ? num(model.pendOf(m), FM) : null,
      debt && m.dueDate ? dateCell(m.dueDate) : null,
      debt && m.inst ? m.inst : null,
      m.items.length || null,
      text(m.notes),
    ];
  });
  const wsMov = sheetOf(
    [
      "Fecha",
      "Tipo",
      "Categoría",
      "Descripción",
      "Persona",
      "Entidad",
      ...own(["Moneda del registro", "Monto (moneda del registro)"]),
      ...amtHead,
      "Estado (deudas)",
      single ? "Pendiente" : "Pendiente USD (tasa de hoy)",
      "Vencimiento",
      "Cuotas",
      "Ítems",
      "Notas",
    ],
    movRows,
    [
      12,
      12,
      20,
      30,
      18,
      16,
      ...own([18, 20]),
      ...amtWide,
      16,
      single ? 14 : 22,
      13,
      8,
      8,
      24,
    ],
  );

  /* ---------- Abonos ---------- */
  const payRows = [];
  model.moves.forEach((m) =>
    (m.pays || []).forEach((p) => {
      if (!inRange(p.date, from, to)) return;
      payRows.push([
        p.date,
        [
          dateCell(p.date),
          m.type === "cobrar" ? "Cobro" : "Pago",
          m.person || m.cat.name,
          m.hasDesc ? m.title : m.cat.name,
          p.ent ? model.entName(p.ent) : "",
          ...own([
            CCY_LABEL[p.ccy],
            num(p.val[p.ccy], p.ccy === "bin" ? FMT_USDT : FMT_MONEY),
          ]),
          ...amts(p.val),
          text(p.method),
        ],
      ]);
    }),
  );
  payRows.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const wsPay = sheetOf(
    [
      "Fecha",
      "Tipo",
      "Persona",
      "Deuda",
      "Entidad",
      ...own(["Moneda", "Monto (moneda del abono)"]),
      ...amtHead,
      "Detalle",
    ],
    payRows.map((r) => r[1]),
    [12, 8, 18, 28, 16, ...own([16, 22]), ...amtWide, 18],
  );

  /* ---------- Transferencias ---------- */
  const trfs = model.transfers
    .filter((t) => inRange(t.date, from, to))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const wsTrf = sheetOf(
    [
      "Fecha",
      "Desde",
      "Hacia",
      ...own(["Moneda"]),
      ...amtHead,
      single ? "Comisión" : "Comisión USD",
    ],
    trfs.map((t) => [
      dateCell(t.date),
      model.entName(t.from),
      model.entName(t.to),
      ...own([CCY_LABEL[t.ccy]]),
      ...amts(t.val),
      num(t.feeVal.usd, FM),
    ]),
    [12, 18, 18, ...own([16]), ...amtWide, 14],
  );

  /* ---------- Ítems de las compras ---------- */
  const itemRows = [];
  moves.forEach((m) =>
    m.items.forEach((it) => {
      const ownAmt =
        it.usd > 0 && m.usd > 0
          ? (it.usd / m.usd) * (m.amount != null ? m.amount : m.val[m.ccy])
          : null;
      itemRows.push([
        dateCell(m.date),
        m.hasDesc ? m.title : m.cat.name,
        m.cat.name,
        it.name,
        num(it.qty || 1, "General"),
        ...own([
          num(ownAmt, m.ccy === "bin" ? FMT_USDT : FMT_MONEY),
          CCY_LABEL[m.ccy],
        ]),
        num(it.usd > 0 ? it.usd : null, FM),
      ]);
    }),
  );
  const wsItems = sheetOf(
    [
      "Fecha",
      "Movimiento",
      "Categoría",
      "Ítem",
      "Cantidad",
      ...own(["Monto (moneda del registro)", "Moneda"]),
      single ? `Monto (${cur})` : "Monto USD",
    ],
    itemRows,
    [12, 28, 20, 24, 10, ...own([24, 16]), single ? 16 : 14],
  );

  /* ---------- Entidades: saldos de hoy ---------- */
  const wsEnt = sheetOf(
    [
      "Entidad",
      "Tipo",
      ...own(["Moneda", "Saldo actual (moneda de la entidad)"]),
      single ? `Saldo actual (${cur})` : "Saldo actual USD",
      "Suma a Mi saldo",
    ],
    model.ents.map((e) => [
      e.name,
      KIND_LABEL[e.kind] || "",
      ...own([
        ENT_CCY_LABEL[e.ccy] || e.ccy,
        num(model.entNative(e), e.ccy === "usdt" ? FMT_USDT : FMT_MONEY),
      ]),
      num(model.entBal(e), FM),
      e.include ? "Sí" : "No",
    ]),
    [22, 18, ...own([10, 32]), single ? 22 : 18, 16],
  );

  /* ---------- Resumen ---------- */
  const inc = model.sumIn(moves, "ingreso", "usd");
  const exp = model.sumIn(moves, "gasto", "usd");
  const sumRow = (label, type) => [
    label,
    ...amts({
      usd: model.sumIn(moves, type, "usd"),
      bcv: model.sumIn(moves, type, "bcv"),
      bin: model.sumIn(moves, type, "bin"),
    }),
  ];
  const head = single
    ? ["", `Monto (${cur})`]
    : ["", "USD", "VES (BCV)", "USDT (Binance)"];
  const wsSum = XLSX.utils.aoa_to_sheet([
    ["Mi Biyuyo · Exportación a Excel"],
    [],
    ["País", single ? `${prof.name} (${cur})` : "Venezuela"],
    ["Período", `${from} a ${to}`],
    ["Generado el", dateCell(todayStr())],
    ["Movimientos en el período", moves.length],
    [],
    head,
    sumRow("Ingresos", "ingreso"),
    sumRow("Gastos", "gasto"),
    [
      single
        ? "Balance (ingresos - gastos)"
        : "Balance (ingresos - gastos, USD)",
      num(inc - exp, FM),
    ],
    sumRow("Por cobrar registrado", "cobrar"),
    sumRow("Por pagar registrado", "pagar"),
    [],
    [
      single ? `Mi saldo hoy (${cur})` : "Mi saldo hoy (USD)",
      num(model.balance, FM),
    ],
    ...(single
      ? []
      : [
          [
            "Tasa BCV (VES por 1 USD)",
            fx.ready("bcv") ? num(fx.rate, "#,##0.0000") : "Sin tasa",
          ],
          [
            "Tasa Binance P2P (VES por 1 USDT)",
            fx.ready("bin") && fx.ready("bcv")
              ? num(fx.FACT.bcv / fx.FACT.bin, "#,##0.0000")
              : "Sin tasa",
          ],
        ]),
    [],
    [
      single
        ? "Entidades muestra los saldos de hoy."
        : "Los montos de cada movimiento están en las monedas guardadas el día en que se registró. Entidades muestra los saldos de hoy.",
    ],
  ]);
  wsSum["!cols"] = [{ wch: 38 }, { wch: 18 }, { wch: 18 }, { wch: 20 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsSum, "Resumen");
  XLSX.utils.book_append_sheet(wb, wsMov, "Movimientos");
  XLSX.utils.book_append_sheet(wb, wsPay, "Abonos");
  XLSX.utils.book_append_sheet(wb, wsTrf, "Transferencias");
  XLSX.utils.book_append_sheet(wb, wsItems, "Ítems");
  XLSX.utils.book_append_sheet(wb, wsEnt, "Entidades");
  return {
    wb,
    counts: {
      moves: moves.length,
      pays: payRows.length,
      transfers: trfs.length,
      items: itemRows.length,
    },
  };
}

/** Cuántas filas llevaría cada hoja en ese rango (para mostrarlo antes de exportar). */
export function countsFor(model, { from, to }) {
  const moves = model.moves.filter((m) => inRange(m.date, from, to));
  return {
    moves: moves.length,
    pays: model.moves.reduce(
      (a, m) =>
        a + (m.pays || []).filter((p) => inRange(p.date, from, to)).length,
      0,
    ),
    transfers: model.transfers.filter((t) => inRange(t.date, from, to)).length,
    items: moves.reduce((a, m) => a + m.items.length, 0),
  };
}

/** Fecha más antigua con datos (para «Todo el historial»). */
export function firstDate(model) {
  const dates = [
    ...model.moves.map((m) => m.date),
    ...model.moves.flatMap((m) => (m.pays || []).map((p) => p.date)),
    ...model.transfers.map((t) => t.date),
  ].filter(Boolean);
  return dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : todayStr();
}

/**
 * Genera el .xlsx y lo entrega: en el teléfono abre el menú de compartir (guardar en Archivos o
 * Drive, abrir con Excel, enviar por WhatsApp o correo…); en el navegador lo descarga.
 */
export async function exportExcel(model, range) {
  const { wb, counts } = buildWorkbook(model, range);
  const name = `MiBiyuyo_${range.from}_a_${range.to}.xlsx`;
  if (Platform.OS === "web") {
    XLSX.writeFile(wb, name);
    return counts;
  }
  if (!(await Sharing.isAvailableAsync()))
    throw new Error("Este dispositivo no permite compartir archivos");
  const base64 = XLSX.write(wb, { type: "base64", bookType: "xlsx" });
  const uri = FileSystem.cacheDirectory + name;
  await FileSystem.writeAsStringAsync(uri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  await Sharing.shareAsync(uri, {
    mimeType: XLSX_MIME,
    dialogTitle: "Exportar a Excel",
    UTI: "org.openxmlformats.spreadsheetml.sheet",
  });
  return counts;
}
