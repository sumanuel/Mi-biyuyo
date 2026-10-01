import React, { useEffect, useRef, useState } from "react";
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
import { useTheme } from "../../contexts/ThemeContext";
import { useFocusChain } from "../../hooks/useFocusChain";
import * as authService from "../../services/api/authService";
import { Icon, IC } from "../../components/icons";
import {
  authenticateWithBiometrics,
  getBiometricCredentials,
  getBiometricLockEnabled,
  isBiometricHardwareAvailable,
  saveBiometricCredentials,
} from "../../services/biometricAuthService";

// Acceso (prototipo "Acceso Mi Biyuyo"): una sola pantalla con cuatro modos.
// Los colores siguen el tema de la app (claro u oscuro).
function useC() {
  const { colors } = useTheme();
  return {
    page: colors.page,
    card: colors.surface,
    brand: "#1f7a59",
    text: colors.text,
    muted: colors.textSecondary,
    border: colors.border,
    field: colors.surfaceAlt,
    link: colors.link,
    error: colors.danger.fg,
    hint: colors.placeholder,
  };
}

const HELPER = {
  login: "Inicia sesión para cargar tus finanzas y sincronizar tus datos.",
  register:
    "Crea tu cuenta para guardar y sincronizar tus finanzas en la nube.",
  reset: "Recupera el acceso a tus finanzas con el correo de tu cuenta.",
  verify:
    "Un último paso: confirma que el correo es tuyo con el código que te enviamos.",
  newpass:
    "Casi listo: usa el código que te enviamos por correo para crear tu contraseña nueva.",
};

function T({ style, ...p }) {
  const C = useC();
  return <Text {...p} style={[{ color: C.text }, style]} />;
}

