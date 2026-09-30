import React, { useState } from "react";
import { View, TouchableOpacity, Modal } from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { Txt, Icon } from "./ui";
import {
  daysAgo,
  fullDate,
  parseDate,
  todayStr,
  toDateStr,
} from "../utils/money";

const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];
const WEEK = ["L", "M", "M", "J", "V", "S", "D"];

/** Etiqueta amigable: "Hoy · 30/09/2026". */
function label(value) {
  const d = daysAgo(value);
  const prefix = d === 0 ? "Hoy · " : d === 1 ? "Ayer · " : "";
  return prefix + fullDate(value);
}

/**
 * Campo de fecha con calendario. value = "YYYY-MM-DD".
 * min / max acotan las fechas elegibles (por defecto: hasta hoy).
 */
export default function DateField({
  value,
  onChange,
  min,
  max,
  tint,
  compact = false, // solo la fecha (sin «Hoy»/«Ayer» ni «Cambiar»), para filtros en fila
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const today = todayStr();
  const maxD = max || today;
  const accent = tint ? tint.strong : colors.accent;

  const sel = parseDate(value);
  const [view, setView] = useState({ y: sel.getFullYear(), m: sel.getMonth() });

  const openCal = () => {
    const d = parseDate(value);
    setView({ y: d.getFullYear(), m: d.getMonth() });
    setOpen(true);
  };
  const shift = (n) =>
    setView((v) => {
      const d = new Date(v.y, v.m + n, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });

  const first = new Date(view.y, view.m, 1);
  const lead = (first.getDay() + 6) % 7; // semana desde lunes
  const total = new Date(view.y, view.m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= total; d++)
    cells.push(toDateStr(new Date(view.y, view.m, d)));

  const disabled = (s) => s > maxD || (min && s < min);
  const nextOff = toDateStr(new Date(view.y, view.m + 1, 1)) > maxD;
  const prevOff = min && toDateStr(new Date(view.y, view.m, 0)) < min;

  const pick = (s) => {
    onChange(s);
    setOpen(false);
  };

  const nav = (dir, off) => (
    <TouchableOpacity
      onPress={() => shift(dir)}
      disabled={off}
      accessibilityLabel={dir < 0 ? "Mes anterior" : "Mes siguiente"}
      style={{
        width: 44,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
        opacity: off ? 0.3 : 1,
      }}
    >
      <Icon
        name={dir < 0 ? "chevronLeft" : "chevronRight"}
        size={20}
        color={colors.text}
        stroke={2}
      />
    </TouchableOpacity>
  );

  return (
    <>
      <TouchableOpacity
        onPress={openCal}
        activeOpacity={0.85}
        accessibilityLabel="Cambiar fecha"
        style={{
          minHeight: 48,
          flexDirection: "row",
          alignItems: "center",
          gap: compact ? 8 : 10,
          paddingHorizontal: compact ? 10 : 14,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 12,
          backgroundColor: colors.surface,
        }}
      >
        <Icon name="calendar" size={20} color={accent} stroke={1.8} />
        <Txt
          numberOfLines={1}
          style={{ flex: 1, fontSize: compact ? 14 : 15, fontWeight: "600" }}
        >
          {compact ? fullDate(value) : label(value)}
        </Txt>
        {compact ? null : (
          <Txt style={{ fontSize: 13, fontWeight: "700", color: colors.link }}>
            Cambiar
          </Txt>
        )}
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setOpen(false)}
          style={{
            flex: 1,
            backgroundColor: colors.overlay,
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={{
              width: "100%",
              maxWidth: 360,
              backgroundColor: colors.surface,
              borderRadius: 20,
              padding: 14,
              gap: 8,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              {nav(-1, prevOff)}
              <Txt style={{ fontSize: 16, fontWeight: "800" }}>
                {MONTHS[view.m]} {view.y}
              </Txt>
              {nav(1, nextOff)}
            </View>
            <View style={{ flexDirection: "row" }}>
              {WEEK.map((w, i) => (
                <Txt
                  key={i}
                  style={{
                    width: `${100 / 7}%`,
                    textAlign: "center",
                    fontSize: 12,
                    fontWeight: "700",
                    color: colors.textSecondary,
                  }}
                >
                  {w}
                </Txt>
              ))}
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {cells.map((s, i) => {
                if (!s)
                  return (
                    <View
                      key={i}
                      style={{ width: `${100 / 7}%`, height: 44 }}
                    />
                  );
                const off = disabled(s);
                const on = s === value;
                return (
                  <View
                    key={i}
                    style={{ width: `${100 / 7}%`, height: 44, padding: 2 }}
                  >
                    <TouchableOpacity
                      disabled={off}
                      onPress={() => pick(s)}
                      accessibilityLabel={fullDate(s)}
                      style={{
                        flex: 1,
                        borderRadius: 999,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: on ? accent : "transparent",
                        borderWidth: s === today && !on ? 1 : 0,
                        borderColor: accent,
                      }}
                    >
                      <Txt
                        style={{
                          fontSize: 14,
                          fontWeight: on ? "800" : "600",
                          color: on
                            ? "#ffffff"
                            : off
                              ? colors.disabled
                              : colors.text,
                        }}
                      >
                        {parseDate(s).getDate()}
                      </Txt>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
            <View
              style={{ flexDirection: "row", justifyContent: "space-between" }}
            >
              <TouchableOpacity
                onPress={() => pick(today)}
                disabled={disabled(today)}
                style={{
                  minHeight: 44,
                  justifyContent: "center",
                  paddingHorizontal: 8,
                }}
              >
                <Txt
                  style={{
                    color: colors.link,
                    fontSize: 14,
                    fontWeight: "700",
                  }}
                >
                  Hoy
                </Txt>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setOpen(false)}
                style={{
                  minHeight: 44,
                  justifyContent: "center",
                  paddingHorizontal: 8,
                }}
              >
                <Txt
                  style={{
                    color: colors.textSecondary,
                    fontSize: 14,
                    fontWeight: "700",
                  }}
                >
                  Cancelar
                </Txt>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}
