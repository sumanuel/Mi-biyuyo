import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { useExchangeRate } from "./ExchangeRateContext";
import * as watcher from "../services/rateWatcher";

const Ctx = createContext(null);

/** Avisos de la campanita: nuevas tasas BCV detectadas cada día. */
export function RateNotificationsProvider({ children }) {
  const { rates, updateManual } = useExchangeRate();
  const [items, setItems] = useState([]);

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
  }, [refresh]);

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
        unread: items.filter((x) => !x.read).length,
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
