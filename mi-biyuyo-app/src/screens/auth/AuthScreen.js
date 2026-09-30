import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../contexts/AuthContext";
import * as authService from "../../services/api/authService";
import { Icon, IC } from "../../components/icons";

// Acceso (prototipo "Acceso Mi Biyuyo"): una sola pantalla con tres modos.
const C = {
  page: "#f4f7fb",
  brand: "#1f7a59",
  text: "#193227",
  muted: "#66766d",
  border: "#d8e4db",
  field: "#f6faf7",
  link: "#245fd1",
  error: "#cf4f43",
  hint: "#8a94a6",
};

const HELPER = {
  login: "Inicia sesión para cargar tus finanzas y sincronizar tus datos.",
  register: "Crea tu cuenta para guardar y sincronizar tus finanzas en la nube.",
  reset: "Recupera el acceso a tus finanzas con el correo de tu cuenta.",
};

function T({ style, ...p }) {
  return <Text {...p} style={[{ color: C.text }, style]} />;
}

function PwField({ label, value, onChangeText, placeholder, autoComplete, onSubmit }) {
  const [shown, setShown] = useState(false);
  return (
    <View style={{ gap: 10, marginTop: 4 }}>
      <T style={{ fontSize: 13, fontWeight: "700" }}>{label}</T>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          borderWidth: 1,
          borderColor: C.border,
          borderRadius: 12,
          backgroundColor: C.field,
          paddingLeft: 14,
          paddingRight: 6,
          minHeight: 48,
        }}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={C.hint}
          secureTextEntry={!shown}
          onSubmitEditing={onSubmit}
          returnKeyType="go"
          autoCapitalize="none"
          autoComplete={autoComplete}
          style={{ flex: 1, minWidth: 0, paddingVertical: 14, fontSize: 15, color: C.text }}
        />
        <TouchableOpacity
          onPress={() => setShown((v) => !v)}
          accessibilityLabel="Mostrar u ocultar contraseña"
          style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}
        >
          <Icon name={shown ? "eyeOff" : "eye"} size={18} color={C.muted} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function AuthScreen({ initialMode = "login" }) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const isLogin = mode === "login";
  const isRegister = mode === "register";
  const isReset = mode === "reset";
  const go = (m) => {
    setMode(m);
    setError("");
    setInfo("");
  };

  const submit = async () => {
    setInfo("");
    if (isReset) {
      if (!email.trim())
        return setError("Escribe tu correo para enviarte el enlace de recuperación.");
      setBusy(true);
      try {
        await authService.forgotPassword(email.trim());
        setError("");
        setInfo(
          "Te enviamos un correo para restablecer tu contraseña. Si no aparece en unos minutos, revisa también la carpeta spam.",
        );
      } catch {
        setError("No se pudo enviar el correo. Intenta de nuevo.");
      } finally {
        setBusy(false);
      }
      return;
    }
    if (isRegister && !name.trim()) return setError("Debes ingresar tu nombre.");
    if (!email.trim()) return setError("Debes ingresar tu correo.");
    if (!password) return setError("Debes ingresar tu contraseña.");
    if (isRegister && password.length < 6)
      return setError("La contraseña debe tener al menos 6 caracteres.");
    if (isRegister && password !== confirm)
      return setError("Las contraseñas no coinciden.");
    setError("");
    setBusy(true);
    try {
      if (isRegister) await register(name.trim(), email.trim(), password);
      else await login(email.trim(), password);
    } catch (e) {
      let msg = isRegister ? "Error al registrarse" : "Error al iniciar sesión";
      if (e?.response?.status === 409) msg = "Este correo ya está registrado";
      else if (e?.response?.data?.error) msg = e.response.data.error;
      else if (e?.message) msg = e.message;
      setError(msg);
      setBusy(false);
    }
  };

  const chip = (d, label) => (
    <View
      key={label}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: "rgba(255,255,255,0.14)",
        borderRadius: 24,
        paddingVertical: 8,
        paddingHorizontal: 12,
      }}
    >
      <Icon d={d} size={16} color="#0f5a3f" stroke={1.9} />
      <T style={{ color: "#ffffff", fontSize: 12, fontWeight: "700" }}>{label}</T>
    </View>
  );

  const field = (label, props) => (
    <View style={{ gap: 10, marginTop: 4 }}>
      <T style={{ fontSize: 13, fontWeight: "700" }}>{label}</T>
      <TextInput
        placeholderTextColor={C.hint}
        onSubmitEditing={isReset ? submit : undefined}
        {...props}
        style={{
          borderWidth: 1,
          borderColor: C.border,
          borderRadius: 12,
          backgroundColor: C.field,
          padding: 14,
          fontSize: 15,
          color: C.text,
          minHeight: 48,
        }}
      />
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.page }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            paddingHorizontal: 18,
            paddingVertical: 24,
            gap: 18,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={{
              backgroundColor: C.brand,
              borderRadius: 24,
              padding: 24,
              gap: 10,
              shadowColor: "#000",
              shadowOpacity: 0.12,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 8 },
              elevation: 6,
            }}
          >
            <T
              style={{
                color: "rgba(255,255,255,0.7)",
                fontSize: 12,
                fontWeight: "700",
                textTransform: "uppercase",
                letterSpacing: 0.8,
              }}
            >
              Acceso seguro
            </T>
            <T style={{ color: "#ffffff", fontSize: 24, fontWeight: "800" }}>
              Mi Biyuyo Cloud
            </T>
            <T style={{ color: "rgba(255,255,255,0.84)", fontSize: 14, lineHeight: 20 }}>
              {HELPER[mode]}
            </T>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
              {chip(
                "M7 19a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 17.9 8.6 4.7 4.7 0 0 1 17.5 19z M9.5 13.5l2 2 3.5-4",
                "Sincronización",
              )}
              {chip(
                "M12 3 4.5 6v5.5c0 4.6 3.1 8 7.5 9.5 4.4-1.5 7.5-4.9 7.5-9.5V6z M9 12l2.3 2.3L15.5 10",
                "Seguridad",
              )}
              {chip(IC.store, "Tus finanzas")}
            </View>
          </View>

          <View
            style={{
              backgroundColor: "#ffffff",
              borderRadius: 24,
              padding: 18,
              gap: 10,
              shadowColor: "#000",
              shadowOpacity: 0.08,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 8 },
              elevation: 3,
            }}
          >
            {!isReset ? (
              <View
                style={{
                  flexDirection: "row",
                  backgroundColor: C.field,
                  borderRadius: 18,
                  padding: 4,
                  marginBottom: 8,
                }}
              >
                {[
                  ["login", "Iniciar sesión", isLogin],
                  ["register", "Registrarme", isRegister],
                ].map(([m, label, active]) => (
                  <TouchableOpacity
                    key={m}
                    onPress={() => go(m)}
                    style={{
                      flex: 1,
                      minHeight: 44,
                      borderRadius: 12,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: active ? C.brand : "transparent",
                    }}
                  >
                    <T
                      style={{
                        fontSize: 14,
                        fontWeight: "700",
                        color: active ? "#ffffff" : C.muted,
                      }}
                    >
                      {label}
                    </T>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={{ gap: 6, marginBottom: 4 }}>
                <T style={{ fontSize: 18, fontWeight: "800" }}>Recuperar contraseña</T>
                <T style={{ fontSize: 13, lineHeight: 18, color: C.muted }}>
                  Escribe el correo de tu cuenta y te enviaremos un enlace para
                  crear una contraseña nueva.
                </T>
              </View>
            )}

            {isRegister
              ? field("Nombre", {
                  value: name,
                  onChangeText: setName,
                  placeholder: "Nombre del usuario",
                  autoComplete: "name",
                })
              : null}
            {field("Correo", {
              value: email,
              onChangeText: (v) => {
                setEmail(v);
                setError("");
              },
              placeholder: "correo@dominio.com",
              keyboardType: "email-address",
              autoCapitalize: "none",
              autoComplete: "email",
            })}
            {!isReset ? (
              <PwField
                label="Contraseña"
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  setError("");
                }}
                placeholder="Mínimo 6 caracteres"
                autoComplete={isRegister ? "new-password" : "current-password"}
                onSubmit={submit}
              />
            ) : null}
            {isRegister ? (
              <PwField
                label="Confirmar contraseña"
                value={confirm}
                onChangeText={(v) => {
                  setConfirm(v);
                  setError("");
                }}
                placeholder="Repite la contraseña"
                autoComplete="new-password"
                onSubmit={submit}
              />
            ) : null}

            {info ? (
              <T style={{ color: C.brand, fontSize: 13, fontWeight: "600", marginTop: 4, lineHeight: 18 }}>
                {info}
              </T>
            ) : null}
            {error ? (
              <T style={{ color: C.error, fontSize: 13, fontWeight: "600", marginTop: 4 }}>
                {error}
              </T>
            ) : null}

            <TouchableOpacity
              onPress={submit}
              disabled={busy}
              activeOpacity={0.85}
              style={{
                marginTop: 12,
                minHeight: 48,
                borderRadius: 12,
                backgroundColor: C.brand,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {busy ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <T style={{ color: "#ffffff", fontSize: 15, fontWeight: "800" }}>
                  {isReset ? "Enviar enlace" : isRegister ? "Crear cuenta" : "Entrar"}
                </T>
              )}
            </TouchableOpacity>

            {isLogin ? (
              <TouchableOpacity
                onPress={() => go("reset")}
                style={{ alignSelf: "center", marginTop: 4, minHeight: 40, paddingHorizontal: 12, justifyContent: "center" }}
              >
                <T style={{ color: C.link, fontSize: 13, fontWeight: "700" }}>
                  Recuperar contraseña
                </T>
              </TouchableOpacity>
            ) : null}
            {isReset ? (
              <TouchableOpacity
                onPress={() => go("login")}
                style={{ alignSelf: "center", marginTop: 4, minHeight: 40, paddingHorizontal: 12, justifyContent: "center" }}
              >
                <T style={{ color: C.link, fontSize: 13, fontWeight: "700" }}>
                  Volver a iniciar sesión
                </T>
              </TouchableOpacity>
            ) : null}

            <T
              style={{
                marginTop: 4,
                color: C.muted,
                fontSize: 12,
                lineHeight: 18,
                textAlign: "center",
              }}
            >
              Al continuar, tus datos locales se vinculan con tu espacio seguro en la nube.
            </T>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
