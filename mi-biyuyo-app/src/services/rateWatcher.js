// Consulta diaria de la tasa oficial BCV (mismo enfoque que tienda-app).
// - Tarea en segundo plano (cada ~15 min): a partir de la hora configurada (7:00 a. m.)
//   consulta la tasa una vez al día y guarda un aviso para la campanita + una notificación local.
// - En primer plano (app abierta): DailyRateWatcher hace la misma consulta y pregunta si actualizar.
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { isRunningInExpoGo } from "expo";
import * as TaskManager from "expo-task-manager";
import { grp } from "../utils/money";

export const TASK_NAME = "daily-bcv-rate-check";

// Desde el SDK 53, Expo Go no soporta expo-notifications (ni tareas en segundo plano):
// con solo importarlos en Android lanzan un error. Por eso se cargan de forma diferida
// y únicamente fuera de Expo Go (APK / development build). En Expo Go la consulta con la
// app abierta y la campanita siguen funcionando.
const NATIVE_OK = Platform.OS !== "web" && !isRunningInExpoGo();
const loadNotifications = () => import("expo-notifications");
const loadBackgroundTask = () => import("expo-background-task");
const DOLARAPI = "https://ve.dolarapi.com/v1/dolares";
const BINANCE_API = "https://criptoya.com/api/binancep2p/USDT/VES/1"; // USDT en Binance P2P

// Hora de la consulta diaria (7:00 a. m.)
export const DEFAULT_SETTINGS = { enabled: true, hour: 7, minute: 0 };

const K_SETTINGS = "@mb_rate_daily_settings";
const K_LAST_FETCH = "@mb_rate_daily_last_fetch"; // YYYY-MM-DD de la última consulta
const K_NOTIFS = "@mb_rate_notifications";
const K_CURRENT = "@mb_rate_current"; // última tasa BCV conocida (para detectar cambios)
const MAX_NOTIFS = 60;

