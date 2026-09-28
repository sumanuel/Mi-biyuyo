import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { rf, s, ms, spacing, borderRadius } from "../../utils/responsive";

// ─── Card ────────────────────────────────────────────────────────────────────
export function Card({ children, style, onPress, ...rest }) {
  const { colors } = useTheme();
  const Wrap = onPress ? TouchableOpacity : View;
  return (
    <Wrap
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.85}
      {...rest}
    >
      {children}
    </Wrap>
  );
}

// ─── SectionHeader ───────────────────────────────────────────────────────────
export function SectionHeader({ title, right, style }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.sectionHeader, style]}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      {right}
    </View>
  );
}

// ─── EmptyState ──────────────────────────────────────────────────────────────
export function EmptyState({
  icon = "document-text-outline",
  title,
  message,
  action,
  actionLabel,
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.emptyContainer}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.accentSoft }]}>
        <Ionicons name={icon} size={s(32)} color={colors.accent} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text>
      {message ? (
        <Text style={[styles.emptyMessage, { color: colors.muted }]}>
          {message}
        </Text>
      ) : null}
      {action ? (
        <TouchableOpacity
          style={[styles.emptyButton, { backgroundColor: colors.accent }]}
          onPress={action}
        >
          <Text style={styles.emptyButtonText}>
            {actionLabel || "Comenzar"}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// ─── ActionButton ────────────────────────────────────────────────────────────
export function ActionButton({
  label,
  onPress,
  icon,
  loading: busy,
  variant = "primary",
  style,
  disabled,
}) {
  const { colors } = useTheme();
  const isPrimary = variant === "primary";
  const isDanger = variant === "danger";

  const bg = isPrimary
    ? colors.accent
    : isDanger
      ? colors.danger
      : "transparent";
  const textColor = isPrimary || isDanger ? "#fff" : colors.accent;
  const borderColor = isPrimary || isDanger ? "transparent" : colors.accent;

  return (
    <TouchableOpacity
      style={[
        styles.actionBtn,
        {
          backgroundColor: bg,
          borderColor,
          borderWidth: isPrimary || isDanger ? 0 : 1.5,
        },
        disabled && styles.actionBtnDisabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || busy}
      activeOpacity={0.8}
    >
      {busy ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <>
          {icon && (
            <Ionicons
              name={icon}
              size={s(18)}
              color={textColor}
              style={{ marginRight: s(6) }}
            />
          )}
          <Text style={[styles.actionBtnText, { color: textColor }]}>
            {label}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

// ─── PillBadge ───────────────────────────────────────────────────────────────
export function PillBadge({ label, color, bg, style }) {
  const { colors } = useTheme();
  const bgColor = bg || colors.accentSoft;
  const textColor = color || colors.accent;
  return (
    <View style={[styles.pill, { backgroundColor: bgColor }, style]}>
      <Text style={[styles.pillText, { color: textColor }]}>{label}</Text>
    </View>
  );
}

// ─── ScreenHeader ────────────────────────────────────────────────────────────
export function ScreenHeader({ title, onBack, right }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.header,
        { backgroundColor: colors.surface, borderBottomColor: colors.border },
      ]}
    >
      {onBack ? (
        <TouchableOpacity
          style={styles.headerBack}
          onPress={onBack}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={s(22)} color={colors.text} />
        </TouchableOpacity>
      ) : (
        <View style={styles.headerBack} />
      )}
      <Text style={[styles.headerTitle, { color: colors.text }]}>{title}</Text>
      <View style={styles.headerRight}>{right || null}</View>
    </View>
  );
}

// ─── InputField ──────────────────────────────────────────────────────────────
export function InputField({
  label,
  error,
  style,
  inputStyle,
  leftIcon,
  rightContent,
  ...inputProps
}) {
  const { colors } = useTheme();
  const { TextInput } = require("react-native");
  return (
    <View style={[styles.inputWrap, style]}>
      {label ? (
        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
          {label}
        </Text>
      ) : null}
      <View
        style={[
          styles.inputRow,
          {
            backgroundColor: colors.surfaceAlt,
            borderColor: error ? colors.danger : colors.border,
          },
        ]}
      >
        {leftIcon && (
          <Ionicons
            name={leftIcon}
            size={s(18)}
            color={colors.muted}
            style={styles.inputIcon}
          />
        )}
        <TextInput
          style={[
            styles.inputText,
            { color: colors.text, flex: 1 },
            inputStyle,
          ]}
          placeholderTextColor={colors.muted}
          {...inputProps}
        />
        {rightContent}
      </View>
      {error ? (
        <Text style={[styles.inputError, { color: colors.danger }]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

// ─── LoadingOverlay ──────────────────────────────────────────────────────────
export function LoadingOverlay() {
  const { colors } = useTheme();
  return (
    <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
      <ActivityIndicator size="large" color={colors.accent} />
    </View>
  );
}

// ─── AmountRow (3 monedas) ───────────────────────────────────────────────────
export function AmountRow({
  amountUsd,
  amountVes,
  amountBinance,
  size = "md",
}) {
  const { colors } = useTheme();
  const fontSize = size === "lg" ? rf(22) : size === "sm" ? rf(13) : rf(16);
  const subSize = size === "lg" ? rf(13) : rf(11);
  return (
    <View style={styles.amountRow}>
      <AmountChip
        value={amountUsd}
        label="USD"
        color={colors.accent}
        fontSize={fontSize}
        subSize={subSize}
      />
      <AmountChip
        value={amountVes}
        label="VES"
        color={colors.income}
        fontSize={fontSize}
        subSize={subSize}
      />
      <AmountChip
        value={amountBinance}
        label="Binance"
        color={colors.warning}
        fontSize={fontSize}
        subSize={subSize}
      />
    </View>
  );
}

function AmountChip({ value, label, color, fontSize, subSize }) {
  const { colors } = useTheme();
  return (
    <View style={styles.amountChip}>
      <Text style={[styles.amountValue, { color, fontSize }]}>
        {value ?? "—"}
      </Text>
      <Text
        style={[styles.amountLabel, { color: colors.muted, fontSize: subSize }]}
      >
        {label}
      </Text>
    </View>
  );
}

// ─── TypeBadge ───────────────────────────────────────────────────────────────
const TYPE_META = {
  income: {
    label: "Ingreso",
    icon: "trending-up",
    colorKey: "income",
    softKey: "incomeSoft",
  },
  expense: {
    label: "Gasto",
    icon: "trending-down",
    colorKey: "expense",
    softKey: "expenseSoft",
  },
  loan_given: {
    label: "Préstamo",
    icon: "arrow-forward-circle",
    colorKey: "loan",
    softKey: "loanSoft",
  },
  debt: {
    label: "Deuda",
    icon: "arrow-back-circle",
    colorKey: "debt",
    softKey: "debtSoft",
  },
};

export function TypeBadge({ type, style }) {
  const { colors } = useTheme();
  const meta = TYPE_META[type] || {
    label: type,
    icon: "ellipse",
    colorKey: "accent",
    softKey: "accentSoft",
  };
  return (
    <View
      style={[
        styles.typeBadge,
        { backgroundColor: colors[meta.softKey] },
        style,
      ]}
    >
      <Ionicons name={meta.icon} size={s(13)} color={colors[meta.colorKey]} />
      <Text style={[styles.typeBadgeText, { color: colors[meta.colorKey] }]}>
        {meta.label}
      </Text>
    </View>
  );
}

export { TYPE_META };

// ─── Divider ─────────────────────────────────────────────────────────────────
export function Divider({ style }) {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.divider, { backgroundColor: colors.borderLight }, style]}
    />
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...Platform.select({
      ios: {
        shadowColor: "#1E1B4B",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: rf(13),
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  emptyIcon: {
    width: s(64),
    height: s(64),
    borderRadius: s(32),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: rf(16),
    fontWeight: "700",
    marginBottom: spacing.xs,
    textAlign: "center",
  },
  emptyMessage: {
    fontSize: rf(14),
    textAlign: "center",
    lineHeight: rf(14) * 1.5,
  },
  emptyButton: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
  },
  emptyButtonText: { color: "#fff", fontSize: rf(15), fontWeight: "700" },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: s(14),
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
  },
  actionBtnDisabled: { opacity: 0.5 },
  actionBtnText: { fontSize: rf(15), fontWeight: "700" },
  pill: {
    paddingHorizontal: s(8),
    paddingVertical: s(3),
    borderRadius: borderRadius.sm,
  },
  pillText: { fontSize: rf(11), fontWeight: "600" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingTop: s(8),
    paddingBottom: s(10),
    borderBottomWidth: 1,
  },
  headerBack: { width: s(36), alignItems: "flex-start" },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: rf(16),
    fontWeight: "700",
  },
  headerRight: { width: s(36), alignItems: "flex-end" },
  inputWrap: { marginBottom: spacing.md },
  inputLabel: { fontSize: rf(13), fontWeight: "600", marginBottom: s(5) },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    minHeight: s(48),
  },
  inputIcon: { marginRight: s(8) },
  inputText: { fontSize: rf(15), paddingVertical: s(10) },
  inputError: { fontSize: rf(12), marginTop: s(3) },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
  },
  amountRow: { flexDirection: "row", gap: spacing.sm },
  amountChip: { flex: 1, alignItems: "center" },
  amountValue: { fontWeight: "700", letterSpacing: -0.3 },
  amountLabel: { marginTop: s(2), fontWeight: "500" },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: s(4),
    paddingHorizontal: s(8),
    paddingVertical: s(3),
    borderRadius: borderRadius.sm,
  },
  typeBadgeText: { fontSize: rf(11), fontWeight: "600" },
  divider: { height: 1, marginVertical: spacing.sm },
});
