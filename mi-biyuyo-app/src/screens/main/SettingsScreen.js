import React, { useEffect, useState } from "react";
import {
  View,
  TouchableOpacity,
  Switch,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import { Screen, Txt, H1, Icon, Field, Button } from "../../components/ui";
import * as authService from "../../services/api/authService";
import {
  authenticateWithBiometrics,
  clearBiometricCredentials,
  getBiometricCredentials,
  getBiometricLockEnabled,
  saveBiometricCredentials,
  isBiometricHardwareAvailable,
  setBiometricLockEnabled,
} from "../../services/biometricAuthService";
import { confirm } from "../../utils/confirm";

const Section = ({ title, children }) => {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <Txt
        style={{
          fontSize: 13,
          fontWeight: "700",
          letterSpacing: 0.52,
          color: colors.textSecondary,
        }}
      >
        {title}
      </Txt>
      <View
        style={{
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 16,
          overflow: "hidden",
        }}
      >
        {children}
      </View>
    </View>
  );
};

function Row({ label, sub, onPress, last, right }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.8}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        minHeight: 60,
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.divider,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Txt style={{ fontSize: 15, fontWeight: "600" }}>{label}</Txt>
        <Txt style={{ fontSize: 13, color: colors.textSecondary }}>{sub}</Txt>
      </View>
      {right || (
        <Icon
          name="chevronRight"
          size={18}
          color={colors.textSecondary}
          stroke={2}
        />
      )}
    </TouchableOpacity>
  );
}

