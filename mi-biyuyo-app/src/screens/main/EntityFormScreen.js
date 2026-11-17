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
  Chip,
  ChipRow,
  CcyOptions,
  ConvRows,
  Button,
  Field,
  Label,
  Icon,
} from "../../components/ui";
import { KIND_LABEL, KIND_PT, PT } from "../../utils/ledger";
import {
  CCY_KEYS,
  CCY_LABEL,
  ENT_CCY,
  ENT_CCY_LABEL,
  fmtIn,
  grp,
  parseNum,
} from "../../utils/money";
import { useFocusChain } from "../../hooks/useFocusChain";
import { usePlan } from "../../hooks/usePlan";

// Comisiones bancarias: métodos y topes del BCV (tarifas vigentes desde el 18/09/2026, solo en bolívares)
const FEE_METHODS = [
  ["pago_movil", "Pago móvil"],
  ["transferencia", "Transferencia"],
];
const BCV_FEES = {
  pago_movil: { pct: "0,3", min: "14", max: "" },
  transferencia: { pct: "0,3", min: "14", max: "" },
};
const feeStr = (n) => (n > 0 ? String(n).replace(".", ",") : "");
const feeNum = (s) => {
  const n = parseFloat(String(s || "").replace(",", "."));
  return n > 0 ? n : 0;
};

const KINDS = ["efectivo", "banco", "digital", "otro"];
const PTS = ["pm", "acct", "email", "id", "none"];

const round2 = (n) => String(Math.round(n * 100) / 100).replace(".", ",");

