// Componentes base del sistema de diseño (ver DESIGN.md).
import React from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  useWindowDimensions,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { BottomTabBarHeightContext } from "@react-navigation/bottom-tabs";
import { useTheme } from "../contexts/ThemeContext";
import { useData } from "../contexts/DataContext";
import { fontFor } from "../theme/font";
import { Icon, UI } from "./icons";
import { scrollIntoView, useKeyboardVisible } from "../utils/keyboard";

// Permite que un campo avise a su pantalla para desplazarse sobre el teclado
const ScrollCtx = React.createContext(null);

/* ---------- Texto e inputs con Plus Jakarta Sans ---------- */
export function Txt({ style, children, ...rest }) {
  const { colors } = useTheme();
  const flat = StyleSheet.flatten(style) || {};
  return (
    <Text
      {...rest}
      style={[
        {
          color: colors.text,
          fontFamily: fontFor(flat.fontWeight || "400"),
          fontVariant: ["tabular-nums"],
        },
        style,
        { fontWeight: undefined },
      ]}
    >
      {children}
    </Text>
  );
}

export const Input = React.forwardRef(function Input(
  { style, onFocus, ...rest },
  fwd,
) {
  const { colors } = useTheme();
  const scrollRef = React.useContext(ScrollCtx);
  const inner = React.useRef(null);
  const flat = StyleSheet.flatten(style) || {};
  const setRef = (node) => {
    inner.current = node;
    if (typeof fwd === "function") fwd(node);
    else if (fwd) fwd.current = node;
  };
  return (
    <TextInput
      ref={setRef}
      placeholderTextColor={colors.placeholder}
      {...rest}
      onFocus={(e) => {
        onFocus?.(e);
        scrollIntoView(scrollRef, inner.current);
      }}
      style={[
        { color: colors.text, fontFamily: fontFor(flat.fontWeight || "400") },
        Platform.select({ web: { outlineStyle: "none" } }),
        style,
        { fontWeight: undefined },
      ]}
    />
  );
});

/* ---------- Estructura de pantalla ---------- */
/**
 * Pantalla con scroll. Muestra carga/error mientras no haya datos (data),
 * y permite refrescar tirando hacia abajo (pull).
 */
export function Screen({
  children,
  scroll = true,
  footer,
  contentStyle,
  data = true,
  pull = false,
  keyboard = "handled",
}) {
  const { colors } = useTheme();
  const { model, loading, error, refresh } = useData();
  const { height: winH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const tabHeight = React.useContext(BottomTabBarHeightContext);
  // Pantalla de pila sin pie: separar el contenido de la barra del sistema
  const bottomGap = !footer && tabHeight === undefined ? insets.bottom : 0;
  const scrollRef = React.useRef(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  let body = children;
  let usesScroll = scroll;
  if (data && !model.ready) {
    usesScroll = false;
    body = (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          padding: 24,
        }}
      >
        {loading ? (
          <ActivityIndicator color={colors.accent} />
        ) : (
          <>
            <Txt style={{ color: colors.textSecondary, textAlign: "center" }}>
              {error || "No se pudieron cargar tus datos"}
            </Txt>
            <Button
              label="Reintentar"
              onPress={refresh}
              style={{ paddingHorizontal: 24 }}
            />
          </>
        )}
      </View>
    );
  }

  return (
    <SafeAreaView
      edges={["top"]}
      // En web el contenedor de la pila no acota la altura: se limita a la ventana
      // para que el pie (footer) quede siempre a la vista.
      style={[
        { flex: 1, backgroundColor: colors.page },
        Platform.OS === "web" ? { maxHeight: winH, overflow: "hidden" } : null,
      ]}
    >
      <ScrollCtx.Provider value={scrollRef}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "web" ? undefined : "padding"}
        >
          {usesScroll ? (
            <ScrollView
              ref={scrollRef}
              style={{ flex: 1, minHeight: 0 }}
              contentContainerStyle={[
                { padding: 16, paddingTop: 20, paddingBottom: 24, gap: 14 },
                contentStyle,
              ]}
              keyboardShouldPersistTaps={keyboard}
              showsVerticalScrollIndicator={false}
              refreshControl={
                pull ? (
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    tintColor={colors.accent}
                  />
                ) : undefined
              }
            >
              {body}
              {bottomGap ? <View style={{ height: bottomGap }} /> : null}
            </ScrollView>
          ) : (
            <View
              style={[{ flex: 1 }, data && !model.ready ? null : contentStyle]}
            >
              {body}
            </View>
          )}
          {data && !model.ready ? null : footer}
        </KeyboardAvoidingView>
      </ScrollCtx.Provider>
    </SafeAreaView>
  );
}

