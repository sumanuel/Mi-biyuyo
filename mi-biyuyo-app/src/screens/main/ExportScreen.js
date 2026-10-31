import React, { useState } from "react";
import { View } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { useData, errorMessage } from "../../contexts/DataContext";
import { Screen, Header, Txt, Card, Button } from "../../components/ui";
import DateRangeFilter from "../../components/DateRangeFilter";
import { countsFor, exportExcel, firstDate } from "../../utils/exportExcel";
import {
  endOfMonth,
  fullDate,
  nTxt,
  startOfMonth,
  todayStr,
} from "../../utils/money";

/** Exportar a Excel (Ajustes > Sistema): elige el rango de fechas y genera el archivo .xlsx. */
export default function ExportScreen({ navigation }) {
  const { colors } = useTheme();
  const { model, showToast } = useData();
  const [from, setFrom] = useState(startOfMonth());
  const [to, setTo] = useState(endOfMonth());
  const [busy, setBusy] = useState(false);

  const counts = countsFor(model, { from, to });
  const nothing =
    !counts.moves && !counts.pays && !counts.transfers && !model.ents.length;

  const run = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await exportExcel(model, { from, to });
    } catch (err) {
      showToast(errorMessage(err, "No se pudo exportar el archivo"));
    } finally {
      setBusy(false);
    }
  };

  const sheets = [
    [
      "Resumen",
      model.fx.single
        ? "Totales del período"
        : "Totales del período y tasas de hoy",
    ],
    [
      "Movimientos",
      `${nTxt(counts.moves, "movimiento")} (ingresos, gastos, por cobrar y por pagar)`,
    ],
    ["Abonos", `${nTxt(counts.pays, "abono")} de cobros y pagos`],
    ["Transferencias", `${nTxt(counts.transfers, "transferencia")}`],
    [
      "Ítems",
      `${nTxt(counts.items, "ítem")} del detalle de las compras, con cantidad`,
    ],
    ["Entidades", "Saldos de hoy de cada entidad"],
  ];

  return (
    <Screen data={false} contentStyle={{ gap: 16, paddingTop: 16 }}>
      <Header title="Exportar a Excel" onBack={() => navigation.goBack()} />
      <Txt
        style={{ fontSize: 13, lineHeight: 18, color: colors.textSecondary }}
      >
        Elige el período y genera un archivo de Excel (.xlsx) con tus datos.
        Podrás guardarlo, abrirlo o enviarlo.
      </Txt>

      <DateRangeFilter
        from={from}
        to={to}
        onChange={(f, t) => {
          setFrom(f);
          setTo(t);
        }}
      />
      <Button
        label="Todo el historial"
        outline
        height={44}
        style={{ borderRadius: 14 }}
        onPress={() => {
          setFrom(firstDate(model));
          setTo(todayStr());
        }}
      />

      <Card style={{ gap: 10 }}>
        <Txt style={{ fontSize: 14, fontWeight: "700" }}>
          Del {fullDate(from)} al {fullDate(to)}
        </Txt>
        {sheets.map(([name, detail]) => (
          <View key={name} style={{ flexDirection: "row", gap: 8 }}>
            <Txt style={{ color: colors.accent, fontWeight: "800" }}>•</Txt>
            <Txt style={{ flex: 1, fontSize: 13, lineHeight: 18 }}>
              <Txt style={{ fontSize: 13, fontWeight: "700" }}>{name}: </Txt>
              <Txt style={{ fontSize: 13, color: colors.textSecondary }}>
                {detail}
              </Txt>
            </Txt>
          </View>
        ))}
      </Card>

      <Button
        label={busy ? "Generando…" : "Exportar a Excel"}
        height={52}
        disabled={nothing || busy}
        onPress={run}
      />
    </Screen>
  );
}
