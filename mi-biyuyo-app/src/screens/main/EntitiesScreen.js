import React from "react";
import { View, TouchableOpacity } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { useData } from "../../contexts/DataContext";
import {
  Screen,
  Txt,
  H1,
  Tile,
  DispTabs,
  Pill,
  Empty,
  Button,
  EyeButton,
} from "../../components/ui";
import { KIND_ICON, PT, balanceNote } from "../../utils/ledger";
import { ENT_CCY_LABEL, maskMoney } from "../../utils/money";

export function ptSummary(e) {
  const v = (e.pd || []).filter(Boolean);
  if (e.pt === "none" || !v.length || !PT[e.pt]) return "Sin datos de pago";
  return PT[e.pt].label + " · " + (e.pt === "pm" ? e.pd[1] || v[0] : v[0]);
}

export default function EntitiesScreen({ navigation }) {
  const { colors } = useTheme();
  const { model, dv, hideBalance, toggleHideBalance } = useData();
  const shareOf = (b) =>
    b < -0.005
      ? "Saldo negativo"
      : model.balance > 0 && b > 0
        ? Math.round((b / model.balance) * 100) + "% del total"
        : "0% del total";

  return (
    <Screen pull>
      <H1>Entidades</H1>
      <DispTabs height={40} />

      <View
        style={{
          backgroundColor: colors.accentDark,
          borderRadius: 20,
          paddingVertical: 18,
          paddingHorizontal: 20,
          gap: 4,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: -6,
            marginBottom: -4,
          }}
        >
          <Txt
            style={{
              fontSize: 12,
              fontWeight: "700",
              letterSpacing: 0.96,
              color: "rgba(255,255,255,0.85)",
            }}
          >
            SALDO TOTAL
          </Txt>
          <EyeButton hidden={hideBalance} onPress={toggleHideBalance} />
        </View>
        <Txt
          style={{
            fontSize: 30,
            fontWeight: "800",
            letterSpacing: -0.6,
            color: "#ffffff",
          }}
        >
          {hideBalance ? maskMoney(dv(model.balance)) : dv(model.balance)}
        </Txt>
        <Txt style={{ fontSize: 12, color: "rgba(255,255,255,0.85)" }}>
          {balanceNote(model)}
        </Txt>
      </View>

      <View style={{ gap: 8 }}>
        {model.ents.length === 0 ? (
          <Empty text="Aún no tienes entidades. Crea una para llevar tu saldo." />
        ) : null}
        {model.ents.map((e) => {
          const k = colors.kind[e.kind] || colors.kind.otro;
          const b = model.entBal(e);
          return (
            <TouchableOpacity
              key={e.id}
              activeOpacity={0.85}
              onPress={() => navigation.navigate("EntityDetail", { id: e.id })}
              accessibilityLabel={`${e.name}, saldo ${dv(b)}`}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingVertical: 12,
                paddingHorizontal: 14,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 14,
              }}
            >
              <Tile
                icon={KIND_ICON[e.kind] || "card"}
                soft={k.soft}
                fg={k.fg}
                size={44}
                radius={14}
                iconSize={22}
              />
              <View style={{ flex: 1, gap: 3 }}>
                <Txt
                  numberOfLines={1}
                  style={{ fontSize: 15, fontWeight: "700" }}
                >
                  {e.name}
                </Txt>
                <Txt
                  numberOfLines={1}
                  style={{ fontSize: 12, color: colors.textSecondary }}
                >
                  {(model.fx.single ? "" : ENT_CCY_LABEL[e.ccy] + " · ") +
                    ptSummary(e)}
                </Txt>
              </View>
              <View style={{ alignItems: "flex-end", gap: 3, maxWidth: "40%" }}>
                <Txt style={{ fontSize: 15, fontWeight: "800" }}>{dv(b)}</Txt>
                {e.include ? (
                  <Txt style={{ fontSize: 11, color: colors.textSecondary }}>
                    {shareOf(b)}
                  </Txt>
                ) : (
                  <Pill
                    label="No suma a Mi saldo"
                    bg={colors.chip}
                    fg={colors.textSecondary}
                    style={{ alignSelf: "flex-end" }}
                  />
                )}
                {model.isLow(e) ? (
                  <Pill
                    label="Saldo bajo"
                    bg={colors.warn.bg}
                    fg={colors.warn.fg}
                    style={{ alignSelf: "flex-end" }}
                  />
                ) : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <Button
          label="Nueva entidad"
          height={50}
          style={{ flex: 1, borderRadius: 14 }}
          onPress={() => navigation.navigate("EntityForm")}
        />
        <Button
          label="Transferir"
          outline
          height={50}
          style={{ flex: 1, borderRadius: 14 }}
          disabled={model.ents.length < 2}
          onPress={() => navigation.navigate("Transfer")}
        />
      </View>
    </Screen>
  );
}
