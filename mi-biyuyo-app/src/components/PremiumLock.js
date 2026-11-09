import React from "react";
import { View, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../contexts/ThemeContext";
import { Card, Txt, Icon, Button } from "./ui";
import { FEATURE_TEXT } from "../utils/plan";

/** Etiqueta «Premium» para marcar una función que el plan actual no incluye. */
export function PremiumPill({ style }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          paddingVertical: 3,
          paddingHorizontal: 8,
          borderRadius: 999,
          backgroundColor: colors.chip,
        },
        style,
      ]}
    >
      <Icon name="shield" size={12} color={colors.textSecondary} stroke={2} />
      <Txt
        style={{ fontSize: 11, fontWeight: "800", color: colors.textSecondary }}
      >
        Premium
      </Txt>
    </View>
  );
}

/** Bloque que reemplaza una sección Premium en el plan Gratis y lleva a «Mi plan». */
export function LockedBlock({ feature, text }) {
  const { colors } = useTheme();
  const navigation = useNavigation();
  return (
    <Card style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Icon name="shield" size={18} color={colors.textSecondary} stroke={2} />
        <Txt style={{ flex: 1, fontSize: 15, fontWeight: "700" }}>
          {FEATURE_TEXT[feature] || "Función Premium"}
        </Txt>
        <PremiumPill />
      </View>
      {text ? (
        <Txt style={{ fontSize: 13, lineHeight: 18, color: colors.textSecondary }}>
          {text}
        </Txt>
      ) : null}
      <Button
        label="Ver planes"
        outline
        height={44}
        style={{ borderRadius: 12 }}
        onPress={() => navigation.navigate("Plans", { feature })}
      />
    </Card>
  );
}

/** Fila tocable con candado, para listas de ajustes y accesos. */
export function LockedRow({ feature, label }) {
  const { colors } = useTheme();
  const navigation = useNavigation();
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => navigation.navigate("Plans", { feature })}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        minHeight: 44,
      }}
    >
      <Txt style={{ flex: 1, fontSize: 14, fontWeight: "700" }}>{label}</Txt>
      <PremiumPill />
    </TouchableOpacity>
  );
}
