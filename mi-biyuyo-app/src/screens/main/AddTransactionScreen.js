import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  Alert,
  Modal,
  FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../contexts/AuthContext";
import { useExchangeRate } from "../../contexts/ExchangeRateContext";
import { createTransaction } from "../../services/api/transactionService";
import { getCategories } from "../../services/api/categoryService";
import {
  ActionButton,
  ScreenHeader,
  InputField,
} from "../../components/common/AppUI";
import {
  formatAmount,
  CURRENCIES,
  CURRENCY_LABELS,
} from "../../utils/currency";
import { rf, s, spacing, borderRadius } from "../../utils/responsive";

const TYPES = [
  {
    key: "income",
    label: "Ingreso",
    emoji: "📈",
    desc: "Dinero que recibes",
    color: "#22C55E",
    soft: "#DCFCE7",
  },
  {
    key: "expense",
    label: "Gasto",
    emoji: "📉",
    desc: "Dinero que gastas",
    color: "#EF4444",
    soft: "#FEE2E2",
  },
  {
    key: "loan_given",
    label: "Préstamo dado",
    emoji: "🤝",
    desc: "Le prestas a alguien",
    color: "#6C7FFF",
    soft: "#EDEDFF",
  },
  {
    key: "debt",
    label: "Deuda",
    emoji: "💳",
    desc: "Dinero que debes",
    color: "#F59E0B",
    soft: "#FEF3C7",
  },
];

