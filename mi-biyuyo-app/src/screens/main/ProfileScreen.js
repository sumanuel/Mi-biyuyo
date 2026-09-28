import React, { useState } from "react";
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
import {
  Card,
  ActionButton,
  ScreenHeader,
} from "../../components/common/AppUI";
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
      <ScreenHeader title="Perfil" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Avatar */}
        <View style={styles.avatarBlock}>
          <View
            style={[
              styles.avatarCircle,
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
        </View>

        {/* Preferences */}
        <Card>
          <SettingRow
            icon="moon-outline"
            label="Modo oscuro"
            colors={colors}
            right={
              <Switch
                value={isDark}
                onValueChange={toggle}
                trackColor={{ true: colors.accent }}
                thumbColor="#fff"
              />
            }
          />
          <SettingRow
            icon="swap-horizontal-outline"
            label="Tasas de cambio"
            colors={colors}
            onPress={() => navigation.navigate("ExchangeRate")}
            showArrow
          />
        </Card>

        {/* App info */}
        <Card style={{ marginTop: spacing.md }}>
          <SettingRow
            icon="information-circle-outline"
            label="Versión"
            colors={colors}
            right={
              <Text style={{ color: colors.muted, fontSize: rf(14) }}>
                1.0.0
              </Text>
            }
          />
          <SettingRow
            icon="cash-outline"
            label="Mi Biyuyo"
            colors={colors}
            right={
              <Text style={{ color: colors.muted, fontSize: rf(12) }}>
                Finanzas personales
              </Text>
            }
          />
        </Card>

        <ActionButton
          label="Cerrar sesión"
          variant="danger"
          icon="log-out-outline"
          onPress={handleLogout}
          style={styles.logoutBtn}
        />
      </ScrollView>
    </View>
  );
}

function SettingRow({ icon, label, colors, right, onPress, showArrow }) {
  const Row = onPress ? TouchableOpacity : View;
  return (
    <Row style={styles.settingRow} onPress={onPress} activeOpacity={0.7}>
      <View
        style={[styles.settingIcon, { backgroundColor: colors.accentSoft }]}
      >
        <Ionicons name={icon} size={s(18)} color={colors.accent} />
      </View>
      <Text style={[styles.settingLabel, { color: colors.text }]}>{label}</Text>
      {right || null}
      {showArrow && (
        <Ionicons name="chevron-forward" size={s(16)} color={colors.muted} />
      )}
    </Row>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.xl, paddingBottom: s(60) },
  avatarBlock: { alignItems: "center", marginBottom: spacing.xl },
  avatarCircle: {
    width: s(80),
    height: s(80),
    borderRadius: s(40),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  avatarLetter: { color: "#fff", fontSize: rf(36), fontWeight: "800" },
  userName: { fontSize: rf(22), fontWeight: "700" },
  userEmail: { fontSize: rf(14), marginTop: s(4) },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  settingIcon: {
    width: s(36),
    height: s(36),
    borderRadius: borderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  settingLabel: { flex: 1, fontSize: rf(15) },
  logoutBtn: { marginTop: spacing.xl },
});
