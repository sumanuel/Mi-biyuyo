import React, { useState } from "react";
import { View, TouchableOpacity } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { useData, errorMessage } from "../../contexts/DataContext";
import {
  Screen,
  Footer,
  Header,
  Txt,
  Input,
  Card,
  Tile,
  Chip,
  ChipRow,
  CcyOptions,
  ConvRows,
  Button,
  Empty,
} from "../../components/ui";
import {
  CCY_KEYS,
  CCY_LABEL,
  CCY_TO_API,
  fmtIn,
  grp,
  parseNum,
  todayStr,
} from "../../utils/money";
import DateField from "../../components/DateField";

/** Registrar un cobro (por cobrar) o un pago (por pagar) parcial. */
export default function PayScreen({ navigation, route }) {
  const { colors } = useTheme();
  const { model, dv, actions, showToast } = useData();
  const { fx } = model;
  const debt = model.moveById[route.params?.id];

  const [ccy, setCcy] = useState("usd");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayStr());
  const [entId, setEntId] = useState(null);
  const [busy, setBusy] = useState(false);

  if (!debt) {
    return (
      <Screen>
        <Header title="Registrar abono" onBack={() => navigation.goBack()} />
        <Empty text="No se encontró esta deuda." />
      </Screen>
    );
  }

  const isCobro = debt.type === "cobrar";
  const tint = colors[debt.type];
  const pend = model.pendOf(debt);
  const num = parseNum(amount);
  const usd = fx.toUsd(ccy, num);
  const over = usd > pend + 0.005;
  const after = Math.max(0, pend - usd);
  const rateMissing = !fx.ready(ccy);
  const entSel =
    entId && model.entById[entId]
      ? entId
      : model.entById[debt.ent]
        ? debt.ent
        : model.ents[0]?.id;
  const canPay =
    num > 0 && !over && pend > 0.005 && !rateMissing && !!entSel && !busy;

  const save = async () => {
    if (!canPay) return;
    setBusy(true);
    try {
      await actions.addPayment(debt.id, {
        amount: num,
        currency: CCY_TO_API[ccy],
        date,
        entity_id: entSel,
        notes: model.entName(entSel),
      });
      showToast(
        `${isCobro ? "Cobro" : "Pago"} registrado: ${fx.money(ccy, num)}. Saldo ${fx.money("usd", after)}`,
      );
      navigation.goBack();
    } catch (err) {
      showToast(errorMessage(err));
      setBusy(false);
    }
  };

  const rows = CCY_KEYS.map((k) => ({
    label: CCY_LABEL[k],
    sub: k === ccy ? "Moneda del registro" : fx.rateTxt(k),
    value: fx.ready(k) ? fx.money(k, fx.fromUsd(k, usd)) : "Sin tasa",
    active: k === ccy,
  }));

  return (
    <Screen
      contentStyle={{ gap: 16, paddingTop: 16 }}
      footer={
        <Footer>
          <Button
            label={isCobro ? "Guardar cobro" : "Guardar pago"}
            onPress={save}
            disabled={!canPay}
            bg={tint.strong}
            height={54}
            loading={busy}
          />
        </Footer>
      }
    >
      <Header
        title={isCobro ? "Registrar cobro" : "Registrar pago"}
        onBack={() => navigation.goBack()}
      />

      <Card
        pad={0}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingVertical: 12,
          paddingHorizontal: 14,
        }}
      >
        <Tile
          icon={debt.cat.icon}
          soft={tint.soft}
          fg={tint.fg}
          size={44}
          radius={14}
          iconSize={22}
        />
        <View style={{ flex: 1, gap: 2 }}>
          <Txt numberOfLines={1} style={{ fontSize: 15, fontWeight: "700" }}>
            {debt.person || debt.title}
          </Txt>
          <Txt style={{ fontSize: 12, color: colors.textSecondary }}>
            Pendiente {fx.money("usd", pend)}
          </Txt>
        </View>
      </Card>

      <View style={{ gap: 8 }}>
        <Txt style={{ fontSize: 14, fontWeight: "700" }}>Moneda del registro</Txt>
        <CcyOptions
          tint={tint}
          options={CCY_KEYS.map((k) => ({
            label: CCY_LABEL[k],
            sub: k === "usd" ? "Base" : fx.ready(k) ? grp(fx.FACT[k], ".", ",") : "Sin tasa",
            active: k === ccy,
            onPress: () => setCcy(k),
          }))}
        />
      </View>

      <Card style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Txt
            style={{
              fontSize: 16,
              fontWeight: "800",
              color: colors.textSecondary,
            }}
          >
            {ccy === "usd" ? "USD" : "VES"}
          </Txt>
          <Input
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0,00"
            accessibilityLabel="Monto del abono"
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
        <View style={{ flexDirection: "row", gap: 8 }}>
          {[
            ["Saldo total", () => setAmount(fmtIn(fx.fromUsd(ccy, pend)))],
            ["Mitad", () => setAmount(fmtIn(fx.fromUsd(ccy, pend / 2)))],
          ].map(([label, fn]) => (
            <TouchableOpacity
              key={label}
              onPress={fn}
              disabled={rateMissing}
              style={{
                flex: 1,
                minHeight: 44,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Txt style={{ fontSize: 13, fontWeight: "700" }}>{label}</Txt>
            </TouchableOpacity>
          ))}
        </View>
        {over ? (
          <View
            style={{
              padding: 10,
              paddingHorizontal: 12,
              borderRadius: 12,
              backgroundColor: colors.danger.bg,
            }}
          >
            <Txt
              style={{
                color: colors.danger.fg,
                fontSize: 13,
                fontWeight: "600",
                lineHeight: 18,
              }}
            >
              El monto supera el saldo pendiente (Pendiente{" "}
              {fx.money("usd", pend)}).
            </Txt>
          </View>
        ) : null}
        <View style={{ height: 1, backgroundColor: colors.divider }} />
        <ConvRows title="EQUIVALENCIAS" rows={rows} tint={tint} />
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "baseline",
            paddingTop: 10,
            borderTopWidth: 1,
            borderTopColor: colors.divider,
          }}
        >
          <Txt
            style={{
              fontSize: 13,
              color: colors.textSecondary,
              fontWeight: "600",
            }}
          >
            Saldo tras este abono
          </Txt>
          <Txt style={{ fontSize: 16, fontWeight: "800" }}>
            {fx.money("usd", after)}
          </Txt>
        </View>
      </Card>

      <View style={{ gap: 8 }}>
        <Txt style={{ fontSize: 14, fontWeight: "700" }}>Fecha</Txt>
        <DateField value={date} onChange={setDate} min={debt.date} tint={tint} />
      </View>

      <View style={{ gap: 8 }}>
        <Txt style={{ fontSize: 14, fontWeight: "700" }}>
          {isCobro ? "¿En qué entidad entró?" : "¿De qué entidad salió?"}
        </Txt>
        <ChipRow>
          {model.ents.map((e) => (
            <Chip
              key={e.id}
              label={e.name}
              active={e.id === entSel}
              color={tint.strong}
              onPress={() => setEntId(e.id)}
            />
          ))}
        </ChipRow>
      </View>
    </Screen>
  );
}
