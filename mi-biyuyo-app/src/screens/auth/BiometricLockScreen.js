import React, { useEffect, useState } from "react";
import { Image, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../../contexts/ThemeContext";
import { Txt } from "../../components/ui";
import { Icon } from "../../components/icons";
import { authenticateWithBiometrics } from "../../services/biometricAuthService";

/** Sesión bloqueada: pide huella o Face ID para continuar. */
export default function BiometricLockScreen({ onUnlock, onSignOut }) {
  const { colors } = useTheme();
  const [authenticating, setAuthenticating] = useState(false);
  const [failed, setFailed] = useState(false);

  const tryUnlock = async () => {
    setAuthenticating(true);
    setFailed(false);
    try {
      const ok = await authenticateWithBiometrics(
        "Desbloquea Mi Biyuyo para continuar",
      );
      if (ok) onUnlock?.();
      else setFailed(true);
    } finally {
      setAuthenticating(false);
    }
  };

  useEffect(() => {
    tryUnlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.page }}>
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
          padding: 28,
        }}
      >
        <Image
          source={require("../../../assets/icon.png")}
          style={{ width: 84, height: 84, borderRadius: 20, marginBottom: 6 }}
          accessibilityIgnoresInvertColors
        />
        <Txt style={{ fontSize: 22, fontWeight: "800" }}>Sesión bloqueada</Txt>
        <Txt
          style={{
            fontSize: 14,
            lineHeight: 20,
            textAlign: "center",
            color: colors.textSecondary,
            marginBottom: 10,
          }}
        >
          {failed
            ? "No se pudo verificar tu identidad. Intenta de nuevo."
            : "Usa tu huella o Face ID para continuar."}
        </Txt>

        <TouchableOpacity
          disabled={authenticating}
          onPress={tryUnlock}
          activeOpacity={0.85}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            minHeight: 52,
            paddingHorizontal: 28,
            borderRadius: 999,
            backgroundColor: colors.accent,
            opacity: authenticating ? 0.7 : 1,
          }}
        >
          <Icon name="fingerprint" size={24} color="#ffffff" stroke={2} />
          <Txt style={{ color: "#ffffff", fontSize: 16, fontWeight: "800" }}>
            {authenticating ? "Verificando..." : "Desbloquear"}
          </Txt>
        </TouchableOpacity>

        {onSignOut ? (
          <TouchableOpacity
            onPress={onSignOut}
            style={{
              marginTop: 16,
              minHeight: 44,
              justifyContent: "center",
              padding: 8,
            }}
          >
            <Txt
              style={{
                fontSize: 13,
                fontWeight: "700",
                color: colors.textSecondary,
              }}
            >
              Cerrar sesión
            </Txt>
          </TouchableOpacity>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
