import React from "react";
import { View } from "react-native";
import { Card, Segmented, Txt } from "./ui";
import DateField from "./DateField";
import {
  endOfMonth,
  last30Range,
  monthsBackStart,
  startOfMonth,
} from "../utils/money";

/**
 * Filtro por rango de fechas: atajos en una fila («Este mes», «Mes anterior»,
 * «Últimos 3 meses») y calendarios «Desde» / «Hasta» en otra fila.
 * Por defecto: primer y último día del mes en curso.
 */
export default function DateRangeFilter({
  from,
  to,
  onChange,
  last30 = false,
}) {
  const monthStart = startOfMonth();
  const monthEnd = endOfMonth();
  const prevStart = monthsBackStart(1);

  const l30 = last30Range();
  // Con last30 el primer atajo son los últimos 30 días (valor por defecto de los historiales)
  const presets = last30
    ? [
        ["30 días", l30.from, l30.to],
        ["Este mes", monthStart, monthEnd],
        ["Mes anterior", prevStart, endOfMonth(prevStart)],
        ["3 meses", monthsBackStart(2), monthEnd],
      ]
    : [
        ["Este mes", monthStart, monthEnd],
        ["Mes anterior", prevStart, endOfMonth(prevStart)],
        ["Últimos 3 meses", monthsBackStart(2), monthEnd],
      ];

  return (
    <Card style={{ gap: 12 }}>
      <Segmented
        height={40}
        fontSize={12}
        items={presets.map(([label, f, t]) => ({
          label,
          active: from === f && to === t,
          onPress: () => onChange(f, t),
        }))}
      />
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1, gap: 6 }}>
          <Txt style={{ fontSize: 14, fontWeight: "700" }}>Desde</Txt>
          <DateField
            compact
            value={from}
            max={to}
            onChange={(v) => onChange(v, to)}
          />
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <Txt style={{ fontSize: 14, fontWeight: "700" }}>Hasta</Txt>
          <DateField
            compact
            value={to}
            min={from}
            max={monthEnd}
            onChange={(v) => onChange(from, v)}
          />
        </View>
      </View>
    </Card>
  );
}
