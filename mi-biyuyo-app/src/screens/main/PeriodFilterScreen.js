import React, { useState } from "react";
import { View, TouchableOpacity } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { usePeriod, resolvePeriod, FREE_KINDS } from "../../contexts/PeriodContext";
import { usePlan } from "../../hooks/usePlan";
import { PremiumPill } from "../../components/PremiumLock";
import { Screen, Footer, Header, Txt, Card, Button, Icon } from "../../components/ui";
import DateField from "../../components/DateField";
import {
  MONTH_NAMES,
  endOfMonth,
  fullDate,
  startOfMonth,
} from "../../utils/money";

const OPTIONS = [
  ["30d", "Últimos 30 días"],
  ["month", "Este mes"],
  ["prev", "Mes anterior"],
  ["spec", "Mes específico"],
  ["custom", "Desde / Hasta"],
];

const monthOf = (str) => str.slice(0, 7) + "-01";
const shiftMonth = (str, n) => {
  const y = Number(str.slice(0, 4));
  const m = Number(str.slice(5, 7)) - 1 + n;
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};

/** Elige el período que se usa en toda la app. */
export default function PeriodFilterScreen({ navigation }) {
  const { colors } = useTheme();
  const { sel, period, setPeriod } = usePeriod();
  const { can, gate } = usePlan();

  // Borrador: al abrir muestra lo que está seleccionado en la app
  const [kind, setKind] = useState(sel.kind);
  const [month, setMonth] = useState(
    sel.kind === "spec" ? sel.month : startOfMonth(),
  );
  const [from, setFrom] = useState(period.from);
  const [to, setTo] = useState(period.to);

  const thisMonth = startOfMonth();
  const next = kind === "spec" ? { kind, month } : kind === "custom" ? { kind, from, to } : { kind };
  const chosen = resolvePeriod(next);

  const apply = () => {
    setPeriod(next);
    navigation.goBack();
  };

  const pick = (k) => {
    // Mes anterior, mes específico y rangos libres son Premium: llevan a «Mi plan»
    if (!FREE_KINDS.includes(k) && !gate("period_range")) return;
    setKind(k);
    // Al pasar a «Desde / Hasta» se parte del período que ya se estaba viendo
    if (k === "custom") {
      setFrom(chosen.from);
      setTo(chosen.to);
    }
  };

  return (
    <Screen
      data={false}
      contentStyle={{ gap: 16, paddingTop: 16 }}
      footer={
        <Footer>
          <Button label="Aplicar filtro" height={54} onPress={apply} />
        </Footer>
      }
    >
      <Header title="Filtros" onBack={() => navigation.goBack()} />
      <Txt style={{ fontSize: 13, lineHeight: 18, color: colors.textSecondary }}>
        El período que elijas se usa en toda la app: Inicio, Estadísticas,
        Historial, Por cobrar y Por pagar, y los movimientos de cada entidad.
      </Txt>

      <View style={{ gap: 10 }}>
        {OPTIONS.map(([k, label]) => {
          const active = kind === k;
          return (
            <View key={k} style={{ gap: 10 }}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => pick(k)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                style={{
                  minHeight: 54,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingHorizontal: 16,
                  borderRadius: 16,
                  borderWidth: 1.5,
                  borderColor: active ? colors.accent : colors.border,
                  backgroundColor: colors.surface,
                }}
              >
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    borderWidth: 2,
                    borderColor: active ? colors.accent : colors.border,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {active ? (
                    <View
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: colors.accent,
                      }}
                    />
                  ) : null}
                </View>
                <Txt style={{ flex: 1, fontSize: 15, fontWeight: "700" }}>
                  {label}
                </Txt>
                {!FREE_KINDS.includes(k) && !can("period_range") ? (
                  <PremiumPill />
                ) : null}
              </TouchableOpacity>

              {active && k === "spec" ? (
                <Card
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                  pad={8}
                >
                  <TouchableOpacity
                    onPress={() => setMonth(shiftMonth(month, -1))}
                    accessibilityLabel="Mes anterior"
                    style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center" }}
                  >
                    <Icon name="chevronLeft" size={22} color={colors.text} stroke={2} />
                  </TouchableOpacity>
                  <Txt style={{ fontSize: 17, fontWeight: "800" }}>
                    {MONTH_NAMES[Number(month.slice(5, 7)) - 1].replace(/^./, (c) => c.toUpperCase())}{" "}
                    {month.slice(0, 4)}
                  </Txt>
                  <TouchableOpacity
                    onPress={() => setMonth(shiftMonth(month, 1))}
                    disabled={monthOf(month) >= thisMonth}
                    accessibilityLabel="Mes siguiente"
                    style={{
                      width: 48,
                      height: 48,
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: monthOf(month) >= thisMonth ? 0.3 : 1,
                    }}
                  >
                    <Icon name="chevronRight" size={22} color={colors.text} stroke={2} />
                  </TouchableOpacity>
                </Card>
              ) : null}

              {active && k === "custom" ? (
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={{ flex: 1, gap: 6 }}>
                    <Txt style={{ fontSize: 14, fontWeight: "700" }}>Desde</Txt>
                    <DateField
                      compact
                      value={from}
                      max={to}
                      onChange={(v) => setFrom(v)}
                    />
                  </View>
                  <View style={{ flex: 1, gap: 6 }}>
                    <Txt style={{ fontSize: 14, fontWeight: "700" }}>Hasta</Txt>
                    <DateField
                      compact
                      value={to}
                      min={from}
                      max={endOfMonth()}
                      onChange={(v) => setTo(v)}
                    />
                  </View>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      <Txt style={{ fontSize: 13, color: colors.textSecondary }}>
        Se mostrará: {chosen.label} · del {fullDate(chosen.from)} al{" "}
        {fullDate(chosen.to)}
      </Txt>
    </Screen>
  );
}
