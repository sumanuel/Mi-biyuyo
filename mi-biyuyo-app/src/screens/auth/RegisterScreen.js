import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../contexts/AuthContext";
import { ActionButton, InputField } from "../../components/common/AppUI";
import { rf, s, spacing, borderRadius } from "../../utils/responsive";

export default function RegisterScreen({ navigation }) {
  const { colors } = useTheme();
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleRegister = async () => {
    if (!name.trim()) {
      setError("Ingresa tu nombre");
      return;
    }
    if (!email.trim()) {
      setError("Ingresa tu correo");
      return;
    }
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await register(name.trim(), email.trim(), password);
      // El registro fue exitoso, AuthContext navegará automáticamente
    } catch (e) {
      // Manejo mejorado de errores
      let errorMessage = "Error al registrarse";
      if (e?.response?.status === 409) {
        errorMessage = "Este correo ya está registrado";
      } else if (e?.response?.data?.error) {
        errorMessage = e.response.data.error;
      } else if (e?.message) {
        errorMessage = e.message;
      }
      setError(errorMessage);
      console.error("Register error:", e);
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
        <View style={styles.top}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
          >
            <Text style={[styles.backText, { color: colors.accent }]}>
              ← Volver
            </Text>
          </TouchableOpacity>
          <View
            style={[styles.logoCircle, { backgroundColor: colors.accentSoft }]}
          >
            <Text style={styles.logoEmoji}>💰</Text>
          </View>
          <Text style={[styles.appName, { color: colors.accent }]}>
            Mi Biyuyo
          </Text>
        </View>

        <View
          style={[
            styles.form,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.formTitle, { color: colors.text }]}>
            Crear cuenta
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
            label="Nombre"
            leftIcon="person-outline"
            value={name}
            onChangeText={setName}
            placeholder="Tu nombre"
            autoCapitalize="words"
          />
          <InputField
            label="Correo electrónico"
            leftIcon="mail-outline"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="tucorreo@email.com"
          />
          <InputField
            label="Contraseña"
            leftIcon="lock-closed-outline"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPass}
            placeholder="Mínimo 6 caracteres"
            rightContent={
              <TouchableOpacity onPress={() => setShowPass((v) => !v)}>
                <Text style={[styles.showPassText, { color: colors.muted }]}>
                  {showPass ? "Ocultar" : "Ver"}
                </Text>
              </TouchableOpacity>
            }
          />
          <InputField
            label="Confirmar contraseña"
            leftIcon="lock-closed-outline"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry={!showPass}
            placeholder="Repite tu contraseña"
          />

          <ActionButton
            label="Crear cuenta"
            onPress={handleRegister}
            loading={loading}
            style={styles.btn}
          />
        </View>

        <View style={styles.loginRow}>
          <Text style={[styles.loginLabel, { color: colors.muted }]}>
            ¿Ya tienes cuenta?{" "}
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate("Login")}>
            <Text style={[styles.loginLink, { color: colors.accent }]}>
              Inicia sesión
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, padding: spacing.xl },
  top: {
    alignItems: "center",
    marginBottom: spacing.xl,
    marginTop: spacing.lg,
  },
  backBtn: { alignSelf: "flex-start", marginBottom: spacing.lg },
  backText: { fontSize: rf(14), fontWeight: "600" },
  logoCircle: {
    width: s(64),
    height: s(64),
    borderRadius: s(20),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  logoEmoji: { fontSize: s(30) },
  appName: { fontSize: rf(22), fontWeight: "800" },
  form: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  formTitle: { fontSize: rf(20), fontWeight: "700", marginBottom: spacing.lg },
  errorBox: {
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorText: { fontSize: rf(13) },
  btn: { marginTop: spacing.xs },
  showPassText: { fontSize: rf(12) },
  loginRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: spacing.md,
  },
  loginLabel: { fontSize: rf(14) },
  loginLink: { fontSize: rf(14), fontWeight: "700" },
});
