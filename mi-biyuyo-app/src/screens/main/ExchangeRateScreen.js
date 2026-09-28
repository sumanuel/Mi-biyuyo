import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { useExchangeRate } from "../../contexts/ExchangeRateContext";
import {
  ActionButton,
  Card,
  ScreenHeader,
} from "../../components/common/AppUI";
import { formatAmount } from "../../utils/currency";
import { rf, s, spacing, borderRadius } from "../../utils/responsive";

export default function ExchangeRateScreen({ navigation }) {
  const { colors } = useTheme();
  const { rates, loading, fetchExternal, updateManual } = useExchangeRate();
  const [usdVes, setUsdVes] = useState(String(rates.usd_to_ves || ""));
  const [binanceVes, setBinanceVes] = useState(
    String(rates.binance_to_ves || ""),
  );
  const [saving, setSaving] = useState(false);

  const handleFetch = async () => {
    try {
      const data = await fetchExternal();
      setUsdVes(String(data.usd_to_ves || ""));
      setBinanceVes(String(data.binance_to_ves || ""));
      Alert.alert(
        "Tasas actualizadas",
        "Las tasas se obtuvieron de fuentes externas correctamente.",
      );
    } catch (e) {
      Alert.alert(
        "Error",
        e?.response?.data?.error || "No se pudo obtener las tasas",
      );
    }
  };

  const handleSave = async () => {
    const ves = parseFloat(usdVes);
    const bin = parseFloat(binanceVes);
    if (!ves && !bin) {
      Alert.alert("Error", "Ingresa al menos una tasa");
      return;
    }
    setSaving(true);
    try {
      await updateManual(ves || undefined, bin || undefined);
      Alert.alert("Tasas guardadas", "Las tasas se guardaron correctamente.");
    } catch {
      Alert.alert("Error", "No se pudo guardar las tasas");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <ScreenHeader
        title="Tasas de cambio"
        onBack={() => navigation.goBack()}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Current rates */}
        <Text style={[styles.sectionLabel, { color: colors.muted }]}>
          TASAS ACTUALES
        </Text>
        <Card style={styles.ratesCard}>
          <RateRow
            label="USD → VES"
            sublabel="Tasa BCV / Manual"
            value={
              rates.usd_to_ves
                ? `1 USD = ${formatAmount(rates.usd_to_ves, "VES")}`
                : "No configurada"
            }
            icon="trending-up"
            color={colors.income}
            colors={colors}
          />
          <View
            style={{
              height: 1,
              backgroundColor: colors.borderLight,
              marginVertical: spacing.sm,
            }}
          />
          <RateRow
            label="Binance → VES"
            sublabel="USDT P2P"
            value={
              rates.binance_to_ves
                ? `1 USDT = ${formatAmount(rates.binance_to_ves, "VES")}`
                : "No configurada"
            }
            icon="logo-bitcoin"
            color={colors.warning}
            colors={colors}
          />
          {rates.source === "auto" && rates.fetched_at && (
            <Text style={[styles.fetchedAt, { color: colors.muted }]}>
              Actualizado: {new Date(rates.fetched_at).toLocaleString("es")}
            </Text>
          )}
        </Card>

        {/* Auto-fetch */}
        <ActionButton
          label={loading ? "Obteniendo tasas..." : "Actualizar desde internet"}
          icon="cloud-download-outline"
          variant="outline"
          onPress={handleFetch}
          loading={loading}
          style={styles.fetchBtn}
        />
        <Text style={[styles.hint, { color: colors.muted }]}>
          Fuentes: BCV (tasa oficial), Binance P2P (USDT)
        </Text>

        {/* Manual input */}
        <Text
          style={[
            styles.sectionLabel,
            { color: colors.muted, marginTop: spacing.xl },
          ]}
        >
          INGRESAR MANUALMENTE
        </Text>
        <Card>
          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
            Tasa USD → VES (Bs. por 1 USD)
          </Text>
          <TextInput
            style={[
              styles.rateInput,
              {
                backgroundColor: colors.surfaceAlt,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            value={usdVes}
            onChangeText={setUsdVes}
            keyboardType="decimal-pad"
            placeholder="Ej: 40.50"
            placeholderTextColor={colors.muted}
          />

          <Text
            style={[
              styles.inputLabel,
              { color: colors.textSecondary, marginTop: spacing.md },
            ]}
          >
            Tasa Binance → VES (Bs. por 1 USDT)
          </Text>
          <TextInput
            style={[
              styles.rateInput,
              {
                backgroundColor: colors.surfaceAlt,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            value={binanceVes}
            onChangeText={setBinanceVes}
            keyboardType="decimal-pad"
            placeholder="Ej: 41.20"
            placeholderTextColor={colors.muted}
          />

          <ActionButton
            label="Guardar tasas"
            onPress={handleSave}
            loading={saving}
            style={{ marginTop: spacing.md }}
          />
        </Card>

        {/* Preview */}
        {(parseFloat(usdVes) > 0 || parseFloat(binanceVes) > 0) && (
          <>
            <Text
              style={[
                styles.sectionLabel,
                { color: colors.muted, marginTop: spacing.xl },
              ]}
            >
              PREVISUALIZACIÓN
            </Text>
            <Card>
              <PreviewRow
                label="$1 USD ="
                usd={1}
                ves={parseFloat(usdVes) || 0}
                bin={parseFloat(usdVes) / parseFloat(binanceVes) || 0}
                colors={colors}
              />
              <PreviewRow
                label="Bs.1.000 ="
                usd={1000 / (parseFloat(usdVes) || 1)}
                ves={1000}
                bin={1000 / (parseFloat(binanceVes) || 1)}
                colors={colors}
              />
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function RateRow({ label, sublabel, value, icon, color, colors }) {
  return (
    <View style={styles.rateRowContainer}>
      <View style={[styles.rateIcon, { backgroundColor: color + "22" }]}>
        <Ionicons name={icon} size={s(20)} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rateLabel, { color: colors.text }]}>{label}</Text>
        <Text style={[styles.rateSublabel, { color: colors.muted }]}>
          {sublabel}
        </Text>
      </View>
      <Text style={[styles.rateValue, { color }]}>{value}</Text>
    </View>
  );
}

function PreviewRow({ label, usd, ves, bin, colors }) {
  return (
    <View style={styles.previewRow}>
      <Text style={[styles.previewLabel, { color: colors.textSecondary }]}>
        {label}
      </Text>
      <Text style={[styles.previewValue, { color: colors.text }]}>
        {formatAmount(usd, "USD")} · {formatAmount(ves, "VES")} ·{" "}
        {formatAmount(bin, "BINANCE")}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.xl, paddingBottom: s(60) },
  sectionLabel: {
    fontSize: rf(11),
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: spacing.sm,
  },
  ratesCard: {},
  rateRowContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  rateIcon: {
    width: s(40),
    height: s(40),
    borderRadius: s(20),
    alignItems: "center",
    justifyContent: "center",
  },
  rateLabel: { fontSize: rf(15), fontWeight: "600" },
  rateSublabel: { fontSize: rf(12) },
  rateValue: { fontSize: rf(14), fontWeight: "700" },
  fetchedAt: { fontSize: rf(11), marginTop: spacing.sm, textAlign: "center" },
  fetchBtn: { marginVertical: spacing.md },
  hint: { fontSize: rf(12), textAlign: "center", marginBottom: spacing.md },
  inputLabel: { fontSize: rf(13), fontWeight: "600", marginBottom: s(6) },
  rateInput: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    height: s(48),
    fontSize: rf(16),
    fontWeight: "600",
  },
  previewRow: { marginBottom: spacing.sm },
  previewLabel: { fontSize: rf(13), fontWeight: "600" },
  previewValue: { fontSize: rf(14), marginTop: s(2) },
});