/** Nueva entidad o edición de una existente (params.id). */
export default function EntityFormScreen({ navigation, route }) {
  const chain = useFocusChain();
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
  // Editando: el saldo inicial solo se puede corregir mientras la entidad no tenga movimientos;
  // después se corrige con «Ajustar saldo» (así el historial no cambia hacia atrás)
  const canEditInit = !editing || !model.entUsed(editing.id);
  const [init, setInit] = useState(
    editing && editing.initNative > 0
      ? fmtIn(editing.initNative, editing.ccy === "usdt" ? 3 : 2)
      : "",
  );
  const [alertOn, setAlertOn] = useState(
    editing ? editing.alert != null : false,
  );
  const [alertStr, setAlertStr] = useState(
    editing && editing.alert != null
      ? round2(fx.fromUsd(ENT_CCY[ccy], editing.alert))
      : "",
  );
  const [include, setInclude] = useState(editing ? editing.include : true);
  const [busy, setBusy] = useState(false);
  const { can, gate } = usePlan();
  const canFees = can("fees");
  const [fees, setFees] = useState(() => {
    const r = editing?.feeRules || {};
    const out = {};
    FEE_METHODS.forEach(([k]) => {
      out[k] = {
        pct: feeStr(r[k]?.pct),
        min: feeStr(r[k]?.min),
        max: feeStr(r[k]?.max),
      };
    });
    return out;
  });
  const setFee = (k, f, v) =>
    setFees((prev) => ({ ...prev, [k]: { ...prev[k], [f]: v } }));

  const num = parseNum(init);
  const toUsd = (n) => fx.toUsd(ENT_CCY[ccy], n); // 0 si falta la tasa necesaria
  const initUsd = toUsd(num);
  const alertUsd =
    alertOn && parseNum(alertStr) > 0 ? toUsd(parseNum(alertStr)) : null;
  const vesNeedsRate = !fx.ready(ENT_CCY[ccy]) && (num > 0 || alertOn);
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
      include_in_balance: include,
    };
    if (canEditInit) body.initial_amount = num;
    // Reglas de comisión (solo bancos y Premium); sin ninguna se mandan vacías para quitarlas
    if (kind === "banco" && canFees) {
      const rules = {};
      FEE_METHODS.forEach(([k]) => {
        const f = fees[k];
        if (feeNum(f.pct) > 0 || feeNum(f.min) > 0)
          rules[k] = { pct: feeNum(f.pct), min: feeNum(f.min), max: feeNum(f.max) || null };
      });
      body.fee_rules = Object.keys(rules).length ? rules : null;
    } else if (kind !== "banco") {
      body.fee_rules = null;
    }
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
  const prefix = ENT_CCY_LABEL[ccy];

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
        {...chain(0)}
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
        <Txt style={{ fontSize: 14, fontWeight: "700" }}>
          Moneda de la entidad
        </Txt>
        <CcyOptions
          tint={colors.ingreso}
          options={[
            {
              label: "USD",
              sub: "Moneda base",
              active: ccy === "usd",
              onPress: () => setCcy("usd"),
            },
            {
              label: "VES",
              sub:
                fx.rate > 0
                  ? "A tasa BCV " + grp(fx.rate, ".", ",")
                  : "Sin tasa BCV",
              active: ccy === "ves",
              onPress: () => setCcy("ves"),
            },
            {
              label: "USDT",
              sub:
                fx.rateB > 0
                  ? "Binance " + grp(fx.rateB, ".", ",")
                  : "Sin tasa Binance",
              active: ccy === "usdt",
              onPress: () => setCcy("usdt"),
            },
          ]}
        />
      </View>

      {canEditInit ? (
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
              {...chain(1)}
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
          <ConvRows title="EQUIVALENCIAS" rows={rows} collapsible />
          {vesNeedsRate ? (
            <Txt style={{ fontSize: 12, color: colors.danger.fg }}>
              {ccy === "usdt"
                ? "Configura las tasas BCV y Binance en Ajustes para usar una entidad en USDT."
                : "Configura la tasa BCV en Ajustes para usar una entidad en bolívares."}
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
          <Txt
            style={{
              fontSize: 13,
              lineHeight: 18,
              color: colors.textSecondary,
            }}
          >
            El saldo se ajusta con los movimientos y las transferencias. Para
            corregirlo, usa «Ajustar saldo» en el detalle de la entidad.
          </Txt>
        </View>
      )}

      <TouchableOpacity
        onPress={() => setInclude((v) => !v)}
        activeOpacity={0.85}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: include }}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          padding: 16,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 16,
        }}
      >
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 8,
            borderWidth: 2,
            borderColor: include ? colors.accent : colors.disabled,
            backgroundColor: include ? colors.accent : "transparent",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {include ? (
            <Icon name="check" size={16} color="#ffffff" stroke={3} />
          ) : null}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt style={{ fontSize: 14, fontWeight: "700" }}>
            Sumar a Mi saldo
          </Txt>
          <Txt
            style={{
              fontSize: 12,
              lineHeight: 17,
              color: colors.textSecondary,
            }}
          >
            Si lo desmarcas, la entidad sigue funcionando pero su saldo no se
            cuenta en Mi saldo.
          </Txt>
        </View>
      </TouchableOpacity>

      <Card style={{ gap: 12 }}>
        <Txt style={{ fontSize: 14, fontWeight: "700" }}>
          Alerta de saldo bajo
        </Txt>
        <Txt
          style={{ fontSize: 13, lineHeight: 18, color: colors.textSecondary }}
        >
          Te avisamos en el inicio y en la lista cuando el saldo de esta entidad
          baje del monto que definas.
        </Txt>
        <ChipRow>
          {[
            [true, "Activada"],
            [false, "Desactivada"],
          ].map(([v, l]) => (
            <Chip
              key={l}
              label={l}
              active={alertOn === v}
              onPress={() => setAlertOn(v)}
            />
          ))}
        </ChipRow>
        {alertOn ? (
          <Field
            label={`Avisar cuando baje de (${prefix})`}
            value={alertStr}
            onChangeText={setAlertStr}
            keyboardType="decimal-pad"
            placeholder="0,00"
            {...chain(2)}
          />
        ) : null}
      </Card>

      {kind === "banco" ? (
        <Card style={{ gap: 12 }}>
          <Txt style={{ fontSize: 14, fontWeight: "700" }}>
            Comisiones bancarias
          </Txt>
          <Txt
            style={{ fontSize: 13, lineHeight: 18, color: colors.textSecondary }}
          >
            Si tu banco cobra comisión por pago móvil o transferencia, escríbela
            aquí (en la moneda de la entidad). Al registrar un gasto o un pago de
            por pagar desde esta entidad, la app calcula la comisión: el
            porcentaje del monto, pero nunca menos que el mínimo ni más que el
            máximo.
          </Txt>
          {canFees ? (
            <>
              {FEE_METHODS.map(([k, label]) => (
                <View key={k} style={{ gap: 6 }}>
                  <Txt style={{ fontSize: 13, fontWeight: "700" }}>{label}</Txt>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {[
                      ["pct", "% del monto"],
                      ["min", "Mínimo"],
                      ["max", "Máximo"],
                    ].map(([f, l]) => (
                      <View key={f} style={{ flex: 1 }}>
                        <Field
                          label={l}
                          value={fees[k][f]}
                          onChangeText={(v) => setFee(k, f, v)}
                          keyboardType="decimal-pad"
                          placeholder={f === "max" ? "Sin tope" : "0"}
                        />
                      </View>
                    ))}
                  </View>
                </View>
              ))}
              {ccy === "ves" ? (
                <Button
                  label="Usar los topes del BCV"
                  outline
                  height={42}
                  onPress={() => setFees({ ...BCV_FEES })}
                />
              ) : null}
              <Txt
                style={{ fontSize: 12, lineHeight: 17, color: colors.textSecondary }}
              >
                Los topes del BCV (0,30 % con mínimo de Bs 14) son lo máximo que
                puede cobrar un banco: el tuyo puede cobrar menos. Déjalos en
                blanco si no cobra comisión.
              </Txt>
            </>
          ) : (
            <Button
              label="Disponible en Premium"
              outline
              height={42}
              onPress={() => gate("fees")}
            />
          )}
        </Card>
      ) : null}

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
          {...chain(3 + i, { last: i === PT[pt].f.length - 1 })}
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
