import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import { Screen, Header, Txt, Card, Button, Icon } from "../../components/ui";
import { COMPARE_ROWS, FEATURE_TEXT } from "../../utils/plan";
import { fullDate } from "../../utils/money";
import * as subscriptionService from "../../services/api/subscriptionService";

const dateOf = (iso) => (iso ? fullDate(String(iso).slice(0, 10)) : "");

/**
 * «Mi plan»: plan actual, días de prueba, qué incluye cada plan y precios. También es la pantalla
 * a la que llevan los candados (params.feature = la función que se quiso usar).
 */
export default function PlansScreen({ navigation, route }) {
  const { colors } = useTheme();
  const { token } = useAuth();
  const { plan } = useData();
  const feature = route.params?.feature;
  const [plans, setPlans] = useState([]);

  useEffect(() => {
    if (!plan.enabled) return;
    subscriptionService
      .getSubscription(token)
      .then((s) => setPlans(s.plans || []))
      .catch(() => {});
  }, [token, plan.enabled]);

  const monthly = plans.find((p) => p.code === "monthly");
  const annual = plans.find((p) => p.code === "annual");
  // Cuánto se ahorra pagando el año frente a pagar mes a mes durante el mismo tiempo
  const saving =
    monthly && annual
      ? Math.round(
          (1 - annual.price_usd / ((monthly.price_usd * annual.days) / monthly.days)) *
            100,
        )
      : 0;

  const free = plan.plan === "free";
  const headline =
    plan.plan === "trial"
      ? `Te quedan ${plan.trialDaysLeft} ${plan.trialDaysLeft === 1 ? "día" : "días"} de prueba Premium`
      : plan.plan === "premium"
        ? plan.enabled
          ? `Premium hasta el ${dateOf(plan.premiumUntil)}`
          : "Tienes todas las funciones"
        : plan.trialEndsAt
          ? "Tu prueba Premium terminó"
          : "Estás en el plan Gratis";
  const detail =
    plan.plan === "trial"
      ? `Tu prueba termina el ${dateOf(plan.trialEndsAt)}. Después pasas al plan Gratis, sin perder nada de lo que registraste.`
      : free
        ? "Tus datos están a salvo: lo que no incluye el plan Gratis se ve, pero no se puede registrar de nuevo hasta que actives Premium."
        : "";

  const priceCard = (p, tag) => (
    <View
      key={p.code}
      style={{
        flex: 1,
        gap: 2,
        padding: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
      }}
    >
      <Txt style={{ fontSize: 13, color: colors.textSecondary, fontWeight: "700" }}>
        {p.name}
      </Txt>
      <Txt style={{ fontSize: 22, fontWeight: "800", letterSpacing: -0.4 }}>
        USD {p.price_usd.toFixed(2)}
      </Txt>
      <Txt style={{ fontSize: 12, color: colors.textSecondary }}>
        {p.days === 30 ? "por mes" : p.days === 365 ? "por año" : `por ${p.days} días`}
      </Txt>
      {tag ? (
        <Txt style={{ fontSize: 12, fontWeight: "700", color: colors.ok.fg }}>
          {tag}
        </Txt>
      ) : null}
    </View>
  );

  return (
    <Screen data={false} contentStyle={{ gap: 16, paddingTop: 16 }}>
      <Header title="Mi plan" onBack={() => navigation.goBack()} />

      {feature ? (
        <View
          style={{
            padding: 14,
            borderRadius: 14,
            backgroundColor: colors.chip,
            gap: 2,
          }}
        >
          <Txt style={{ fontSize: 14, fontWeight: "700" }}>
            «{FEATURE_TEXT[feature] || "Esta función"}» es una función Premium
          </Txt>
          <Txt style={{ fontSize: 13, color: colors.textSecondary }}>
            Tu plan actual no la incluye.
          </Txt>
        </View>
      ) : null}

      <Card style={{ gap: 6 }}>
        <Txt style={{ fontSize: 12, fontWeight: "700", letterSpacing: 0.5, color: colors.textSecondary }}>
          TU PLAN
        </Txt>
        <Txt style={{ fontSize: 20, fontWeight: "800", letterSpacing: -0.4 }}>
          {plan.name}
        </Txt>
        <Txt style={{ fontSize: 15, fontWeight: "700" }}>{headline}</Txt>
        {detail ? (
          <Txt style={{ fontSize: 13, lineHeight: 18, color: colors.textSecondary }}>
            {detail}
          </Txt>
        ) : null}
      </Card>

      <Card style={{ gap: 0 }} pad={0}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderBottomWidth: 1,
            borderBottomColor: colors.divider,
          }}
        >
          <Txt style={{ flex: 1, fontSize: 12, fontWeight: "700", color: colors.textSecondary }}>
            QUÉ INCLUYE
          </Txt>
          <Txt style={{ width: 64, textAlign: "center", fontSize: 12, fontWeight: "700", color: colors.textSecondary }}>
            Gratis
          </Txt>
          <Txt style={{ width: 64, textAlign: "center", fontSize: 12, fontWeight: "700", color: colors.accent }}>
            Premium
          </Txt>
        </View>
        {COMPARE_ROWS.map((r, i) => (
          <View
            key={r.text}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 11,
              paddingHorizontal: 16,
              borderBottomWidth: i === COMPARE_ROWS.length - 1 ? 0 : 1,
              borderBottomColor: colors.divider,
            }}
          >
            <Txt style={{ flex: 1, fontSize: 13.5 }}>{r.text}</Txt>
            <View style={{ width: 64, alignItems: "center" }}>
              {r.free ? (
                <Icon name="check" size={18} color={colors.ok.fg} stroke={2.4} />
              ) : (
                <Txt style={{ color: colors.textSecondary }}>—</Txt>
              )}
            </View>
            <View style={{ width: 64, alignItems: "center" }}>
              <Icon name="check" size={18} color={colors.ok.fg} stroke={2.4} />
            </View>
          </View>
        ))}
      </Card>

      {plan.enabled && (monthly || annual) ? (
        <View style={{ gap: 8 }}>
          <Txt style={{ fontSize: 15, fontWeight: "700" }}>Precios de Premium</Txt>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {monthly ? priceCard(monthly) : null}
            {annual
              ? priceCard(annual, saving > 0 ? `Ahorras ${saving}%` : null)
              : null}
          </View>
        </View>
      ) : null}

      {plan.enabled && plan.plan !== "premium" ? (
        <View style={{ gap: 8 }}>
          <Button label="Activar Premium (próximamente)" height={54} disabled />
          <Txt style={{ fontSize: 12, lineHeight: 17, color: colors.textSecondary, textAlign: "center" }}>
            Muy pronto podrás pagar y activar Premium desde aquí.
          </Txt>
        </View>
      ) : null}
    </Screen>
  );
}
