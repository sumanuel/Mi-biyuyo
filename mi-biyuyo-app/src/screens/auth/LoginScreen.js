import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Image,
} from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../contexts/AuthContext";
import { ActionButton, InputField } from "../../components/common/AppUI";
import { rf, s, spacing, borderRadius } from "../../utils/responsive";

export default function LoginScreen({ navigation }) {
  const { colors } = useTheme();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError("Ingresa tu correo y contraseña");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (e) {
      setError(e?.response?.data?.error || "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.page }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo / Brand */}
        <View style={styles.brand}>
          <View
            style={[styles.logoCircle, { backgroundColor: colors.accentSoft }]}
          >
            <Text style={[styles.logoEmoji]}>💰</Text>
          </View>
          <Text style={[styles.appName, { color: colors.accent }]}>
            Mi Biyuyo
          </Text>
          <Text style={[styles.tagline, { color: colors.muted }]}>
            Controla tus finanzas
          </Text>
        </View>

        {/* Form */}
        <View
          style={[
            styles.form,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.formTitle, { color: colors.text }]}>
            Iniciar sesión
          </Text>

          {error ? (
            <View
              style={[styles.errorBox, { backgroundColor: colors.dangerSoft }]}
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
            autoComplete="email"
          />

          <InputField
            label="Contraseña"
            leftIcon="lock-closed-outline"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPass}
            placeholder="••••••"
            rightContent={
              <TouchableOpacity
                onPress={() => setShowPass((v) => !v)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[styles.showPassText, { color: colors.muted }]}>
                  {showPass ? "Ocultar" : "Ver"}
                </Text>
              </TouchableOpacity>
            }
          />

          <TouchableOpacity
            style={styles.forgotLink}
            onPress={() => navigation.navigate("ForgotPassword")}
          >
            <Text style={[styles.forgotText, { color: colors.accent }]}>
              ¿Olvidaste tu contraseña?
            </Text>
          </TouchableOpacity>

          <ActionButton
            label="Entrar"
            onPress={handleLogin}
            loading={loading}
            style={styles.btn}
          />
        </View>

        {/* Register link */}
        <View style={styles.registerRow}>
          <Text style={[styles.registerLabel, { color: colors.muted }]}>
            ¿No tienes cuenta?{" "}
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate("Register")}>
            <Text style={[styles.registerLink, { color: colors.accent }]}>
              Regístrate
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: "center", padding: spacing.xl },
  brand: { alignItems: "center", marginBottom: spacing.xl },
  logoCircle: {
    width: s(72),
    height: s(72),
    borderRadius: s(22),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  logoEmoji: { fontSize: s(36) },
  appName: { fontSize: rf(28), fontWeight: "800", letterSpacing: -0.5 },
  tagline: { fontSize: rf(14), marginTop: s(4) },
  form: {
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  formTitle: { fontSize: rf(20), fontWeight: "800", marginBottom: spacing.lg },
  errorBox: {
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorText: { fontSize: rf(13) },
  forgotLink: {
    alignSelf: "flex-end",
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
  forgotText: { fontSize: rf(13), fontWeight: "600" },
  btn: { marginTop: spacing.xs },
  showPassText: { fontSize: rf(12) },
  registerRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: spacing.md,
  },
  registerLabel: { fontSize: rf(14) },
  registerLink: { fontSize: rf(14), fontWeight: "700" },
});
