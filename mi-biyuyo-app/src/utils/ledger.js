// Lógica de negocio del prototipo (Main.dc.html) portada a datos reales.
// Todo se guarda en USD (base); cada movimiento recuerda la moneda en que se registró.
import {
  CCY_FROM_API,
  CCY_LABEL,
  makeFx,
  nTxt,
  dlabel,
  daysAgo,
  daysUntil,
} from "./money";

export const TYPE_FROM_DB = {
  income: "ingreso",
  expense: "gasto",
  loan_given: "cobrar",
  debt: "pagar",
};
export const TYPE_TO_DB = {
  ingreso: "income",
  gasto: "expense",
  cobrar: "loan_given",
  pagar: "debt",
};
export const TYPES = ["ingreso", "gasto", "cobrar", "pagar"];

export const META = {
  ingreso: {
    short: "Ingreso",
    label: "Ingreso",
    plural: "Ingresos",
    question: "¿De dónde viene tu dinero?",
    hint: "Elige la fuente del ingreso",
    formTitle: "Nuevo ingreso",
    saveLabel: "Guardar ingreso",
    savedTitle: "Ingreso guardado",
    descHint: "Ej: Quincena de septiembre",
  },
  gasto: {
    short: "Gasto",
    label: "Gasto",
    plural: "Gastos",
    question: "¿En qué gastaste?",
    hint: "Elige la categoría del gasto",
    formTitle: "Nuevo gasto",
    saveLabel: "Guardar gasto",
    savedTitle: "Gasto guardado",
    descHint: "Ej: Mercado de la semana",
  },
  cobrar: {
    short: "Por cobrar",
    label: "Por cobrar",
    plural: "Por cobrar",
    question: "¿A quién le prestaste?",
    hint: "Elige quién te debe",
    formTitle: "Nuevo por cobrar",
    saveLabel: "Guardar por cobrar",
    savedTitle: "Por cobrar guardado",
    personLabel: "¿Quién te debe?",
    cashQ: "¿Ya entregaste el dinero?",
    descHint: "Ej: Préstamo para el carro",
  },
  pagar: {
    short: "Por pagar",
    label: "Por pagar",
    plural: "Por pagar",
    question: "¿A quién le debes?",
    hint: "Elige el tipo de deuda",
    formTitle: "Nuevo por pagar",
    saveLabel: "Guardar por pagar",
    savedTitle: "Por pagar guardado",
    personLabel: "¿A quién le debes?",
    cashQ: "¿Esta deuda te dio dinero?",
    descHint: "Ej: Cuota del crédito",
  },
};

export const KIND_LABEL = {
  efectivo: "Efectivo",
  banco: "Banco",
  digital: "Billetera digital",
  otro: "Otro",
};
export const KIND_ICON = {
  efectivo: "sueldo",
  banco: "bank",
  digital: "globe",
  otro: "card",
};
export const KIND_PT = {
  efectivo: "none",
  banco: "pm",
  digital: "email",
  otro: "none",
};
export const PT = {
  pm: { label: "Pago Móvil", f: ["Banco", "Teléfono", "Cédula"] },
  acct: {
    label: "Cuenta bancaria",
    f: ["N.º de cuenta", "Titular", "Cédula o RIF"],
  },
  email: { label: "Correo", f: ["Correo electrónico", "Titular"] },
  id: { label: "ID de usuario", f: ["ID o usuario", "Plataforma"] },
  none: { label: "Sin datos", f: [] },
};

export const isDebtType = (t) => t === "cobrar" || t === "pagar";

