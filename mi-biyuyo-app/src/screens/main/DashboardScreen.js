import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BarChart } from "react-native-chart-kit";
import { Dimensions } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../contexts/AuthContext";
import { useExchangeRate } from "../../contexts/ExchangeRateContext";
import { getSummary, getTrend } from "../../services/api/statsService";
import { getTransactions } from "../../services/api/transactionService";
import {
  Card,
  SectionHeader,
  EmptyState,
  TypeBadge,
} from "../../components/common/AppUI";
import { formatAmount } from "../../utils/currency";
import { rf, s, ms, spacing, borderRadius } from "../../utils/responsive";

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
  const balance = income - expense;

  const greet = getGreeting();

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
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.greet, { color: colors.muted }]}>{greet}</Text>
            <Text style={[styles.userName, { color: colors.text }]}>
              {user?.name?.split(" ")[0] || "Bienvenido"}
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
              styles.rateBanner,
              {
                backgroundColor: colors.warningSoft,
                borderColor: colors.warning,
              },
            ]}
            onPress={() => navigation.navigate("ExchangeRate")}
          >
            <Ionicons
              name="warning-outline"
              size={s(16)}
              color={colors.warning}
            />
            <Text style={[styles.rateBannerText, { color: colors.warning }]}>
              Configura las tasas de cambio para ver montos correctos
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
            {/* Balance Card */}
            <Card
              style={[styles.balanceCard, { backgroundColor: colors.accent }]}
            >
              <Text style={styles.balanceLabel}>Balance del mes</Text>
              <Text style={styles.balanceAmount}>
                {formatAmount(balance, "USD")}
              </Text>
              <View style={styles.balanceRow}>
                <BalanceStat
                  label="Ingresos"
                  amount={income}
                  color="#4ADE80"
                  icon="trending-up"
                />
                <View
                  style={[
                    styles.balanceDivider,
                    { backgroundColor: "rgba(255,255,255,0.2)" },
                  ]}
                />
                <BalanceStat
                  label="Gastos"
                  amount={expense}
                  color="#FCA5A5"
                  icon="trending-down"
                />
              </View>
              <Text style={styles.balancePeriod}>
                {new Date(year, month - 1).toLocaleString("es", {
                  month: "long",
                  year: "numeric",
                })}
              </Text>
            </Card>

            {/* VES / Binance equivalent */}
            <View style={styles.rateRow}>
              <RateChip
                label="En Bs."
                value={formatAmount(balance * (rates.usd_to_ves || 0), "VES")}
                colors={colors}
              />
              <RateChip
                label="En USDT"
                value={formatAmount(
                  balance *
                    ((rates.usd_to_ves || 0) / (rates.binance_to_ves || 1)),
                  "BINANCE",
                )}
                colors={colors}
              />
            </View>

            {/* Trend Chart */}
            {chartData.labels.length > 0 && (
              <>
                <SectionHeader title="Últimos 6 meses" style={styles.section} />
                <Card style={styles.chartCard}>
                  <BarChart
                    data={chartData}
                    width={SCREEN_W - spacing.xl * 2 - spacing.md * 2 - 2}
                    height={s(160)}
                    yAxisLabel="$"
                    chartConfig={{
                      backgroundColor: colors.surface,
                      backgroundGradientFrom: colors.surface,
                      backgroundGradientTo: colors.surface,
                      decimalPlaces: 0,
                      color: (opacity = 1) => `rgba(67,97,238,${opacity})`,
                      labelColor: () => colors.muted,
                      style: { borderRadius: borderRadius.md },
                    }}
                    style={{ borderRadius: borderRadius.md }}
                    showValuesOnTopOfBars={false}
                    withInnerLines={false}
                  />
                </Card>
              </>
            )}

            {/* Pending loans/debts */}
            {pending.length > 0 && (
              <>
                <SectionHeader
                  title="Pendientes"
                  style={styles.section}
                  right={
                    <TouchableOpacity
                      onPress={() =>
                        navigation.navigate("Transactions", {
                          filter: "pending",
                        })
                      }
                    >
                      <Text style={[styles.seeAll, { color: colors.accent }]}>
                        Ver todo
                      </Text>
                    </TouchableOpacity>
                  }
                />
                {pending.map((tx) => (
                  <Card
                    key={tx.id}
                    onPress={() =>
                      navigation.navigate("TransactionDetail", { id: tx.id })
                    }
                  >
                    <View style={styles.txRow}>
                      <View
                        style={[
                          styles.txIcon,
                          { backgroundColor: colors.accentSoft },
                        ]}
                      >
                        <Ionicons
                          name={tx.category_icon || "cash"}
                          size={s(20)}
                          color={colors.accent}
                        />
                      </View>
                      <View style={styles.txInfo}>
                        <Text
                          style={[styles.txName, { color: colors.text }]}
                          numberOfLines={1}
                        >
                          {tx.counterpart_name ||
                            tx.description ||
                            tx.category_name}
                        </Text>
                        <TypeBadge type={tx.category_type} />
                      </View>
                      <View style={styles.txAmounts}>
                        <Text
                          style={[styles.txAmountMain, { color: colors.text }]}
                        >
                          {formatAmount(tx.amount_usd - tx.paid_usd, "USD")}
                        </Text>
                        <Text
                          style={[styles.txAmountSub, { color: colors.muted }]}
                        >
                          pendiente
                        </Text>
                      </View>
                    </View>
                  </Card>
                ))}
              </>
            )}

            {/* Empty state */}
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

// ─── Helpers ─────────────────────────────────────────────────────────────────
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
  if (h < 12) return "Buenos días,";
  if (h < 18) return "Buenas tardes,";
  return "Buenas noches,";
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.xl, paddingBottom: s(100) },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  greet: { fontSize: rf(13) },
  userName: { fontSize: rf(22), fontWeight: "800" },
  avatarCircle: {
    width: s(40),
    height: s(40),
    borderRadius: s(20),
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: { color: "#fff", fontSize: rf(18), fontWeight: "700" },
  rateBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: s(6),
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  rateBannerText: { fontSize: rf(12), flex: 1 },
  balanceCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    marginBottom: spacing.sm,
    borderWidth: 0,
  },
  balanceLabel: {
    color: "rgba(255,255,255,0.75)",
    fontSize: rf(13),
    marginBottom: s(4),
  },
  balanceAmount: {
    color: "#fff",
    fontSize: rf(34),
    fontWeight: "800",
    letterSpacing: -1,
  },
  balanceRow: { flexDirection: "row", marginTop: spacing.md },
  balanceDivider: { width: 1, marginHorizontal: spacing.md },
  balancePeriod: {
    color: "rgba(255,255,255,0.55)",
    fontSize: rf(12),
    marginTop: spacing.sm,
    textTransform: "capitalize",
  },
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
  section: { marginTop: spacing.md },
  chartCard: { padding: spacing.sm, marginBottom: spacing.md },
  seeAll: { fontSize: rf(13), fontWeight: "600" },
  txRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  txIcon: {
    width: s(40),
    height: s(40),
    borderRadius: s(20),
    alignItems: "center",
    justifyContent: "center",
  },
  txInfo: { flex: 1 },
  txName: { fontSize: rf(14), fontWeight: "600", marginBottom: s(3) },
  txAmounts: { alignItems: "flex-end" },
  txAmountMain: { fontSize: rf(15), fontWeight: "700" },
  txAmountSub: { fontSize: rf(11) },
  fab: {
    position: "absolute",
    bottom: s(24),
    right: spacing.xl,
    width: s(56),
    height: s(56),
    borderRadius: s(28),
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: "#4361EE",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
});
