import React, { useState } from "react";
import { View } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { useData } from "../../contexts/DataContext";
import {
  Screen,
  Header,
  Txt,
  Card,
  Chip,
  ChipRow,
  MovRow,
  Button,
  Empty,
} from "../../components/ui";
import DateField from "../../components/DateField";
import { ledgerOf } from "../../utils/ledger";
import {
  endOfMonth,
  fullDate,
  monthsBackStart,
  startOfMonth,
} from "../../utils/money";
import { go } from "../../navigation/helpers";

const PAGE = 50;

/** Movimientos de una entidad en un rango de fechas (por defecto, el mes en curso). */
export default function EntityMovementsScreen({ navigation, route }) {
  const { colors } = useTheme();
  const { model, dv } = useData();
  const e = model.entById[route.params?.id];

  const monthStart = startOfMonth();
  const monthEnd = endOfMonth();
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(monthEnd);
  const [limit, setLimit] = useState(PAGE);

  if (!e) {
    return (
      <Screen>
        <Header title="Movimientos" onBack={() => navigation.goBack()} />
        <Empty text="No se encontró esta entidad." />
      </Screen>
    );
  }

  const rows = ledgerOf(model, e.id, dv, { from, to });
  const shown = rows.slice(0, limit);

  const presets = [
    ["Este mes", monthStart, monthEnd],
    ["Mes anterior", monthsBackStart(1), endOfMonth(monthsBackStart(1))],
    ["Últimos 3 meses", monthsBackStart(2), monthEnd],
  ];
  const setRange = (f, t) => {
    setFrom(f);
    setTo(t);
    setLimit(PAGE);
  };

  return (
    <Screen data={false} contentStyle={{ paddingTop: 16 }}>
      <Header
        title={`Movimientos · ${e.name}`}
        onBack={() => navigation.goBack()}
      />

      <Card style={{ gap: 12 }}>
        <ChipRow>
          {presets.map(([label, f, t]) => (
            <Chip
              key={label}
              label={label}
              active={from === f && to === t}
              onPress={() => setRange(f, t)}
            />
          ))}
        </ChipRow>
        <View style={{ gap: 6 }}>
          <Txt style={{ fontSize: 14, fontWeight: "700" }}>Desde</Txt>
          <DateField
            value={from}
            max={to}
            onChange={(v) => {
              setFrom(v);
              setLimit(PAGE);
            }}
          />
        </View>
        <View style={{ gap: 6 }}>
          <Txt style={{ fontSize: 14, fontWeight: "700" }}>Hasta</Txt>
          <DateField
            value={to}
            min={from}
            max={monthEnd}
            onChange={(v) => {
              setTo(v);
              setLimit(PAGE);
            }}
          />
        </View>
      </Card>

      <Txt style={{ fontSize: 13, color: colors.textSecondary }}>
        {rows.length === 1 ? "1 movimiento" : `${rows.length} movimientos`} del{" "}
        {fullDate(from)} al {fullDate(to)}
      </Txt>

      <View style={{ gap: 8 }}>
        {shown.map((r) => (
          <MovRow
            key={r.key}
            row={r}
            bordered
            onPress={() => go(navigation, r.nav.name, r.nav.params)}
          />
        ))}
        {!rows.length ? (
          <Empty text="Sin movimientos en este rango de fechas." />
        ) : null}
        {rows.length > limit ? (
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
