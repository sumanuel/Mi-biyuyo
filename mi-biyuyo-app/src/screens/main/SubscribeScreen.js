import React, { useEffect, useState } from "react";
import { View, TouchableOpacity } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../contexts/AuthContext";
import { useData, errorMessage } from "../../contexts/DataContext";
import {
  Screen,
  Footer,
  Header,
  Txt,
  Card,
  Button,
  Field,
  Chip,
  ChipRow,
  Icon,
  Empty,
} from "../../components/ui";
import { fmtIn, parseNum } from "../../utils/money";
import { takePhoto, pickFile } from "../../utils/receipt";
import { useFocusChain } from "../../hooks/useFocusChain";
import * as subscriptionService from "../../services/api/subscriptionService";

const MAX_PROOF_CHARS = 2_900_000; // el servidor acepta hasta ~3 millones de caracteres

/**
 * Activar o renovar Premium: elegir plan y método, ver los datos de cobro y el monto exacto,
 * e informar el pago («Ya pagué») con su referencia y un comprobante opcional. El pago queda en
 * revisión hasta que se apruebe.
 */
export default function SubscribeScreen({ navigation }) {
  const chain = useFocusChain();
  const { colors } = useTheme();
  const { token } = useAuth();
  const { model, showToast } = useData();
  const { fx } = model;

  const [info, setInfo] = useState(null); // { plans, receivers, bcv_rate }
  const [error, setError] = useState(null);
  const [planCode, setPlanCode] = useState("monthly");
  const [recvId, setRecvId] = useState(null);
  const [reference, setReference] = useState("");
  const [paid, setPaid] = useState("");
  const [proof, setProof] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    subscriptionService
      .getReceivers(token)
      .then((d) => {
        setInfo(d);
        if (d.receivers.length) setRecvId(d.receivers[0].id);
        if (!d.plans.some((p) => p.code === "monthly") && d.plans.length)
          setPlanCode(d.plans[0].code);
      })
      .catch((e) => setError(errorMessage(e, "No se pudieron cargar los métodos de pago")));
  }, [token]);

  const plan = info?.plans.find((p) => p.code === planCode);
  const recv = info?.receivers.find((r) => r.id === recvId);
  const ves = recv?.currency === "VES";
  // Lo que se debe pagar con ese método: bolívares (tasa BCV del servidor) o USD
  const expected = plan ? (ves ? plan.amount_ves : plan.price_usd) : null;
  const expectedTxt =
    expected == null ? null : ves ? fx.money("bcv", expected) : fx.money("usd", expected);

  // El monto pagado parte del que corresponde, y se reajusta al cambiar plan o método
  useEffect(() => {
    if (expected != null) setPaid(fmtIn(expected, 2));
  }, [planCode, recvId, expected]);

  const copyData = async () => {
    if (!recv) return;
    const text =
      `${recv.label}\n` +
      recv.details.map((d) => `${d.label}: ${d.value}`).join("\n") +
      (expectedTxt ? `\nMonto: ${expectedTxt}` : "");
    await Clipboard.setStringAsync(text);
    showToast("Datos de pago copiados");
  };

  const attach = async (fn) => {
    try {
      const r = await fn();
      if (!r) return;
      if (r.data.length > MAX_PROOF_CHARS) {
        showToast("El comprobante pesa demasiado (máximo 2 MB). Elige otra imagen");
        return;
      }
      setProof(r);
    } catch (err) {
      showToast(errorMessage(err, "No se pudo adjuntar el comprobante"));
    }
  };

  const paidNum = parseNum(paid);
  const can = !!plan && !!recv && reference.trim().length >= 4 && paidNum > 0 && !busy;

  const submit = async () => {
    if (!can) return;
    setBusy(true);
    try {
      await subscriptionService.createPayment(token, {
        plan_code: plan.code,
        method: recv.method,
        reference: reference.trim(),
        paid_amount: paidNum,
        proof_data: proof ? proof.data : undefined,
        proof_name: proof ? proof.name : undefined,
      });
      showToast("Recibimos tu pago. Lo revisaremos y te avisaremos");
      navigation.goBack();
    } catch (err) {
      showToast(errorMessage(err));
      setBusy(false);
    }
  };

  if (error)
    return (
      <Screen data={false}>
        <Header title="Activar Premium" onBack={() => navigation.goBack()} />
        <Empty text={error} />
      </Screen>
    );
  if (!info)
    return (
      <Screen data={false}>
        <Header title="Activar Premium" onBack={() => navigation.goBack()} />
        <Txt style={{ color: colors.textSecondary }}>Cargando…</Txt>
      </Screen>
    );
  if (!info.receivers.length)
    return (
      <Screen data={false}>
        <Header title="Activar Premium" onBack={() => navigation.goBack()} />
        <Empty text="Todavía no hay métodos de pago disponibles. Intenta más tarde." />
      </Screen>
    );

  const sectionTitle = (n, text) => (
    <Txt style={{ fontSize: 15, fontWeight: "700" }}>
      {n}. {text}
    </Txt>
  );

  return (
    <Screen
      data={false}
      contentStyle={{ gap: 16, paddingTop: 16 }}
      footer={
        <Footer>
          <Button label="Ya pagué" height={54} disabled={!can} loading={busy} onPress={submit} />
        </Footer>
      }
    >
      <Header title="Activar Premium" onBack={() => navigation.goBack()} />

      <View style={{ gap: 8 }}>
        {sectionTitle(1, "Elige el plan")}
        <View style={{ flexDirection: "row", gap: 10 }}>
          {info.plans.map((p) => {
            const active = p.code === planCode;
            return (
              <TouchableOpacity
                key={p.code}
                activeOpacity={0.85}
                onPress={() => setPlanCode(p.code)}
                accessibilityState={{ selected: active }}
                style={{
                  flex: 1,
                  gap: 2,
                  padding: 14,
                  borderRadius: 16,
                  borderWidth: 1.5,
                  borderColor: active ? colors.accent : colors.border,
                  backgroundColor: colors.surface,
                }}
              >
                <Txt style={{ fontSize: 13, fontWeight: "700", color: colors.textSecondary }}>
                  {p.name}
                </Txt>
                <Txt style={{ fontSize: 20, fontWeight: "800" }}>USD {p.price_usd.toFixed(2)}</Txt>
                <Txt style={{ fontSize: 12, color: colors.textSecondary }}>
                  {p.days} días de Premium
                </Txt>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={{ gap: 8 }}>
        {sectionTitle(2, "Elige cómo pagar")}
        <ChipRow>
          {info.receivers.map((r) => (
            <Chip key={r.id} label={r.label} active={r.id === recvId} onPress={() => setRecvId(r.id)} />
          ))}
        </ChipRow>
      </View>

      {recv ? (
        <View style={{ gap: 8 }}>
          {sectionTitle(3, "Haz el pago")}
          <Card style={{ gap: 10 }}>
            <View style={{ gap: 2 }}>
              <Txt style={{ fontSize: 12, fontWeight: "700", color: colors.textSecondary }}>
                PAGA EXACTAMENTE
              </Txt>
              <Txt style={{ fontSize: 26, fontWeight: "800", letterSpacing: -0.5 }}>
                {expectedTxt || "—"}
              </Txt>
              {ves ? (
                <Txt style={{ fontSize: 12, color: colors.textSecondary }}>
                  USD {plan.price_usd.toFixed(2)} a la tasa BCV de hoy (VES{" "}
                  {info.bcv_rate ? info.bcv_rate.toFixed(2) : "—"} por USD)
                </Txt>
              ) : null}
            </View>
            {recv.details.map((d) => (
              <View
                key={d.label}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  gap: 12,
                  paddingVertical: 8,
                  borderTopWidth: 1,
                  borderTopColor: colors.divider,
                }}
              >
                <Txt style={{ fontSize: 13, color: colors.textSecondary }}>{d.label}</Txt>
                <Txt selectable style={{ fontSize: 14, fontWeight: "700", textAlign: "right", flexShrink: 1 }}>
                  {d.value}
                </Txt>
              </View>
            ))}
            <Button label="Copiar datos de pago" outline height={44} style={{ borderRadius: 12 }} onPress={copyData} />
          </Card>
        </View>
      ) : null}

      <View style={{ gap: 10 }}>
        {sectionTitle(4, "Cuéntanos tu pago")}
        <Field
          label="Referencia del pago"
          value={reference}
          onChangeText={setReference}
          placeholder="Número de referencia o de operación"
          autoCapitalize="characters"
          {...chain(0)}
        />
        <Field
          label="Monto que pagaste"
          value={paid}
          onChangeText={setPaid}
          keyboardType="decimal-pad"
          placeholder="0,00"
          {...chain(1, { last: true })}
        />
        <View style={{ gap: 8 }}>
          <Txt style={{ fontSize: 14, fontWeight: "700" }}>
            Comprobante <Txt style={{ fontWeight: "400", color: colors.textSecondary }}>(opcional)</Txt>
          </Txt>
          {proof ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                padding: 12,
                borderRadius: 12,
                backgroundColor: colors.surfaceAlt,
              }}
            >
              <Icon name="receipt" size={20} color={colors.ok.fg} stroke={2} />
              <Txt numberOfLines={1} style={{ flex: 1, fontSize: 14, fontWeight: "700" }}>
                {proof.name}
              </Txt>
              <TouchableOpacity onPress={() => setProof(null)} style={{ minHeight: 44, justifyContent: "center" }}>
                <Txt style={{ color: colors.danger.fg, fontSize: 13, fontWeight: "700" }}>Quitar</Txt>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ flexDirection: "row", gap: 8 }}>
              {[
                ["Tomar foto", "camera", takePhoto],
                ["Elegir archivo", "clip", pickFile],
              ].map(([label, icon, fn]) => (
                <TouchableOpacity
                  key={label}
                  onPress={() => attach(fn)}
                  style={{
                    flex: 1,
                    minHeight: 52,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  <Icon name={icon} size={18} color={colors.text} stroke={2} />
                  <Txt style={{ fontSize: 14, fontWeight: "700" }}>{label}</Txt>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
        <Txt style={{ fontSize: 12, lineHeight: 17, color: colors.textSecondary }}>
          Revisaremos tu pago y activaremos Premium. Si algo no cuadra, te diremos el motivo en «Mi
          plan».
        </Txt>
        <TouchableOpacity
          onPress={() => navigation.navigate("Terms")}
          style={{ minHeight: 44, justifyContent: "center" }}
          accessibilityRole="link"
        >
          <Txt style={{ fontSize: 12, lineHeight: 17, color: colors.link, fontWeight: "700" }}>
            Al pagar aceptas los términos de uso y la política de reembolsos
          </Txt>
        </TouchableOpacity>
      </View>
    </Screen>
  );
}
