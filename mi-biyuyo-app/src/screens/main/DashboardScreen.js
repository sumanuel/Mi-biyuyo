import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../contexts/AuthContext";
import { useExchangeRate } from "../../contexts/ExchangeRateContext";
import { getSummary, getTrend } from "../../services/api/statsService";
import { getTransactions } from "../../services/api/transactionService";
import { EmptyState } from "../../components/common/AppUI";
import { formatAmount } from "../../utils/currency";
import { rf, s, spacing, borderRadius } from "../../utils/responsive";

const SCREEN_W = Dimensions.get("window").width;

export default function DashboardScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const { token, user } = useAuth();
  const { rates } = useExchangeRate();
  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState([]);
  const [pending, setPending] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const load = useCallback(async () => {
    try {
      const [s, t, tx] = await Promise.all([
        getSummary(token, month, year),
        getTrend(token, 6),
        getTransactions(token, { status: "active", limit: 5 }),
      ]);
      setSummary(s);
      setTrend(t);
      setPending(
        (tx.data || []).filter((tx) =>
          ["loan_given", "debt"].includes(tx.category_type),
        ),
      );
    } catch {}
  }, [token, month, year]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // Build chart data from trend
  const chartData = buildChartData(trend);

  const income = parseFloat(summary?.by_type?.income?.total_usd || 0);
  const expense = parseFloat(summary?.by_type?.expense?.total_usd || 0);
  const loanTotal = parseFloat(summary?.by_type?.loan_given?.total_usd || 0);
  const debtTotal = parseFloat(summary?.by_type?.debt?.total_usd || 0);
  const balance = income - expense;
  const balanceVes = balance * (rates.usd_to_ves || 0);
  const balanceBinance = rates.binance_to_ves
    ? balance * (rates.usd_to_ves / rates.binance_to_ves)
    : 0;

  const greet = getGreeting();
  const monthName = new Date(year, month - 1).toLocaleString("es", {
    month: "long",
    year: "numeric",
  });
  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.headerSub, { color: colors.muted }]}>Panel de control</Text>
            <Text style={[styles.headerName, { color: colors.text }]}>{user?.name?.split(" ")[0] || "Bienvenido"}</Text>
          </View>
          <TouchableOpacity style={[styles.bellBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="notifications-outline" size={s(20)} color={colors.text} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xxl }} />
        ) : (
          <>
            {/* Tarjeta de saldo — verde oscuro */}
            <View style={[styles.balanceCard, { backgroundColor: colors.accent }]}>
              <Text style={styles.balanceCardLabel}>MI SALDO</Text>
              <Text style={styles.balanceCardAmount}>{formatAmount(balance, "USD")}</Text>
              {rates.usd_to_ves > 0 || rates.binance_to_ves > 0 ? (
                <Text style={styles.balanceCardSub}>Suma de tus movimientos activos</Text>
              ) : (
                <Text style={styles.balanceCardSub}>Configura tasas para ver equivalencias</Text>
              )}
              {rates.usd_to_ves > 0 && (
                <View style={styles.balanceRateRow}>
                  <Text style={styles.balanceRateLabel}>BCV</Text>
                  <Text style={styles.balanceRateVal}>{formatAmount(balanceVes, "VES")}</Text>
                </View>
              )}
              {rates.binance_to_ves > 0 && (
                <View style={[styles.balanceRateRow, { marginTop: s(4) }]}>
                  <Text style={styles.balanceRateLabel}>Binance P2P</Text>
                  <Text style={styles.balanceRateVal}>{formatAmount(balanceBinance, "BINANCE")}</Text>
                </View>
              )}
            </View>

            {/* Alerta tasas */}
            {(!rates.usd_to_ves || rates.usd_to_ves === 0) && (
              <TouchableOpacity
                style={[styles.alertCard, { backgroundColor: colors.warningSoft, borderColor: colors.warning }]}
                onPress={() => navigation.navigate("ExchangeRate")}
                activeOpacity={0.8}
              >
                <Ionicons name="warning-outline" size={s(18)} color={colors.warning} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.alertTitle, { color: colors.warning }]}>Tasas no configuradas</Text>
                  <Text style={[styles.alertSub, { color: colors.warning }]}>Toca para configurar BCV y Binance P2P</Text>
                </View>
                <Ionicons name="chevron-forward" size={s(16)} color={colors.warning} />
              </TouchableOpacity>
            )}

            {/* Tasas de cambio */}
            {rates.usd_to_ves > 0 && (
              <TouchableOpacity style={[styles.rateRow, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => navigation.navigate("ExchangeRate")} activeOpacity={0.8}>
                <View style={[styles.vesBadge, { backgroundColor: colors.accent }]}>
                  <Text style={[styles.vesBadgeText]}>VES</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rateRowLabel, { color: colors.muted }]}>Tasa BCV</Text>
                  <Text style={[styles.rateRowVal, { color: colors.text }]}>1 USD = VES {Number(rates.usd_to_ves).toLocaleString("es")}</Text>
                </View>
                <Ionicons name="chevron-forward" size={s(16)} color={colors.muted} />
              </TouchableOpacity>
            )}
            {rates.binance_to_ves > 0 && (
              <TouchableOpacity style={[styles.rateRow, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => navigation.navigate("ExchangeRate")} activeOpacity={0.8}>
                <View style={[styles.vesBadge, { backgroundColor: colors.accent }]}>
                  <Text style={styles.vesBadgeText}>VES</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rateRowLabel, { color: colors.muted }]}>Tasa Binance P2P</Text>
                  <Text style={[styles.rateRowVal, { color: colors.text }]}>1 USD = VES {Number(rates.binance_to_ves).toLocaleString("es")}</Text>
                </View>
                <Ionicons name="chevron-forward" size={s(16)} color={colors.muted} />
              </TouchableOpacity>
            )}

            {/* Resumen operativo */}
            <View style={styles.sectionRow}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Resumen operativo</Text>
              <TouchableOpacity onPress={() => navigation.navigate("Transactions")}>
                <Text style={[styles.sectionLink, { color: colors.accent }]}>Ver historial</Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.sectionSub, { color: colors.muted }]}>Ingresos y gastos de los últimos 30 días</Text>
            <View style={styles.summaryGrid}>
              <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.summaryLabel, { color: colors.muted }]}>Ingresos</Text>
                <Text style={[styles.summaryAmt, { color: colors.income }]}>{formatAmount(income, "USD")}</Text>
                <View style={[styles.summaryPill, { backgroundColor: colors.incomeSoft }]}>
                  <Text style={[styles.summaryPillText, { color: colors.income }]}>{summary?.by_type?.income?.count || 0} ingresos</Text>
                </View>
              </View>
              <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.summaryLabel, { color: colors.muted }]}>Gastos</Text>
                <Text style={[styles.summaryAmt, { color: colors.expense }]}>{formatAmount(expense, "USD")}</Text>
                <View style={[styles.summaryPill, { backgroundColor: colors.expenseSoft }]}>
                  <Text style={[styles.summaryPillText, { color: colors.expense }]}>{summary?.by_type?.expense?.count || 0} gastos</Text>
                </View>
              </View>
            </View>

            {/* Pendientes */}
            {pending.length > 0 && (
              <>
                <View style={[styles.sectionRow, { marginTop: spacing.md }]}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Pendientes</Text>
                  <TouchableOpacity onPress={() => navigation.navigate("Transactions")}>
                    <Text style={[styles.sectionLink, { color: colors.accent }]}>Ver todo</Text>
                  </TouchableOpacity>
                </View>
                {pending.map((tx) => (
                  <TouchableOpacity
                    key={tx.id}
                    style={[styles.pendingItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    onPress={() => navigation.navigate("TransactionDetail", { id: tx.id })}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.pendingDot, { backgroundColor: tx.category_type === "debt" ? colors.expense : colors.income }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.pendingName, { color: colors.text }]} numberOfLines={1}>
                        {tx.counterpart_name || tx.description || tx.category_name}
                      </Text>
                      <Text style={[styles.pendingType, { color: colors.muted }]}>
                        {tx.category_type === "debt" ? "Deuda" : "Préstamo"} · {formatShortDate(tx.date)}
                      </Text>
                    </View>
                    <Text style={[styles.pendingAmt, { color: tx.category_type === "debt" ? colors.expense : colors.income }]}>
                      {formatAmount(parseFloat(tx.amount_usd) - parseFloat(tx.paid_usd || 0), "USD")}
                    </Text>
                  </TouchableOpacity>
                ))}
              </>
            )}

            {!income && !expense && !pending.length && (
              <View style={styles.emptyWrap}>
                <Text style={{ fontSize: rf(36), marginBottom: spacing.sm }}>💰</Text>
                <Text style={[{ fontSize: rf(16), fontWeight: "700", color: colors.text, marginBottom: s(6) }]}>Sin movimientos</Text>
                <Text style={[{ fontSize: rf(13), color: colors.muted, textAlign: "center" }]}>Toca el botón + para registrar tu primer movimiento</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function getMonthLabel(month) {
  return ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"][month - 1] || "";
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 18) return "Buenas tardes";
  return "Buenas noches";
}

function formatShortDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("es", { day: "numeric", month: "short" });
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, paddingBottom: s(100) },

  // header
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.lg },
  headerSub: { fontSize: rf(12), fontWeight: "500" },
  headerName: { fontSize: rf(24), fontWeight: "800", letterSpacing: -0.5 },
  bellBtn: { width: s(40), height: s(40), borderRadius: s(12), borderWidth: 1, alignItems: "center", justifyContent: "center" },

  // balance card
  balanceCard: { borderRadius: s(16), padding: spacing.xl, marginBottom: spacing.md },
  balanceCardLabel: { color: "rgba(255,255,255,0.7)", fontSize: rf(11), fontWeight: "700", letterSpacing: 1, marginBottom: s(6) },
  balanceCardAmount: { color: "#fff", fontSize: rf(32), fontWeight: "900", letterSpacing: -1 },
  balanceCardSub: { color: "rgba(255,255,255,0.6)", fontSize: rf(12), marginTop: s(4), marginBottom: s(12) },
  balanceRateRow: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.2)", paddingTop: s(10) },
  balanceRateLabel: { color: "rgba(255,255,255,0.7)", fontSize: rf(12), fontWeight: "600" },
  balanceRateVal: { color: "#fff", fontSize: rf(13), fontWeight: "700" },

  // alert
  alertCard: { flexDirection: "row", alignItems: "center", gap: s(10), borderWidth: 1, borderRadius: s(12), padding: spacing.md, marginBottom: spacing.sm },
  alertTitle: { fontSize: rf(13), fontWeight: "700" },
  alertSub: { fontSize: rf(11), marginTop: s(1) },

  // rate rows
  rateRow: { flexDirection: "row", alignItems: "center", gap: s(12), borderWidth: 1, borderRadius: s(12), padding: spacing.md, marginBottom: s(8) },
  vesBadge: { borderRadius: s(6), paddingHorizontal: s(8), paddingVertical: s(3) },
  vesBadgeText: { color: "#fff", fontSize: rf(11), fontWeight: "800" },
  rateRowLabel: { fontSize: rf(11), fontWeight: "500" },
  rateRowVal: { fontSize: rf(14), fontWeight: "700" },

  // section
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: s(4), marginTop: spacing.md },
  sectionTitle: { fontSize: rf(15), fontWeight: "700" },
  sectionLink: { fontSize: rf(13), fontWeight: "600" },
  sectionSub: { fontSize: rf(12), marginBottom: spacing.sm },

  // summary grid
  summaryGrid: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  summaryCard: { flex: 1, borderRadius: s(12), borderWidth: 1, padding: spacing.md },
  summaryLabel: { fontSize: rf(12), fontWeight: "500", marginBottom: s(4) },
  summaryAmt: { fontSize: rf(18), fontWeight: "800", letterSpacing: -0.5 },
  summaryPill: { borderRadius: s(6), paddingHorizontal: s(8), paddingVertical: s(3), marginTop: s(8), alignSelf: "flex-start" },
  summaryPillText: { fontSize: rf(11), fontWeight: "700" },

  // pending
  pendingItem: { flexDirection: "row", alignItems: "center", gap: s(10), borderWidth: 1, borderRadius: s(12), padding: spacing.md, marginBottom: s(8) },
  pendingDot: { width: s(8), height: s(8), borderRadius: s(4) },
  pendingName: { fontSize: rf(14), fontWeight: "600" },
  pendingType: { fontSize: rf(11), marginTop: s(2) },
  pendingAmt: { fontSize: rf(14), fontWeight: "700" },

  // empty
  emptyWrap: { alignItems: "center", paddingVertical: spacing.xxl },
});

