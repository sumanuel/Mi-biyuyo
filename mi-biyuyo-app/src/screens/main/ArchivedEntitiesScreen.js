import React from "react";
import { View, TouchableOpacity } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { useData } from "../../contexts/DataContext";
import { Screen, Header, Txt, Card, Tile, Empty } from "../../components/ui";
import { KIND_ICON, KIND_LABEL } from "../../utils/ledger";
import { ENT_CCY, ENT_CCY_LABEL } from "../../utils/money";

/** Entidades archivadas: se abren para ver su historial o restaurarlas. */
export default function ArchivedEntitiesScreen({ navigation }) {
  const { colors } = useTheme();
  const { model } = useData();
  const { fx } = model;
  const list = model.archivedEnts;

  return (
    <Screen contentStyle={{ gap: 12, paddingTop: 16 }}>
      <Header title="Entidades archivadas" onBack={() => navigation.goBack()} />
      <Txt style={{ fontSize: 13, lineHeight: 18, color: colors.textSecondary }}>
        Las entidades archivadas no suman a Mi saldo ni aparecen al registrar.
        Ábrelas para ver su historial o restaurarlas.
      </Txt>
      {list.length === 0 ? <Empty text="No tienes entidades archivadas." /> : null}
      {list.map((e) => {
        const k = colors.kind[e.kind] || colors.kind.otro;
        return (
          <TouchableOpacity
            key={e.id}
            activeOpacity={0.85}
            onPress={() => navigation.navigate("EntityDetail", { id: e.id })}
            accessibilityLabel={`${e.name}, archivada`}
          >
            <Card pad={14}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <Tile
                  icon={KIND_ICON[e.kind] || "card"}
                  soft={k.soft}
                  fg={k.fg}
                  size={44}
                  radius={14}
                  iconSize={22}
                />
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt numberOfLines={1} style={{ fontSize: 16, fontWeight: "700" }}>
                    {e.name}
                  </Txt>
                  <Txt style={{ fontSize: 12, color: colors.textSecondary }}>
                    {(KIND_LABEL[e.kind] || "Otro") + " · " + ENT_CCY_LABEL[e.ccy]}
                  </Txt>
                </View>
                <Txt style={{ fontSize: 14, fontWeight: "700" }}>
                  {fx.money(ENT_CCY[e.ccy], model.entNative(e))}
                </Txt>
              </View>
            </Card>
          </TouchableOpacity>
        );
      })}
    </Screen>
  );
}