export default function SettingsScreen({ navigation }) {
  const { colors, isDark, toggle } = useTheme();
  const { logout, user } = useAuth();
  const { threshold, setThreshold, showToast } = useData();
  const soon = () => showToast("Próximamente");

  // Desbloqueo con huella: solo aparece si el dispositivo tiene huella o Face ID registrados
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(false);
  const [bioBusy, setBioBusy] = useState(false);
  const [bioHasCreds, setBioHasCreds] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [pwError, setPwError] = useState("");
  useEffect(() => {
    (async () => {
      const [available, enabled, creds] = await Promise.all([
        isBiometricHardwareAvailable(),
        getBiometricLockEnabled(),
        getBiometricCredentials(),
      ]);
      setBioAvailable(available);
      setBioEnabled(available && enabled);
      setBioHasCreds(!!creds);
    })();
  }, []);

  const toggleBio = async (value) => {
    if (bioBusy) return;
    if (!value) {
      await setBiometricLockEnabled(false);
      await clearBiometricCredentials();
      setBioEnabled(false);
      setBioHasCreds(false);
      return;
    }
    setBioBusy(true);
    try {
      const ok = await authenticateWithBiometrics(
        "Confirma tu huella o Face ID para activar el desbloqueo",
      );
      if (!ok) {
        showToast("No se pudo verificar tu identidad. Intenta de nuevo.");
        return;
      }
      // Para poder entrar solo con la huella se guarda (cifrada) tu contraseña
      setPw("");
      setPwError("");
      setPwOpen(true);
    } finally {
      setBioBusy(false);
    }
  };

  const confirmPassword = async () => {
    if (!pw) return setPwError("Escribe tu contraseña.");
    setBioBusy(true);
    setPwError("");
    try {
      await authService.login(user.email, pw); // comprueba que sea la correcta
    } catch (e) {
      setPwError(e?.response?.data?.error || "Contraseña incorrecta.");
      setBioBusy(false);
      return;
    }
    const saved = await saveBiometricCredentials(user.email, pw);
    if (saved) {
      await setBiometricLockEnabled(true);
      setBioEnabled(true);
      setBioHasCreds(true);
      setPwOpen(false);
      showToast("Ya puedes entrar con tu huella");
    } else {
      setPwError(
        "Este dispositivo no permite guardar la contraseña de forma segura.",
      );
    }
    setBioBusy(false);
  };

  const stepBtn = (icon, onPress, label) => (
    <TouchableOpacity
      onPress={onPress}
      accessibilityLabel={label}
      style={{
        width: 40,
        height: 40,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon name={icon} size={16} color={colors.text} stroke={2.4} />
    </TouchableOpacity>
  );

  const doLogout = async () => {
    const ok = await confirm(
      "Cerrar sesión",
      "¿Seguro que deseas salir?",
      "Salir",
    );
    if (ok) logout();
  };

  return (
    <Screen data={false} contentStyle={{ gap: 18 }}>
      <H1>Configuraciones</H1>

      <Section title="PERFIL">
        <Row
          label="Mi perfil"
          sub="Nombre, correo y moneda principal"
          onPress={() => navigation.navigate("Profile")}
        />
        <Row
          label="Tasas de cambio"
          sub="BCV y Binance P2P, manual o en línea"
          onPress={() => navigation.navigate("ExchangeRate")}
        />
        <Row
          label="Presupuestos"
          sub="Límites por categoría y metas de ahorro"
          onPress={soon}
        />
        <Row
          label="Cuentas compartidas"
          sub="Gestionar personas con acceso"
          onPress={soon}
          last
        />
      </Section>

      <Section title="SISTEMA">
        <Row
          label="Exportar a Excel"
          sub="Movimientos, cuentas y categorías"
          onPress={soon}
        />
        <Row
          label="Centro de ayuda"
          sub="Cómo usar Mi Biyuyo paso a paso"
          onPress={() => navigation.navigate("HelpCenter")}
        />
        <Row
          label="Primeros pasos"
          sub="Guía para empezar a usar la app"
          onPress={() => navigation.navigate("GettingStarted")}
        />
        <Row
          label="Ver introducción"
          sub="Repasa cómo funciona Mi Biyuyo"
          onPress={() => navigation.navigate("Onboarding")}
        />
        <Row
          label="Acerca de"
          sub="Información de la aplicación"
          onPress={() => navigation.navigate("About")}
          last
        />
      </Section>

      <Section title="APARIENCIA">
        <Row
          label="Modo oscuro"
          sub="Cambiar el tema de la app"
          last
          right={
            <Switch
              value={isDark}
              onValueChange={toggle}
              trackColor={{ false: colors.disabled, true: colors.accent }}
              thumbColor="#ffffff"
            />
          }
          onPress={toggle}
        />
      </Section>

      {bioAvailable ? (
        <Section title="SEGURIDAD">
          <Row
            label="Desbloquear con huella"
            sub={
              bioEnabled && !bioHasCreds
                ? "Desactívalo y vuelve a activarlo para entrar con huella desde el inicio de sesión"
                : "Pide huella o Face ID al abrir la app y al iniciar sesión"
            }
            last
            right={
              <Switch
                value={bioEnabled}
                disabled={bioBusy}
                onValueChange={toggleBio}
                trackColor={{ false: colors.disabled, true: colors.accent }}
                thumbColor="#ffffff"
              />
            }
            onPress={() => toggleBio(!bioEnabled)}
          />
        </Section>
      ) : null}

      <Modal
        visible={pwOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPwOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "web" ? undefined : "padding"}
          style={{
            flex: 1,
            backgroundColor: colors.overlay,
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <View
            style={{
              width: "100%",
              maxWidth: 420,
              backgroundColor: colors.surface,
              borderRadius: 20,
              padding: 18,
              gap: 12,
            }}
          >
            <Txt style={{ fontSize: 17, fontWeight: "800" }}>
              Confirma tu contraseña
            </Txt>
            <Txt
              style={{
                fontSize: 13,
                lineHeight: 18,
                color: colors.textSecondary,
              }}
            >
              Se guarda cifrada en este teléfono para que puedas entrar con tu
              huella sin escribirla. Se borra al desactivar la opción.
            </Txt>
            <Field
              label="Contraseña"
              value={pw}
              onChangeText={(v) => {
                setPw(v);
                setPwError("");
              }}
              secureTextEntry
              autoCapitalize="none"
              onSubmitEditing={confirmPassword}
              error={!!pwError}
            />
            {pwError ? (
              <Txt style={{ fontSize: 13, color: colors.danger.fg }}>
                {pwError}
              </Txt>
            ) : null}
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Button
                label="Cancelar"
                outline
                height={48}
                style={{ flex: 1 }}
                onPress={() => setPwOpen(false)}
              />
              <Button
                label="Activar"
                height={48}
                style={{ flex: 1 }}
                loading={bioBusy}
                onPress={confirmPassword}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Section title="AVISOS">
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingVertical: 12,
            paddingHorizontal: 16,
          }}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <Txt style={{ fontSize: 15, fontWeight: "600" }}>
              Umbral de saldo bajo
            </Txt>
            <Txt style={{ fontSize: 13, color: colors.textSecondary }}>
              Avisar cuando tu saldo baje de USD {threshold}
            </Txt>
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 2,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
            }}
          >
            {stepBtn(
              "minus",
              () => setThreshold(threshold - 10),
              "Reducir umbral",
            )}
            <Txt
              style={{ minWidth: 28, textAlign: "center", fontWeight: "800" }}
            >
              {threshold}
            </Txt>
            {stepBtn(
              "plus",
              () => setThreshold(threshold + 10),
              "Aumentar umbral",
            )}
          </View>
        </View>
      </Section>

      <TouchableOpacity
        onPress={doLogout}
        activeOpacity={0.85}
        style={{
          height: 52,
          borderWidth: 1,
          borderColor: colors.danger.border,
          borderRadius: 16,
          backgroundColor: colors.surface,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        <Icon name="logout" size={18} color={colors.danger.fg} stroke={2} />
        <Txt
          style={{ fontSize: 15, fontWeight: "700", color: colors.danger.fg }}
        >
          Cerrar sesión
        </Txt>
      </TouchableOpacity>
    </Screen>
  );
}
