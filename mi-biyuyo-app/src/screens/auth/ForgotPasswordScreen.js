import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { ActionButton, InputField } from "../../components/common/AppUI";
import { forgotPassword } from "../../services/api/authService";
import { rf, s, spacing, borderRadius } from "../../utils/responsive";

export default function ForgotPasswordScreen({ navigation }) {
  const { colors } = useTheme();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSend = async () => {
    if (!email.trim()) {
      setError("Ingresa tu correo");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await forgotPassword(email.trim());
      setSent(true);
    } catch {
      setError("No se pudo enviar el correo. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.page }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.container}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Text style={[styles.backText, { color: colors.accent }]}>
            ← Volver
          </Text>
        </TouchableOpacity>

        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View
            style={[styles.iconCircle, { backgroundColor: colors.accentSoft }]}
          >
            <Text style={styles.icon}>🔑</Text>
          </View>
          <Text style={[styles.title, { color: colors.text }]}>
            Recuperar contraseña
          </Text>

          {sent ? (
            <View
              style={[
                styles.successBox,
                { backgroundColor: colors.successSoft },
              ]}
            >
              <Text style={[styles.successText, { color: colors.success }]}>
                Si el correo existe, recibirás un enlace para restablecer tu
                contraseña.
              </Text>
            </View>
          ) : (
            <>
              <Text style={[styles.subtitle, { color: colors.muted }]}>
                Ingresa tu correo y te enviaremos un enlace para restablecer tu
                contraseña.
              </Text>

              {error ? (
                <View
                  style={[
                    styles.errorBox,
                    { backgroundColor: colors.dangerSoft },
                  ]}
                >
                  <Text style={[styles.errorText, { color: colors.danger }]}>
                    {error}
                  </Text>
                </View>
              ) : null}

              <InputField
                label="Correo electrónico"
                leftIcon="mail-outline"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="tucorreo@email.com"
              />
              <ActionButton
                label="Enviar enlace"
                onPress={handleSend}
                loading={loading}
                style={styles.btn}
              />
            </>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.xl, justifyContent: "center" },
  backBtn: { marginBottom: spacing.xl },
  backText: { fontSize: rf(14), fontWeight: "600" },
  card: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.xl,
    alignItems: "center",
  },
  iconCircle: {
    width: s(64),
    height: s(64),
    borderRadius: s(32),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  icon: { fontSize: s(32) },
  title: {
    fontSize: rf(20),
    fontWeight: "700",
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  subtitle: {
    fontSize: rf(14),
    textAlign: "center",
    marginBottom: spacing.lg,
    lineHeight: rf(14) * 1.5,
  },
  errorBox: {
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
    alignSelf: "stretch",
  },
  errorText: { fontSize: rf(13) },
  successBox: {
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    alignSelf: "stretch",
  },
  successText: { fontSize: rf(14), lineHeight: rf(14) * 1.5 },
  btn: { alignSelf: "stretch", marginTop: spacing.xs },
});
