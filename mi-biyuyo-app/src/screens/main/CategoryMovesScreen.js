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
import { byRecent } from "../../utils/ledger";
import { fullDate, nTxt } from "../../utils/money";
import { go } from "../../navigation/helpers";

/** Movimientos de una categoría (gasto o ingreso) dentro del rango recibido. */
export default function CategoryMovesScreen({ navigation, route }) {
  const { colors } = useTheme();
  const { model, disp } = useData();
  const { catId, type, name, from, to } = route.params || {};

  const moves = model.moves
    .filter(
      (m) =>
        m.type === type &&
        (m.cat.id ?? "x") === catId &&
        m.date >= from &&
        m.date <= to,
    )
    .sort(byRecent);
  const total = moves.reduce((a, m) => a + m.val[disp], 0);

  return (
    <Screen data={false} contentStyle={{ paddingTop: 16 }}>
      <Header title={name || "Categoría"} onBack={() => navigation.goBack()} />
      <DispTabs height={40} />
      <Card style={{ gap: 2 }}>
        <Txt style={{ fontSize: 12, color: colors.textSecondary }}>
          Del {fullDate(from)} al {fullDate(to)}
        </Txt>
        <Txt style={{ fontSize: 15, fontWeight: "700" }}>
          {nTxt(moves.length, "movimiento")}
          {moves.length ? " · " + model.fx.money(disp, total) : ""}
        </Txt>
      </Card>
      <View style={{ gap: 8 }}>
        {moves.map((m) => (
          <TouchableOpacity
            key={m.id}
            activeOpacity={0.8}
            onPress={() => go(navigation, "MovementDetail", { id: m.id })}
            accessibilityLabel={`Ver movimiento del ${fullDate(m.date)}`}
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
              {model.fx.money(disp, m.val[disp])}
            </Txt>
          </TouchableOpacity>
        ))}
        {!moves.length ? (
          <Empty text="No hay movimientos de esta categoría en el rango." />
        ) : null}
      </View>
    </Screen>
  );
}
