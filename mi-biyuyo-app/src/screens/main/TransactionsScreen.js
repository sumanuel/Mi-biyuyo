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

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      {/* Search */}
      <View
        style={[
          styles.searchRow,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        <View
          style={[
            styles.searchBox,
            { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
          ]}
        >
          <Ionicons name="search-outline" size={s(16)} color={colors.muted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Buscar..."
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

      {/* Type filters */}
      <View
        style={[
          styles.filterRow,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        {TYPES.map((t) => (
          <TouchableOpacity
            key={String(t.key)}
            style={[
              styles.filterChip,
              typeFilter === t.key && { backgroundColor: colors.accent },
              typeFilter !== t.key && { backgroundColor: colors.surfaceAlt },
            ]}
            onPress={() => setTypeFilter(t.key)}
          >
            <Text
              style={[
                styles.filterChipText,
                { color: typeFilter === t.key ? "#fff" : colors.muted },
              ]}
            >
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
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

function TransactionItem({ tx, colors, navigation }) {
  const isNegative =
    tx.category_type === "expense" || tx.category_type === "debt";
  const amountColor = isNegative ? colors.expense : colors.income;
  const sign = isNegative ? "−" : "+";
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
  searchRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: borderRadius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    gap: s(6),
    height: s(40),
  },
  searchInput: { flex: 1, fontSize: rf(14) },
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    gap: s(6),
    borderBottomWidth: 1,
  },
  filterChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: s(5),
    borderRadius: borderRadius.lg,
  },
  filterChipText: { fontSize: rf(12), fontWeight: "600" },
  list: { padding: spacing.md, paddingBottom: s(100) },
  dateHeader: {
    fontSize: rf(12),
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  txCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: s(6),
    gap: spacing.sm,
  },
  txIcon: {
    width: s(42),
    height: s(42),
    borderRadius: s(21),
    alignItems: "center",
    justifyContent: "center",
  },
  txMid: { flex: 1 },
  txName: { fontSize: rf(14), fontWeight: "600", marginBottom: s(4) },
  txMeta: { flexDirection: "row", alignItems: "center" },
  txRight: { alignItems: "flex-end" },
  txAmount: { fontSize: rf(15), fontWeight: "700" },
  txSub: { fontSize: rf(11), marginTop: s(2) },
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
