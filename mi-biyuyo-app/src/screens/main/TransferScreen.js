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
  Chip,
  ChipRow,
  CcyOptions,
  ConvRows,
  Button,
  Field,
  Empty,
} from "../../components/ui";
import DateField from "../../components/DateField";
import { CCY_KEYS, CCY_LABEL, CCY_TO_API, grp, parseNum, todayStr } from "../../utils/money";

/** Transferencia entre entidades propias (no es ingreso ni gasto). */
export default function TransferScreen({ navigation, route }) {
  const { colors } = useTheme();
  const { model, dv, actions, showToast } = useData();
  const { fx } = model;
  const tint = colors.ingreso;

  const [fromId, setFromId] = useState(route.params?.from || model.ents[0]?.id);
  const [toId, setToId] = useState(null);
  const [ccy, setCcy] = useState("usd");
  const [amount, setAmount] = useState("");
  const [fee, setFee] = useState("");
  const [date, setDate] = useState(todayStr());
  const [busy, setBusy] = useState(false);

  if (model.ents.length < 2) {
    return (
      <Screen>
        <Header title="Transferir" onBack={() => navigation.goBack()} />
        <Empty text="Necesitas al menos dos entidades para transferir." />
      </Screen>
    );
  }

  const from = model.entById[fromId] || model.ents[0];
  const to =
    model.entById[toId] && toId !== from.id
      ? model.entById[toId]
      : model.ents.find((e) => e.id !== from.id);
  const num = parseNum(amount);
  const feeNum = parseNum(fee);
  const usd = fx.toUsd(ccy, num);
  const feeUsd = fx.toUsd(ccy, feeNum);
  const fromBal = model.entBal(from);
  const toBal = model.entBal(to);
  const short = usd + feeUsd > fromBal + 0.005;
  const can = num > 0 && from.id !== to.id && !short && fx.ready(ccy) && !busy;

  const save = async () => {
    if (!can) return;
    setBusy(true);
    try {
      await actions.createTransfer({
        from_entity_id: from.id,
        to_entity_id: to.id,
        amount: num,
        fee: feeNum || 0,
        currency: CCY_TO_API[ccy],
        date,
      });
      showToast(
        `Transferencia registrada: ${fx.money(ccy, num)} de ${from.name} a ${to.name}`,
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
            label="Confirmar transferencia"
            onPress={save}
            disabled={!can}
            height={54}
            loading={busy}
          />
        </Footer>
      }
    >
      <Header title="Transferir" onBack={() => navigation.goBack()} />

      <View style={{ gap: 8 }}>
        <Txt style={{ fontSize: 14, fontWeight: "700" }}>Desde</Txt>
        <ChipRow>
          {model.ents.map((e) => (
            <Chip
              key={e.id}
              label={e.name}
              active={e.id === from.id}
              onPress={() => setFromId(e.id)}
            />
          ))}
        </ChipRow>
        <Txt style={{ fontSize: 12, color: colors.textSecondary }}>
          Disponible en {from.name}: {dv(fromBal)}
        </Txt>
      </View>

      <View style={{ gap: 8 }}>
        <Txt style={{ fontSize: 14, fontWeight: "700" }}>Hacia</Txt>
        <ChipRow>
          {model.ents
            .filter((e) => e.id !== from.id)
            .map((e) => (
              <Chip
                key={e.id}
                label={e.name}
                active={e.id === to.id}
                onPress={() => setToId(e.id)}
              />
            ))}
        </ChipRow>
      </View>

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
            accessibilityLabel="Monto a transferir"
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
        {short && num > 0 ? (
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
              Saldo insuficiente en {from.name}. Disponible:{" "}
              {fx.money("usd", fromBal)}
            </Txt>
          </View>
        ) : null}
        <View style={{ height: 1, backgroundColor: colors.divider }} />
        <ConvRows title="EQUIVALENCIAS" rows={rows} tint={tint} />
      </Card>

      <View style={{ gap: 8 }}>
        <Txt style={{ fontSize: 14, fontWeight: "700" }}>Fecha</Txt>
        <DateField value={date} onChange={setDate} tint={tint} />
      </View>

      <Field
        label="Comisión"
        hint={`(opcional, en ${ccy === "usd" ? "USD" : "VES"})`}
        value={fee}
        onChangeText={setFee}
        keyboardType="decimal-pad"
        placeholder="0,00"
      />

      <Card pad={14} style={{ gap: 8 }}>
        <Txt
          style={{
            fontSize: 12,
            fontWeight: "700",
            letterSpacing: 0.5,
            color: colors.textSecondary,
          }}
        >
          SALDOS DESPUÉS
        </Txt>
        {[
          [from.name, dv(fromBal - usd - feeUsd)],
          [to.name, dv(toBal + usd)],
        ].map(([label, value]) => (
          <View
            key={label}
            style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}
          >
            <Txt style={{ fontSize: 13, color: colors.textSecondary }}>{label}</Txt>
            <Txt style={{ fontSize: 14, fontWeight: "800" }}>{value}</Txt>
          </View>
        ))}
        <Txt style={{ fontSize: 12, lineHeight: 17, color: colors.textSecondary }}>
          Una transferencia no cuenta como ingreso ni gasto. La comisión sí sale
          de la entidad de origen.
        </Txt>
      </Card>
    </Screen>
  );
}
