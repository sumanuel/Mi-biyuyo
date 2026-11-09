import { useCallback } from "react";
import { useNavigation } from "@react-navigation/native";
import { useData } from "../contexts/DataContext";
import { canAddEntity as canAdd, canUse } from "../utils/plan";

/**
 * Plan del usuario dentro de una pantalla:
 *  - plan: estado normalizado (enabled, plan, name, trialDaysLeft, features…)
 *  - can(función): ¿la tiene? (siempre true si los planes están apagados)
 *  - gate(función): true si la tiene; si no, abre «Mi plan» explicando la función y devuelve false
 *  - canAddEntity: ¿puede crear otra entidad?
 */
export function usePlan() {
  const { plan, model } = useData();
  const navigation = useNavigation();
  const can = useCallback((f) => canUse(plan, f), [plan]);
  const gate = useCallback(
    (feature) => {
      if (canUse(plan, feature)) return true;
      navigation.navigate("Plans", { feature });
      return false;
    },
    [plan, navigation],
  );
  return {
    plan,
    can,
    gate,
    canAddEntity: canAdd(plan, model.ents.length),
  };
}
