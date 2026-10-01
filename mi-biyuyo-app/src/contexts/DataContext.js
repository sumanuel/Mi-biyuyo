import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "./AuthContext";
import { useExchangeRate } from "./ExchangeRateContext";
import * as ledgerService from "../services/api/ledgerService";
import * as transactionService from "../services/api/transactionService";
import * as categoryService from "../services/api/categoryService";
import { buildModel } from "../utils/ledger";

const THRESHOLD_KEY = "@mb_threshold";
// Cada país tiene su propio umbral (50 USD no sirve para pesos); Venezuela conserva la clave original
const thresholdKey = (country) =>
  country === "VE" ? THRESHOLD_KEY : `${THRESHOLD_KEY}_${country}`;
const HIDE_KEY = "@mb_hide_balance";
const DataContext = createContext(null);

export function errorMessage(err, fallback = "No se pudo completar la acción") {
  return err?.response?.data?.error || err?.message || fallback;
}

export function DataProvider({ children }) {
  const { token, profile } = useAuth();
  const { rates } = useExchangeRate();
  const [raw, setRaw] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [disp, setDisp] = useState("usd");
  const [threshold, setThresholdState] = useState(50);
  const [hideBalance, setHideBalance] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      setRaw(await ledgerService.getLedger(token));
      setError(null);
    } catch (err) {
      setError(errorMessage(err, "No se pudieron cargar tus datos"));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  // Al cambiar las tasas se recalculan las equivalencias; no hace falta recargar.
  useEffect(() => {
    AsyncStorage.getItem(thresholdKey(profile.country)).then((v) => {
      if (v !== null && !isNaN(Number(v))) setThresholdState(Number(v));
      else setThresholdState(profile.thresholdDefault);
    });
  }, [profile.country, profile.thresholdDefault]);

  useEffect(() => {
    AsyncStorage.getItem(HIDE_KEY).then((v) => setHideBalance(v === "1"));
  }, []);

  // Ojito de Mi saldo: oculta o muestra los montos (se recuerda entre sesiones)
  const toggleHideBalance = useCallback(() => {
    setHideBalance((h) => {
      AsyncStorage.setItem(HIDE_KEY, h ? "0" : "1");
      return !h;
    });
  }, []);

  const setThreshold = useCallback(
    (v) => {
      const n = Math.max(0, v);
      setThresholdState(n);
      AsyncStorage.setItem(thresholdKey(profile.country), String(n));
    },
    [profile.country],
  );

  const model = useMemo(() => {
    const r =
      Number(rates?.usd_to_ves) > 0 ? rates : raw?.rates || rates || null;
    return buildModel(raw, r, profile);
  }, [raw, rates, profile]);

  // dv(número) = USD de hoy convertido con la tasa vigente (saldos, pendientes).
  // dv({usd,bcv,bin}) = valor guardado el día del movimiento, sin recalcular.
  const dv = useCallback(
    (x) =>
      typeof x === "object" && x !== null
        ? model.fx.money(disp, x[disp])
        : model.fx.money(disp, model.fx.fromUsd(disp, x)),
    [model, disp],
  );

  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);
  const hideToast = useCallback(() => {
    clearTimeout(toastTimer.current);
    setToast(null);
  }, []);

  /* ---------- acciones (siempre refrescan el ledger) ---------- */
  const run = useCallback(
    async (fn) => {
      const result = await fn();
      await refresh();
      return result;
    },
    [refresh],
  );

  const actions = useMemo(
    () => ({
      createMovement: (body) =>
        run(() => transactionService.createTransaction(token, body)),
      updateMovement: (id, body) =>
        run(() => transactionService.updateTransaction(token, id, body)),
      reorderCategories: (ids) =>
        run(() => categoryService.reorderCategories(token, ids)),
      deleteMovement: (id) =>
        run(() => transactionService.deleteTransaction(token, id)),
      addPayment: (id, body) =>
        run(() => transactionService.createPayment(token, id, body)),
      deletePayment: (id, paymentId) =>
        run(() => transactionService.deletePayment(token, id, paymentId)),
      createEntity: (body) =>
        run(() => ledgerService.createEntity(token, body)),
      updateEntity: (id, body) =>
        run(() => ledgerService.updateEntity(token, id, body)),
      deleteEntity: (id) => run(() => ledgerService.deleteEntity(token, id)),
      createTransfer: (body) =>
        run(() => ledgerService.createTransfer(token, body)),
      deleteTransfer: (id) =>
        run(() => ledgerService.deleteTransfer(token, id)),
      getReceipt: (id) => ledgerService.getReceipt(token, id),
    }),
    [run, token],
  );

  return (
    <DataContext.Provider
      value={{
        model,
        loading,
        error,
        refresh,
        disp,
        setDisp,
        dv,
        threshold,
        setThreshold,
        hideBalance,
        toggleHideBalance,
        toast,
        showToast,
        hideToast,
        actions,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export const useData = () => useContext(DataContext);
