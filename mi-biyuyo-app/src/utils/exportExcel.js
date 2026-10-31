import { Platform } from "react-native";
import * as XLSX from "xlsx";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { KIND_LABEL, META, isDebtType } from "./ledger";
import { CCY_LABEL, ENT_CCY_LABEL, todayStr } from "./money";

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
 * Los montos van como números (se pueden sumar y filtrar en Excel); los valores en USD, VES y
 * USDT son los guardados el día de cada movimiento.
 */
export function buildWorkbook(model, { from, to }) {
  const { fx } = model;
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
      CCY_LABEL[m.ccy],
      num(
        m.amount != null ? m.amount : m.val[m.ccy],
        m.ccy === "bin" ? FMT_USDT : FMT_MONEY,
      ),
      num(m.val.usd),
      num(m.val.bcv),
      num(m.val.bin, FMT_USDT),
      debt ? (model.pendOf(m) <= 0.005 ? "Saldada" : "Pendiente") : "",
      debt ? num(model.pendOf(m)) : null,
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
      "Moneda del registro",
      "Monto (moneda del registro)",
      "Monto USD",
      "Monto VES (BCV)",
      "Monto USDT (Binance)",
      "Estado (deudas)",
      "Pendiente USD (tasa de hoy)",
      "Vencimiento",
      "Cuotas",
      "Ítems",
      "Notas",
    ],
    movRows,
    [12, 12, 20, 30, 18, 16, 18, 20, 14, 18, 20, 16, 22, 13, 8, 8, 24],
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
          CCY_LABEL[p.ccy],
          num(p.val[p.ccy], p.ccy === "bin" ? FMT_USDT : FMT_MONEY),
          num(p.val.usd),
          num(p.val.bcv),
          num(p.val.bin, FMT_USDT),
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
      "Moneda",
      "Monto (moneda del abono)",
      "Monto USD",
      "Monto VES (BCV)",
      "Monto USDT (Binance)",
      "Detalle",
    ],
    payRows.map((r) => r[1]),
    [12, 8, 18, 28, 16, 16, 22, 14, 18, 20, 18],
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
      "Moneda",
      "Monto USD",
      "Monto VES (BCV)",
      "Monto USDT (Binance)",
      "Comisión USD",
    ],
    trfs.map((t) => [
      dateCell(t.date),
      model.entName(t.from),
      model.entName(t.to),
      CCY_LABEL[t.ccy],
      num(t.val.usd),
      num(t.val.bcv),
      num(t.val.bin, FMT_USDT),
      num(t.feeVal.usd),
    ]),
    [12, 18, 18, 16, 14, 18, 20, 14],
  );

  /* ---------- Ítems de las compras ---------- */
  const itemRows = [];
  moves.forEach((m) =>
    m.items.forEach((it) => {
      const own =
        it.usd > 0 && m.usd > 0
          ? (it.usd / m.usd) * (m.amount != null ? m.amount : m.val[m.ccy])
          : null;
      itemRows.push([
        dateCell(m.date),
        m.hasDesc ? m.title : m.cat.name,
        m.cat.name,
        it.name,
        num(it.qty || 1, "General"),
        num(own, m.ccy === "bin" ? FMT_USDT : FMT_MONEY),
        CCY_LABEL[m.ccy],
        num(it.usd > 0 ? it.usd : null),
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
      "Monto (moneda del registro)",
      "Moneda",
      "Monto USD",
    ],
    itemRows,
    [12, 28, 20, 24, 10, 24, 16, 14],
  );

  /* ---------- Entidades: saldos de hoy ---------- */
  const wsEnt = sheetOf(
    [
      "Entidad",
      "Tipo",
      "Moneda",
      "Saldo actual (moneda de la entidad)",
      "Saldo actual USD",
      "Suma a Mi saldo",
    ],
    model.ents.map((e) => [
      e.name,
      KIND_LABEL[e.kind] || "",
      ENT_CCY_LABEL[e.ccy] || e.ccy,
      num(model.entNative(e), e.ccy === "usdt" ? FMT_USDT : FMT_MONEY),
      num(model.entBal(e)),
      e.include ? "Sí" : "No",
    ]),
    [22, 18, 10, 32, 18, 16],
  );

  /* ---------- Resumen ---------- */
  const sumRow = (label, type) => [
    label,
    num(model.sumIn(moves, type, "usd")),
    num(model.sumIn(moves, type, "bcv")),
    num(model.sumIn(moves, type, "bin"), FMT_USDT),
  ];
  const inc = model.sumIn(moves, "ingreso", "usd");
  const exp = model.sumIn(moves, "gasto", "usd");
  const wsSum = XLSX.utils.aoa_to_sheet([
    ["Mi Biyuyo · Exportación a Excel"],
    [],
    ["Período", `${from} a ${to}`],
    ["Generado el", dateCell(todayStr())],
    ["Movimientos en el período", moves.length],
    [],
    ["", "USD", "VES (BCV)", "USDT (Binance)"],
    sumRow("Ingresos", "ingreso"),
    sumRow("Gastos", "gasto"),
    ["Balance (ingresos - gastos, USD)", num(inc - exp)],
    sumRow("Por cobrar registrado", "cobrar"),
    sumRow("Por pagar registrado", "pagar"),
    [],
    ["Mi saldo hoy (USD)", num(model.balance)],
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
    [],
    [
      "Los montos de cada movimiento están en las monedas guardadas el día en que se registró. Entidades muestra los saldos de hoy.",
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