/** Barra inferior fija con el botón principal. */
export function Footer({ children }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardVisible();
  return (
    <View
      style={{
        padding: 16,
        // Deja libre la barra de navegación del sistema (botones de Android),
        // salvo con el teclado abierto: él ya cubre esa zona
        paddingBottom: 16 + (keyboard ? 0 : insets.bottom),
        backgroundColor: colors.page,
        borderTopWidth: 1,
        borderTopColor: colors.border,
      }}
    >
      {children}
    </View>
  );
}

export function H1({ children, style }) {
  return (
    <Txt
      style={[{ fontSize: 22, fontWeight: "800", letterSpacing: -0.44 }, style]}
    >
      {children}
    </Txt>
  );
}

export function H2({ children, style }) {
  return (
    <Txt style={[{ fontSize: 16, fontWeight: "700" }, style]}>{children}</Txt>
  );
}

/** Encabezado con botón atrás (pantallas de detalle y formularios). */
export function Header({ title, onBack, right }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      {onBack ? (
        <TouchableOpacity
          onPress={onBack}
          accessibilityLabel="Volver"
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="chevronLeft" size={20} color={colors.text} stroke={2} />
        </TouchableOpacity>
      ) : null}
      <Txt
        style={{
          flex: 1,
          fontSize: 20,
          fontWeight: "800",
          letterSpacing: -0.4,
        }}
        numberOfLines={1}
      >
        {title}
      </Txt>
      {right}
    </View>
  );
}

