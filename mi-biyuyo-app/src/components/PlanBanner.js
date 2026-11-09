import React from "react";
import { TouchableOpacity, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../contexts/ThemeContext";
import { useData } from "../contexts/DataContext";
import { Txt, Icon } from "./ui";
import { daysUntil } from "../utils/money";

/**
 * Aviso del plan en Inicio: días de prueba que quedan, prueba terminada (plan Gratis) o Premium
 * próximo a vencer. No se muestra si los planes están apagados o si Premium está vigente.
 */
export default function PlanBanner() {
  const { colors } = useTheme();
  const { plan } = useData();
  const navigation = useNavigation();
  if (!plan.enabled) return null;

  let title = null;
  let sub = null;
  if (plan.plan === "trial") {
    const d = plan.trialDaysLeft;
    title = `Prueba Premium: te ${d === 1 ? "queda 1 día" : `quedan ${d} días`}`;
    sub = "Después pasas al plan Gratis. Toca para ver qué incluye cada plan.";
  } else if (plan.plan === "free") {
    title = plan.trialEndsAt ? "Tu prueba Premium terminó" : "Estás en el plan Gratis";
    sub = "Tus datos están a salvo. Toca para conocer Premium.";
  } else if (plan.premiumUntil) {
    const d = daysUntil(String(plan.premiumUntil).slice(0, 10));
    if (d <= 7) {
      title = d <= 0 ? "Tu Premium vence hoy" : `Tu Premium vence en ${d} ${d === 1 ? "día" : "días"}`;
      sub = "Toca para ver tu plan.";
    }
  }
  if (!title) return null;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => navigation.navigate("Plans")}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Txt style={{ fontSize: 14, fontWeight: "700" }}>{title}</Txt>
        <Txt style={{ fontSize: 12, lineHeight: 17, color: colors.textSecondary }}>
          {sub}
        </Txt>
      </View>
      <Icon name="chevronRight" size={18} color={colors.textSecondary} stroke={2} />
    </TouchableOpacity>
  );
}
