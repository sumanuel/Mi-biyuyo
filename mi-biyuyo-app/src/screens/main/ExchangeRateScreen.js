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
      <View
        style={[
          styles.screenHeader,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.backBtn,
            { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
          ]}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={s(20)} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.screenTitle, { color: colors.text }]}>
          Tasas de Cambio
        </Text>
        <View style={{ width: s(36) }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {(!rates.usd_to_ves || rates.usd_to_ves === 0) && (
          <View
            style={[
              styles.warningBanner,
              {
                backgroundColor: colors.warningSoft,
                borderColor: colors.warning,
              },
            ]}
          >
            <Ionicons
              name="warning-outline"
              size={s(15)}
              color={colors.warning}
            />
            <Text style={[styles.warningText, { color: colors.warning }]}>
              Las tasas deben actualizarse para conversiones exactas
            </Text>
          </View>
        )}

        {/* Tasas actuales — tarjetas grandes */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
          Tasas actuales
        </Text>
        <View
          style={[
            styles.rateCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.rateCardLabel, { color: colors.muted }]}>
            🇻🇪 USD → BOLÍVARES (BCV)
          </Text>
          <Text style={[styles.rateCardVal, { color: colors.text }]}>
            {rates.usd_to_ves
              ? `${Number(rates.usd_to_ves).toLocaleString("es")} Bs.`
              : "No configurada"}
          </Text>
          <View style={styles.rateCardFooter}>
            <Text style={[styles.rateCardSource, { color: colors.muted }]}>
              Fuente: {rates.source === "auto" ? "API externa" : "Manual"}
            </Text>
            {rates.fetched_at && (
              <Text style={[styles.rateCardTs, { color: colors.muted }]}>
                Act:{" "}
                {new Date(rates.fetched_at).toLocaleString("es", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            )}
          </View>
        </View>
        <View
          style={[
            styles.rateCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.rateCardLabel, { color: colors.muted }]}>
            🔶 BINANCE → BOLÍVARES (P2P)
          </Text>
          <Text style={[styles.rateCardVal, { color: colors.text }]}>
            {rates.binance_to_ves
              ? `${Number(rates.binance_to_ves).toLocaleString("es")} Bs.`
              : "No configurada"}
          </Text>
          <View style={styles.rateCardFooter}>
            <Text style={[styles.rateCardSource, { color: colors.muted }]}>
              Fuente: {rates.source === "auto" ? "API externa" : "Manual"}
            </Text>
          </View>
        </View>

        {/* Botones de fetch */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
          Obtener tasas externas
        </Text>
        <View style={styles.fetchBtnRow}>
          <TouchableOpacity
            style={[
              styles.fetchBtn,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
            onPress={handleFetch}
            activeOpacity={0.8}
          >
            <Text style={styles.fetchBtnIcon}>🏛️</Text>
            <Text
              style={[styles.fetchBtnLabel, { color: colors.textSecondary }]}
            >
              BCV Oficial
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.fetchBtn,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
            onPress={handleFetch}
            activeOpacity={0.8}
          >
            <Text style={styles.fetchBtnIcon}>🔶</Text>
            <Text
              style={[styles.fetchBtnLabel, { color: colors.textSecondary }]}
            >
              Binance P2P
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={[styles.hint, { color: colors.muted }]}>
          Fuentes: BCV (tasa oficial), Binance P2P (USDT)
        </Text>

        {/* Entrada manual */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
          Entrada manual
        </Text>
        <View
          style={[
            styles.manualCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
            Tasa USD → VES (Bs. por 1 USD)
          </Text>
          <View
            style={[
              styles.inputWrap,
              {
                backgroundColor: colors.surfaceAlt,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.inputFlag]}>🇻🇪</Text>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              value={usdVes}
              onChangeText={setUsdVes}
              keyboardType="decimal-pad"
              placeholder="Ej: 3650.00"
              placeholderTextColor={colors.muted}
            />
          </View>
          <Text
            style={[
              styles.inputLabel,
              { color: colors.textSecondary, marginTop: spacing.md },
            ]}
          >
            Tasa Binance → VES (Bs. por 1 USDT)
          </Text>
          <View
            style={[
              styles.inputWrap,
              {
                backgroundColor: colors.surfaceAlt,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={styles.inputFlag}>🔶</Text>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              value={binanceVes}
              onChangeText={setBinanceVes}
              keyboardType="decimal-pad"
              placeholder="Ej: 3645.20"
              placeholderTextColor={colors.muted}
            />
          </View>
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: colors.accent }]}
            onPress={handleSave}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.saveBtnText}>💾 Guardar tasas</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Preview */}
        {(parseFloat(usdVes) > 0 || parseFloat(binanceVes) > 0) && (
          <>
            <Text
              style={[styles.sectionLabel, { color: colors.textSecondary }]}
            >
              Vista previa (con $1.00)
            </Text>
            <View
              style={[
                styles.previewCard,
                {
                  backgroundColor: colors.surfaceAlt,
                  borderColor: colors.border,
                },
              ]}
            >
              <View
                style={[styles.convRow, { borderBottomColor: colors.border }]}
              >
                <Text style={[styles.convLabel, { color: colors.muted }]}>
                  🇺🇸 $1.00 USD
                </Text>
                <Text style={[styles.convVal, { color: colors.text }]}>
                  Bs.{" "}
                  {Number(usdVes || 0).toLocaleString("es", {
                    maximumFractionDigits: 2,
                  })}
                </Text>
              </View>
              <View
                style={[styles.convRow, { borderBottomColor: colors.border }]}
              >
                <Text style={[styles.convLabel, { color: colors.muted }]}>
                  🔶 ₮1.00 USDT
                </Text>
                <Text style={[styles.convVal, { color: colors.text }]}>
                  Bs.{" "}
                  {Number(binanceVes || 0).toLocaleString("es", {
                    maximumFractionDigits: 2,
                  })}
                </Text>
              </View>
              <View
                style={[styles.convRow, { borderBottomColor: "transparent" }]}
              >
                <Text style={[styles.convLabel, { color: colors.muted }]}>
                  🇻🇪 Bs. 1,000
                </Text>
                <Text style={[styles.convVal, { color: colors.text }]}>
                  ${(1000 / (parseFloat(usdVes) || 1)).toFixed(3)} USD
                </Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screenHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  screenTitle: { fontSize: 17, fontWeight: "700" },
  scroll: { padding: 16, paddingBottom: 60 },
  warningBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  warningText: { flex: 1, fontSize: 12, fontWeight: "600" },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 4,
  },
  rateCard: { borderRadius: 12, borderWidth: 1, padding: 16, marginBottom: 8 },
  rateCardLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  rateCardVal: { fontSize: 24, fontWeight: "900", letterSpacing: -0.5 },
  rateCardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  rateCardSource: { fontSize: 10 },
  rateCardTs: { fontSize: 10 },
  fetchBtnRow: { flexDirection: "row", gap: 8, marginBottom: 4 },
  fetchBtn: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    alignItems: "center",
    gap: 6,
  },
  fetchBtnIcon: { fontSize: 20 },
  fetchBtnLabel: { fontSize: 12, fontWeight: "600" },
  hint: { fontSize: 11, textAlign: "center", marginBottom: 12 },
  manualCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  inputLabel: { fontSize: 13, fontWeight: "600", marginBottom: 6 },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 50,
    gap: 8,
    marginBottom: 4,
  },
  inputFlag: { fontSize: 18 },
  input: { flex: 1, fontSize: 16, fontWeight: "600" },
  saveBtn: {
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    marginTop: 12,
  },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  previewCard: { borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  convRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderBottomWidth: 1,
  },
  convLabel: { fontSize: 13, fontWeight: "600" },
  convVal: { fontSize: 13, fontWeight: "700" },
});