export function SectionHead({ title, action, onAction }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <H2>{title}</H2>
      {action ? (
        <TouchableOpacity
          onPress={onAction}
          style={{
            minHeight: 44,
            justifyContent: "center",
            paddingHorizontal: 4,
          }}
        >
          <Txt style={{ color: colors.link, fontSize: 13, fontWeight: "700" }}>
            {action}
          </Txt>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function Label({ children, hint, style }) {
  const { colors } = useTheme();
  return (
    <Txt style={[{ fontSize: 14, fontWeight: "700" }, style]}>
      {children}
      {hint ? (
        <Txt style={{ fontWeight: "400", color: colors.textSecondary }}>
          {" "}
          {hint}
        </Txt>
      ) : null}
    </Txt>
  );
}

/** Texto en mayúsculas pequeño (encabezados de bloque). */
export function Eyebrow({ children, style }) {
  const { colors } = useTheme();
  return (
    <Txt
      style={[
        {
          fontSize: 12,
          fontWeight: "700",
          letterSpacing: 0.6,
          color: colors.textSecondary,
          textTransform: "uppercase",
        },
        style,
      ]}
    >
      {children}
    </Txt>
  );
}

/* ---------- Superficies ---------- */
export function Card({ children, style, onPress, pad = 16, ...rest }) {
  const { colors } = useTheme();
  const Wrap = onPress ? TouchableOpacity : View;
  return (
    <Wrap
      onPress={onPress}
      activeOpacity={0.85}
      {...rest}
      style={[
        {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 16,
          padding: pad,
        },
        style,
      ]}
    >
      {children}
    </Wrap>
  );
}

/** Contenedor de filas con divisores (listas dentro de una tarjeta). */
export function ListCard({ children, style }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 16,
          overflow: "hidden",
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function tone(colors, t) {
  return colors[t] || colors.neutral;
}

/** Cuadro de icono con fondo suave. */
export function Tile({
  icon,
  d,
  soft,
  fg,
  size = 40,
  radius = 12,
  iconSize = 20,
  children,
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: soft,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children || <Icon name={icon} d={d} size={iconSize} color={fg} />}
    </View>
  );
}

export function Pill({ label, bg, fg, style }) {
  return (
    <View
      style={[
        {
          alignSelf: "flex-start",
          backgroundColor: bg,
          borderRadius: 999,
          paddingHorizontal: 8,
          paddingVertical: 3,
        },
        style,
      ]}
    >
      <Txt style={{ fontSize: 11, fontWeight: "700", color: fg }}>{label}</Txt>
    </View>
  );
}

/** Pill según tono: ok | warn | danger | info | neutral. */
export function TonePill({ label, toneName, style }) {
  const { colors } = useTheme();
  const t =
    toneName === "neutral"
      ? { bg: colors.chip, fg: colors.textSecondary }
      : colors[toneName] || colors.ok;
  return <Pill label={label} bg={t.bg} fg={t.fg} style={style} />;
}

/* ---------- Controles ---------- */
/** Chip tipo píldora (selección única). */
export function Chip({ label, active, color, onPress, style }) {
  const { colors } = useTheme();
  const c = color || colors.accent;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityState={{ selected: !!active }}
      style={[
        {
          minHeight: 44,
          paddingHorizontal: 14,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: active ? c : colors.border,
          backgroundColor: active ? c : colors.surface,
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      <Txt
        style={{
          fontSize: 13,
          fontWeight: "600",
          color: active ? "#ffffff" : colors.text,
        }}
      >
        {label}
      </Txt>
    </TouchableOpacity>
  );
}

export function ChipRow({ children, scroll = false }) {
  if (scroll)
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingBottom: 2 }}
      >
        {children}
      </ScrollView>
    );
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {children}
    </View>
  );
}

/** Pestañas segmentadas. items: [{label, active, onPress}] */
export function Segmented({ items, height = 44, fontSize = 13, tint }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 4,
        padding: 4,
        backgroundColor: colors.segment,
        borderRadius: 14,
      }}
    >
      {items.map((it) => (
        <TouchableOpacity
          key={it.label}
          onPress={it.onPress}
          activeOpacity={0.8}
          accessibilityState={{ selected: !!it.active }}
          style={{
            flex: 1,
            minHeight: height,
            borderRadius: 10,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: it.active
              ? it.activeBg || colors.surface
              : "transparent",
          }}
        >
          <Txt
            style={{
              fontSize: fontSize,
              fontWeight: "700",
              color: it.active
                ? it.activeFg || colors.text
                : colors.textSecondary,
            }}
          >
            {it.label}
          </Txt>
        </TouchableOpacity>
      ))}
    </View>
  );
}

/** Selector de moneda de visualización (USD / VES BCV / USDT Binance). */
export function DispTabs({ height = 44 }) {
  const { disp, setDisp } = useData();
  const items = [
    ["usd", "USD"],
    ["bcv", "VES BCV"],
    ["bin", "USDT Binance"],
  ].map(([k, label]) => ({
    label,
    active: disp === k,
    onPress: () => setDisp(k),
  }));
  return <Segmented items={items} height={height} />;
}

