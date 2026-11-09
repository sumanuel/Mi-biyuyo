import React from "react";
import { TouchableOpacity, View } from "react-native";
import Svg, { Path, Circle } from "react-native-svg";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../contexts/ThemeContext";
import { useData } from "../contexts/DataContext";
import { Txt } from "./ui";

const GOLD = "#F2B01E";

/** Corona: llena (Premium) o solo contorno (prueba). */
export function Crown({ size = 22, filled = true, color = GOLD }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3.5 8.5l4.2 4 4.3-7 4.3 7 4.2-4-1.6 10H5.1z"
        fill={filled ? color : "none"}
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Circle cx="3.5" cy="8.5" r="1.3" fill={color} />
      <Circle cx="12" cy="5.5" r="1.3" fill={color} />
      <Circle cx="20.5" cy="8.5" r="1.3" fill={color} />
    </Svg>
  );
}

/**
 * Marca del plan junto al nombre en Inicio: corona dorada llena para Premium pagado, corona con
 * contorno y «Prueba» durante la prueba, y nada en el plan Gratis (ni con los planes apagados).
 * Al tocarla abre «Mi plan».
 */
export default function PlanCrown() {
  const { colors } = useTheme();
  const { plan } = useData();
  const navigation = useNavigation();
  if (!plan.enabled || plan.plan === "free") return null;

  const trial = plan.plan === "trial";
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => navigation.navigate("Plans")}
      accessibilityRole="button"
      accessibilityLabel={trial ? "Prueba Premium" : "Plan Premium"}
      hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
      style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
    >
      <Crown size={22} filled={!trial} />
      {trial ? (
        <View>
          <Txt style={{ fontSize: 11, fontWeight: "800", color: colors.textSecondary }}>
            Prueba
          </Txt>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}
