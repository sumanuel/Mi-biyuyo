import React from "react";
import { View } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { useData } from "../../contexts/DataContext";
import {
  Screen,
  Footer,
  Txt,
  Card,
  Button,
  ConvRows,
  Icon,
} from "../../components/ui";
import { META, dayRateTxt, isDebtType } from "../../utils/ledger";
import { CCY_KEYS, CCY_LABEL, dlabel } from "../../utils/money";
import { go } from "../../navigation/helpers";

export default function MovementSavedScreen({ navigation, route }) {
  const { colors } = useTheme();
  const { model } = useData();
  const { fx } = model;
  const last = model.moveById[route.params?.id];

  const home = () => {
    navigation.popToTop();
    go(navigation, "Home");
  };
  const again = () => {
    navigation.popToTop();
    go(navigation, "Pick", { type: last?.type || "gasto", ts: Date.now() });
  };

  if (!last) {
    return (
      <Screen>
        <Txt style={{ textAlign: "center", color: colors.textSecondary }}>
          Movimiento guardado.
        </Txt>
        <Button label="Volver al inicio" onPress={home} />
      </Screen>
    );
  }

  const meta = META[last.type];
  const tint = colors[last.type];
  const bal = fx.money("usd", model.balance);
  const note = isDebtType(last.type)
    ? last.cash === false
      ? `No afectó Mi saldo porque no hubo movimiento de dinero. Tu saldo sigue en ${bal}.`
      : (last.type === "cobrar"
          ? "Se descontó de Mi saldo porque el dinero ya salió. "
          : "Se sumó a Mi saldo porque ya recibiste el dinero. ") +
        `Tu saldo ahora es ${bal}.`
    : `Tu saldo ahora es ${bal}.`;

  const rows = CCY_KEYS.map((k) => ({
    label: CCY_LABEL[k],
    sub: k === last.ccy ? "Moneda del registro" : dayRateTxt(last.val, k),
    value: fx.money(k, last.val[k]),
    active: k === last.ccy,
  }));

  return (
    <Screen
      contentStyle={{ alignItems: "center", paddingTop: 32, gap: 16 }}
      footer={
        <Footer>
          <View style={{ gap: 10 }}>
            <Button label="Registrar otro" onPress={again} height={54} />
            <Button
              label="Volver al inicio"
              onPress={home}
              outline
              height={50}
            />
          </View>
        </Footer>
      }
    >
      <View
        style={{
          width: 76,
          height: 76,
          borderRadius: 999,
          backgroundColor: tint.soft,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name="check" size={38} color={tint.fg} stroke={2.6} />
      </View>
      <View style={{ gap: 4, alignItems: "center" }}>
        <Txt style={{ fontSize: 22, fontWeight: "800", textAlign: "center" }}>
          {meta.savedTitle}
        </Txt>
        <Txt style={{ fontSize: 14, color: colors.textSecondary }}>
          {last.cat.name} · {dlabel(last.date)}
        </Txt>
      </View>
      <Card style={{ alignSelf: "stretch" }} pad={14}>
        <ConvRows title="MONTO EN LAS 3 MONEDAS" rows={rows} tint={tint} />
      </Card>
      <View
        style={{
          alignSelf: "stretch",
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderRadius: 14,
          backgroundColor: tint.soft,
        }}
      >
        <Txt
          style={{
            fontSize: 13,
            fontWeight: "600",
            lineHeight: 18,
            color: tint.fg,
          }}
        >
          {note}
        </Txt>
      </View>
    </Screen>
  );
}