/** Construye el modelo derivado a partir de la respuesta de /api/ledger. */
export function buildModel(raw, ratesOverride) {
  const fx = makeFx(ratesOverride || raw?.rates);
  const empty = !raw;
  const rawCats = empty ? [] : raw.categories || [];

  const cats = rawCats.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    type: TYPE_FROM_DB[c.type] || "gasto",
    icon: c.icon,
    active: c.active !== false,
  }));
  const catById = {};
  cats.forEach((c) => (catById[c.id] = c));
  const fallbackCat = (type) => ({
    id: null,
    name: "Sin categoría",
    type,
    icon: "more",
    active: false,
  });

  const ents = (empty ? [] : raw.entities || []).map((e) => ({
    id: e.id,
    name: e.name,
    kind: e.kind,
    ccy: e.currency,
    init: e.initial_usd || 0,
    pt: e.payment_type || "none",
    pd: e.payment_data || [],
    alert: e.alert_usd,
  }));
  const entById = {};
  ents.forEach((e) => (entById[e.id] = e));
  const entName = (id) => (entById[id] ? entById[id].name : "");

  const moves = (empty ? [] : raw.transactions || []).map((t) => {
    const cat = catById[t.category_id] || fallbackCat("gasto");
    const type = cat.type;
    const dueIn = t.due_date ? daysUntil(t.due_date) : null;
    return {
      id: t.id,
      type,
      cat,
      title: t.description || cat.name,
      hasDesc: !!t.description,
      date: t.date,
      d: daysAgo(t.date),
      usd: t.amount_usd || 0,
      ccy: CCY_FROM_API[t.currency] || "usd",
      amount: t.amount,
      person: t.counterpart_name || null,
      ent: t.entity_id || null,
      cash: t.cash !== false,
      dueIn,
      dueDate: t.due_date || null,
      notes: t.notes || null,
      receipt: t.receipt_name || null,
      hasReceipt: !!t.has_receipt,
      items: (t.items || []).map((i) => ({
        id: i.id,
        name: i.name,
        usd: i.amount_usd,
      })),
      pays: (t.payments || []).map((p) => ({
        id: p.id,
        date: p.date,
        d: daysAgo(p.date),
        usd: p.amount_usd || 0,
        ccy: CCY_FROM_API[p.currency] || "usd",
        rate: p.rate || null,
        ent: p.entity_id || null,
        method: p.notes || (p.entity_id ? entName(p.entity_id) : "Abono"),
      })),
    };
  });
  const moveById = {};
  moves.forEach((m) => (moveById[m.id] = m));

  const transfers = (empty ? [] : raw.transfers || []).map((t) => ({
    id: t.id,
    date: t.date,
    d: daysAgo(t.date),
    from: t.from_entity_id,
    to: t.to_entity_id,
    usd: t.amount_usd,
    fee: t.fee_usd || 0,
    ccy: CCY_FROM_API[t.currency] || "usd",
  }));

  /* ---------- deudas ---------- */
  const paidOf = (m) => (m.pays || []).reduce((a, p) => a + p.usd, 0);
  const pendOf = (m) => Math.max(0, m.usd - paidOf(m));
  const isLive = (m) => !(isDebtType(m.type) && m.cash === false);

  /* ---------- saldos por entidad ---------- */
  const entBal = (e) => {
    let b = e.init;
    moves.forEach((m) => {
      if (m.ent === e.id && isLive(m))
        b += m.type === "ingreso" || m.type === "pagar" ? m.usd : -m.usd;
      (m.pays || []).forEach((q) => {
        if (q.ent === e.id) b += m.type === "cobrar" ? q.usd : -q.usd;
      });
    });
    transfers.forEach((t) => {
      if (t.from === e.id) b -= t.usd + t.fee;
      if (t.to === e.id) b += t.usd;
    });
    return b;
  };
  const balance = ents.reduce((a, e) => a + entBal(e), 0);
  const isLow = (e) => e.alert !== null && e.alert !== undefined && entBal(e) < e.alert;

  const sum = (list, t) =>
    list.filter((m) => m.type === t).reduce((a, m) => a + m.usd, 0);

  const cashIn = moves
    .filter((m) => m.type === "cobrar")
    .reduce((a, m) => a + paidOf(m), 0);
  const cashOut = moves
    .filter((m) => m.type === "pagar")
    .reduce((a, m) => a + paidOf(m), 0);
  const lent = moves
    .filter((m) => m.type === "cobrar" && m.cash)
    .reduce((a, m) => a + m.usd, 0);
  const borrowed = moves
    .filter((m) => m.type === "pagar" && m.cash)
    .reduce((a, m) => a + m.usd, 0);

  const dueText = (m) => {
    if (m.dueIn === null || m.dueIn === undefined) return "Sin fecha";
    if (m.dueIn < 0) return "Vencida hace " + nTxt(-m.dueIn, "día");
    if (m.dueIn === 0) return "Vence hoy";
    return "Vence en " + nTxt(m.dueIn, "día");
  };

  return {
    ready: !empty,
    fx,
    cats,
    catById,
    moves,
    moveById,
    ents,
    entById,
    entName,
    transfers,
    paidOf,
    pendOf,
    isLive,
    entBal,
    balance,
    isLow,
    sum,
    cashIn,
    cashOut,
    lent,
    borrowed,
    dueText,
  };
}

/** Estado de una deuda: texto y tono (ok | danger | warn | neutral). */
export function debtStatus(model, m) {
  if (model.pendOf(m) <= 0.005) return { t: "Saldada", tone: "ok" };
  if (m.dueIn !== null && m.dueIn < 0)
    return { t: model.dueText(m), tone: "danger" };
  if (m.dueIn !== null && m.dueIn <= 7)
    return { t: model.dueText(m), tone: "warn" };
  return { t: model.dueText(m), tone: "neutral" };
}

