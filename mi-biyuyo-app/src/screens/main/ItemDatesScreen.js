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
import { itemAgg } from "../../utils/ledger";
import { fullDate, nTxt } from "../../utils/money";
import { go } from "../../navigation/helpers";

/** Fechas en que se compró un ítem dentro del rango recibido. */
export default function ItemDatesScreen({ navigation, route }) {
  const { colors } = useTheme();
  const { model, disp } = useData();
  const { name, from, to } = route.params || {};

  const list = model.moves.filter((m) => m.date >= from && m.date <= to);
  const item = itemAgg(list, disp).find(
    (x) =>
      x.key ===
      String(name || "")
        .trim()
        .toLowerCase(),
  );
  const buys = item ? item.buys.slice().sort((a, b) => a.m.d - b.m.d) : [];

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
          {item && item.amt > 0 ? " · " + model.fx.money(disp, item.amt) : ""}
        </Txt>
      </Card>
      <View style={{ gap: 8 }}>
        {buys.map(({ m, amt }) => (
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
                {m.title}
              </Txt>
            </View>
            <Txt style={{ fontSize: 14, fontWeight: "700" }}>
              {amt > 0 ? model.fx.money(disp, amt) : "Sin monto"}
            </Txt>
          </TouchableOpacity>
        ))}
        {!buys.length ? (
          <Empty text="No hay compras de este ítem en el rango." />
        ) : null}
      </View>
    </Screen>
  );
}