export function Button({
  label,
  onPress,
  bg,
  disabled,
  style,
  icon,
  outline,
  color,
  height = 52,
  loading,
}) {
  const { colors } = useTheme();
  const bgc = disabled ? colors.disabled : bg || colors.accent;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      accessibilityState={{ disabled: !!disabled }}
      style={[
        {
          height,
          borderRadius: 16,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: 8,
          backgroundColor: outline ? colors.surface : bgc,
          borderWidth: outline ? 1 : 0,
          borderColor: color ? color : colors.border,
        },
        style,
      ]}
    >
      {icon ? (
        <Icon
          name={icon}
          size={18}
          color={outline ? color || colors.text : "#ffffff"}
          stroke={2}
        />
      ) : null}
      <Txt
        style={{
          fontSize: 15,
          fontWeight: "700",
          color: outline ? color || colors.text : "#ffffff",
        }}
      >
        {loading ? "Guardando…" : label}
      </Txt>
    </TouchableOpacity>
  );
}

export function Field({ label, hint, style, inputStyle, error, ...input }) {
  const { colors } = useTheme();
  return (
    <View style={[{ gap: 6 }, style]}>
      {label ? <Label hint={hint}>{label}</Label> : null}
      <Input
        {...input}
        style={[
          {
            minHeight: 48,
            borderWidth: 1,
            borderColor: error ? colors.danger.border : colors.border,
            borderRadius: 12,
            backgroundColor: colors.surface,
            paddingHorizontal: 14,
            fontSize: 15,
          },
          inputStyle,
        ]}
      />
    </View>
  );
}

/** Opciones de moneda: tarjetas con etiqueta y tasa. */
export function CcyOptions({ options, tint }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      {options.map((o) => (
        <TouchableOpacity
          key={o.label}
          onPress={o.onPress}
          activeOpacity={0.85}
          accessibilityState={{ selected: !!o.active }}
          style={{
            flex: 1,
            minHeight: 60,
            borderRadius: 14,
            borderWidth: 1.5,
            borderColor: o.active ? tint.strong : colors.border,
            backgroundColor: o.active ? tint.soft : colors.surface,
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
            paddingHorizontal: 4,
          }}
        >
          <Txt style={{ fontSize: 13, fontWeight: "700" }}>{o.label}</Txt>
          <Txt style={{ fontSize: 12, color: colors.textSecondary }}>
            {o.sub}
          </Txt>
        </TouchableOpacity>
      ))}
    </View>
  );
}

/** Filas de equivalencias en las 3 monedas. rows: [{label, sub, value, active}] */
export function ConvRows({ rows, tint, title }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      {title ? <Eyebrow>{title}</Eyebrow> : null}
      {rows.map((r) => (
        <View
          key={r.label}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: r.active && tint ? tint.soft : colors.surfaceAlt,
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}
        >
          <View style={{ gap: 1, flexShrink: 1 }}>
            <Txt style={{ fontSize: 13, fontWeight: "700" }}>{r.label}</Txt>
            <Txt style={{ fontSize: 12, color: colors.textSecondary }}>
              {r.sub}
            </Txt>
          </View>
          <Txt style={{ fontSize: 16, fontWeight: "800" }}>{r.value}</Txt>
        </View>
      ))}
    </View>
  );
}