export default function AddTransactionScreen({ navigation, route }) {
  const { colors } = useTheme();
  const { token } = useAuth();
  const { convert, rates } = useExchangeRate();

  const [type, setType] = useState(route.params?.type || "expense");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [categoryId, setCategoryId] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [description, setDescription] = useState("");
  const [counterpart, setCounterpart] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCatPicker, setShowCatPicker] = useState(false);
  const [showCurrPicker, setShowCurrPicker] = useState(false);

  useEffect(() => {
    getCategories(token)
      .then((data) => setCategories(data || []))
      .catch(() => {});
  }, [token]);

  const preview = amount ? convert(parseFloat(amount) || 0, currency) : null;

  const filteredCategories = categories.filter((c) => c.type === type);

  const handleSave = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert("Error", "Ingresa un monto válido");
      return;
    }
    if (!categoryId) {
      Alert.alert("Error", "Selecciona una categoría");
      return;
    }
    setLoading(true);
    try {
      await createTransaction(token, {
        category_id: categoryId,
        amount: parseFloat(amount),
        currency,
        description: description || undefined,
        date,
        counterpart_name: counterpart || undefined,
        notes: notes || undefined,
      });
      navigation.goBack();
    } catch (e) {
      Alert.alert("Error", e?.response?.data?.error || "No se pudo guardar");
    } finally {
      setLoading(false);
    }
  };

  const needsCounterpart = type === "loan_given" || type === "debt";

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <ScreenHeader
        title="Nuevo movimiento"
        onBack={() => navigation.goBack()}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Type selector — grid 2×2 */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          Tipo de transacción
        </Text>
        <View style={styles.typeGrid}>
          {TYPES.map((t) => {
            const selected = type === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                style={[
                  styles.typeCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: selected ? t.color : colors.border,
                  },
                  selected && { backgroundColor: t.soft },
                ]}
                onPress={() => {
                  setType(t.key);
                  setCategoryId(null);
                  setSelectedCategory(null);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.typeEmoji}>{t.emoji}</Text>
                <Text
                  style={[
                    styles.typeName,
                    { color: selected ? t.color : colors.text },
                  ]}
                >
                  {t.label}
                </Text>
                <Text style={[styles.typeDesc, { color: colors.muted }]}>
                  {t.desc}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Currency selector */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          Moneda
        </Text>
        <View style={styles.currRow}>
          {CURRENCIES.map((c) => (
            <TouchableOpacity
              key={c}
              style={[
                styles.currChip,
                {
                  borderColor: currency === c ? colors.accent : colors.border,
                  backgroundColor:
                    currency === c ? colors.accentSoft : colors.surface,
                },
              ]}
              onPress={() => setCurrency(c)}
            >
              <Text
                style={[
                  styles.currChipText,
                  { color: currency === c ? colors.accent : colors.muted },
                ]}
              >
                {CURRENCY_LABELS[c]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Amount */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          Monto
        </Text>
        <View
          style={[
            styles.amountWrap,
            {
              backgroundColor: colors.surface,
              borderColor:
                TYPES.find((t) => t.key === type)?.color || colors.border,
            },
          ]}
        >
          <Text style={[styles.amountCurrSymbol, { color: colors.muted }]}>
            💵
          </Text>
          <TextInput
            style={[
              styles.amountInput,
              {
                color: TYPES.find((t) => t.key === type)?.color || colors.text,
              },
            ]}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={colors.muted}
          />
        </View>

        {/* Preview */}
        {preview && (
          <View
            style={[
              styles.preview,
              {
                backgroundColor: colors.accentSoft,
                borderColor: colors.border,
              },
            ]}
          >
            <PreviewItem
              label="USD"
              value={formatAmount(preview.usd, "USD")}
              colors={colors}
            />
            <PreviewItem
              label="VES"
              value={formatAmount(preview.ves, "VES")}
              colors={colors}
            />
            <PreviewItem
              label="Binance"
              value={formatAmount(preview.binance, "BINANCE")}
              colors={colors}
            />
          </View>
        )}
        {(!rates.usd_to_ves || rates.usd_to_ves === 0) && (
          <Text style={[styles.rateWarning, { color: colors.warning }]}>
            ⚠️ Configura las tasas para ver conversiones
          </Text>
        )}

        {/* Category */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          Categoría
        </Text>
        <TouchableOpacity
          style={[
            styles.catBtn,
            {
              backgroundColor: colors.surfaceAlt,
              borderColor: selectedCategory
                ? selectedCategory.color
                : colors.border,
            },
          ]}
          onPress={() => setShowCatPicker(true)}
        >
          {selectedCategory ? (
            <>
              <Ionicons
                name={selectedCategory.icon || "ellipse"}
                size={s(18)}
                color={selectedCategory.color || colors.accent}
              />
              <Text style={[styles.catBtnText, { color: colors.text }]}>
                {selectedCategory.name}
              </Text>
            </>
          ) : (
            <>
              <Ionicons name="grid-outline" size={s(18)} color={colors.muted} />
              <Text style={[styles.catBtnText, { color: colors.muted }]}>
                Seleccionar categoría
              </Text>
            </>
          )}
          <Ionicons
            name="chevron-down"
            size={s(16)}
            color={colors.muted}
            style={{ marginLeft: "auto" }}
          />
        </TouchableOpacity>

        {/* Counterpart for loans/debts */}
        {needsCounterpart && (
          <InputField
            label={type === "loan_given" ? "Prestado a" : "Debo a"}
            leftIcon="person-outline"
            value={counterpart}
            onChangeText={setCounterpart}
            placeholder="Nombre de la persona"
          />
        )}

        {/* Description */}
        <InputField
          label="Descripción (opcional)"
          leftIcon="create-outline"
          value={description}
          onChangeText={setDescription}
          placeholder="¿De qué trata?"
        />

        {/* Date */}
        <InputField
          label="Fecha"
          leftIcon="calendar-outline"
          value={date}
          onChangeText={setDate}
          placeholder="YYYY-MM-DD"
        />

        {/* Notes */}
        <InputField
          label="Notas (opcional)"
          leftIcon="document-text-outline"
          value={notes}
          onChangeText={setNotes}
          placeholder="Notas adicionales..."
          inputStyle={{ minHeight: s(80) }}
          multiline
        />

        <ActionButton
          label="Guardar movimiento"
          onPress={handleSave}
          loading={loading}
          style={styles.saveBtn}
        />
      </ScrollView>

      {/* Currency picker modal */}
      <Modal visible={showCurrPicker} transparent animationType="slide">
        <TouchableOpacity
          style={styles.modalOverlay}
          onPress={() => setShowCurrPicker(false)}
        />
        <View style={[styles.bottomSheet, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sheetTitle, { color: colors.text }]}>
            Seleccionar moneda
          </Text>
          {CURRENCIES.map((c) => (
            <TouchableOpacity
              key={c}
              style={[
                styles.sheetItem,
                currency === c && { backgroundColor: colors.accentSoft },
              ]}
              onPress={() => {
                setCurrency(c);
                setShowCurrPicker(false);
              }}
            >
              <Text
                style={[
                  styles.sheetItemText,
                  { color: currency === c ? colors.accent : colors.text },
                ]}
              >
                {CURRENCY_LABELS[c]}
              </Text>
              {currency === c && (
                <Ionicons name="checkmark" size={s(18)} color={colors.accent} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </Modal>

      {/* Category picker modal */}
      <Modal visible={showCatPicker} transparent animationType="slide">
        <TouchableOpacity
          style={styles.modalOverlay}
          onPress={() => setShowCatPicker(false)}
        />
        <View style={[styles.bottomSheet, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sheetTitle, { color: colors.text }]}>
            Seleccionar categoría
          </Text>
          <FlatList
            data={filteredCategories}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <View>
                <Text style={[styles.catGroupTitle, { color: colors.muted }]}>
                  {item.name}
                </Text>
                {(item.children || []).map((child) => (
                  <TouchableOpacity
                    key={child.id}
                    style={[
                      styles.sheetItem,
                      categoryId === child.id && {
                        backgroundColor: colors.accentSoft,
                      },
                    ]}
                    onPress={() => {
                      setCategoryId(child.id);
                      setSelectedCategory(child);
                      setShowCatPicker(false);
                    }}
                  >
                    <Ionicons
                      name={child.icon || "ellipse"}
                      size={s(18)}
                      color={child.color || colors.accent}
                    />
                    <Text
                      style={[styles.sheetItemText, { color: colors.text }]}
                    >
                      {child.name}
                    </Text>
                    {categoryId === child.id && (
                      <Ionicons
                        name="checkmark"
                        size={s(18)}
                        color={colors.accent}
                        style={{ marginLeft: "auto" }}
                      />
                    )}
                  </TouchableOpacity>
                ))}
                {/* Direct selection if no children (custom category) */}
                {(!item.children || item.children.length === 0) &&
                  !item.parent_id && (
                    <TouchableOpacity
                      style={[
                        styles.sheetItem,
                        categoryId === item.id && {
                          backgroundColor: colors.accentSoft,
                        },
                      ]}
                      onPress={() => {
                        setCategoryId(item.id);
                        setSelectedCategory(item);
                        setShowCatPicker(false);
                      }}
                    >
                      <Ionicons
                        name={item.icon || "ellipse"}
                        size={s(18)}
                        color={item.color || colors.accent}
                      />
                      <Text
                        style={[styles.sheetItemText, { color: colors.text }]}
                      >
                        {item.name}
                      </Text>
                    </TouchableOpacity>
                  )}
              </View>
            )}
            ListEmptyComponent={
              <Text style={[styles.emptyCategories, { color: colors.muted }]}>
                No hay categorías para este tipo. Ve a Categorías y crea una.
              </Text>
            }
          />
        </View>
      </Modal>
    </View>
  );
}

function PreviewItem({ label, value, colors }) {
  return (
    <View style={{ alignItems: "center" }}>
      <Text
        style={{ color: colors.accent, fontSize: rf(15), fontWeight: "700" }}
      >
        {value}
      </Text>
      <Text style={{ color: colors.muted, fontSize: rf(11) }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, paddingBottom: s(60) },
  label: {
    fontSize: rf(13),
    fontWeight: "700",
    marginBottom: s(8),
    marginTop: spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },

  // type grid 2×2
  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: s(8),
    marginBottom: spacing.md,
  },
  typeCard: {
    width: "47.5%",
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    padding: spacing.md,
  },
  typeEmoji: { fontSize: rf(22), marginBottom: s(6) },
  typeName: { fontSize: rf(13), fontWeight: "700", marginBottom: s(2) },
  typeDesc: { fontSize: rf(11) },

  // currency chips
  currRow: { flexDirection: "row", gap: s(8), marginBottom: spacing.md },
  currChip: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: s(10),
    paddingVertical: s(8),
    alignItems: "center",
  },
  currChipText: { fontSize: rf(12), fontWeight: "700" },

  // amount
  amountWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
  },
  amountCurrSymbol: { fontSize: rf(18), marginRight: s(6) },
  amountInput: {
    flex: 1,
    fontSize: rf(24),
    fontWeight: "800",
    paddingVertical: s(14),
  },

  preview: {
    flexDirection: "row",
    justifyContent: "space-around",
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.xs,
  },
  rateWarning: { fontSize: rf(12), marginBottom: spacing.md },
  catBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: s(8),
    borderWidth: 1.5,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  catBtnText: { fontSize: rf(15) },
  saveBtn: { marginTop: spacing.xl },
  modalOverlay: { flex: 1 },
  bottomSheet: {
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.xl,
    maxHeight: "70%",
  },
  sheetTitle: { fontSize: rf(17), fontWeight: "700", marginBottom: spacing.lg },
  sheetItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
  },
  sheetItemText: { fontSize: rf(15), flex: 1 },
  catGroupTitle: {
    fontSize: rf(12),
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: spacing.md,
    marginBottom: s(4),
    paddingHorizontal: spacing.sm,
  },
  emptyCategories: {
    padding: spacing.lg,
    textAlign: "center",
    fontSize: rf(14),
  },

  // legacy (para el modal de currency que quedó)
  amountRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  currBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: s(4),
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  currText: { fontSize: rf(14), fontWeight: "700" },
  typeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: s(8),
    marginBottom: spacing.md,
  },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: s(5),
    paddingHorizontal: spacing.md,
    paddingVertical: s(8),
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
  },
  typeChipText: { fontSize: rf(13), fontWeight: "600" },
});
