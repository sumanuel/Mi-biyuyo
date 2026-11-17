import React, { useState } from "react";
import { View } from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { Txt, Input, Chip, ChipRow, Label } from "./ui";
import { usePlan } from "../hooks/usePlan";
import { ENT_CCY, parseNum } from "../utils/money";
import { FEE_METHOD } from "../utils/ledger";

const round2 = (n) => Math.round(n * 100) / 100;
const fmt = (n) => String(round2(n)).replace(".", ",");

/** Comisión de una regla {pct, min, max} sobre un monto en la moneda de la entidad. */
export function feeFor(rule, native) {
  if (!rule || !(native > 0)) return 0;
  let fee = (native * (rule.pct || 0)) / 100;
  if (rule.min > 0) fee = Math.max(fee, rule.min);
  if (rule.max > 0) fee = Math.min(fee, rule.max);
  return round2(fee);
}

/**
 * Estado de la comisión bancaria de una operación que sale de `entity` (por `usdAmount` USD).
 * Solo ofrece los métodos que la entidad tiene configurados y, si el usuario no la cambia,
 * la calcula sola. `initial` = { method, amount } de una comisión ya guardada (al editar).
 */
export function useBankFee(model, entity, usdAmount, initial) {
  const { can } = usePlan();
  const [method, setMethod] = useState(initial?.method || null);
  const [text, setText] = useState(initial ? fmt(initial.amount) : "");
  const [touched, setTouched] = useState(!!initial);

  const rules = can("fees") && entity?.feeRules ? entity.feeRules : null;
  const methods = rules ? Object.keys(FEE_METHOD).filter((k) => rules[k]) : [];
  const active = method && rules && rules[method] ? method : null;
  const key = entity ? ENT_CCY[entity.ccy] : null;
  const native =
    key && model.fx.ready(key) ? model.fx.fromUsd(key, usdAmount || 0) : 0;
  const suggested = active ? feeFor(rules[active], native) : 0;
  const value = touched ? text : suggested > 0 ? fmt(suggested) : "";
  const amount = active ? parseNum(value) : 0;

  return {
    entity,
    methods,
    rules,
    method: active,
    value,
    amount,
    suggested,
    setMethod: (m) => {
      setMethod(m);
      setTouched(false);
    },
    setText: (v) => {
      setText(v);
      setTouched(true);
    },
    /** Cuerpo para la API: { method, amount } o null si no hay comisión. */
    body: () => (active && amount > 0 ? { method: active, amount } : null),
  };
}

/** Selector «Comisión» (Sin comisión / Pago móvil / Transferencia / Otro) y su monto editable. */
export default function BankFeeBlock({ fee, model, tint }) {
  const { colors } = useTheme();
  if (!fee || !fee.methods.length) return null;
  const key = ENT_CCY[fee.entity.ccy];
  const rule = fee.method ? fee.rules[fee.method] : null;
  return (
    <View style={{ gap: 8 }}>
      <Label>Comisión</Label>
      <ChipRow>
        <Chip
          label="Sin comisión"
          active={!fee.method}
          color={tint?.strong}
          onPress={() => fee.setMethod(null)}
        />
        {fee.methods.map((k) => (
          <Chip
            key={k}
            label={FEE_METHOD[k]}
            active={fee.method === k}
            color={tint?.strong}
            onPress={() => fee.setMethod(k)}
          />
        ))}
      </ChipRow>
      {fee.method ? (
        <>
          <Input
            value={fee.value}
            onChangeText={fee.setText}
            keyboardType="decimal-pad"
            placeholder="0,00"
            accessibilityLabel="Monto de la comisión"
            style={{
              minHeight: 44,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              backgroundColor: colors.surface,
              paddingHorizontal: 14,
              fontSize: 15,
            }}
          />
          <Txt
            style={{ fontSize: 12, lineHeight: 17, color: colors.textSecondary }}
          >
            {`${fee.value ? "Se descuenta " + model.fx.money(key, fee.amount) + " de " + fee.entity.name + ". " : ""}Calculada con ${String(rule.pct).replace(".", ",")} %` +
              (rule.min > 0 ? `, mínimo ${model.fx.money(key, rule.min)}` : "") +
              (rule.max > 0 ? `, máximo ${model.fx.money(key, rule.max)}` : "") +
              ". Puedes cambiarla."}
          </Txt>
        </>
      ) : null}
    </View>
  );
}
