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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting */}
        <View style={styles.greeting}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.greetName, { color: colors.text }]}>
              {greet}, {user?.name?.split(" ")[0] || "Bienvenido"} 👋
            </Text>
            <Text
              style={[styles.greetSub, { color: colors.muted }]}
              numberOfLines={1}
            >
              {monthName.charAt(0).toUpperCase() + monthName.slice(1)}
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.avatarCircle,
              { backgroundColor: user?.avatar_color || colors.accent },
            ]}
            onPress={() => navigation.navigate("Profile")}
          >
            <Text style={styles.avatarLetter}>
              {(user?.name || "U")[0].toUpperCase()}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Rate warning */}
        {(!rates.usd_to_ves || rates.usd_to_ves === 0) && (
          <TouchableOpacity
            style={[
              styles.warningBanner,
              {
                backgroundColor: colors.warningSoft,
                borderColor: colors.warning,
              },
            ]}
            onPress={() => navigation.navigate("ExchangeRate")}
          >
            <Ionicons
              name="warning-outline"
              size={s(15)}
              color={colors.warning}
            />
            <Text style={[styles.warningText, { color: colors.warning }]}>
              Configura las tasas de cambio para conversiones correctas
            </Text>
          </TouchableOpacity>
        )}

        {loading ? (
          <ActivityIndicator
            color={colors.accent}
            style={{ marginTop: spacing.xxl }}
          />
        ) : (
          <>
            {/* Balance Card — gradient */}
            <LinearGradient
              colors={[colors.accent, colors.accentStrong]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.balanceCard}
            >
              <Text style={styles.balanceLabel}>BALANCE DEL MES</Text>
              <Text style={styles.balanceAmount}>
                {formatAmount(balance, "USD")}
              </Text>
              <View style={styles.balanceSubRow}>
                <View style={styles.balanceSubItem}>
                  <Text style={styles.balanceSubLabel}>EN BOLÍVARES</Text>
                  <Text style={styles.balanceSubVal}>
                    {formatAmount(balanceVes, "VES")}
                  </Text>
                </View>
                <View style={[styles.balanceSubDivider]} />
                <View style={styles.balanceSubItem}>
                  <Text style={styles.balanceSubLabel}>EN BINANCE</Text>
                  <Text style={styles.balanceSubVal}>
                    {formatAmount(balanceBinance, "BINANCE")}
                  </Text>
                </View>
              </View>
            </LinearGradient>

            {/* Metric 2×2 grid */}
            <View style={styles.metricGrid}>
              <MetricCard
                emoji="📈"
                label="INGRESOS"
                value={formatAmount(income, "USD")}
                sub="Este mes"
                valueColor={colors.income}
                bg={colors.surface}
                border={colors.border}
              />
              <MetricCard
                emoji="📉"
                label="GASTOS"
                value={formatAmount(expense, "USD")}
                sub="Este mes"
                valueColor={colors.expense}
                bg={colors.surface}
                border={colors.border}
              />
              <MetricCard
                emoji="🤝"
                label="PRÉSTAMOS"
                value={formatAmount(loanTotal, "USD")}
                sub={`${pending.filter((t) => t.category_type === "loan_given").length} pendientes`}
                valueColor={colors.loan}
                bg={colors.surface}
                border={colors.border}
              />
              <MetricCard
                emoji="💳"
                label="DEUDAS"
                value={formatAmount(debtTotal, "USD")}
                sub={`${pending.filter((t) => t.category_type === "debt").length} pendientes`}
                valueColor={colors.debt}
                bg={colors.surface}
                border={colors.border}
              />
            </View>

            {/* Trend chart — barras simples */}
            {trend.length > 0 && (
              <View
                style={[
                  styles.chartCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={styles.chartHeader}>
                  <Text style={[styles.chartTitle, { color: colors.text }]}>
                    Tendencia 6 meses
                  </Text>
                  <Text style={[styles.chartSub, { color: colors.muted }]}>
                    Balance mensual
                  </Text>
                </View>
                <MiniBarChart
                  trend={trend}
                  accent={colors.accent}
                  accentSoft={colors.accentSoft}
                  muted={colors.muted}
                />
              </View>
            )}

            {/* Pendientes */}
            {pending.length > 0 && (
              <>
                <View style={styles.sectionRow}>
                  <Text
                    style={[
                      styles.sectionTitle,
                      { color: colors.textSecondary },
                    ]}
                  >
                    ⏳ Pendientes
                  </Text>
                  <TouchableOpacity
                    onPress={() =>
                      navigation.navigate("Transactions", { filter: "pending" })
                    }
                  >
                    <Text style={[styles.seeAll, { color: colors.accent }]}>
                      Ver todo
                    </Text>
                  </TouchableOpacity>
                </View>
                <View
                  style={[
                    styles.pendingCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  {pending.map((tx, idx) => (
                    <TouchableOpacity
                      key={tx.id}
                      style={[
                        styles.pendingItem,
                        idx < pending.length - 1 && {
                          borderBottomWidth: 1,
                          borderBottomColor: colors.border,
                        },
                      ]}
                      onPress={() =>
                        navigation.navigate("TransactionDetail", { id: tx.id })
                      }
                      activeOpacity={0.8}
                    >
                      <View
                        style={[
                          styles.pendingAvatar,
                          {
                            backgroundColor:
                              tx.category_type === "debt"
                                ? colors.debtSoft
                                : colors.loanSoft,
                          },
                        ]}
                      >
                        <Text style={{ fontSize: rf(18) }}>
                          {tx.category_type === "debt" ? "💳" : "🤝"}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[styles.pendingName, { color: colors.text }]}
                          numberOfLines={1}
                        >
                          {tx.counterpart_name ||
                            tx.description ||
                            tx.category_name}
                        </Text>
                        <Text
                          style={[styles.pendingDate, { color: colors.muted }]}
                        >
                          {tx.category_type === "debt" ? "Deuda" : "Préstamo"} ·{" "}
                          {formatShortDate(tx.date)}
                        </Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text
                          style={[
                            styles.pendingAmount,
                            {
                              color:
                                tx.category_type === "debt"
                                  ? colors.debt
                                  : colors.loan,
                            },
                          ]}
                        >
                          {formatAmount(
                            parseFloat(tx.amount_usd) -
                              parseFloat(tx.paid_usd || 0),
                            "USD",
                          )}
                        </Text>
                        <View
                          style={[
                            styles.pendingPill,
                            { backgroundColor: colors.warningSoft },
                          ]}
                        >
                          <Text
                            style={[
                              styles.pendingPillText,
                              { color: colors.warning },
                            ]}
                          >
                            Pendiente
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* Empty */}
            {!summary?.by_type?.income && !summary?.by_type?.expense && (
              <EmptyState
                icon="wallet-outline"
                title="Sin movimientos este mes"
                message="Registra tu primer ingreso o gasto para empezar"
                action={() => navigation.navigate("AddTransaction")}
                actionLabel="Registrar movimiento"
              />
            )}
          </>
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.accent }]}
        onPress={() => navigation.navigate("AddTransaction")}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={s(26)} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────
function MetricCard({ emoji, label, value, sub, valueColor, bg, border }) {
  return (
    <View
      style={[styles.metricCard, { backgroundColor: bg, borderColor: border }]}
    >
      <Text style={styles.metricEmoji}>{emoji}</Text>
      <Text style={[styles.metricLabel, { color: "#9CA3AF" }]}>{label}</Text>
      <Text style={[styles.metricValue, { color: valueColor }]}>{value}</Text>
      <Text style={[styles.metricSub, { color: "#9CA3AF" }]}>{sub}</Text>
    </View>
  );
}

function MiniBarChart({ trend, accent, accentSoft, muted }) {
  const months = {};
  for (const r of trend) {
    const key = `${r.year}-${String(r.month).padStart(2, "0")}`;
    if (!months[key])
      months[key] = { income: 0, expense: 0, label: getMonthLabel(r.month) };
    if (r.type === "income") months[key].income += parseFloat(r.total_usd || 0);
    if (r.type === "expense")
      months[key].expense += parseFloat(r.total_usd || 0);
  }
  const sorted = Object.entries(months)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-6);
  const maxVal = Math.max(
    ...sorted.map(([, m]) => Math.max(m.income - m.expense, 0)),
    1,
  );

  return (
    <View style={styles.chartBars}>
      {sorted.map(([key, m], i) => {
        const val = Math.max(m.income - m.expense, 0);
        const heightPct = val / maxVal;
        const isLast = i === sorted.length - 1;
        return (
          <View key={key} style={styles.chartCol}>
            <View style={styles.chartBarWrap}>
              <View
                style={[
                  styles.chartBar,
                  {
                    height: Math.max(heightPct * s(56), s(4)),
                    backgroundColor: isLast ? accent : accentSoft,
                  },
                ]}
              />
            </View>
            <Text
              style={[
                styles.chartBarLabel,
                {
                  color: isLast ? accent : muted,
                  fontWeight: isLast ? "800" : "600",
                },
              ]}
            >
              {m.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function BalanceStat({ label, amount, color, icon }) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Ionicons name={icon} size={s(16)} color={color} />
      <Text
        style={{ color, fontSize: rf(16), fontWeight: "700", marginTop: s(2) }}
      >
        {formatAmount(amount, "USD")}
      </Text>
      <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: rf(11) }}>
        {label}
      </Text>
    </View>
  );
}

function RateChip({ label, value, colors }) {
  return (
    <View
      style={[
        styles.rateChip,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.rateChipLabel, { color: colors.muted }]}>
        {label}
      </Text>
      <Text style={[styles.rateChipValue, { color: colors.text }]}>
        {value}
      </Text>
    </View>
  );
}

function buildChartData(trend) {
  if (!trend.length) return { labels: [], datasets: [{ data: [] }] };
  const months = {};
  for (const r of trend) {
    const key = `${r.year}-${r.month}`;
    if (!months[key])
      months[key] = { income: 0, expense: 0, label: getMonthLabel(r.month) };
    if (r.type === "income") months[key].income += parseFloat(r.total_usd || 0);
    if (r.type === "expense")
      months[key].expense += parseFloat(r.total_usd || 0);
  }
  const sorted = Object.values(months).slice(-6);
  return {
    labels: sorted.map((m) => m.label),
    datasets: [{ data: sorted.map((m) => Math.max(m.income - m.expense, 0)) }],
  };
}

function getMonthLabel(month) {
  return (
    [
      "Ene",
      "Feb",
      "Mar",
      "Abr",
      "May",
      "Jun",
      "Jul",
      "Ago",
      "Sep",
      "Oct",
      "Nov",
      "Dic",
    ][month - 1] || ""
  );
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

  // greeting
  greeting: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  greetName: { fontSize: rf(22), fontWeight: "800", letterSpacing: -0.5 },
  greetSub: { fontSize: rf(13), marginTop: s(2) },
  avatarCircle: {
    width: s(42),
    height: s(42),
    borderRadius: s(13),
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: { color: "#fff", fontSize: rf(18), fontWeight: "700" },

  // warning
  warningBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: s(6),
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  warningText: { fontSize: rf(12), flex: 1, fontWeight: "600" },

  // balance card
  balanceCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    marginBottom: spacing.md,
  },
  balanceLabel: {
    color: "rgba(255,255,255,0.75)",
    fontSize: rf(11),
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: s(6),
  },
  balanceAmount: {
    color: "#fff",
    fontSize: rf(34),
    fontWeight: "900",
    letterSpacing: -1.5,
  },
  balanceSubRow: {
    flexDirection: "row",
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.2)",
  },
  balanceSubItem: { flex: 1 },
  balanceSubLabel: {
    color: "rgba(255,255,255,0.65)",
    fontSize: rf(10),
    fontWeight: "700",
    letterSpacing: 0.3,
    marginBottom: s(2),
  },
  balanceSubVal: { color: "#fff", fontSize: rf(14), fontWeight: "700" },
  balanceSubDivider: {
    width: 1,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginHorizontal: spacing.md,
  },

  // metric grid
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  metricCard: {
    width: "47.5%",
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  metricEmoji: { fontSize: rf(20), marginBottom: s(8) },
  metricLabel: {
    fontSize: rf(11),
    fontWeight: "600",
    letterSpacing: 0.3,
    marginBottom: s(3),
  },
  metricValue: { fontSize: rf(17), fontWeight: "800" },
  metricSub: { fontSize: rf(10), marginTop: s(1) },

  // chart
  chartCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  chartHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  chartTitle: { fontSize: rf(14), fontWeight: "700" },
  chartSub: { fontSize: rf(11) },
  chartBars: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: s(72),
    gap: s(6),
  },
  chartCol: { flex: 1, alignItems: "center", gap: s(4) },
  chartBarWrap: { flex: 1, justifyContent: "flex-end", width: "100%" },
  chartBar: { width: "100%", borderRadius: s(3) },
  chartBarLabel: { fontSize: rf(9) },

  // pending
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  sectionTitle: {
    fontSize: rf(13),
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  seeAll: { fontSize: rf(13), fontWeight: "600" },
  pendingCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  pendingItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  pendingAvatar: {
    width: s(38),
    height: s(38),
    borderRadius: s(12),
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  pendingName: { fontSize: rf(14), fontWeight: "600" },
  pendingDate: { fontSize: rf(11), marginTop: s(2) },
  pendingAmount: { fontSize: rf(14), fontWeight: "700" },
  pendingPill: {
    borderRadius: s(10),
    paddingHorizontal: s(8),
    paddingVertical: s(2),
    marginTop: s(3),
  },
  pendingPillText: { fontSize: rf(10), fontWeight: "700" },

  // rate chips (legacy, kept for safety)
  rateRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  rateChip: {
    flex: 1,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing.sm,
    alignItems: "center",
  },
  rateChipLabel: { fontSize: rf(11) },
  rateChipValue: { fontSize: rf(15), fontWeight: "700", marginTop: s(2) },

  // fab
  fab: {
    position: "absolute",
    bottom: s(24),
    right: spacing.xl,
    width: s(52),
    height: s(52),
    borderRadius: s(16),
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: "#4361EE",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
});
