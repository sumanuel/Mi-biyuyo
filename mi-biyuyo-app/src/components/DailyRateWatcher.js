import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useRateNotifications } from "../contexts/RateNotificationsContext";
import { useData, errorMessage } from "../contexts/DataContext";
import * as watcher from "../services/rateWatcher";
import { confirm } from "../utils/confirm";

/**
 * Sin interfaz. Configura las notificaciones, registra la tarea en segundo plano y,
 * con la app abierta, consulta la tasa a la hora configurada (7:00 a. m.) y pregunta
 * si se desea actualizar.
 */
export default function DailyRateWatcher() {
  const { checkNow, apply, dismiss, items } = useRateNotifications();
  const { showToast } = useData();
  const asked = useRef(new Set());
  const busy = useRef(false);
  const timer = useRef(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const prompt = useCallback(async () => {
    // Aviso pendiente más reciente que aún no se ha preguntado en esta sesión
    const item = itemsRef.current.find(
      (x) =>
        x.type === "exchange_rate" &&
        x.status === "pending" &&
        !asked.current.has(x.id),
    );
    if (!item) return;
    asked.current.add(item.id);
    const ok = await confirm(
      "Actualizar tasas",
      `${item.message}\n\n¿Deseas actualizar tus tasas?`,
      "Actualizar",
    );
    try {
      if (ok) {
        await apply(item);
        showToast("Tasas actualizadas");
      } else {
        await dismiss(item);
      }
    } catch (err) {
      showToast(errorMessage(err, "No se pudo actualizar las tasas"));
    }
  }, [apply, dismiss, showToast]);

  const check = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      await checkNow();
    } catch (e) {
      console.warn("Consulta de tasa:", e?.message);
    } finally {
      busy.current = false;
    }
    // Espera un ciclo para que `items` ya refleje el aviso nuevo
    setTimeout(prompt, 300);
  }, [checkNow, prompt]);

  const scheduleNext = useCallback(async () => {
    clearTimeout(timer.current);
    const s = await watcher.getSettings();
    if (!s.enabled) return;
    const now = new Date();
    const next = new Date(now);
    next.setHours(s.hour, s.minute, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    timer.current = setTimeout(() => {
      check();
      scheduleNext();
    }, next - now);
  }, [check]);

  useEffect(() => {
    watcher.setupNotifications();
    watcher.registerBackgroundTask();
    check();
    scheduleNext();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        check();
        scheduleNext();
      }
    });
    return () => {
      sub.remove();
      clearTimeout(timer.current);
    };
  }, [check, scheduleNext]);

  return null;
}
