import React, { createContext, useCallback, useContext, useState } from "react";
import { useData } from "./DataContext";
import { canUse } from "../utils/plan";
import {
  MONTH_NAMES,
  endOfMonth,
  fullDate,
  last30Range,
  monthsBackStart,
  startOfMonth,
} from "../utils/money";

/**
 * Período de fechas único para toda la app (Inicio, Estadísticas, Historial, Por cobrar/pagar,
 * movimientos de entidades, ítems). Se guarda la elección (no las fechas) para que «Este mes»
 * siga siendo el mes en curso aunque cambie el día.
 *   sel = { kind: "30d" | "month" | "prev" }
 *       | { kind: "spec", month: "YYYY-MM-01" }
 *       | { kind: "custom", from, to }
 */
const PeriodContext = createContext(null);

export const DEFAULT_PERIOD = { kind: "30d" };

// El plan Gratis solo puede usar estos períodos; el resto (mes anterior, mes específico, rangos) es Premium
export const FREE_KINDS = ["30d", "month"];

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Rango y etiqueta de una elección: { from, to, label, kind }. */
export function resolvePeriod(sel) {
  switch (sel.kind) {
    case "month":
      return { kind: sel.kind, from: startOfMonth(), to: endOfMonth(), label: "Este mes" };
    case "prev": {
      const s = monthsBackStart(1);
      return { kind: sel.kind, from: s, to: endOfMonth(s), label: "Mes anterior" };
    }
    case "spec": {
      const m = Number(sel.month.slice(5, 7)) - 1;
      return {
        kind: sel.kind,
        from: startOfMonth(sel.month),
        to: endOfMonth(sel.month),
        label: `${cap(MONTH_NAMES[m])} ${sel.month.slice(0, 4)}`,
      };
    }
    case "custom":
      return { kind: sel.kind, from: sel.from, to: sel.to, label: "Personalizado" };
    default: {
      const r = last30Range();
      return { kind: "30d", from: r.from, to: r.to, label: "Últimos 30 días" };
    }
  }
}

export function PeriodProvider({ children }) {
  const { plan } = useData();
  const [chosen, setChosen] = useState(DEFAULT_PERIOD);
  const apply = useCallback((next) => setChosen(next), []);
  // Si el plan ya no incluye el período elegido (p. ej. vence Premium), se vuelve a «Últimos 30 días»
  const sel =
    canUse(plan, "period_range") || FREE_KINDS.includes(chosen.kind)
      ? chosen
      : DEFAULT_PERIOD;
  const period = resolvePeriod(sel);
  return (
    <PeriodContext.Provider value={{ sel, period, setPeriod: apply }}>
      {children}
    </PeriodContext.Provider>
  );
}

/** { sel, period: { from, to, label, kind }, setPeriod(sel), text } */
export function usePeriod() {
  const ctx = useContext(PeriodContext);
  const { period } = ctx;
  return {
    ...ctx,
    // «Este mes · 01/11/2026 al 30/11/2026»
    text: `${period.label} · ${fullDate(period.from)} al ${fullDate(period.to)}`,
  };
}
