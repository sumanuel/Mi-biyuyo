import React, { useEffect, useState } from "react";
import { TouchableOpacity, View } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { useData } from "../../contexts/DataContext";
import {
  Screen,
  Header,
  Txt,
  Input,
  DispTabs,
  ProgressBar,
  Empty,
  Button,
} from "../../components/ui";
import PeriodBar from "../../components/PeriodBar";
import { usePeriod } from "../../contexts/PeriodContext";
import { itemAgg } from "../../utils/ledger";
import { itemKey, qtyText } from "../../utils/text";
import { fullDate, nTxt } from "../../utils/money";
import { go } from "../../navigation/helpers";

const PAGE = 30;

/** Todos los ítems comprados en un rango de fechas; al tocar uno, sus fechas de compra. */
export default function ItemsScreen({ navigation }) {
  const { colors } = useTheme();
  const { model, disp } = useData();
  const {
    period: { from, to },
  } = usePeriod();
  const [limit, setLimit] = useState(PAGE);
  useEffect(() => setLimit(PAGE), [from, to]);
  const [q, setQ] = useState("");

  const list = model.moves.filter((m) => m.date >= from && m.date <= to);
  const qn = itemKey(q); // sin tildes, mayúsculas ni plural: «jamones» encuentra «Jamón»
  const items = itemAgg(list, disp).filter((x) => !qn || x.key.includes(qn));
  const max = items.length && items[0].n > 0 ? items[0].n : 1; // la barra mide las compras

  return (
    <Screen data={false} contentStyle={{ paddingTop: 16 }}>
      <Header title="Ítems más comprados" onBack={() => navigation.goBack()} />
      <Input
        value={q}
        onChangeText={(v) => {
          setQ(v);
          setLimit(PAGE);
        }}
        placeholder="Buscar por nombre del ítem"
        accessibilityLabel="Buscar ítems"
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
      <PeriodBar />
      <DispTabs height={40} />
      <Txt style={{ fontSize: 13, color: colors.textSecondary }}>
        {nTxt(items.length, "ítem")} del {fullDate(from)} al {fullDate(to)}.
        Ordenados del que más compras al que menos. Las compras sin monto se
        estiman con el último precio por unidad (≈). Toca uno para ver las
        fechas en que lo compraste.
      </Txt>
      <View style={{ gap: 8 }}>
        {items.slice(0, limit).map((r) => (
          <TouchableOpacity
            key={r.key}
            activeOpacity={0.8}
            onPress={() =>
              go(navigation, "ItemDates", { name: r.name, from, to })
            }
            accessibilityLabel={`Ver fechas de compra de ${r.name}`}
            style={{
              padding: 12,
              gap: 6,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 14,
              backgroundColor: colors.surface,
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
            >
              <View style={{ flex: 1, gap: 1 }}>
                <Txt
                  numberOfLines={1}
                  style={{ fontSize: 14, fontWeight: "600" }}
                >
                  {r.name}
                </Txt>
                <Txt style={{ fontSize: 12, color: colors.textSecondary }}>
                  {nTxt(r.n, "compra")}
                  {" · Cantidad total: " + qtyText(r.qty)}
                </Txt>
              </View>
              <Txt style={{ fontSize: 14, fontWeight: "700" }}>
                {r.total > 0
                  ? (r.nEst ? "≈ " : "") + model.fx.money(disp, r.total)
                  : "Sin monto"}
              </Txt>
            </View>
            <ProgressBar
              height={6}
              pct={Math.max(4, Math.round((r.n / max) * 100))}
              color={colors.chartExpense}
            />
          </TouchableOpacity>
        ))}
        {!items.length ? (
          <Empty text="No hay ítems que coincidan en este rango de fechas." />
        ) : null}
        {items.length > limit ? (
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