const pad = (n) => String(n).padStart(2, "0");
export const dateKey = (d = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const read = async (key, fallback) => {
  try {
    const v = await AsyncStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
};
const write = (key, value) => AsyncStorage.setItem(key, JSON.stringify(value));

/* ---------- ajustes ---------- */
export const getSettings = async () => ({
  ...DEFAULT_SETTINGS,
  ...(await read(K_SETTINGS, {})),
});
export const saveSettings = async (patch) =>
  write(K_SETTINGS, { ...(await getSettings()), ...patch });

/** Guarda las tasas vigentes del usuario (BCV y Binance), para avisar solo si cambian. */
export const rememberCurrentRate = (bcv, binance) =>
  write(K_CURRENT, { bcv: Number(bcv) || 0, binance: Number(binance) || 0 });

/* ---------- avisos de la campanita ---------- */
export const getNotifications = () => read(K_NOTIFS, []);

const saveNotifications = (list) => write(K_NOTIFS, list.slice(0, MAX_NOTIFS));

export async function addNotification(n) {
  const list = await getNotifications();
  const item = {
    id: `${Date.now()}`,
    createdAt: new Date().toISOString(),
    read: false,
    status: "pending", // pending | applied | dismissed
    ...n,
  };
  await saveNotifications([item, ...list]);
  return item;
}

export async function updateNotification(id, patch) {
  const list = await getNotifications();
  await saveNotifications(
    list.map((x) => (x.id === id ? { ...x, ...patch } : x)),
  );
}

export async function removeNotification(id) {
  const list = await getNotifications();
  await saveNotifications(list.filter((x) => x.id !== id));
}

export async function markAllRead() {
  const list = await getNotifications();
  await saveNotifications(list.map((x) => ({ ...x, read: true })));
}

export const unreadCount = async () =>
  (await getNotifications()).filter((x) => !x.read).length;

/* ---------- consulta a las APIs ---------- */
const getJson = async (url) => {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};
const num = (v) =>
  Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null;

/** Tasa oficial BCV (VES por 1 USD). */
export async function fetchBcvRate() {
  const list = await getJson(DOLARAPI);
  const item = (Array.isArray(list) ? list : []).find(
    (d) => d.fuente === "oficial",
  );
  const rate = num(item?.promedio);
  if (!rate) throw new Error("Tasa BCV inválida");
  return { rate, apiUpdatedAt: item?.fechaActualizacion || null };
}

/** USDT en Binance P2P (VES por 1 USDT). Respaldo: dólar paralelo de dolarapi. */
export async function fetchBinanceRate() {
  try {
    const d = await getJson(BINANCE_API);
    const vals = [num(d?.ask), num(d?.bid)].filter(Boolean);
    if (vals.length)
      return {
        rate: vals.reduce((a, n) => a + n, 0) / vals.length,
        source: "Binance P2P",
      };
  } catch {}
  const list = await getJson(DOLARAPI);
  const item = (Array.isArray(list) ? list : []).find(
    (d) => d.fuente === "paralelo",
  );
  const rate = num(item?.promedio);
  if (!rate) throw new Error("Tasa Binance inválida");
  return { rate, source: "Paralelo" };
}

/** Consulta BCV y Binance; falla solo si ninguna responde. */
export async function fetchRates() {
  const [bcv, bin] = await Promise.allSettled([
    fetchBcvRate(),
    fetchBinanceRate(),
  ]);
  if (bcv.status !== "fulfilled" && bin.status !== "fulfilled")
    throw new Error("No se pudieron consultar las tasas");
  return {
    bcv: bcv.status === "fulfilled" ? bcv.value.rate : null,
    binance: bin.status === "fulfilled" ? bin.value.rate : null,
    binanceSource: bin.status === "fulfilled" ? bin.value.source : null,
    apiUpdatedAt: bcv.status === "fulfilled" ? bcv.value.apiUpdatedAt : null,
  };
}

/**
 * Consulta la tasa si ya pasó la hora configurada y aún no se consultó hoy.
 * Devuelve el aviso creado (si la tasa cambió) o null.
 * `notify`: además lanza una notificación del sistema (segundo plano).
 */
export async function runDailyCheck({ notify = false, force = false } = {}) {
  const s = await getSettings();
  if (!s.enabled && !force) return null;

  const now = new Date();
  const pastTime =
    now.getHours() > s.hour ||
    (now.getHours() === s.hour && now.getMinutes() >= s.minute);
  if (!pastTime && !force) return null;

  const today = dateKey(now);
  if (!force && (await AsyncStorage.getItem(K_LAST_FETCH)) === today)
    return null;

  const fetched = await fetchRates();
  await AsyncStorage.setItem(K_LAST_FETCH, today);

  // Sin cambios respecto a las tasas que ya usa el usuario: no hay nada que avisar
  let current = await read(K_CURRENT, { bcv: 0, binance: 0 });
  if (typeof current === "number") current = { bcv: current, binance: 0 }; // formato anterior
  const differs = (a, b) => a != null && (!(b > 0) || Math.abs(a - b) >= 0.005);
  const changed =
    differs(fetched.bcv, current.bcv) ||
    differs(fetched.binance, current.binance);
  if (!changed && !force) return null;

  const parts = [];
  if (fetched.bcv) parts.push(`BCV: VES ${grp(fetched.bcv, ".", ",")} por USD`);
  if (fetched.binance)
    parts.push(`Binance: VES ${grp(fetched.binance, ".", ",")} por USDT`);
  const item = await addNotification({
    type: "exchange_rate",
    title: "Nuevas tasas disponibles",
    message: parts.join(" · ") + ".",
    rate: fetched.bcv,
    binanceRate: fetched.binance,
    source: ["BCV oficial", fetched.binance ? fetched.binanceSource : null]
      .filter(Boolean)
      .join(" · "),
    apiUpdatedAt: fetched.apiUpdatedAt,
  });

  if (notify) await notifyDevice(item.title, item.message);
  return item;
}

/* ---------- notificación del sistema ---------- */
export async function notifyDevice(title, body) {
  if (!NATIVE_OK) return;
  try {
    const Notifications = await loadNotifications();
    await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: null,
    });
  } catch (e) {
    console.warn("No se pudo mostrar la notificación:", e?.message);
  }
}

export async function setupNotifications() {
  if (!NATIVE_OK) return false;
  try {
    const Notifications = await loadNotifications();
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Avisos de tasa",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    const perm = await Notifications.getPermissionsAsync();
    if (perm.granted) return true;
    return (await Notifications.requestPermissionsAsync()).granted;
  } catch (e) {
    console.warn("Notificaciones no disponibles:", e?.message);
    return false;
  }
}

/* ---------- tarea en segundo plano ---------- */
if (NATIVE_OK) {
  TaskManager.defineTask(TASK_NAME, async () => {
    const BackgroundTask = await loadBackgroundTask();
    try {
      await runDailyCheck({ notify: true });
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch (e) {
      console.warn("Consulta diaria de tasa falló:", e?.message);
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

export async function registerBackgroundTask() {
  if (!NATIVE_OK) return false;
  try {
    const BackgroundTask = await loadBackgroundTask();
    const status = await BackgroundTask.getStatusAsync();
    if (status === BackgroundTask.BackgroundTaskStatus.Restricted) return false;
    if (await TaskManager.isTaskRegisteredAsync(TASK_NAME)) return true;
    await BackgroundTask.registerTaskAsync(TASK_NAME, { minimumInterval: 15 });
    return true;
  } catch (e) {
    console.warn("No se pudo registrar la tarea en segundo plano:", e?.message);
    return false;
  }
}

export async function unregisterBackgroundTask() {
  if (!NATIVE_OK) return;
  try {
    const BackgroundTask = await loadBackgroundTask();
    if (await TaskManager.isTaskRegisteredAsync(TASK_NAME))
      await BackgroundTask.unregisterTaskAsync(TASK_NAME);
  } catch {}
}
