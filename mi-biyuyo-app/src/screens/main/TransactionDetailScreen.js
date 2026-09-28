import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  TextInput,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../contexts/AuthContext";
import { useExchangeRate } from "../../contexts/ExchangeRateContext";
import {
  getTransaction,
  deleteTransaction,
  getPayments,
  createPayment,
  deletePayment,
} from "../../services/api/transactionService";
import {
  Card,
  ScreenHeader,
  TypeBadge,
  PillBadge,
  ActionButton,
  Divider,
} from "../../components/common/AppUI";
import {
  formatAmount,
  CURRENCIES,
  CURRENCY_LABELS,
} from "../../utils/currency";
import { rf, s, spacing, borderRadius } from "../../utils/responsive";

export default function TransactionDetailScreen({ navigation, route }) {
  const { id } = route.params;
  const { colors } = useTheme();
  const { token } = useAuth();
  const { convert } = useExchangeRate();
  const [tx, setTx] = useState(null);
  const [payments, setPayments] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payCurrency, setPayCurrency] = useState("USD");
  const [payNotes, setPayNotes] = useState("");
  const [payLoading, setPayLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const [t, p] = await Promise.all([
        getTransaction(token, id),
        getPayments(token, id),
      ]);
      setTx(t);
      setPayments(p || []);
    } catch {}
  }, [token, id]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleDelete = () => {
    Alert.alert(
      "Eliminar movimiento",
      "¿Estás seguro? Esta acción no se puede deshacer.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteTransaction(token, id);
              navigation.goBack();
            } catch {
              Alert.alert("Error", "No se pudo eliminar");
            }
          },
        },
      ],
    );
  };

  const handleAddPayment = async () => {
    if (!payAmount || parseFloat(payAmount) <= 0) {
      Alert.alert("Error", "Ingresa un monto válido");
      return;
    }
    setPayLoading(true);
    try {
      await createPayment(token, id, {
        amount: parseFloat(payAmount),
        currency: payCurrency,
        date: new Date().toISOString().slice(0, 10),
        notes: payNotes || undefined,
      });
      setShowPayModal(false);
      setPayAmount("");
      setPayNotes("");
      await load();
    } catch (e) {
      Alert.alert(
        "Error",
        e?.response?.data?.error || "No se pudo registrar el abono",
      );
    } finally {
      setPayLoading(false);
    }
  };

  const handleDeletePayment = (payId) => {
    Alert.alert("Eliminar abono", "¿Seguro que deseas eliminar este abono?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            await deletePayment(token, id, payId);
            await load();
          } catch {
            Alert.alert("Error", "No se pudo eliminar el abono");
          }
        },
      },
    ]);
  };

  if (!tx) return <View style={{ flex: 1, backgroundColor: colors.page }} />;

  const paidUsd = parseFloat(tx.paid_usd || 0);
  const remainingUsd = parseFloat(tx.amount_usd || 0) - paidUsd;
  const progress =
    tx.amount_usd > 0 ? Math.min(paidUsd / parseFloat(tx.amount_usd), 1) : 0;
  const isLoanOrDebt =
    tx.category_type === "loan_given" || tx.category_type === "debt";

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <ScreenHeader
        title="Detalle"
        onBack={() => navigation.goBack()}
        right={
          <TouchableOpacity
            onPress={handleDelete}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="trash-outline" size={s(20)} color={colors.danger} />
          </TouchableOpacity>
        }
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
      >
        {/* Main card */}
        <Card
          style={[
            styles.mainCard,
            { borderColor: tx.category_color + "44" || colors.border },
          ]}
        >
          <View style={styles.mainTop}>
            <View
              style={[
                styles.mainIcon,
                {
                  backgroundColor:
                    tx.category_color + "22" || colors.accentSoft,
                },
              ]}
            >
              <Ionicons
                name={tx.category_icon || "cash"}
                size={s(28)}
                color={tx.category_color || colors.accent}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.mainName, { color: colors.text }]}>
                {tx.counterpart_name || tx.description || tx.category_name}
              </Text>
              <View style={styles.badgeRow}>
                <TypeBadge type={tx.category_type} />
                {tx.status === "paid" && (
                  <PillBadge
                    label="Pagado"
                    bg={colors.successSoft}
                    color={colors.success}
                    style={{ marginLeft: s(6) }}
                  />
                )}
                {tx.status === "cancelled" && (
                  <PillBadge
                    label="Cancelado"
                    bg={colors.dangerSoft}
                    color={colors.danger}
                    style={{ marginLeft: s(6) }}
                  />
                )}
              </View>
            </View>
          </View>

          <Divider />

          {/* 3-currency display */}
          <View style={styles.amountsGrid}>
            <AmountBlock
              label="USD"
              value={formatAmount(tx.amount_usd, "USD")}
              color={colors.accent}
              colors={colors}
            />
            <AmountBlock
              label="VES"
              value={formatAmount(tx.amount_ves, "VES")}
              color={colors.income}
              colors={colors}
            />
            <AmountBlock
              label="Binance"
              value={formatAmount(tx.amount_binance, "BINANCE")}
              color={colors.warning}
              colors={colors}
            />
          </View>

          {tx.date && (
            <Text style={[styles.dateText, { color: colors.muted }]}>
              <Ionicons name="calendar-outline" size={s(13)} />{" "}
              {new Date(tx.date + "T00:00:00").toLocaleDateString("es", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </Text>
          )}
          {tx.notes && (
            <Text style={[styles.notes, { color: colors.textSecondary }]}>
              {tx.notes}
            </Text>
          )}
        </Card>

        {/* Progress bar for loans/debts */}
        {isLoanOrDebt && (
          <Card>
            <View style={styles.progressHeader}>
              <Text style={[styles.progressLabel, { color: colors.text }]}>
                {tx.category_type === "loan_given"
                  ? "Abonos recibidos"
                  : "Pagos realizados"}
              </Text>
              <Text style={[styles.progressPct, { color: colors.accent }]}>
                {Math.round(progress * 100)}%
              </Text>
            </View>
            <View
              style={[
                styles.progressTrack,
                { backgroundColor: colors.borderLight },
              ]}
            >
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${progress * 100}%`,
                    backgroundColor:
                      progress >= 1 ? colors.success : colors.accent,
                  },
                ]}
              />
            </View>
            <View style={styles.progressAmounts}>
              <Text style={[styles.progressSub, { color: colors.muted }]}>
                Pagado: {formatAmount(paidUsd, "USD")}
              </Text>
              <Text
                style={[
                  styles.progressSub,
                  { color: remainingUsd > 0 ? colors.danger : colors.success },
                ]}
              >
                {remainingUsd > 0
                  ? `Pendiente: ${formatAmount(remainingUsd, "USD")}`
                  : "¡Completado!"}
              </Text>
            </View>
          </Card>
        )}

        {/* Payments history */}
        {isLoanOrDebt && (
          <>
            <View style={styles.sectionRow}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Historial de abonos
              </Text>
              {tx.status !== "paid" && tx.status !== "cancelled" && (
                <TouchableOpacity
                  style={[
                    styles.addPayBtn,
                    { backgroundColor: colors.accentSoft },
                  ]}
                  onPress={() => setShowPayModal(true)}
                >
                  <Ionicons name="add" size={s(16)} color={colors.accent} />
                  <Text style={[styles.addPayText, { color: colors.accent }]}>
                    Agregar abono
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {payments.length === 0 ? (
              <Text style={[styles.noPayments, { color: colors.muted }]}>
                Sin abonos registrados
              </Text>
            ) : (
              payments.map((p) => (
                <View
                  key={p.id}
                  style={[
                    styles.paymentItem,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[styles.paymentAmount, { color: colors.income }]}
                    >
                      {formatAmount(p.amount_usd, "USD")}
                    </Text>
                    <Text style={[styles.paymentMeta, { color: colors.muted }]}>
                      {p.date?.slice(0, 10)} ·{" "}
                      {formatAmount(p.amount_ves, "VES")}
                    </Text>
                    {p.notes && (
                      <Text
                        style={[
                          styles.paymentNotes,
                          { color: colors.textSecondary },
                        ]}
                      >
                        {p.notes}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={() => handleDeletePayment(p.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={s(18)}
                      color={colors.muted}
                    />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </>
        )}

        {/* Edit button */}
        {tx.status !== "cancelled" && (
          <ActionButton
            label="Editar movimiento"
            variant="outline"
            icon="create-outline"
            onPress={() =>
              navigation.navigate("AddTransaction", { editId: id })
            }
            style={styles.editBtn}
          />
        )}
      </ScrollView>

      {/* Add payment modal */}
      <Modal visible={showPayModal} transparent animationType="slide">
        <TouchableOpacity
          style={styles.modalOverlay}
          onPress={() => setShowPayModal(false)}
        />
        <View style={[styles.bottomSheet, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sheetTitle, { color: colors.text }]}>
            Registrar abono
          </Text>
          <View style={styles.amountInputRow}>
            <TouchableOpacity
              style={[
                styles.currBtn,
                {
                  backgroundColor: colors.accentSoft,
                  borderColor: colors.border,
                },
              ]}
              onPress={() =>
                setPayCurrency(
                  CURRENCIES[
                    (CURRENCIES.indexOf(payCurrency) + 1) % CURRENCIES.length
                  ],
                )
              }
            >
              <Text style={[styles.currText, { color: colors.accent }]}>
                {payCurrency}
              </Text>
            </TouchableOpacity>
            <TextInput
              style={[
                styles.payInput,
                {
                  backgroundColor: colors.surfaceAlt,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              value={payAmount}
              onChangeText={setPayAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={colors.muted}
              autoFocus
            />
          </View>
          <TextInput
            style={[
              styles.payNotesInput,
              {
                backgroundColor: colors.surfaceAlt,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            value={payNotes}
            onChangeText={setPayNotes}
            placeholder="Notas (opcional)"
            placeholderTextColor={colors.muted}
          />
          <ActionButton
            label="Guardar abono"
            onPress={handleAddPayment}
            loading={payLoading}
            style={styles.payBtn}
          />
        </View>
      </Modal>
    </View>
  );
}

function AmountBlock({ label, value, color, colors }) {
  return (
    <View style={styles.amountBlock}>
      <Text style={[styles.amountBlockValue, { color }]}>{value}</Text>
      <Text style={[styles.amountBlockLabel, { color: colors.muted }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.xl, paddingBottom: s(60) },
  mainCard: { borderWidth: 1.5 },
  mainTop: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.md },
  mainIcon: {
    width: s(52),
    height: s(52),
    borderRadius: s(26),
    alignItems: "center",
    justifyContent: "center",
  },
  mainName: { fontSize: rf(18), fontWeight: "700", marginBottom: s(6) },
  badgeRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
  amountsGrid: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  amountBlock: { flex: 1, alignItems: "center" },
  amountBlockValue: {
    fontSize: rf(16),
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  amountBlockLabel: { fontSize: rf(11), marginTop: s(2) },
  dateText: {
    fontSize: rf(13),
    marginTop: spacing.sm,
    textTransform: "capitalize",
  },
  notes: { fontSize: rf(14), marginTop: spacing.xs },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  progressLabel: { fontSize: rf(15), fontWeight: "700" },
  progressPct: { fontSize: rf(15), fontWeight: "700" },
  progressTrack: {
    height: s(8),
    borderRadius: s(4),
    overflow: "hidden",
    marginBottom: spacing.sm,
  },
  progressFill: { height: "100%", borderRadius: s(4) },
  progressAmounts: { flexDirection: "row", justifyContent: "space-between" },
  progressSub: { fontSize: rf(13) },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  sectionTitle: { fontSize: rf(16), fontWeight: "700" },
  addPayBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: s(4),
    paddingHorizontal: spacing.sm,
    paddingVertical: s(6),
    borderRadius: borderRadius.md,
  },
  addPayText: { fontSize: rf(13), fontWeight: "600" },
  noPayments: {
    fontSize: rf(14),
    textAlign: "center",
    paddingVertical: spacing.lg,
  },
  paymentItem: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: s(6),
  },
  paymentAmount: { fontSize: rf(16), fontWeight: "700" },
  paymentMeta: { fontSize: rf(12), marginTop: s(2) },
  paymentNotes: { fontSize: rf(13), marginTop: s(2) },
  editBtn: { marginTop: spacing.xl },
  modalOverlay: { flex: 1 },
  bottomSheet: {
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.xl,
  },
  sheetTitle: { fontSize: rf(17), fontWeight: "700", marginBottom: spacing.lg },
  amountInputRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  currBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  currText: { fontSize: rf(14), fontWeight: "700" },
  payInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    fontSize: rf(20),
    fontWeight: "700",
    height: s(52),
  },
  payNotesInput: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    height: s(44),
    fontSize: rf(14),
    marginBottom: spacing.lg,
  },
  payBtn: {},
});
