import React from "react";
import { View, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../contexts/ThemeContext";
import { usePeriod } from "../contexts/PeriodContext";
import { Txt, Icon } from "./ui";
import { fullDate } from "../utils/money";

/**
 * Barra del período activo: dice en qué período estás parado y abre la pantalla de filtros.
 * El período es el mismo en toda la app.
 */
export default function PeriodBar() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const { period } = usePeriod();

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 10,
        paddingLeft: 14,
        paddingRight: 10,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
      }}
    >
      <View style={{ flex: 1, gap: 1 }}>
        <Txt style={{ fontSize: 12, color: colors.textSecondary }}>
          Mostrando
        </Txt>
        <Txt numberOfLines={1} style={{ fontSize: 15, fontWeight: "700" }}>
          {period.label}
        </Txt>
        <Txt style={{ fontSize: 12, color: colors.textSecondary }}>
          {fullDate(period.from)} al {fullDate(period.to)}
        </Txt>
      </View>
      <TouchableOpacity
        onPress={() => navigation.navigate("PeriodFilter")}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`Filtros. Período actual: ${period.label}`}
        style={{
          minHeight: 44,
          paddingHorizontal: 16,
          borderRadius: 12,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          backgroundColor: colors.accent,
        }}
      >
        <Icon name="calendar" size={18} color="#ffffff" stroke={2} />
        <Txt style={{ fontSize: 14, fontWeight: "700", color: "#ffffff" }}>
          Filtros
        </Txt>
      </TouchableOpacity>
    </View>
  );
}
