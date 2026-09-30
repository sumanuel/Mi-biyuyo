import React from "react";
import { View, TouchableOpacity, Switch } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import { Screen, Txt, H1, Icon } from "../../components/ui";
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
        <Icon name="chevronRight" size={18} color={colors.textSecondary} stroke={2} />
      )}
    </TouchableOpacity>
  );
}

export default function SettingsScreen({ navigation }) {
  const { colors, isDark, toggle } = useTheme();
  const { logout } = useAuth();
  const { threshold, setThreshold, showToast } = useData();
  const soon = () => showToast("Próximamente");

  const stepBtn = (icon, onPress, label) => (
    <TouchableOpacity
      onPress={onPress}
      accessibilityLabel={label}
      style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}
    >
      <Icon name={icon} size={16} color={colors.text} stroke={2.4} />
    </TouchableOpacity>
  );

  const doLogout = async () => {
    const ok = await confirm("Cerrar sesión", "¿Seguro que deseas salir?", "Salir");
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
        <Row label="Presupuestos" sub="Límites por categoría y metas de ahorro" onPress={soon} />
        <Row label="Cuentas compartidas" sub="Gestionar personas con acceso" onPress={soon} last />
      </Section>

      <Section title="SISTEMA">
        <Row label="Exportar a Excel" sub="Movimientos, cuentas y categorías" onPress={soon} />
        <Row label="Crear respaldo" sub="Guarda una copia de tus datos" onPress={soon} />
        <Row label="Importar respaldo" sub="Restaura datos desde un archivo" onPress={soon} />
        <Row
          label="Acerca de"
          sub="Información de la aplicación"
          onPress={() => showToast("Mi Biyuyo v1.0.0")}
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
            <Txt style={{ fontSize: 15, fontWeight: "600" }}>Umbral de saldo bajo</Txt>
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
            {stepBtn("minus", () => setThreshold(threshold - 10), "Reducir umbral")}
            <Txt style={{ minWidth: 28, textAlign: "center", fontWeight: "800" }}>
              {threshold}
            </Txt>
            {stepBtn("plus", () => setThreshold(threshold + 10), "Aumentar umbral")}
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
        <Txt style={{ fontSize: 15, fontWeight: "700", color: colors.danger.fg }}>
          Cerrar sesión
        </Txt>
      </TouchableOpacity>
    </Screen>
  );
}
