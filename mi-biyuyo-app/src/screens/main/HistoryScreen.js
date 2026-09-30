import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { useData } from "../../contexts/DataContext";
import {
  Screen,
  Txt,
  H1,
  Input,
  Card,
  Chip,
  ChipRow,
  DispTabs,
  MovRow,
  Empty,
  Button,
} from "../../components/ui";
import DateRangeFilter from "../../components/DateRangeFilter";
import { META, feed } from "../../utils/ledger";
import { endOfMonth, fullDate, startOfMonth } from "../../utils/money";
import { go } from "../../navigation/helpers";

const FILTERS = [
  ["all", "Todos"],
  ["ingreso", "Ingresos"],
  ["gasto", "Gastos"],
  ["cobrar", "Por cobrar"],
  ["pagar", "Por pagar"],
];
const PAGE = 25;

export default function HistoryScreen({ navigation, route }) {
  const { colors } = useTheme();
  const { model, dv, disp } = useData();
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [from, setFrom] = useState(startOfMonth());
  const [to, setTo] = useState(endOfMonth());

  const setRange = (f, t) => {
    setFrom(f);
    setTo(t);
    setLimit(PAGE);
  };

  useEffect(() => {
    if (route.params?.q !== undefined) {
      setQ(route.params.q);
      setFilter("all");
      setLimit(PAGE);
      // Una búsqueda desde el inicio abarca todo el historial
      const first = model.moves.reduce(
        (a, m) => (m.date < a ? m.date : a),
        startOfMonth(),
      );
      setFrom(first);
      setTo(endOfMonth());
    }
  }, [route.params?.q, route.params?.ts]);

  const qn = q.trim().toLowerCase();
  const matchQ = (m) =>
    !qn ||
    [m.title, m.cat.name, m.person || ""]
      .concat(m.items.map((i) => i.name))
      .join(" ")
      .toLowerCase()
      .includes(qn);
  const sorted = model.moves.slice().sort((a, b) => a.d - b.d);
  const fl = (
    filter === "all" ? sorted : sorted.filter((m) => m.type === filter)
  )
    .filter((m) => m.date >= from && m.date <= to)
    .filter(matchQ);
  // Historial: valores del día de cada movimiento, en la moneda elegida
  const flInc = model.sumIn(fl, "ingreso", disp);
  const flExp = model.sumIn(fl, "gasto", disp);
  const label =
    filter === "all"
      ? "Balance del período"
      : "Total " + META[filter].plural.toLowerCase();
  const histVal =
    filter === "all" ? flInc - flExp : fl.reduce((a, m) => a + m.val[disp], 0);
  const money = (n) => model.fx.money(disp, n);
  const all = feed(model, fl, filter === "all" && !qn, dv, { from, to });
  const rows = all.slice(0, limit);

  return (
    <Screen pull>
      <H1>Historial de movimientos</H1>
      <Input
        value={q}
        onChangeText={setQ}
        placeholder="Buscar por ítem, categoría o persona"
        accessibilityLabel="Buscar movimientos"
        style={{
          minHeight: 48,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 12,
          backgroundColor: colors.surface,
          paddingHorizontal: 14,
          fontSize: 15,
        }}
      />
      <DateRangeFilter from={from} to={to} onChange={setRange} />
      <DispTabs height={40} />
      <ChipRow scroll>
        {FILTERS.map(([k, l]) => (
          <Chip
            key={k}
            label={l}
            active={filter === k}
            color={k === "all" ? colors.accent : colors[k].strong}
            onPress={() => {
              setFilter(k);
              setLimit(PAGE);
            }}
          />
        ))}
      </ChipRow>

      <Card style={{ gap: 12 }}>
        <View style={{ gap: 2 }}>
          <Txt
            style={{
              fontSize: 12,
              color: colors.textSecondary,
              fontWeight: "600",
            }}
          >
            {label}
          </Txt>
          <Txt style={{ fontSize: 26, fontWeight: "800" }}>
            {(histVal < 0 ? "-" : "") + money(Math.abs(histVal))}
          </Txt>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Txt style={{ fontSize: 12, color: colors.textSecondary }}>
              Movimientos
            </Txt>
            <Txt style={{ fontSize: 15, fontWeight: "700" }}>
              {String(all.length)}
            </Txt>
          </View>
          <View style={{ flex: 1.4, gap: 2 }}>
            <Txt style={{ fontSize: 12, color: colors.textSecondary }}>
              Ingresos
            </Txt>
            <Txt
              style={{
                fontSize: 14,
                fontWeight: "700",
                color: colors.ingreso.fg,
              }}
            >
              {money(flInc)}
            </Txt>
          </View>
          <View style={{ flex: 1.4, gap: 2 }}>
            <Txt style={{ fontSize: 12, color: colors.textSecondary }}>
              Gastos
            </Txt>
            <Txt
              style={{
                fontSize: 14,
                fontWeight: "700",
                color: colors.gasto.fg,
              }}
            >
              {money(flExp)}
            </Txt>
          </View>
        </View>
      </Card>

      <View style={{ gap: 8 }}>
        {rows.length === 0 ? (
          <Empty
            text={`No hay movimientos del ${fullDate(from)} al ${fullDate(to)}.`}
          />
        ) : null}
        {rows.map((r) => (
          <MovRow
            key={r.key}
            row={r}
            bordered
            onPress={() => go(navigation, r.nav.name, r.nav.params)}
          />
        ))}
        {all.length > limit ? (
          <Button
            label="Mostrar más"
            outline
            height={46}
            style={{ borderRadius: 14 }}
            onPress={() => setLimit((l) => l + PAGE)}
          />
        ) : null}
      </View>
    </Screen>
  );
}
