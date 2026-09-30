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
  Label,
} from "../../components/ui";
import { KIND_LABEL, KIND_PT, PT } from "../../utils/ledger";
import { CCY_KEYS, CCY_LABEL, grp, parseNum } from "../../utils/money";

const KINDS = ["efectivo", "banco", "digital", "otro"];
const PTS = ["pm", "acct", "email", "id", "none"];

const round2 = (n) => String(Math.round(n * 100) / 100).replace(".", ",");

/** Nueva entidad o edición de una existente (params.id). */
export default function EntityFormScreen({ navigation, route }) {
  const { colors } = useTheme();
  const { model, actions, showToast } = useData();
  const { fx } = model;
  const editing = model.entById[route.params?.id] || null;

  const [name, setName] = useState(editing?.name || "");
  const [kind, setKind] = useState(editing?.kind || "banco");
  const [ccy, setCcy] = useState(editing?.ccy || "ves");
  const [pt, setPt] = useState(editing?.pt || KIND_PT.banco);
  const [vals, setVals] = useState(
    editing?.pd?.length ? editing.pd.slice() : ["", "", ""],
  );
  const [init, setInit] = useState("");
  const [alertOn, setAlertOn] = useState(editing ? editing.alert != null : false);
  const [alertStr, setAlertStr] = useState(
    editing && editing.alert != null
      ? round2(ccy === "usd" ? editing.alert : editing.alert * fx.rate)
      : "",
  );
  const [busy, setBusy] = useState(false);

  const num = parseNum(init);
  const toUsd = (n) => (ccy === "usd" ? n : fx.rate > 0 ? n / fx.rate : 0);
  const initUsd = toUsd(num);
  const alertUsd = alertOn && parseNum(alertStr) > 0 ? toUsd(parseNum(alertStr)) : null;
  const vesNeedsRate = ccy === "ves" && fx.rate <= 0 && (num > 0 || alertOn);
  const canSave = name.trim().length > 0 && !vesNeedsRate && !busy;

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    const body = {
      name: name.trim(),
      kind,
      currency: ccy,
      payment_type: pt,
      payment_data: vals.slice(0, PT[pt].f.length),
      alert_usd: alertUsd,
      initial_usd: initUsd,
    };
    try {
      if (editing) {
        await actions.updateEntity(editing.id, body);
        showToast("Entidad actualizada");
        navigation.goBack();
      } else {
        const created = await actions.createEntity(body);
        showToast("Entidad creada. Ya suma a Mi saldo");
        navigation.replace("EntityDetail", { id: created.id });
      }
    } catch (err) {
      showToast(errorMessage(err));
      setBusy(false);
    }
  };

  const rows = CCY_KEYS.map((k) => ({
    label: CCY_LABEL[k],
    sub: k === "usd" ? "Moneda base" : fx.rateTxt(k),
    value: fx.ready(k) ? fx.money(k, fx.fromUsd(k, initUsd)) : "Sin tasa",
  }));
  const prefix = ccy === "usd" ? "USD" : "VES";

  return (
    <Screen
      contentStyle={{ gap: 16, paddingTop: 16 }}
      footer={
        <Footer>
          <Button
            label={editing ? "Guardar cambios" : "Guardar entidad"}
            onPress={save}
            disabled={!canSave}
            height={54}
            loading={busy}
          />
        </Footer>
      }
    >
      <Header
        title={editing ? "Editar entidad" : "Nueva entidad"}
        onBack={() => navigation.goBack()}
      />

      <Field
        label="Nombre"
        value={name}
        onChangeText={setName}
        placeholder="Ej: Banco 1, Efectivo, PayPal"
      />

      <View style={{ gap: 8 }}>
        <Txt style={{ fontSize: 14, fontWeight: "700" }}>Tipo</Txt>
        <ChipRow>
          {KINDS.map((k) => (
            <Chip
              key={k}
              label={KIND_LABEL[k]}
              active={kind === k}
              onPress={() => {
                setKind(k);
                setPt(KIND_PT[k]);
              }}
            />
          ))}
        </ChipRow>
      </View>

      <View style={{ gap: 8 }}>
        <Txt style={{ fontSize: 14, fontWeight: "700" }}>Moneda de la entidad</Txt>
        <CcyOptions
          tint={colors.ingreso}
          options={[
            { label: "USD", sub: "Moneda base", active: ccy === "usd", onPress: () => setCcy("usd") },
            {
              label: "VES",
              sub: fx.rate > 0 ? "A tasa BCV " + grp(fx.rate, ".", ",") : "Sin tasa BCV",
              active: ccy === "ves",
              onPress: () => setCcy("ves"),
            },
          ]}
        />
      </View>

      {!editing ? (
        <Card style={{ gap: 12 }}>
          <Txt
            style={{
              fontSize: 12,
              fontWeight: "700",
              letterSpacing: 0.5,
              color: colors.textSecondary,
            }}
          >
            SALDO INICIAL
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
              value={init}
              onChangeText={setInit}
              keyboardType="decimal-pad"
              placeholder="0,00"
              accessibilityLabel="Saldo inicial"
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
          <ConvRows rows={rows} />
          {vesNeedsRate ? (
            <Txt style={{ fontSize: 12, color: colors.danger.fg }}>
              Configura la tasa BCV en Ajustes para usar una entidad en bolívares.
            </Txt>
          ) : null}
        </Card>
      ) : (
        <View
          style={{
            padding: 12,
            paddingHorizontal: 14,
            borderRadius: 14,
            backgroundColor: colors.chip,
          }}
        >
          <Txt style={{ fontSize: 13, lineHeight: 18, color: colors.textSecondary }}>
            El saldo se ajusta con los movimientos y las transferencias. No se
            edita a mano.
          </Txt>
        </View>
      )}

      <Card style={{ gap: 12 }}>
        <Txt style={{ fontSize: 14, fontWeight: "700" }}>Alerta de saldo bajo</Txt>
        <Txt style={{ fontSize: 13, lineHeight: 18, color: colors.textSecondary }}>
          Te avisamos en el inicio y en la lista cuando el saldo de esta entidad
          baje del monto que definas.
        </Txt>
        <ChipRow>
          {[
            [true, "Activada"],
            [false, "Desactivada"],
          ].map(([v, l]) => (
            <Chip key={l} label={l} active={alertOn === v} onPress={() => setAlertOn(v)} />
          ))}
        </ChipRow>
        {alertOn ? (
          <Field
            label={`Avisar cuando baje de (${prefix})`}
            value={alertStr}
            onChangeText={setAlertStr}
            keyboardType="decimal-pad"
            placeholder="0,00"
          />
        ) : null}
      </Card>

      <View style={{ gap: 8 }}>
        <Txt style={{ fontSize: 14, fontWeight: "700" }}>Datos de pago</Txt>
        <ChipRow>
          {PTS.map((k) => (
            <Chip
              key={k}
              label={PT[k].label}
              active={pt === k}
              onPress={() => setPt(k)}
            />
          ))}
        </ChipRow>
      </View>
      {PT[pt].f.map((label, i) => (
        <Field
          key={pt + i}
          label={label}
          value={vals[i] || ""}
          onChangeText={(v) =>
            setVals((prev) => {
              const next = prev.slice();
              next[i] = v;
              return next;
            })
          }
        />
      ))}
    </Screen>
  );
}
