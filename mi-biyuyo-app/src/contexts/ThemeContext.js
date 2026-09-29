import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const THEME_KEY = "@mb_theme";

export const COLORS = {
  light: {
    accent: "#1B4332",
    accentStrong: "#0F2D20",
    accentSoft: "#D8F3DC",
    balanceCard: "#1B4332",
    income: "#2D6A4F",
    incomeSoft: "#D8F3DC",
    expense: "#E76F51",
    expenseSoft: "#FDE8DF",
    loan: "#457B9D",
    loanSoft: "#DDF0F8",
    debt: "#E9C46A",
    debtSoft: "#FDF5DC",
    success: "#2D6A4F",
    successSoft: "#D8F3DC",
    warning: "#E9A44A",
    warningSoft: "#FEF3DC",
    danger: "#E76F51",
    dangerSoft: "#FDE8DF",
    info: "#457B9D",
    infoSoft: "#DDF0F8",
    text: "#1A1A1A",
    textSecondary: "#444444",
    muted: "#888888",
    surface: "#FFFFFF",
    surfaceAlt: "#F5F4F0",
    page: "#FAF9F5",
    border: "#E8E6E0",
    borderLight: "#F0EEE8",
    overlay: "rgba(0,0,0,0.45)",
    tabBar: "#FFFFFF",
    vesBadge: "#1B4332",
    vesBadgeText: "#FFFFFF",
  },
  dark: {
    accent: "#52B788",
    accentStrong: "#40916C",
    accentSoft: "#1B4332",
    balanceCard: "#0F2D20",
    income: "#52B788",
    incomeSoft: "#1B4332",
    expense: "#E76F51",
    expenseSoft: "#3D1E14",
    loan: "#74C2E1",
    loanSoft: "#1A3040",
    debt: "#E9C46A",
    debtSoft: "#3A2D10",
    success: "#52B788",
    successSoft: "#1B4332",
    warning: "#E9A44A",
    warningSoft: "#3A2A10",
    danger: "#E76F51",
    dangerSoft: "#3D1E14",
    info: "#74C2E1",
    infoSoft: "#1A3040",
    text: "#F0EDE4",
    textSecondary: "#C8C4BA",
    muted: "#888880",
    surface: "#1E2018",
    surfaceAlt: "#252820",
    page: "#141610",
    border: "#2E3028",
    borderLight: "#252820",
    overlay: "rgba(0,0,0,0.6)",
    tabBar: "#1E2018",
    vesBadge: "#1B4332",
    vesBadgeText: "#D8F3DC",
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
