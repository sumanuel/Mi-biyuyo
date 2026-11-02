import React, { useState } from "react";
import { View } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { useData, errorMessage } from "../../contexts/DataContext";
import {
  Screen,
  Footer,
  Header,
  Txt,
  Input,
  Card,
  Button,
  Field,
  Empty,
} from "../../components/ui";
import DateField from "../../components/DateField";
import {
  ENT_CCY,
  ENT_CCY_LABEL,
  dlabel,
  fmtIn,
  parseNum,
  todayStr,
} from "../../utils/money";
import { useFocusChain } from "../../hooks/useFocusChain";
import { confirm } from "../../utils/confirm";

/**
 * Ajustar el saldo de una entidad (params.entId) o ver/deshacer un ajuste ya hecho (params.adjId).
 * El ajuste corrige el saldo con un movimiento propio: no cuenta como ingreso ni gasto y el
 * historial anterior no cambia.
 */
export default function AdjustBalanceScreen({ navigation, route }) {
  const chain = useFocusChain();
  const { colors } = useTheme();
  const { model, dv, actions, showToast } = useData();
  const { fx } = model;

  const adj = model.adjustmentById[route.params?.adjId] || null;
  const e = model.entById[adj ? adj.ent : route.params?.entId];

  const dec = e && e.ccy === "usdt" ? 3 : 2;
  const cur = e ? model.entNative(e) : 0;
  const key = e ? ENT_CCY[e.ccy] : "usd"; // moneda de la entidad en el formato de fx
  const [real, setReal] = useState(e ? fmtIn(Math.max(0, cur), dec) : "");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayStr());
  const [busy, setBusy] = useState(false);

  if (!e) {
    return (
      <Screen>
        <Header title="Ajustar saldo" onBack={() => navigation.goBack()} />
        <Empty text="No se encontró esta entidad." />
      </Screen>
    );
  }

  const prefix = ENT_CCY_LABEL[e.ccy];
  const signed = (n) => (n >= 0 ? "+" : "-") + fx.money(key, Math.abs(n));

  /* ---------- ver / deshacer un ajuste existente ---------- */
  if (adj) {
    const undo = async () => {
      const ok = await confirm(
        "Deshacer ajuste",
        `¿Deshacer este ajuste? El saldo de "${e.name}" volverá a ser ${fx.money(key, cur - adj.native)}.`,
        "Deshacer",
      );
      if (!ok) return;
      setBusy(true);
      try {
        await actions.deleteAdjustment(adj.id);
        showToast("Ajuste deshecho");
        navigation.goBack();
      } catch (err) {
        showToast(errorMessage(err));
        setBusy(false);
      }
    };
    return (
      <Screen
        contentStyle={{ gap: 16, paddingTop: 16 }}
        footer={
          <Footer>
            <Button
              label="Deshacer ajuste"
              outline
              height={54}
              loading={busy}
              onPress={undo}
            />
          </Footer>
        }
      >
        <Header title="Ajuste de saldo" onBack={() => navigation.goBack()} />
        <Card style={{ gap: 6 }}>
          <Txt style={{ fontSize: 13, color: colors.textSecondary }}>
            {e.name} · {dlabel(adj.date)}
          </Txt>
          <Txt style={{ fontSize: 30, fontWeight: "800", letterSpacing: -0.6 }}>
            {signed(adj.native)}
          </Txt>
          <Txt style={{ fontSize: 13, color: colors.textSecondary }}>
            {adj.note || "Sin motivo indicado"}
          </Txt>
        </Card>
        <Txt style={{ fontSize: 13, lineHeight: 18, color: colors.textSecondary }}>
          Es una corrección de saldo: no cuenta como ingreso ni gasto en tus
          estadísticas. Si la deshaces, el saldo de la entidad vuelve a como
          estaba antes.
        </Txt>
      </Screen>
    );
  }

  /* ---------- nuevo ajuste ---------- */
  const realNum = parseNum(real);
  const diff = Math.round((realNum - cur) * 10000) / 10000;
  const tiny = Math.abs(diff) < (e.ccy === "usdt" ? 0.0005 : 0.005);
  const rateOk = fx.ready(key);
  const can = !tiny && rateOk && !busy;

  const save = async () => {
    if (!can) return;
    setBusy(true);
    try {
      await actions.createAdjustment({
        entity_id: e.id,
        amount: diff,
        date,
        note: note.trim() || null,
      });
      showToast(`Saldo de ${e.name} ajustado a ${fx.money(key, realNum)}`);
      navigation.goBack();
    } catch (err) {
      showToast(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Screen
      contentStyle={{ gap: 16, paddingTop: 16 }}
      footer={
        <Footer>
          <Button
            label="Guardar ajuste"
            onPress={save}
            disabled={!can}
            height={54}
            loading={busy}
          />
        </Footer>
      }
    >
      <Header title="Ajustar saldo" onBack={() => navigation.goBack()} />

      <Card style={{ gap: 4 }}>
        <Txt style={{ fontSize: 13, color: colors.textSecondary }}>
          Saldo actual de {e.name}
        </Txt>
        <Txt style={{ fontSize: 24, fontWeight: "800", letterSpacing: -0.4 }}>
          {fx.money(key, cur)}
        </Txt>
      </Card>

      <Card style={{ gap: 12 }}>
        <Txt
          style={{
            fontSize: 12,
            fontWeight: "700",
            letterSpacing: 0.5,
            color: colors.textSecondary,
          }}
        >
          SALDO REAL
        </Txt>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Txt
            style={{
              fontSize: 16,
              fontWeight: "800",
              color: colors.textSecondary,
            }}
          >
            {prefix}
          </Txt>
          <Input
            value={real}
            onChangeText={setReal}
            keyboardType="decimal-pad"
            placeholder="0,00"
            accessibilityLabel="Saldo real"
            {...chain(0)}
            style={{
              flex: 1,
              minWidth: 0,
              textAlign: "right",
              fontSize: 34,
              fontWeight: "800",
              letterSpacing: -0.68,
              padding: 0,
            }}
          />
        </View>
        <View style={{ height: 1, backgroundColor: colors.divider }} />
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Txt style={{ fontSize: 14, fontWeight: "700" }}>Diferencia</Txt>
          <Txt
            style={{
              fontSize: 16,
              fontWeight: "800",
              color: tiny
                ? colors.textSecondary
                : diff > 0
                  ? colors.ingreso.strong
                  : colors.gasto.strong,
            }}
          >
            {tiny ? "Sin diferencia" : signed(diff)}
          </Txt>
        </View>
        {!rateOk ? (
          <Txt style={{ fontSize: 12, color: colors.danger.fg }}>
            Configura la tasa en Ajustes para ajustar una entidad en {prefix}.
          </Txt>
        ) : null}
      </Card>

      <Field
        label="Motivo"
        hint="(opcional)"
        value={note}
        onChangeText={setNote}
        placeholder="Ej: Gastos que no registré"
        {...chain(1, { last: true })}
      />

      <View style={{ gap: 8 }}>
        <Txt style={{ fontSize: 14, fontWeight: "700" }}>Fecha</Txt>
        <DateField value={date} onChange={setDate} tint={colors.ingreso} />
      </View>

      <Txt style={{ fontSize: 13, lineHeight: 18, color: colors.textSecondary }}>
        Escribe cuánto tienes de verdad en esta entidad. La app registra la
        diferencia como un ajuste: no cuenta como ingreso ni gasto y tus
        movimientos anteriores no cambian.
      </Txt>
    </Screen>
  );
}
