// Pantallas que viven dentro del navegador de pestañas.
const TAB_SCREENS = new Set([
  "Home",
  "Entities",
  "Pick",
  "Stats",
  "Settings",
  "History",
  "Receivables",
  "Payables",
]);

/** Navega a cualquier pantalla, entrando por MainTabs cuando es una pestaña. */
export function go(navigation, name, params) {
  if (TAB_SCREENS.has(name)) {
    navigation.navigate("MainTabs", { screen: name, params });
  } else {
    navigation.navigate(name, params);
  }
}
