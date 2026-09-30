import React, { useEffect, useState } from "react";
import { View, TouchableOpacity } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { useData } from "../../contexts/DataContext";
import {
  Screen,
  Txt,
  H1,
  Card,
  Segmented,
  DispTabs,
  ProgressBar,
  Tile,
  TonePill,
  Empty,
} from "../../components/ui";
import { META, debtStatus } from "../../utils/ledger";
import { go } from "../../navigation/helpers";

/** Lista de por cobrar / por pagar. */
export default function DebtsScreen({ navigation, route }) {
  const { colors } = useTheme();
  const { model, dv } = useData();
  const [tab, setTab] = useState(route.params?.tab || "cobrar");

  useEffect(() => {
    if (route.params?.tab) setTab(route.params.tab);
  }, [route.params?.tab]);

  const tint = colors[tab];
  const all = model.moves.filter((m) => m.type === tab);
  const total = all.reduce((a, m) => a + m.usd, 0);
  const paid = all.reduce((a, m) => a + model.paidOf(m), 0);
  const rows = all.slice().sort((a, b) => {
    const ao = model.pendOf(a) <= 0.005 ? 1 : 0;
    const bo = model.pendOf(b) <= 0.005 ? 1 : 0;
    if (ao !== bo) return ao - bo;
    return (
      (a.dueIn === null ? 999 : a.dueIn) - (b.dueIn === null ? 999 : b.dueIn)
    );
  });

  return (
    <Screen pull>
      <H1>Por cobrar y por pagar</H1>
      <Segmented
        items={["cobrar", "pagar"].map((k) => ({
          label: META[k].short,
          active: tab === k,
          onPress: () => setTab(k),
        }))}
      />
      <DispTabs height={40} />

      <Card style={{ gap: 10 }}>
        <Txt
          style={{
            fontSize: 12,
            color: colors.textSecondary,
            fontWeight: "600",
          }}
        >
          {tab === "cobrar" ? "Pendiente por cobrar" : "Pendiente por pagar"}
        </Txt>
        <Txt style={{ fontSize: 28, fontWeight: "800", letterSpacing: -0.56 }}>
          {dv(total - paid)}
        </Txt>
        <ProgressBar
          pct={total > 0 ? Math.round((paid / total) * 100) : 0}
          color={tint.strong}
        />
        <Txt style={{ fontSize: 12, color: colors.textSecondary }}>
          {(tab === "cobrar" ? "Cobrado " : "Pagado ") +
            dv(paid) +
            " de " +
            dv(total)}
        </Txt>
      </Card>

      <View style={{ gap: 8 }}>
        {rows.length === 0 ? (
          <Empty
            text={
              tab === "cobrar"
                ? "No tienes cobros registrados."
                : "No tienes deudas registradas."
            }
          />
        ) : null}
        {rows.map((m) => {
          const st = debtStatus(model, m);
          return (
            <TouchableOpacity
              key={m.id}
              activeOpacity={0.85}
              onPress={() => navigation.navigate("DebtDetail", { id: m.id })}
              accessibilityLabel={`${m.person || m.title}, pendiente ${dv(model.pendOf(m))}`}
              style={{
                paddingVertical: 12,
                paddingHorizontal: 14,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 14,
                gap: 10,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <Tile icon={m.cat.icon} soft={tint.soft} fg={tint.fg} />
                <View style={{ flex: 1, gap: 3 }}>
                  <Txt numberOfLines={1} style={{ fontSize: 14, fontWeight: "700" }}>
                    {m.person || m.title}
                  </Txt>
                  <Txt
                    numberOfLines={1}
                    style={{ fontSize: 12, color: colors.textSecondary }}
                  >
                    {m.cat.name} · {m.title}
                  </Txt>
                </View>
                <View style={{ alignItems: "flex-end", gap: 3 }}>
                  <Txt style={{ fontSize: 15, fontWeight: "800" }}>
                    {dv(model.pendOf(m))}
                  </Txt>
                  <Txt style={{ fontSize: 11, color: colors.textSecondary }}>
                    de {dv(m.usd)}
                  </Txt>
                </View>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <ProgressBar
                    height={6}
                    pct={m.usd > 0 ? Math.round((model.paidOf(m) / m.usd) * 100) : 0}
                    color={tint.strong}
                  />
                </View>
                <TonePill label={st.t} toneName={st.tone} />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        onPress={() => go(navigation, "Pick", { type: tab, ts: Date.now() })}
        style={{
          minHeight: 50,
          borderWidth: 1,
          borderStyle: "dashed",
          borderColor: colors.disabled,
          borderRadius: 14,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Txt style={{ fontSize: 14, fontWeight: "700" }}>
          {tab === "cobrar"
            ? "Registrar nuevo por cobrar"
            : "Registrar nuevo por pagar"}
        </Txt>
      </TouchableOpacity>
    </Screen>
  );
}
