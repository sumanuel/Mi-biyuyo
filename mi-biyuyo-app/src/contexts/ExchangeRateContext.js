import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import * as exchangeRateService from "../services/api/exchangeRateService";
import { useAuth } from "./AuthContext";

const ExchangeRateContext = createContext(null);

export function ExchangeRateProvider({ children }) {
  const { token } = useAuth();
  const [rates, setRates] = useState({
    usd_to_ves: 0,
    binance_to_ves: 0,
    source: "manual",
  });
  const [loading, setLoading] = useState(false);

  const loadRates = useCallback(async () => {
    if (!token) return;
    try {
      const data = await exchangeRateService.getRates(token);
      setRates(data);
    } catch {}
  }, [token]);

  useEffect(() => {
    loadRates();
  }, [loadRates]);

  const fetchExternal = useCallback(async () => {
    setLoading(true);
    try {
      const data = await exchangeRateService.fetchExternal(token);
      setRates(data);
      return data;
    } finally {
      setLoading(false);
    }
  }, [token]);

  const updateManual = useCallback(
    async (usdVes, binanceVes) => {
      const data = await exchangeRateService.updateRates(
        token,
        usdVes,
        binanceVes,
      );
      setRates(data);
    },
    [token],
  );

  /** Convierte un monto/moneda a los 3 tipos usando las tasas actuales. */
  const convert = useCallback(
    (amount, currency) => {
      const { usd_to_ves, binance_to_ves } = rates;
      const amt = parseFloat(amount) || 0;
      if (currency === "USD") {
        return {
          usd: amt,
          ves: usd_to_ves > 0 ? amt * usd_to_ves : 0,
          binance:
            binance_to_ves > 0 ? amt * (usd_to_ves / binance_to_ves) : amt,
        };
      }
      if (currency === "VES") {
        return {
          usd: usd_to_ves > 0 ? amt / usd_to_ves : 0,
          ves: amt,
          binance: binance_to_ves > 0 ? amt / binance_to_ves : 0,
        };
      }
      return {
        usd:
          usd_to_ves > 0 && binance_to_ves > 0
            ? amt * (binance_to_ves / usd_to_ves)
            : amt,
        ves: binance_to_ves > 0 ? amt * binance_to_ves : 0,
        binance: amt,
      };
    },
    [rates],
  );

  return (
    <ExchangeRateContext.Provider
      value={{
        rates,
        loading,
        loadRates,
        fetchExternal,
        updateManual,
        convert,
      }}
    >
      {children}
    </ExchangeRateContext.Provider>
  );
}

export const useExchangeRate = () => useContext(ExchangeRateContext);
