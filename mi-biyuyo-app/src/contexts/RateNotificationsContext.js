import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "./AuthContext";
import { getAnnouncements } from "../services/api/announcementsService";
import { useExchangeRate } from "./ExchangeRateContext";
import * as watcher from "../services/rateWatcher";

const Ctx = createContext(null);

const safeParse = (raw, fallback) => {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

/**
 * Avisos de la campanita: nuevas tasas BCV detectadas cada día y anuncios del equipo de
 * Mi Biyuyo (llegan de la API). De cada anuncio, el teléfono solo recuerda si ya lo leíste
 * o lo quitaste de tu lista.
 */
export function RateNotificationsProvider({ children }) {
  const { rates, updateManual } = useExchangeRate();
  const { token, user } = useAuth();
  const uid = user?.id;
  const [items, setItems] = useState([]);
  const [remote, setRemote] = useState([]); // anuncios vigentes que devolvió la API
  const [seen, setSeen] = useState({}); // { [id]: { read, removed } }

  const annKey = `@mb_announcements_state_${uid}`;
  const annCacheKey = `@mb_announcements_cache_${uid}`;

  // Estado local y última lista conocida (la campanita funciona sin conexión)
  useEffect(() => {
    if (!uid) {
      setRemote([]);
      setSeen({});
      return;
    }
    (async () => {
      try {
        const [st, ca] = await AsyncStorage.multiGet([annKey, annCacheKey]);
        setSeen(safeParse(st[1], {}));
        setRemote(safeParse(ca[1], []));
      } catch {}
    })();
  }, [uid, annKey, annCacheKey]);

  const saveSeen = useCallback(
    (next) => {
      setSeen(next);
      AsyncStorage.setItem(annKey, JSON.stringify(next)).catch(() => {});
    },
    [annKey],
  );

  // Consulta los anuncios al abrir la app y cada vez que vuelve a primer plano
  const pullAnnouncements = useCallback(async () => {
    if (!token || !uid) return;
    try {
      const list = await getAnnouncements(token);
      if (!Array.isArray(list)) return;
      setRemote(list);
      AsyncStorage.setItem(annCacheKey, JSON.stringify(list)).catch(() => {});
      // Olvida el estado de anuncios que ya no existen
      setSeen((prev) => {
        const ids = new Set(list.map((a) => String(a.id)));
        const kept = Object.fromEntries(
          Object.entries(prev).filter(([k]) => ids.has(k)),
        );
        if (Object.keys(kept).length !== Object.keys(prev).length)
          AsyncStorage.setItem(annKey, JSON.stringify(kept)).catch(() => {});
        return Object.keys(kept).length !== Object.keys(prev).length
          ? kept
          : prev;
      });
    } catch {
      // Sin conexión: se queda con la última lista
    }
  }, [token, uid, annKey, annCacheKey]);

  useEffect(() => {
    pullAnnouncements();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") pullAnnouncements();
    });
    return () => sub.remove();
  }, [pullAnnouncements]);

  const announcements = useMemo(
    () =>
      remote
        .filter((a) => !seen[a.id]?.removed)
        .map((a) => ({
          id: `a${a.id}`,
          rawId: a.id,
          kind: "announcement",
          title: a.title,
          message: a.body,
          screen: a.screen || null,
          createdAt: a.starts_at,
          read: !!seen[a.id]?.read,
        })),
    [remote, seen],
  );

  const removeAnnouncement = useCallback(
    (rawId) =>
      saveSeen({
        ...seen,
        [rawId]: { ...seen[rawId], read: true, removed: true },
      }),
    [seen, saveSeen],
  );

  const refresh = useCallback(async () => {
    setItems(await watcher.getNotifications());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Recordar la tasa BCV vigente para avisar solo cuando la del día sea distinta
  useEffect(() => {
    if (Number(rates?.usd_to_ves) > 0 || Number(rates?.binance_to_ves) > 0)
      watcher.rememberCurrentRate(rates.usd_to_ves, rates.binance_to_ves);
  }, [rates?.usd_to_ves, rates?.binance_to_ves]);

  const apply = useCallback(
    async (item) => {
      await updateManual(item.rate || undefined, item.binanceRate || undefined);
      await watcher.updateNotification(item.id, {
        status: "applied",
        read: true,
      });
      await refresh();
    },
    [updateManual, refresh],
  );

  const dismiss = useCallback(
    async (item) => {
      await watcher.updateNotification(item.id, {
        status: "dismissed",
        read: true,
      });
      await refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    async (id) => {
      await watcher.removeNotification(id);
      await refresh();
    },
    [refresh],
  );

  const markAllRead = useCallback(async () => {
    await watcher.markAllRead();
    await refresh();
    if (announcements.some((a) => !a.read)) {
      const next = { ...seen };
      announcements.forEach((a) => {
        next[a.rawId] = { ...next[a.rawId], read: true };
      });
      saveSeen(next);
    }
  }, [refresh, announcements, seen, saveSeen]);

  const checkNow = useCallback(
    async (opts) => {
      const item = await watcher.runDailyCheck(opts);
      await refresh();
      return item;
    },
    [refresh],
  );

  return (
    <Ctx.Provider
      value={{
        items,
        announcements,
        removeAnnouncement,
        unread:
          items.filter((x) => !x.read).length +
          announcements.filter((x) => !x.read).length,
        refresh,
        apply,
        dismiss,
        remove,
        markAllRead,
        checkNow,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useRateNotifications = () => useContext(Ctx);