function PwField({
  label,
  value,
  onChangeText,
  placeholder,
  autoComplete,
  onSubmit,
  chainProps,
}) {
  const C = useC();
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
          {...chainProps}
          style={{
            flex: 1,
            minWidth: 0,
            paddingVertical: 14,
            fontSize: 15,
            color: C.text,
          }}
        />
        <TouchableOpacity
          onPress={() => setShown((v) => !v)}
          accessibilityLabel="Mostrar u ocultar contraseña"
          style={{
            width: 40,
            height: 40,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name={shown ? "eyeOff" : "eye"} size={18} color={C.muted} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function AuthScreen({ initialMode = "login" }) {
  const C = useC();
  const sv = useRef(null);
  const chain = useFocusChain(sv);
  const { login, register, verifyEmail } = useAuth();
  const [mode, setMode] = useState(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [devCode, setDevCode] = useState("");
  const [cooldown, setCooldown] = useState(0);

  // Cuenta atrás para poder pedir otro código
  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // «Entrar con huella»: disponible si se activó en Ajustes y hay credenciales guardadas
  const [bioReady, setBioReady] = useState(false);
  useEffect(() => {
    (async () => {
      const [hw, on, creds] = await Promise.all([
        isBiometricHardwareAvailable(),
        getBiometricLockEnabled(),
        getBiometricCredentials(),
      ]);
      setBioReady(hw && on && !!creds);
    })();
  }, []);

  const bioLogin = async () => {
    setError("");
    setInfo("");
    const ok = await authenticateWithBiometrics(
      "Entra a Mi Biyuyo con tu huella",
    );
    if (!ok) return setError("No se pudo verificar tu identidad.");
    const creds = await getBiometricCredentials();
    if (!creds) {
      setBioReady(false);
      return setError(
        "Inicia sesión con tu contraseña para volver a activarlo.",
      );
    }
    setBusy(true);
    try {
      await login(creds.email, creds.password);
    } catch (e) {
      setBusy(false);
      const status = e?.response?.status;
      if (status === 401 || status === 403)
        setError(
          "La contraseña guardada ya no es válida. Inicia sesión con tu contraseña.",
        );
      else setError(e?.response?.data?.error || "No se pudo iniciar sesión.");
    }
  };

  const isVerify = mode === "verify";
  const isNewPass = mode === "newpass";
  const startNewPass = (mail, dev, wait) => {
    setPendingEmail(mail);
    setDevCode(dev || "");
    setCode("");
    setPassword("");
    setConfirm("");
    setError("");
    setInfo(
      "Te enviamos un código a tu correo. Si no aparece, revisa también spam.",
    );
    setCooldown(wait || 60);
    setMode("newpass");
  };
  const startVerify = (mail, dev) => {
    setPendingEmail(mail);
    setDevCode(dev || "");
    setCode("");
    setError("");
    setInfo("");
    setCooldown(60);
    setMode("verify");
  };
  const isLogin = mode === "login";
  const isRegister = mode === "register";
  const isReset = mode === "reset";
  const go = (m) => {
    setMode(m);
    setError("");
    setInfo("");
  };

  const submitCode = async () => {
    if (code.trim().length !== 6)
      return setError("Escribe el código de 6 dígitos.");
    setBusy(true);
    setError("");
    try {
      await verifyEmail(pendingEmail, code.trim());
    } catch (e) {
      setError(e?.response?.data?.error || "No se pudo verificar el código");
      setBusy(false);
    }
  };

  const submitNewPass = async () => {
    if (code.trim().length !== 6)
      return setError("Escribe el código de 6 dígitos.");
    if (password.length < 6)
      return setError("La contraseña debe tener al menos 6 caracteres.");
    if (password !== confirm) return setError("Las contraseñas no coinciden.");
    setBusy(true);
    setError("");
    try {
      await authService.resetPassword(pendingEmail, code.trim(), password);
      setEmail(pendingEmail);
      setPassword("");
      setConfirm("");
      setCode("");
      setMode("login");
      setInfo("Contraseña actualizada. Ya puedes iniciar sesión.");
    } catch (e) {
      setError(
        e?.response?.data?.error ||
          e?.response?.data?.errors?.[0]?.msg ||
          "No se pudo cambiar la contraseña",
      );
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (cooldown > 0) return;
    setError("");
    try {
      const r = isNewPass
        ? await authService.forgotPassword(pendingEmail)
        : await authService.resendCode(pendingEmail);
      setDevCode(r.dev_code || "");
      setInfo("Te enviamos un código nuevo.");
      setCooldown(60);
    } catch (e) {
      setError(e?.response?.data?.error || "No se pudo reenviar el código");
      if (e?.response?.data?.retry_after)
        setCooldown(e.response.data.retry_after);
    }
  };

  const submit = async () => {
    setInfo("");
    if (isVerify) return submitCode();
    if (isNewPass) return submitNewPass();
    if (isReset) {
      if (!email.trim())
        return setError(
          "Escribe tu correo para enviarte el código de recuperación.",
        );
      setBusy(true);
      try {
        const r = await authService.forgotPassword(email.trim());
        startNewPass(email.trim(), r.dev_code, r.retry_after);
      } catch {
        setError("No se pudo enviar el código. Intenta de nuevo.");
      } finally {
        setBusy(false);
      }
      return;
    }
    if (isRegister && !name.trim())
      return setError("Debes ingresar tu nombre.");
    if (!email.trim()) return setError("Debes ingresar tu correo.");
    if (!password) return setError("Debes ingresar tu contraseña.");
    if (isRegister && password.length < 6)
      return setError("La contraseña debe tener al menos 6 caracteres.");
    if (isRegister && password !== confirm)
      return setError("Las contraseñas no coinciden.");
    setError("");
    setBusy(true);
    try {
      if (isRegister) {
        const r = await register(name.trim(), email.trim(), password);
        setBusy(false);
        startVerify(r.email || email.trim(), r.dev_code);
      } else {
        await login(email.trim(), password);
        // Si cambió la contraseña, se actualiza la guardada para la huella
        const saved = await getBiometricCredentials();
        if (saved && saved.email.toLowerCase() === email.trim().toLowerCase())
          await saveBiometricCredentials(saved.email, password);
      }
    } catch (e) {
      const d = e?.response?.data;
      if (d?.code === "EMAIL_NOT_VERIFIED") {
        setBusy(false);
        startVerify(d.email || email.trim(), d.dev_code);
        setInfo("Tu correo aún no está verificado. Te enviamos un código.");
        return;
      }
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
      <T style={{ color: "#ffffff", fontSize: 12, fontWeight: "700" }}>
        {label}
      </T>
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
        behavior={Platform.OS === "web" ? undefined : "padding"}
      >
        <ScrollView
          ref={sv}
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
            <T
              style={{
                color: "rgba(255,255,255,0.84)",
                fontSize: 14,
                lineHeight: 20,
              }}
            >
              {HELPER[mode]}
            </T>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 10,
                marginTop: 8,
              }}
            >
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
              backgroundColor: C.card,
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
            {isNewPass ? (
              <View style={{ gap: 6, marginBottom: 4 }}>
                <T style={{ fontSize: 18, fontWeight: "800" }}>
                  Restablece tu contraseña
                </T>
                <T style={{ fontSize: 13, lineHeight: 18, color: C.muted }}>
                  Escribe el código de 6 dígitos que enviamos a {pendingEmail} y
                  tu contraseña nueva. Vence en 15 minutos.
                </T>
              </View>
            ) : isVerify ? (
              <View style={{ gap: 6, marginBottom: 4 }}>
                <T style={{ fontSize: 18, fontWeight: "800" }}>
                  Verifica tu correo
                </T>
                <T style={{ fontSize: 13, lineHeight: 18, color: C.muted }}>
                  Enviamos un código de 6 dígitos a {pendingEmail}. Vence en 15
                  minutos.
                </T>
              </View>
            ) : !isReset ? (
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
                <T style={{ fontSize: 18, fontWeight: "800" }}>
                  Recuperar contraseña
                </T>
                <T style={{ fontSize: 13, lineHeight: 18, color: C.muted }}>
                  Escribe el correo de tu cuenta y te enviaremos un código para
                  crear una contraseña nueva.
                </T>
              </View>
            )}

            {isVerify || isNewPass ? (
              <>
                <TextInput
                  value={code}
                  onChangeText={(v) => {
                    setCode(v.replace(/[^0-9]/g, "").slice(0, 6));
                    setError("");
                  }}
                  onSubmitEditing={isVerify ? submitCode : undefined}
                  placeholder="000000"
                  placeholderTextColor={C.hint}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoFocus
                  accessibilityLabel={
                    isNewPass
                      ? "Código de recuperación"
                      : "Código de verificación"
                  }
                  style={{
                    borderWidth: 1,
                    borderColor: C.border,
                    borderRadius: 12,
                    backgroundColor: C.field,
                    color: C.text,
                    textAlign: "center",
                    fontSize: 28,
                    fontWeight: "800",
                    letterSpacing: 10,
                    minHeight: 60,
                  }}
                />
                {devCode ? (
                  <T
                    style={{
                      color: C.muted,
                      fontSize: 12,
                      textAlign: "center",
                    }}
                  >
                    Modo desarrollo (correo sin configurar): tu código es{" "}
                    {devCode}
                  </T>
                ) : null}
              </>
            ) : null}

            {!isVerify && !isNewPass && isRegister
              ? field("Nombre", {
                  value: name,
                  onChangeText: setName,
                  placeholder: "Nombre del usuario",
                  autoComplete: "name",
                  ...chain(0),
                })
              : null}
            {!isVerify && !isNewPass
              ? field("Correo", {
                  value: email,
                  onChangeText: (v) => {
                    setEmail(v);
                    setError("");
                  },
                  placeholder: "correo@dominio.com",
                  keyboardType: "email-address",
                  autoCapitalize: "none",
                  autoComplete: "email",
                  ...chain(1, { last: isReset, onSubmit: submit }),
                })
              : null}
            {!isReset && !isVerify ? (
              <PwField
                label={isNewPass ? "Contraseña nueva" : "Contraseña"}
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  setError("");
                }}
                placeholder="Mínimo 6 caracteres"
                autoComplete={
                  isRegister || isNewPass ? "new-password" : "current-password"
                }
                onSubmit={submit}
                chainProps={chain(2, {
                  last: !isRegister && !isNewPass,
                  onSubmit: submit,
                })}
              />
            ) : null}
            {(isRegister || isNewPass) && !isVerify ? (
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
                chainProps={chain(3, { last: true, onSubmit: submit })}
              />
            ) : null}

            {info ? (
              <T
                style={{
                  color: C.brand,
                  fontSize: 13,
                  fontWeight: "600",
                  marginTop: 4,
                  lineHeight: 18,
                }}
              >
                {info}
              </T>
            ) : null}
            {error ? (
              <T
                style={{
                  color: C.error,
                  fontSize: 13,
                  fontWeight: "600",
                  marginTop: 4,
                }}
              >
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
                <T
                  style={{ color: "#ffffff", fontSize: 15, fontWeight: "800" }}
                >
                  {isVerify
                    ? "Verificar"
                    : isNewPass
                      ? "Cambiar contraseña"
                      : isReset
                        ? "Enviar código"
                        : isRegister
                          ? "Crear cuenta"
                          : "Entrar"}
                </T>
              )}
            </TouchableOpacity>

            {isVerify || isNewPass ? (
              <>
                <TouchableOpacity
                  onPress={resend}
                  disabled={cooldown > 0}
                  style={{
                    alignSelf: "center",
                    marginTop: 4,
                    minHeight: 40,
                    paddingHorizontal: 12,
                    justifyContent: "center",
                  }}
                >
                  <T
                    style={{
                      color: cooldown > 0 ? C.muted : C.link,
                      fontSize: 13,
                      fontWeight: "700",
                    }}
                  >
                    {cooldown > 0
                      ? `Reenviar código en ${cooldown} s`
                      : "Reenviar código"}
                  </T>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => go(isNewPass ? "login" : "register")}
                  style={{
                    alignSelf: "center",
                    minHeight: 40,
                    paddingHorizontal: 12,
                    justifyContent: "center",
                  }}
                >
                  <T style={{ color: C.link, fontSize: 13, fontWeight: "700" }}>
                    {isNewPass ? "Volver a iniciar sesión" : "Usar otro correo"}
                  </T>
                </TouchableOpacity>
              </>
            ) : null}
            {isLogin && bioReady ? (
              <TouchableOpacity
                onPress={bioLogin}
                disabled={busy}
                activeOpacity={0.85}
                accessibilityLabel="Entrar con huella"
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  minHeight: 48,
                  borderRadius: 12,
                  borderWidth: 1.5,
                  borderColor: C.brand,
                }}
              >
                <Icon name="fingerprint" size={22} color={C.brand} stroke={2} />
                <T style={{ color: C.brand, fontSize: 15, fontWeight: "800" }}>
                  Entrar con huella
                </T>
              </TouchableOpacity>
            ) : null}
            {isLogin ? (
              <TouchableOpacity
                onPress={() => go("reset")}
                style={{
                  alignSelf: "center",
                  marginTop: 4,
                  minHeight: 40,
                  paddingHorizontal: 12,
                  justifyContent: "center",
                }}
              >
                <T style={{ color: C.link, fontSize: 13, fontWeight: "700" }}>
                  Recuperar contraseña
                </T>
              </TouchableOpacity>
            ) : null}
            {isReset ? (
              <TouchableOpacity
                onPress={() => go("login")}
                style={{
                  alignSelf: "center",
                  marginTop: 4,
                  minHeight: 40,
                  paddingHorizontal: 12,
                  justifyContent: "center",
                }}
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
              Al continuar, tus datos locales se vinculan con tu espacio seguro
              en la nube.
            </T>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
