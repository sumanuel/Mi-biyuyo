import { Alert, Platform } from "react-native";

/** Pide confirmación al usuario. Resuelve true si acepta. */
export function confirm(title, message, okLabel = "Eliminar") {
  if (Platform.OS === "web") {
    // eslint-disable-next-line no-undef
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: "Cancelar", style: "cancel", onPress: () => resolve(false) },
        { text: okLabel, style: "destructive", onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