/** Fila de un movimiento para listas (ver Inicio / Historial / Entidad). */
export function rowOf(model, m, dv) {
  const debt = isDebtType(m.type);
  const sign =
    m.type === "ingreso"
      ? "+"
      : m.type === "gasto"
        ? "-"
        : m.cash === false
          ? ""
          : m.type === "pagar"
            ? "+"
            : "-";
  const over = debt && m.dueIn !== null && m.dueIn < 0;
  const entPart =
    m.ent && !(debt && m.cash === false) ? " · " + model.entName(m.ent) : "";
  const itemsPart = m.items.length ? " · " + nTxt(m.items.length, "ítem") : "";
  const pend = model.pendOf(m);
  return {
    key: "m" + m.id,
    title: m.title,
    icon: m.cat.icon,
    tone: m.type,
    sub:
      (m.person ? m.person : m.cat.name) + entPart + " · " + dlabel(m.date) + itemsPart,
    amount: sign + dv(m.usd),
    line2: debt
      ? pend > 0.005
        ? "Pendiente " + dv(pend)
        : "Saldada"
      : "Registrado en " + CCY_LABEL[m.ccy],
    line2Danger: over && pend > 0.005,
    nav: { name: "MovementDetail", params: { id: m.id } },
  };
}

export function abonoRow(model, m, p, dv) {
  const cobro = m.type === "cobrar";
  return {
    key: "p" + p.id,
    title: (cobro ? "Cobro" : "Pago") + " · " + (m.person || m.cat.name),
    icon: m.cat.icon,
    tone: m.type,
    sub:
      "Abono a: " +
      m.title +
      (p.ent ? " · " + model.entName(p.ent) : "") +
      " · " +
      dlabel(p.date),
    amount: (cobro ? "+" : "-") + dv(p.usd),
    line2: "Registrado en " + CCY_LABEL[p.ccy],
    nav: { name: "DebtDetail", params: { id: m.id } },
  };
}

export function transferRow(model, t, dv, ref) {
  const sign = ref ? (t.to === ref ? "+" : "-") : "";
  const amt = ref ? (t.to === ref ? t.usd : t.usd + t.fee) : t.usd;
  return {
    key: "t" + t.id,
    title: "Transferencia",
    icon: "swap",
    tone: "neutral",
    sub:
      model.entName(t.from) + " → " + model.entName(t.to) + " · " + dlabel(t.date),
    amount: sign + dv(amt),
    line2: t.fee > 0 ? "Comisión " + dv(t.fee) : "Sin comisión",
    nav: { name: "Entities" },
  };
}

/** Mezcla movimientos, abonos y (opcional) transferencias, del más reciente al más antiguo. */
export function feed(model, list, withTransfers, dv) {
  const out = list.map((m) => ({ d: m.d, k: m.id, r: rowOf(model, m, dv) }));
  list.forEach((m) =>
    (m.pays || []).forEach((p) =>
      out.push({ d: p.d, k: p.id, r: abonoRow(model, m, p, dv) }),
    ),
  );
  if (withTransfers)
    model.transfers.forEach((t) =>
      out.push({ d: t.d, k: t.id, r: transferRow(model, t, dv) }),
    );
  return out.sort((a, b) => a.d - b.d).map((o) => o.r);
}

/** Movimientos que tocan una entidad. */
export function ledgerOf(model, entId, dv) {
  const out = [];
  model.moves.forEach((m) => {
    if (m.ent === entId && model.isLive(m))
      out.push({ d: m.d, r: rowOf(model, m, dv) });
    (m.pays || []).forEach((q) => {
      if (q.ent === entId) out.push({ d: q.d, r: abonoRow(model, m, q, dv) });
    });
  });
  model.transfers.forEach((t) => {
    if (t.from === entId || t.to === entId)
      out.push({ d: t.d, r: transferRow(model, t, dv, entId) });
  });
  return out.sort((a, b) => a.d - b.d).map((o) => o.r);
}

/** Alertas de saldo bajo (por entidad y total). */
export function alertsOf(model, dv, threshold) {
  const list = model.ents.filter(model.isLow).map((e) => ({
    key: "e" + e.id,
    title: e.name + " tiene saldo bajo",
    sub:
      "Saldo " + dv(model.entBal(e)) + " · alerta en " + dv(e.alert),
    nav: { name: "EntityDetail", params: { id: e.id } },
  }));
  if (model.ready && model.balance < threshold)
    list.push({
      key: "total",
      title: "Tu saldo total está bajo",
      sub:
        "Saldo " + dv(model.balance) + " · umbral " + model.fx.money("usd", threshold),
      nav: { name: "Entities" },
    });
  return list;
}

export function pillOf(n, over) {
  if (n === 0) return { t: "Sin pendientes", tone: "ok" };
  if (over > 0)
    return {
      t: nTxt(n, "pendiente") + " · " + nTxt(over, "vencida"),
      tone: "danger",
    };
  return { t: nTxt(n, "pendiente"), tone: "warn" };
}
