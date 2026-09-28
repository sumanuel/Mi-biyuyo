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
      <SectionList
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        renderSectionHeader={({ section }) => (
          <View
            style={[styles.sectionHeader, { backgroundColor: colors.page }]}
          >
            <View
              style={[
                styles.sectionIconCircle,
                { backgroundColor: colors.accentSoft },
              ]}
            >
              <Ionicons
                name={section.icon}
                size={s(16)}
                color={colors.accent}
              />
            </View>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {section.title}
            </Text>
          </View>
        )}
        renderItem={({ item: parent }) => (
          <View style={styles.parentBlock}>
            <View
              style={[
                styles.parentRow,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View
                style={[
                  styles.catIcon,
                  { backgroundColor: parent.color + "22" },
                ]}
              >
                <Ionicons
                  name={parent.icon || "folder"}
                  size={s(18)}
                  color={parent.color || colors.accent}
                />
              </View>
              <Text style={[styles.parentName, { color: colors.text }]}>
                {parent.name}
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
            {(parent.children || []).map((child) => (
              <View
                key={child.id}
                style={[
                  styles.childRow,
                  {
                    backgroundColor: colors.surfaceAlt,
                    borderColor: colors.borderLight,
                  },
                ]}
              >
                <View
                  style={[
                    styles.catIcon,
                    { backgroundColor: child.color + "22" },
                  ]}
                >
                  <Ionicons
                    name={child.icon || "ellipse"}
                    size={s(15)}
                    color={child.color || colors.accent}
                  />
                </View>
                <Text
                  style={[styles.childName, { color: colors.textSecondary }]}
                >
                  {child.name}
                </Text>
                {!child.is_system && (
                  <TouchableOpacity
                    onPress={() => handleDelete(child.id, child.is_system)}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={s(14)}
                      color={colors.muted}
                    />
                  </TouchableOpacity>
                )}
              </View>
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
        ListEmptyComponent={
          <EmptyState
            icon="grid-outline"
            title="Sin categorías"
            message="Crea tu primera categoría personalizada"
          />
        }
        showsVerticalScrollIndicator={false}
      />

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.accent }]}
        onPress={() => setShowModal(true)}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={s(26)} color="#fff" />
      </TouchableOpacity>

      {/* Create modal */}
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
                  newType === t && { backgroundColor: colors.accentSoft },
                ]}
                onPress={() => setNewType(t)}
              >
                <Ionicons
                  name={TYPE_ICONS[t]}
                  size={s(14)}
                  color={newType === t ? colors.accent : colors.muted}
                />
                <Text
                  style={[
                    styles.typeChipText,
                    { color: newType === t ? colors.accent : colors.muted },
                  ]}
                >
                  {TYPE_LABELS[t]
                    .replace(" Dados", "")
                    .replace("Gastos ", "")
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
            placeholder="Ej: Viáticos, Comisión..."
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
  list: { padding: spacing.md, paddingBottom: s(100) },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  sectionIconCircle: {
    width: s(28),
    height: s(28),
    borderRadius: s(14),
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: rf(14),
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  parentBlock: { marginBottom: spacing.xs },
  parentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing.sm,
    marginBottom: 1,
  },
  childRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    padding: spacing.sm,
    marginLeft: s(20),
    marginBottom: 1,
  },
  catIcon: {
    width: s(32),
    height: s(32),
    borderRadius: s(16),
    alignItems: "center",
    justifyContent: "center",
  },
  parentName: { flex: 1, fontSize: rf(14), fontWeight: "600" },
  childName: { flex: 1, fontSize: rf(13) },
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
  overlay: { flex: 1 },
  sheet: {
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.xl,
    paddingBottom: s(40),
  },
  sheetTitle: { fontSize: rf(18), fontWeight: "700", marginBottom: spacing.lg },
  inputLabel: { fontSize: rf(13), fontWeight: "600", marginBottom: s(6) },
  typeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: s(6),
    marginBottom: spacing.md,
  },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: s(4),
    paddingHorizontal: spacing.sm,
    paddingVertical: s(6),
    borderRadius: borderRadius.md,
  },
  typeChipText: { fontSize: rf(12), fontWeight: "600" },
  nameInput: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    height: s(48),
    fontSize: rf(15),
  },
});
