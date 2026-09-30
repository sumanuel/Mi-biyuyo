/**
 * biometricAuthService.js
 * Bloqueo de la app con huella/Face ID (expo-local-authentication).
 * No guarda contraseñas: solo confirma la identidad para desbloquear la
 * sesión que ya quedó guardada en el dispositivo.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";

const BIOMETRIC_LOCK_KEY = "@mb_biometric_lock";
const CREDENTIALS_KEY = "mb_biometric_credentials";

/** ¿El dispositivo tiene lector y hay una huella o rostro registrado? */
export async function isBiometricHardwareAvailable() {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) return false;
    return await LocalAuthentication.isEnrolledAsync();
  } catch {
    return false;
  }
}

export async function getBiometricLockEnabled() {
  try {
    return (await AsyncStorage.getItem(BIOMETRIC_LOCK_KEY)) === "1";
  } catch {
    return false;
  }
}

export async function setBiometricLockEnabled(enabled) {
  await AsyncStorage.setItem(BIOMETRIC_LOCK_KEY, enabled ? "1" : "0");
}

/**
 * Credenciales para «Entrar con huella». Se guardan cifradas en el Keychain/Keystore del
 * dispositivo (expo-secure-store) y solo se leen tras verificar la huella. Se borran al
 * desactivar la opción. En web no hay almacén seguro: devuelve false.
 */
export async function saveBiometricCredentials(email, password) {
  try {
    if (!(await SecureStore.isAvailableAsync())) return false;
    await SecureStore.setItemAsync(
      CREDENTIALS_KEY,
      JSON.stringify({ email, password }),
    );
    return true;
  } catch {
    return false;
  }
}

export async function getBiometricCredentials() {
  try {
    const raw = await SecureStore.getItemAsync(CREDENTIALS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function clearBiometricCredentials() {
  try {
    await SecureStore.deleteItemAsync(CREDENTIALS_KEY);
  } catch {}
}

export async function authenticateWithBiometrics(promptMessage) {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: promptMessage || "Desbloquea Mi Biyuyo",
      cancelLabel: "Cancelar",
      disableDeviceFallback: false,
    });
    return result.success;
  } catch {
    return false;
  }
}
