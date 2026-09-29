import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../contexts/AuthContext";
import { getTransactions } from "../../services/api/transactionService";
import {
  Card,
  EmptyState,
  TypeBadge,
  PillBadge,
} from "../../components/common/AppUI";
import { formatAmount } from "../../utils/currency";
import { rf, s, spacing, borderRadius } from "../../utils/responsive";

const TYPES = [
  { key: null, label: "Todos" },
  { key: "income", label: "Ingresos" },
  { key: "expense", label: "Gastos" },
  { key: "loan_given", label: "Préstamos" },
  { key: "debt", label: "Deudas" },
];

export default function TransactionsScreen({ navigation }) {
  const { colors } = useTheme();
  const { token } = useAuth();
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [typeFilter, setTypeFilter] = useState(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const limit = 30;

  const load = useCallback(
    async (reset = false) => {
      const offset = reset ? 0 : page * limit;
      try {
        const res = await getTransactions(token, {
          type: typeFilter || undefined,
          limit,
          offset,
        });
        if (reset) {
          setData(res.data || []);
          setPage(0);
        } else {
          setData((prev) => [...prev, ...(res.data || [])]);
        }
        setTotal(res.total || 0);
      } catch {}
    },
    [token, typeFilter, page],
  );

  useEffect(() => {
    setLoading(true);
    load(true).finally(() => setLoading(false));
  }, [typeFilter]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  };

  const loadMore = () => {
    if (data.length < total) {
      setPage((p) => p + 1);
      load(false);
    }
  };

  // Group by date
  const filtered = search
    ? data.filter(
        (tx) =>
          (tx.description || "").toLowerCase().includes(search.toLowerCase()) ||
          (tx.counterpart_name || "")
            .toLowerCase()
            .includes(search.toLowerCase()) ||
          (tx.category_name || "").toLowerCase().includes(search.toLowerCase()),
      )
    : data;

  const grouped = groupByDate(filtered);
  const totalIncome = data.filter(t => t.category_type === "income").reduce((a, t) => a + parseFloat(t.amount_usd || 0), 0);
  const totalExpense = data.filter(t => t.category_type === "expense").reduce((a, t) => a + parseFloat(t.amount_usd || 0), 0);
  const balance = totalIncome - totalExpense;

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      {/* Header */}
      <View style={[styles.topHeader, { backgroundColor: colors.page }]}>
        <Text style={[styles.topHeaderTitle, { color: colors.text }]}>Historial de movimientos</Text>
      </View>

      {/* Search */}
      <View style={[styles.searchRow, { backgroundColor: colors.page }]}>
        <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={s(16)} color={colors.muted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Buscar por ítem, categoría o persona"
            placeholderTextColor={colors.muted}
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={s(16)} color={colors.muted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Currency / type filter tabs */}
      <View style={[styles.filterRow, { backgroundColor: colors.page }]}>
        {TYPES.map((t) => (
          <TouchableOpacity
            key={String(t.key)}
            style={[
              styles.filterChip,
              { borderColor: typeFilter === t.key ? colors.accent : colors.border },
              typeFilter === t.key && { backgroundColor: colors.accent },
              typeFilter !== t.key && { backgroundColor: colors.surface },
            ]}
            onPress={() => setTypeFilter(t.key)}
          >
            <Text style={[styles.filterChipText, { color: typeFilter === t.key ? "#fff" : colors.textSecondary }]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Balance del historial */}
      <View style={[styles.balanceSummary, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View>
          <Text style={[styles.balanceSummaryLabel, { color: colors.muted }]}>Balance del historial</Text>
          <Text style={[styles.balanceSummaryAmt, { color: colors.text }]}>{formatAmount(balance, "USD")}</Text>
        </View>
        <View style={styles.balanceSummaryStats}>
          <View style={styles.balanceStat}>
            <Text style={[styles.balanceStatLabel, { color: colors.muted }]}>Movimientos</Text>
            <Text style={[styles.balanceStatVal, { color: colors.text }]}>{data.length}</Text>
          </View>
          <View style={styles.balanceStat}>
            <Text style={[styles.balanceStatLabel, { color: colors.muted }]}>Ingresos</Text>
            <Text style={[styles.balanceStatVal, { color: colors.income }]}>{formatAmount(totalIncome, "USD")}</Text>
          </View>
          <View style={styles.balanceStat}>
            <Text style={[styles.balanceStatLabel, { color: colors.muted }]}>Gastos</Text>
            <Text style={[styles.balanceStatVal, { color: colors.expense }]}>{formatAmount(totalExpense, "USD")}</Text>
          </View>
        </View>
      </View>

      <FlatList
        data={grouped}
        keyExtractor={(item, i) => item.date || String(i)}
        renderItem={({ item }) => (
          <View>
            <Text style={[styles.dateHeader, { color: colors.muted }]}>
              {formatDate(item.date)}
            </Text>
            {item.transactions.map((tx) => (
              <TransactionItem
                key={tx.id}
                tx={tx}
                colors={colors}
                navigation={navigation}
              />
            ))}
          </View>
        )}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="wallet-outline"
              title="Sin movimientos"
              message={
                typeFilter
                  ? "No hay movimientos de este tipo"
                  : "Registra tu primer movimiento"
              }
              action={() => navigation.navigate("AddTransaction")}
              actionLabel="Agregar"
            />
          ) : null
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

function TransactionItem({ tx, colors, navigation }) {
  const isNegative =
    tx.category_type === "expense" || tx.category_type === "debt";
  const amountColor = isNegative ? colors.expense : colors.income;
  const sign = isNegative ? "-" : "+";
  const icon = tx.category_icon || "ellipse";

  return (
    <TouchableOpacity
      style={[
        styles.txCard,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
      onPress={() => navigation.navigate("TransactionDetail", { id: tx.id })}
      activeOpacity={0.85}
    >
      <View
        style={[
          styles.txIcon,
          { backgroundColor: tx.category_color + "22" || colors.accentSoft },
        ]}
      >
        <Ionicons
          name={icon}
          size={s(20)}
          color={tx.category_color || colors.accent}
        />
      </View>
      <View style={styles.txMid}>
        <Text style={[styles.txName, { color: colors.text }]} numberOfLines={1}>
          {tx.counterpart_name ||
            tx.description ||
            tx.category_name ||
            "Movimiento"}
        </Text>
        <View style={styles.txMeta}>
          <TypeBadge type={tx.category_type} />
          {tx.status === "paid" && (
            <PillBadge
              label="Pagado"
              bg={colors.successSoft}
              color={colors.success}
              style={{ marginLeft: s(4) }}
            />
          )}
        </View>
      </View>
      <View style={styles.txRight}>
        <Text style={[styles.txAmount, { color: amountColor }]}>
          {sign}
          {formatAmount(tx.amount_usd, "USD")}
        </Text>
        <Text style={[styles.txSub, { color: colors.muted }]}>
          {formatAmount(tx.amount_ves, "VES")}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function groupByDate(transactions) {
  const map = {};
  for (const tx of transactions) {
    const d = tx.date?.slice(0, 10) || "";
    if (!map[d]) map[d] = { date: d, transactions: [] };
    map[d].transactions.push(tx);
  }
  return Object.values(map).sort((a, b) => (b.date > a.date ? 1 : -1));
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Hoy";
  if (d.toDateString() === yesterday.toDateString()) return "Ayer";
  return d.toLocaleDateString("es", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

const styles = StyleSheet.create({
  topHeader: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  topHeaderTitle: { fontSize: rf(20), fontWeight: "800" },
  searchRow: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  searchBox: { flexDirection: "row", alignItems: "center", borderRadius: s(10), borderWidth: 1, paddingHorizontal: spacing.sm, gap: s(6), height: s(42) },
  searchInput: { flex: 1, fontSize: rf(14) },
  filterRow: { flexDirection: "row", paddingHorizontal: spacing.lg, gap: s(8), marginBottom: spacing.sm },
  filterChip: { paddingHorizontal: spacing.sm, paddingVertical: s(6), borderRadius: s(8), borderWidth: 1 },
  filterChipText: { fontSize: rf(12), fontWeight: "600" },
  balanceSummary: { marginHorizontal: spacing.lg, borderRadius: s(12), borderWidth: 1, padding: spacing.md, marginBottom: spacing.sm },
  balanceSummaryLabel: { fontSize: rf(11), fontWeight: "500" },
  balanceSummaryAmt: { fontSize: rf(20), fontWeight: "800", letterSpacing: -0.5, marginTop: s(2) },
  balanceSummaryStats: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm },
  balanceStat: {},
  balanceStatLabel: { fontSize: rf(10), fontWeight: "500" },
  balanceStatVal: { fontSize: rf(13), fontWeight: "700" },
  list: { padding: spacing.lg, paddingBottom: s(100) },
  dateHeader: { fontSize: rf(12), fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, marginTop: spacing.md, marginBottom: spacing.xs },
  txCard: { flexDirection: "row", alignItems: "center", borderRadius: s(12), borderWidth: 1, padding: spacing.md, marginBottom: s(6), gap: spacing.sm },
  txIcon: { width: s(38), height: s(38), borderRadius: s(10), alignItems: "center", justifyContent: "center" },
  txMid: { flex: 1 },
  txName: { fontSize: rf(14), fontWeight: "600", marginBottom: s(3) },
  txMeta: { flexDirection: "row", alignItems: "center" },
  txRight: { alignItems: "flex-end" },
  txAmount: { fontSize: rf(14), fontWeight: "700" },
  txSub: { fontSize: rf(11), marginTop: s(2) },
  fab: { position: "absolute", bottom: s(24), right: spacing.xl, width: s(52), height: s(52), borderRadius: s(16), alignItems: "center", justifyContent: "center", elevation: 6, shadowColor: "#1B4332", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 },
});