export function ProgressBar({ pct, color, height = 8 }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        height,
        borderRadius: height,
        backgroundColor: colors.chip,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          width: `${Math.max(0, Math.min(100, pct))}%`,
          height,
          borderRadius: height,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

/** Fila de movimiento. `row` viene de utils/ledger (rowOf/abonoRow/transferRow). */
export function MovRow({ row, onPress, bordered = false, style }) {
  const { colors } = useTheme();
  const t = tone(colors, row.tone);
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityLabel={row.title}
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingVertical: 12,
          paddingHorizontal: 14,
          backgroundColor: colors.surface,
          ...(bordered
            ? {
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 14,
              }
            : {}),
        },
        style,
      ]}
    >
      <Tile icon={row.icon} soft={t.soft} fg={t.fg} />
      <View style={{ flex: 1, gap: 2 }}>
        <Txt numberOfLines={1} style={{ fontSize: 14, fontWeight: "700" }}>
          {row.title}
        </Txt>
        <Txt
          numberOfLines={1}
          style={{ fontSize: 12, color: colors.textSecondary }}
        >
          {row.sub}
        </Txt>
      </View>
      <View style={{ alignItems: "flex-end", gap: 3, maxWidth: "42%" }}>
        <Txt
          style={{
            fontSize: bordered ? 15 : 14,
            fontWeight: "800",
            color: t.fg,
          }}
        >
          {row.amount}
        </Txt>
        {row.date ? (
          <Txt
            style={{
              fontSize: 11,
              fontWeight: "600",
              color: colors.textSecondary,
              textAlign: "right",
            }}
          >
            {row.date}
          </Txt>
        ) : null}
        {bordered && row.line2 ? (
          <Txt
            style={{
              fontSize: 11,
              fontWeight: "600",
              color: row.line2Danger ? colors.danger.fg : colors.textSecondary,
              textAlign: "right",
            }}
          >
            {row.line2}
          </Txt>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

export function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: 1, backgroundColor: colors.divider }} />;
}

export function Empty({ text }) {
  const { colors } = useTheme();
  return (
    <Txt
      style={{
        fontSize: 13,
        color: colors.textSecondary,
        textAlign: "center",
        paddingVertical: 16,
      }}
    >
      {text}
    </Txt>
  );
}

/** Aviso (saldo bajo, etc.). */
export function AlertRow({ title, sub, onPress }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderWidth: 1,
        borderColor: colors.warn.border,
        borderRadius: 14,
        backgroundColor: colors.warn.bg,
      }}
    >
      <Icon name="warn" size={20} color={colors.warn.fg} stroke={2} />
      <View style={{ flex: 1, gap: 2 }}>
        <Txt style={{ fontSize: 13, fontWeight: "700", color: colors.warn.fg }}>
          {title}
        </Txt>
        <Txt style={{ fontSize: 12, color: colors.warn.fg }}>{sub}</Txt>
      </View>
      <Icon name="chevronRight" size={16} color={colors.warn.fg} stroke={2} />
    </TouchableOpacity>
  );
}

/** Ojito para mostrar/ocultar montos (sobre fondos oscuros). */
export function EyeButton({
  hidden,
  onPress,
  color = "rgba(255,255,255,0.9)",
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityLabel={hidden ? "Mostrar saldo" : "Ocultar saldo"}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={{
        width: 36,
        height: 36,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon
        name={hidden ? "eyeOff" : "eye"}
        size={20}
        color={color}
        stroke={1.8}
      />
    </TouchableOpacity>
  );
}

/** Toast global; se dibuja una sola vez en el navegador raíz. */
export function Toast({ bottom = 100 }) {
  const insets = useSafeAreaInsets();
  const { toast, hideToast } = useData();
  const { colors, isDark } = useTheme();
  if (!toast) return null;
  return (
    <View
      style={{
        position: "absolute",
        left: 16,
        right: 16,
        bottom: bottom + insets.bottom,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 14,
        backgroundColor: colors.toast,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        zIndex: 50,
        ...Platform.select({ android: { elevation: 12 } }),
      }}
    >
      <Txt
        style={{
          flex: 1,
          fontSize: 13,
          fontWeight: "600",
          color: isDark ? "#0f1712" : "#ffffff",
        }}
      >
        {toast}
      </Txt>
      <TouchableOpacity
        onPress={hideToast}
        style={{
          minHeight: 44,
          paddingHorizontal: 10,
          justifyContent: "center",
          borderRadius: 8,
          backgroundColor: "rgba(255,255,255,0.14)",
        }}
      >
        <Txt
          style={{
            fontSize: 12,
            fontWeight: "700",
            color: isDark ? "#0f1712" : "#ffffff",
          }}
        >
          Cerrar
        </Txt>
      </TouchableOpacity>
    </View>
  );
}

export { Icon, UI };
