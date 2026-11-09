import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { useData } from "../../contexts/DataContext";
import {
  Screen,
  Header,
  Txt,
  Card,
  MovRow,
  Button,
  Empty,
} from "../../components/ui";
import PeriodBar from "../../components/PeriodBar";
import { usePeriod } from "../../contexts/PeriodContext";
import { ledgerOf } from "../../utils/ledger";
import { go } from "../../navigation/helpers";

const PAGE = 50;

/** Movimientos de una entidad en un rango de fechas (por defecto, los últimos 30 días). */
export default function EntityMovementsScreen({ navigation, route }) {
  const { colors } = useTheme();
  const { model, dv } = useData();
  const e = model.entById[route.params?.id];

  const {
    period: { from, to },
  } = usePeriod();
  const [limit, setLimit] = useState(PAGE);
  useEffect(() => setLimit(PAGE), [from, to]);

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

  return (
    <Screen data={false} contentStyle={{ paddingTop: 16 }}>
      <Header
        title={`Movimientos · ${e.name}`}
        onBack={() => navigation.goBack()}
      />

      <PeriodBar />

      <Txt style={{ fontSize: 13, color: colors.textSecondary }}>
        {rows.length === 1 ? "1 movimiento" : `${rows.length} movimientos`} en
        el período
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
