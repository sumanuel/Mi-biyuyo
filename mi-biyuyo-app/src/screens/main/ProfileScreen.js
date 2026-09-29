import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../contexts/AuthContext";
import { rf, s, spacing, borderRadius } from "../../utils/responsive";

export default function ProfileScreen({ navigation }) {
  const { colors, isDark, toggle } = useTheme();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert("Cerrar sesión", "¿Seguro que deseas salir?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Salir", style: "destructive", onPress: logout },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      {/* Hero con avatar */}
      <View
        style={[
          styles.hero,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        <View
          style={[
            styles.avatar,
            { backgroundColor: user?.avatar_color || colors.accent },
          ]}
        >
          <Text style={styles.avatarLetter}>
            {(user?.name || "U")[0].toUpperCase()}
          </Text>
        </View>
        <Text style={[styles.userName, { color: colors.text }]}>
          {user?.name}
        </Text>
        <Text style={[styles.userEmail, { color: colors.muted }]}>
          {user?.email}
        </Text>
        <Text style={[styles.userSince, { color: colors.muted }]}>
          Miembro desde{" "}
          {new Date(user?.created_at || Date.now()).toLocaleDateString("es", {
            month: "short",
            year: "numeric",
          })}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Apariencia */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
          Apariencia
        </Text>
        <View style={styles.group}>
          <SettingRow
            icon="moon-outline"
            label="Modo oscuro"
            sub="Cambiar tema de la app"
            iconBg={colors.accentSoft}
            iconColor={colors.accent}
            colors={colors}
            right={
              <Switch
                value={isDark}
                onValueChange={toggle}
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor="#fff"
              />
            }
          />
        </View>

        {/* Configuración */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
          Configuración
        </Text>
        <View style={styles.group}>
          <SettingRow
            icon="swap-horizontal-outline"
            label="Tasas de cambio"
            sub={`USD → Bs. ${(user?.rates?.usd_to_ves || 0).toLocaleString("es")}`}
            iconBg={colors.debtSoft}
            iconColor={colors.debt}
            colors={colors}
            showArrow
            onPress={() => navigation.navigate("ExchangeRate")}
          />
          <View
            style={[styles.separator, { backgroundColor: colors.border }]}
          />
          <SettingRow
            icon="person-outline"
            label="Editar perfil"
            sub="Nombre y correo"
            iconBg={colors.incomeSoft}
            iconColor={colors.income}
            colors={colors}
            showArrow
            onPress={() => {}}
          />
        </View>

        {/* Acerca de */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
          Acerca de
        </Text>
        <View style={styles.group}>
          <SettingRow
            icon="information-circle-outline"
            label="Versión de la app"
            sub="Mi Biyuyo v1.0.0"
            iconBg={colors.surfaceAlt}
            iconColor={colors.muted}
            colors={colors}
          />
        </View>

        {/* Logout */}
        <TouchableOpacity
          style={[
            styles.logoutBtn,
            { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
          ]}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Ionicons name="log-out-outline" size={s(18)} color={colors.danger} />
          <Text style={[styles.logoutText, { color: colors.danger }]}>
            Cerrar sesión
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function SettingRow({
  icon,
  label,
  sub,
  iconBg,
  iconColor,
  colors,
  right,
  onPress,
  showArrow,
}) {
  const Row = onPress ? TouchableOpacity : View;
  return (
    <Row style={styles.settingRow} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.settingIconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={s(18)} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.settingLabel, { color: colors.text }]}>
          {label}
        </Text>
        {sub ? (
          <Text style={[styles.settingSub, { color: colors.muted }]}>
            {sub}
          </Text>
        ) : null}
      </View>
      {right || null}
      {showArrow && (
        <Ionicons name="chevron-forward" size={s(16)} color={colors.muted} />
      )}
    </Row>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: "center",
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xl,
    borderBottomWidth: 1,
  },
  avatar: {
    width: s(72),
    height: s(72),
    borderRadius: s(22),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  avatarLetter: { color: "#fff", fontSize: rf(28), fontWeight: "800" },
  userName: { fontSize: rf(20), fontWeight: "800", letterSpacing: -0.3 },
  userEmail: { fontSize: rf(13), marginTop: s(2) },
  userSince: { fontSize: rf(11), marginTop: s(4) },

  scroll: { padding: spacing.lg, paddingBottom: s(40) },
  sectionLabel: {
    fontSize: rf(12),
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: s(8),
    marginTop: spacing.md,
  },

  group: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: s(4),
    borderColor: "#E0E3F0",
  },
  separator: { height: 1, marginLeft: s(56) },

  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: "transparent",
  },
  settingIconWrap: {
    width: s(36),
    height: s(36),
    borderRadius: s(10),
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  settingLabel: { fontSize: rf(14), fontWeight: "600" },
  settingSub: { fontSize: rf(11), marginTop: s(1) },

  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: s(8),
    borderWidth: 1.5,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  logoutText: { fontSize: rf(15), fontWeight: "700" },
});
