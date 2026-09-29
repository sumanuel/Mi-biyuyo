import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../contexts/AuthContext";
import {
  getCategories,
  createCategory,
  deleteCategory,
} from "../../services/api/categoryService";
import { ActionButton, EmptyState } from "../../components/common/AppUI";
import { rf, s, spacing, borderRadius } from "../../utils/responsive";

const TYPE_ORDER = ["income", "expense", "loan_given", "debt"];
const TYPE_LABELS = {
  income: "Ingresos",
  expense: "Gastos",
  loan_given: "Préstamos Dados",
  debt: "Deudas",
};
const TYPE_ICONS = {
  income: "trending-up",
  expense: "trending-down",
  loan_given: "arrow-forward-circle",
  debt: "arrow-back-circle",
};
const TYPE_DOTS = {
  income: "#22C55E",
  expense: "#EF4444",
  loan_given: "#6C7FFF",
  debt: "#F59E0B",
};

export default function CategoriesScreen({ navigation }) {
  const { colors } = useTheme();
  const { token } = useAuth();
  const [categories, setCategories] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("expense");
  const [newParentId, setNewParentId] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getCategories(token);
      setCategories(data || []);
    } catch {}
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const sections = TYPE_ORDER.map((type) => ({
    type,
    title: TYPE_LABELS[type],
    icon: TYPE_ICONS[type],
    data: categories.filter((c) => c.type === type),
  })).filter((s) => s.data.length > 0);

  const handleSave = async () => {
    if (!newName.trim()) {
      Alert.alert("Error", "Ingresa un nombre");
      return;
    }
    setSaving(true);
    try {
      await createCategory(token, {
        name: newName.trim(),
        type: newType,
        parent_id: newParentId || undefined,
      });
      setShowModal(false);
      setNewName("");
      await load();
    } catch (e) {
      Alert.alert("Error", e?.response?.data?.error || "No se pudo crear");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id, isSystem) => {
    if (isSystem) {
      Alert.alert(
        "No disponible",
        "Las categorías del sistema no se pueden eliminar",
      );
      return;
    }
    Alert.alert("Eliminar categoría", "¿Seguro?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteCategory(token, id);
            await load();
          } catch {
            Alert.alert("Error", "No se pudo eliminar");
          }
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <View
        style={[
          styles.screenHeader,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        <Text style={[styles.screenTitle, { color: colors.text }]}>
          Categorías
        </Text>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <View
              style={[
                styles.typeDot,
                { backgroundColor: TYPE_DOTS[section.type] },
              ]}
            />
            <Text
              style={[styles.sectionTitle, { color: colors.textSecondary }]}
            >
              {section.title}
            </Text>
          </View>
        )}
        renderItem={({ item: parent }) => (
          <View
            style={[
              styles.parentCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.parentRow}>
              <Text style={[styles.parentEmoji]}>
                {parent.icon && parent.icon.includes("emoji")
                  ? parent.icon
                  : "📁"}
              </Text>
              <Text style={[styles.parentName, { color: colors.text }]}>
                {parent.name}
              </Text>
              {parent.is_system && (
                <View
                  style={[
                    styles.systemBadge,
                    { backgroundColor: colors.border },
                  ]}
                >
                  <Text
                    style={[styles.systemBadgeText, { color: colors.muted }]}
                  >
                    Sistema
                  </Text>
                </View>
              )}
              <Text style={[styles.childCount, { color: colors.muted }]}>
                {(parent.children || []).length} sub
              </Text>
              {!parent.is_system && (
                <TouchableOpacity
                  onPress={() => handleDelete(parent.id, parent.is_system)}
                >
                  <Ionicons
                    name="trash-outline"
                    size={s(16)}
                    color={colors.muted}
                  />
                </TouchableOpacity>
              )}
            </View>
            {(parent.children || []).length > 0 && (
              <View style={styles.childPills}>
                {(parent.children || []).map((child) => (
                  <TouchableOpacity
                    key={child.id}
                    style={[
                      styles.childPill,
                      {
                        backgroundColor: colors.surfaceAlt,
                        borderColor: colors.border,
                      },
                    ]}
                    onLongPress={() => handleDelete(child.id, child.is_system)}
                  >
                    <Text
                      style={[
                        styles.childPillText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {child.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
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
        ListFooterComponent={
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.accent }]}
            onPress={() => setShowModal(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={s(20)} color="#fff" />
            <Text style={styles.addBtnText}>Nueva categoría</Text>
          </TouchableOpacity>
        }
        ListEmptyComponent={
          <View style={{ padding: spacing.xl, alignItems: "center" }}>
            <Text style={{ fontSize: rf(40), marginBottom: spacing.md }}>
              🏷️
            </Text>
            <Text
              style={[
                {
                  fontSize: rf(16),
                  fontWeight: "700",
                  color: colors.text,
                  marginBottom: s(6),
                },
              ]}
            >
              Sin categorías
            </Text>
            <Text
              style={[
                { fontSize: rf(13), color: colors.muted, textAlign: "center" },
              ]}
            >
              Crea tu primera categoría personalizada
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />

      {/* Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <TouchableOpacity
          style={styles.overlay}
          onPress={() => setShowModal(false)}
        />
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sheetTitle, { color: colors.text }]}>
            Nueva categoría
          </Text>

          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
            Tipo
          </Text>
          <View style={styles.typeRow}>
            {TYPE_ORDER.map((t) => (
              <TouchableOpacity
                key={t}
                style={[
                  styles.typeChip,
                  {
                    borderColor: newType === t ? TYPE_DOTS[t] : colors.border,
                    backgroundColor:
                      newType === t ? TYPE_DOTS[t] + "22" : colors.surface,
                    borderWidth: 1.5,
                  },
                ]}
                onPress={() => setNewType(t)}
              >
                <View
                  style={[
                    styles.typeDotSmall,
                    { backgroundColor: TYPE_DOTS[t] },
                  ]}
                />
                <Text
                  style={[
                    styles.typeChipText,
                    { color: newType === t ? TYPE_DOTS[t] : colors.muted },
                  ]}
                >
                  {TYPE_LABELS[t]
                    .replace(" Dados", "")
                    .replace("Ingresos", "Ingreso")}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
            Nombre
          </Text>
          <TextInput
            style={[
              styles.nameInput,
              {
                backgroundColor: colors.surfaceAlt,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            value={newName}
            onChangeText={setNewName}
            placeholder="Nombre de la categoría"
            placeholderTextColor={colors.muted}
            autoFocus
          />

          <ActionButton
            label="Crear categoría"
            onPress={handleSave}
            loading={saving}
            style={{ marginTop: spacing.md }}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screenHeader: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  screenTitle: { fontSize: rf(20), fontWeight: "800" },
  list: { padding: spacing.md, paddingBottom: s(40) },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: s(8),
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    marginTop: spacing.sm,
  },
  typeDot: { width: s(10), height: s(10), borderRadius: s(5) },
  sectionTitle: {
    fontSize: rf(12),
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  parentCard: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: s(6),
    overflow: "hidden",
  },
  parentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
  },
  parentEmoji: { fontSize: rf(18) },
  parentName: { flex: 1, fontSize: rf(14), fontWeight: "600" },
  systemBadge: {
    borderRadius: s(6),
    paddingHorizontal: s(7),
    paddingVertical: s(2),
  },
  systemBadgeText: { fontSize: rf(9), fontWeight: "700" },
  childCount: { fontSize: rf(11) },
  childPills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: s(6),
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  childPill: {
    borderRadius: s(8),
    borderWidth: 1,
    paddingHorizontal: s(10),
    paddingVertical: s(5),
  },
  childPillText: { fontSize: rf(12), fontWeight: "600" },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: s(8),
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    margin: spacing.sm,
  },
  addBtnText: { color: "#fff", fontSize: rf(15), fontWeight: "700" },
  overlay: { flex: 1 },
  sheet: {
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.xl,
    paddingBottom: s(40),
  },
  sheetTitle: { fontSize: rf(18), fontWeight: "800", marginBottom: spacing.lg },
  inputLabel: {
    fontSize: rf(12),
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: s(8),
    marginTop: spacing.sm,
  },
  typeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: s(6),
    marginBottom: spacing.md,
  },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: s(5),
    paddingHorizontal: spacing.sm,
    paddingVertical: s(7),
    borderRadius: s(8),
  },
  typeDotSmall: { width: s(7), height: s(7), borderRadius: s(4) },
  typeChipText: { fontSize: rf(12), fontWeight: "700" },
  nameInput: {
    borderWidth: 1.5,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    height: s(50),
    fontSize: rf(15),
  },
});
