import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const THEME_KEY = "@mb_theme";

// Tokens tomados del prototipo (Main.dc.html). Ver DESIGN.md.
// Cada tipo de movimiento: strong (botones/bordes), fg (texto/iconos), soft (fondos).
export const COLORS = {
  light: {
    page: "#f4f7fb",
    surface: "#ffffff",
    surfaceAlt: "#f6f9f7",
    text: "#183127",
    textSecondary: "#5a6b61",
    muted: "#8a94a6",
    placeholder: "#8a94a6",
    border: "#d8e3db",
    divider: "#edf2ee",
    chip: "#eef2ef",
    segment: "#e6ede8",
    selected: "#eef3f0",
    disabled: "#9fb3a6",
    accent: "#1f7a59",
    accentDark: "#15533d",
    accentSoft: "#e8f5ef",
    accentFg: "#0f5a3f",
    link: "#245fd1",
    tabBar: "#ffffff",
    overlay: "rgba(0,0,0,0.45)",
    toast: "#183127",
    ingreso: { strong: "#1f7a59", fg: "#0f5a3f", soft: "#e8f5ef" },
    gasto: { strong: "#b8431a", fg: "#a83a12", soft: "#fdece4" },
    cobrar: { strong: "#245fd1", fg: "#1d4fb0", soft: "#e8f0fb" },
    pagar: { strong: "#4a3aa7", fg: "#4a3aa7", soft: "#f0edfb" },
    neutral: { strong: "#183127", fg: "#183127", soft: "#eef2ef" },
    ok: { bg: "#e8f5ef", fg: "#0f5a3f", border: "#bfe3d1" },
    warn: { bg: "#fff5de", fg: "#8a5a00", border: "#f0d9a3" },
    danger: { bg: "#ffe9e6", fg: "#a8342a", border: "#e9a19a" },
    info: { bg: "#ebf3ff", fg: "#245fd1", border: "#c9dcf7" },
    chartIncome: "#2a78d6",
    chartExpense: "#eb6834",
    kind: {
      efectivo: { fg: "#0f5a3f", soft: "#e8f5ef" },
      banco: { fg: "#1d4fb0", soft: "#e8f0fb" },
      digital: { fg: "#4a3aa7", soft: "#f0edfb" },
      otro: { fg: "#8a5a00", soft: "#fff5de" },
    },
  },
  dark: {
    page: "#0f1712",
    surface: "#18221c",
    surfaceAlt: "#1e2a23",
    text: "#e6efe9",
    textSecondary: "#a5b7ac",
    muted: "#7f8f86",
    placeholder: "#7f8f86",
    border: "#2c3a32",
    divider: "#233029",
    chip: "#223029",
    segment: "#1e2a23",
    selected: "#25352c",
    disabled: "#41564a",
    accent: "#3fb287",
    accentDark: "#15533d",
    accentSoft: "#173a2b",
    accentFg: "#7fd6b3",
    link: "#7aa7f5",
    tabBar: "#18221c",
    overlay: "rgba(0,0,0,0.6)",
    toast: "#e6efe9",
    ingreso: { strong: "#3fb287", fg: "#7fd6b3", soft: "#173a2b" },
    gasto: { strong: "#e0673a", fg: "#f2a07f", soft: "#3a2117" },
    cobrar: { strong: "#5b8def", fg: "#8fb2f7", soft: "#1a2842" },
    pagar: { strong: "#8b7be0", fg: "#b3a8f0", soft: "#26214a" },
    neutral: { strong: "#e6efe9", fg: "#e6efe9", soft: "#223029" },
    ok: { bg: "#173a2b", fg: "#7fd6b3", border: "#245a42" },
    warn: { bg: "#3a2d10", fg: "#f0c56a", border: "#5a4519" },
    danger: { bg: "#3d1e1a", fg: "#f2a19a", border: "#6a2f28" },
    info: { bg: "#1a2842", fg: "#8fb2f7", border: "#2b3f66" },
    chartIncome: "#4b93ea",
    chartExpense: "#f08050",
    kind: {
      efectivo: { fg: "#7fd6b3", soft: "#173a2b" },
      banco: { fg: "#8fb2f7", soft: "#1a2842" },
      digital: { fg: "#b3a8f0", soft: "#26214a" },
      otro: { fg: "#f0c56a", soft: "#3a2d10" },
    },
  },
};

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((v) => {
      if (v) setIsDark(v === "dark");
    });
  }, []);

  const toggle = async () => {
    const next = !isDark;
    setIsDark(next);
    await AsyncStorage.setItem(THEME_KEY, next ? "dark" : "light");
  };

  const colors = isDark ? COLORS.dark : COLORS.light;

  return (
    <ThemeContext.Provider value={{ isDark, colors, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
