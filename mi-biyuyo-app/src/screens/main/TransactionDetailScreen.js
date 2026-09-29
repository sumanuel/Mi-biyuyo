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

  if (!tx) return <View style={{ flex: 1, backgroundColor: colors.page }} />;

  const paidUsd = parseFloat(tx.paid_usd || 0);
  const remainingUsd = parseFloat(tx.amount_usd || 0) - paidUsd;
  const progress = tx.amount_usd > 0 ? Math.min(paidUsd / parseFloat(tx.amount_usd), 1) : 0;
  const isLoanOrDebt = tx.category_type === "loan_given" || tx.category_type === "debt";
  const typeColor = TYPE_COLORS[tx.category_type] || colors.accent;
  const typeEmoji = TYPE_EMOJI[tx.category_type] || "??";

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={s(20)} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Detalle</Text>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: colors.dangerSoft, borderColor: colors.danger }]} onPress={handleDelete}>
          <Ionicons name="trash-outline" size={s(18)} color={colors.danger} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />} showsVerticalScrollIndicator={false}>

        <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={styles.heroEmoji}>{typeEmoji}</Text>
          <View style={styles.heroBadgeRow}>
            <TypeBadge type={tx.category_type} />
            {tx.status === "paid" && <PillBadge label="Pagado" bg={colors.successSoft} color={colors.success} style={{ marginLeft: s(6) }} />}
            {tx.status === "cancelled" && <PillBadge label="Cancelado" bg={colors.dangerSoft} color={colors.danger} style={{ marginLeft: s(6) }} />}
          </View>
          <Text style={[styles.heroTitle, { color: colors.text }]}>
            {tx.counterpart_name || tx.description || tx.category_name}
          </Text>
          {tx.counterpart_name && tx.description && <Text style={[styles.heroSub, { color: colors.muted }]}>{tx.description}</Text>}
          <Text style={[styles.heroAmount, { color: typeColor }]}>{formatAmount(tx.amount_usd, "USD")}</Text>
          {tx.date && (
            <Text style={[styles.heroDate, { color: colors.muted }]}>
              ?? {new Date(tx.date + "T00:00:00").toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" })}
            </Text>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardSectionLabel, { color: colors.textSecondary }]}>Equivalencias</Text>
          <View style={styles.amountRow}>
            <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>???? USD</Text>
            <Text style={[styles.amountVal, { color: colors.text }]}>{formatAmount(tx.amount_usd, "USD")}</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.amountRow}>
            <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>???? Bol�vares</Text>
            <Text style={[styles.amountVal, { color: colors.text }]}>{formatAmount(tx.amount_ves, "VES")}</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.amountRow}>
            <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>?? Binance</Text>
            <Text style={[styles.amountVal, { color: colors.text }]}>{formatAmount(tx.amount_binance, "BINANCE")}</Text>
          </View>
          {tx.notes && (
            <>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <Text style={[styles.notes, { color: colors.textSecondary }]}>{tx.notes}</Text>
            </>
          )}
        </View>

        {isLoanOrDebt && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.progressHeader}>
              <Text style={[styles.progressTitle, { color: colors.text }]}>
                {tx.category_type === "loan_given" ? "Progreso de cobro" : "Progreso de pago"}
              </Text>
              <View style={[styles.statusPill, { backgroundColor: progress >= 1 ? colors.successSoft : colors.warningSoft }]}>
                <Text style={{ fontSize: rf(11), fontWeight: "700", color: progress >= 1 ? colors.success : colors.warning }}>
                  {progress >= 1 ? "Completado" : "En curso"}
                </Text>
              </View>
            </View>
            <View style={styles.progressLabels}>
              <Text style={[styles.progressSub, { color: colors.muted }]}>Pagado: {formatAmount(paidUsd, "USD")}</Text>
              <Text style={[styles.progressSub, { color: colors.muted }]}>Pendiente: {formatAmount(Math.max(remainingUsd, 0), "USD")}</Text>
            </View>
            <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
              <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: progress >= 1 ? colors.success : colors.income }]} />
            </View>
            <Text style={[styles.progressPct, { color: colors.muted }]}>{Math.round(progress * 100)}% completado</Text>
          </View>
        )}

        {isLoanOrDebt && (
          <>
            <View style={styles.sectionRow}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Historial de abonos</Text>
              {tx.status !== "paid" && tx.status !== "cancelled" && (
                <TouchableOpacity style={[styles.addPayBtn, { backgroundColor: colors.accentSoft }]} onPress={() => setShowPayModal(true)}>
                  <Ionicons name="add" size={s(14)} color={colors.accent} />
                  <Text style={[styles.addPayText, { color: colors.accent }]}>Abono</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, padding: spacing.md }]}>
              {payments.length === 0 ? (
                <Text style={[styles.noPayments, { color: colors.muted }]}>Sin abonos registrados</Text>
              ) : (
                payments.map((p, idx) => (
                  <View key={p.id} style={[styles.paymentItem, idx < payments.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.paymentDesc, { color: colors.text }]}>{p.notes || "Abono"}</Text>
                      <Text style={[styles.paymentDate, { color: colors.muted }]}>{p.date?.slice(0, 10)}</Text>
                    </View>
                    <Text style={[styles.paymentAmount, { color: colors.income }]}>{formatAmount(p.amount_usd, "USD")}</Text>
                    <TouchableOpacity onPress={() => handleDeletePayment(p.id)} style={{ marginLeft: s(10) }}>
                      <Ionicons name="trash-outline" size={s(16)} color={colors.muted} />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          </>
        )}

        {isLoanOrDebt && tx.status !== "paid" && tx.status !== "cancelled" && (
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.surfaceAlt, borderColor: colors.accent, borderWidth: 1.5 }]} onPress={() => setShowPayModal(true)} activeOpacity={0.8}>
            <Text style={[styles.actionBtnText, { color: colors.accent }]}>?? Registrar abono</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.dangerSoft, borderColor: colors.danger, borderWidth: 1.5 }]} onPress={handleDelete} activeOpacity={0.8}>
          <Text style={[styles.actionBtnText, { color: colors.danger }]}>??? Eliminar transacci�n</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={showPayModal} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowPayModal(false)} />
        <View style={[styles.bottomSheet, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sheetTitle, { color: colors.text }]}>Registrar abono</Text>
          <View style={styles.amountInputRow}>
            <TouchableOpacity style={[styles.currBtn, { backgroundColor: colors.accentSoft, borderColor: colors.border }]} onPress={() => setPayCurrency(CURRENCIES[(CURRENCIES.indexOf(payCurrency) + 1) % CURRENCIES.length])}>
              <Text style={[styles.currText, { color: colors.accent }]}>{payCurrency}</Text>
            </TouchableOpacity>
            <TextInput style={[styles.payInput, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text }]} value={payAmount} onChangeText={setPayAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.muted} autoFocus />
          </View>
          <TextInput style={[styles.payNotesInput, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text }]} value={payNotes} onChangeText={setPayNotes} placeholder="Notas (opcional)" placeholderTextColor={colors.muted} />
          <ActionButton label="Guardar abono" onPress={handleAddPayment} loading={payLoading} />
        </View>
      </Modal>
    </View>
  );
}

