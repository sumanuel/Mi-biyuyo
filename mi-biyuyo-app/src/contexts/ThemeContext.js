import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const THEME_KEY = "@mb_theme";

export const COLORS = {
  light: {
    accent: "#4361EE",
    accentStrong: "#2D46C4",
    accentSoft: "#EEF2FF",
    income: "#22C55E",
    incomeSoft: "#DCFCE7",
    expense: "#EF4444",
    expenseSoft: "#FEE2E2",
    loan: "#6C7FFF",
    loanSoft: "#EDEDFF",
    debt: "#F59E0B",
    debtSoft: "#FEF3C7",
    success: "#22C55E",
    successSoft: "#DCFCE7",
    warning: "#F59E0B",
    warningSoft: "#FEF3C7",
    danger: "#EF4444",
    dangerSoft: "#FEE2E2",
    info: "#3B82F6",
    infoSoft: "#EFF6FF",
    text: "#1E1B4B",
    textSecondary: "#4B5563",
    muted: "#9CA3AF",
    surface: "#FFFFFF",
    surfaceAlt: "#F8FAFF",
    page: "#F5F7FF",
    border: "#E0E3F0",
    borderLight: "#F0F2FA",
    overlay: "rgba(30,27,75,0.5)",
    tabBar: "#FFFFFF",
  },
  dark: {
    accent: "#6C7FFF",
    accentStrong: "#4361EE",
    accentSoft: "#1E2240",
    income: "#4ADE80",
    incomeSoft: "#052E16",
    expense: "#F87171",
    expenseSoft: "#450A0A",
    loan: "#818CF8",
    loanSoft: "#1E1B4B",
    debt: "#FCD34D",
    debtSoft: "#451A03",
    success: "#4ADE80",
    successSoft: "#052E16",
    warning: "#FCD34D",
    warningSoft: "#451A03",
    danger: "#F87171",
    dangerSoft: "#450A0A",
    info: "#60A5FA",
    infoSoft: "#0C1A2E",
    text: "#E2E8F0",
    textSecondary: "#CBD5E1",
    muted: "#64748B",
    surface: "#1E1E2E",
    surfaceAlt: "#252535",
    page: "#13131F",
    border: "#2E2E45",
    borderLight: "#252535",
    overlay: "rgba(0,0,0,0.6)",
    tabBar: "#1E1E2E",
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
