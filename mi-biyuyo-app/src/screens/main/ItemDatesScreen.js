import React from "react";
import { TouchableOpacity, View } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { useData } from "../../contexts/DataContext";
import {
  Screen,
  Header,
  Txt,
  DispTabs,
  Card,
  Empty,
} from "../../components/ui";
import { byRecent, itemAgg } from "../../utils/ledger";
import { fullDate, nTxt } from "../../utils/money";
import { itemKey, qtyText } from "../../utils/text";
import { go } from "../../navigation/helpers";

/** Fechas en que se compró un ítem dentro del rango recibido. */
export default function ItemDatesScreen({ navigation, route }) {
  const { colors } = useTheme();
  const { model, disp } = useData();
  const { name, from, to } = route.params || {};

  const list = model.moves.filter((m) => m.date >= from && m.date <= to);
  const item = itemAgg(list, disp).find((x) => x.key === itemKey(name));
  const buys = item ? item.buys.slice().sort((a, b) => byRecent(a.m, b.m)) : [];

  // Montos. Las compras sin monto se estiman con el último precio por unidad que tenga el ítem
  // (la compra más reciente con monto: monto ÷ cantidad), y se marcan como estimadas.
  const money = (v) => model.fx.money(disp, v);
  const lastPriced = buys.find((b) => b.amt > 0); // `buys` va de la más reciente a la más antigua
  const lastUnit = lastPriced ? lastPriced.amt / lastPriced.qty : 0;
  const rows = buys.map((b) =>
    b.amt > 0
      ? { ...b, est: false }
      : { ...b, amt: lastUnit * b.qty, est: lastUnit > 0 },
  );
  const withAmt = rows.filter((r) => r.amt > 0);
  const nEst = rows.filter((r) => r.est).length;
  const total = withAmt.reduce((a, r) => a + r.amt, 0);
  const qtyAmt = withAmt.reduce((a, r) => a + r.qty, 0);
  const stats = [];
  if (withAmt.length) {
    stats.push([
      nEst ? "Monto total (con estimados)" : "Monto total",
      money(total),
    ]);
    stats.push(["Promedio por compra", money(total / withAmt.length)]);
    // Si todas las compras fueron de 1 unidad, el promedio por unidad sería el mismo
    if (qtyAmt !== withAmt.length)
      stats.push(["Promedio por unidad", money(total / qtyAmt)]);
  }

  return (
    <Screen data={false} contentStyle={{ paddingTop: 16 }}>
      <Header title={name || "Ítem"} onBack={() => navigation.goBack()} />
      <DispTabs height={40} />
      <Card style={{ gap: 2 }}>
        <Txt style={{ fontSize: 12, color: colors.textSecondary }}>
          Del {fullDate(from)} al {fullDate(to)}
        </Txt>
        <Txt style={{ fontSize: 15, fontWeight: "700" }}>
          {nTxt(buys.length, "compra")}
          {item ? " · Cantidad total: " + qtyText(item.qty) : ""}
        </Txt>
        {stats.map(([label, value]) => (
          <View
            key={label}
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              gap: 12,
              paddingTop: 6,
            }}
          >
            <Txt style={{ fontSize: 13, color: colors.textSecondary }}>
              {label}
            </Txt>
            <Txt style={{ fontSize: 14, fontWeight: "700" }}>{value}</Txt>
          </View>
        ))}
        {nEst ? (
          <Txt
            style={{ fontSize: 11, color: colors.textSecondary, paddingTop: 4 }}
          >
            {`${nTxt(nEst, "compra")} sin monto ${nEst === 1 ? "se estimó" : "se estimaron"} con el último precio por unidad: ${money(lastUnit)}.`}
          </Txt>
        ) : null}
      </Card>
      <View style={{ gap: 8 }}>
        {rows.map(({ m, amt, qty, est }) => (
          <TouchableOpacity
            key={m.id}
            activeOpacity={0.8}
            onPress={() => go(navigation, "MovementDetail", { id: m.id })}
            accessibilityLabel={`Ver compra del ${fullDate(m.date)}`}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              padding: 12,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 14,
              backgroundColor: colors.surface,
            }}
          >
            <View style={{ flex: 1, gap: 1 }}>
              <Txt style={{ fontSize: 14, fontWeight: "700" }}>
                {fullDate(m.date)}
              </Txt>
              <Txt
                numberOfLines={1}
                style={{ fontSize: 12, color: colors.textSecondary }}
              >
                {"Cantidad " + qtyText(qty) + " · " + m.title}
              </Txt>
            </View>
            <View style={{ alignItems: "flex-end", gap: 1 }}>
              <Txt
                style={{
                  fontSize: 14,
                  fontWeight: "700",
                  color: est ? colors.textSecondary : colors.text,
                }}
              >
                {amt > 0 ? (est ? "≈ " : "") + money(amt) : "Sin monto"}
              </Txt>
              {est ? (
                <Txt style={{ fontSize: 11, color: colors.textSecondary }}>
                  Estimado
                </Txt>
              ) : null}
            </View>
          </TouchableOpacity>
        ))}
        {!buys.length ? (
          <Empty text="No hay compras de este ítem en el rango." />
        ) : null}
      </View>
    </Screen>
  );
}