const TYPE_COLORS = { income: "#22C55E", expense: "#EF4444", loan_given: "#6C7FFF", debt: "#F59E0B" };
const TYPE_EMOJI  = { income: "??",     expense: "??",     loan_given: "??",     debt: "??" };

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1 },
  backBtn: { width: s(36), height: s(36), borderRadius: s(10), borderWidth: 1, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: rf(17), fontWeight: "700" },
  scroll: { padding: spacing.lg, paddingBottom: s(60) },
  hero: { borderRadius: s(20), borderWidth: 1, padding: spacing.xl, alignItems: "center", marginBottom: spacing.md },
  heroEmoji: { fontSize: s(44), marginBottom: s(10) },
  heroBadgeRow: { flexDirection: "row", alignItems: "center", marginBottom: s(10) },
  heroTitle: { fontSize: rf(18), fontWeight: "800", textAlign: "center", marginBottom: s(4) },
  heroSub: { fontSize: rf(13), marginBottom: s(10) },
  heroAmount: { fontSize: rf(30), fontWeight: "900", letterSpacing: -1, marginBottom: s(6) },
  heroDate: { fontSize: rf(12) },
  card: { borderRadius: s(16), borderWidth: 1, padding: spacing.lg, marginBottom: spacing.md },
  cardSectionLabel: { fontSize: rf(12), fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: spacing.sm },
  amountRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: s(7) },
  amountLabel: { fontSize: rf(13), fontWeight: "600" },
  amountVal: { fontSize: rf(15), fontWeight: "700" },
  divider: { height: 1, marginVertical: s(2) },
  notes: { fontSize: rf(13), marginTop: spacing.sm, lineHeight: rf(20) },
  progressHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: s(8) },
  progressTitle: { fontSize: rf(14), fontWeight: "700" },
  statusPill: { borderRadius: s(10), paddingHorizontal: s(10), paddingVertical: s(3) },
  progressLabels: { flexDirection: "row", justifyContent: "space-between", marginBottom: s(8) },
  progressSub: { fontSize: rf(12) },
  progressTrack: { height: s(8), borderRadius: s(4), overflow: "hidden", marginBottom: s(4) },
  progressFill: { height: "100%", borderRadius: s(4) },
  progressPct: { fontSize: rf(11), textAlign: "right" },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: s(8) },
  sectionTitle: { fontSize: rf(12), fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  addPayBtn: { flexDirection: "row", alignItems: "center", gap: s(4), paddingHorizontal: s(10), paddingVertical: s(5), borderRadius: s(8) },
  addPayText: { fontSize: rf(12), fontWeight: "700" },
  noPayments: { textAlign: "center", paddingVertical: spacing.lg, fontSize: rf(13) },
  paymentItem: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm },
  paymentDesc: { fontSize: rf(13), fontWeight: "600" },
  paymentDate: { fontSize: rf(11), marginTop: s(2) },
  paymentAmount: { fontSize: rf(14), fontWeight: "700" },
  actionBtn: { borderRadius: s(14), padding: spacing.md, alignItems: "center", marginBottom: s(10) },
  actionBtnText: { fontSize: rf(15), fontWeight: "700" },
  modalOverlay: { flex: 1 },
  bottomSheet: { borderTopLeftRadius: s(24), borderTopRightRadius: s(24), padding: spacing.xl },
  sheetTitle: { fontSize: rf(17), fontWeight: "700", marginBottom: spacing.lg },
  amountInputRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  currBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, borderRadius: borderRadius.md, borderWidth: 1, height: s(52) },
  currText: { fontSize: rf(14), fontWeight: "700" },
  payInput: { flex: 1, borderWidth: 1, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, fontSize: rf(20), fontWeight: "700", height: s(52) },
  payNotesInput: { borderWidth: 1, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, height: s(44), fontSize: rf(14), marginBottom: spacing.lg },
});
