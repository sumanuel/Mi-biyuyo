import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "./AuthContext";
import { useData } from "./DataContext";

const GuideContext = createContext(null);
const keyOf = (uid) => `@mb_guide_${uid}`;

/**
 * Guía de primeros pasos. Los pasos se marcan solos según los datos de la cuenta:
 * tasas registradas, entidades, movimientos y detalle de compras; el último (ver
 * estadísticas) se marca al abrir esa pantalla. Las preferencias (tarjeta cerrada,
 * ayuda vista) se guardan por usuario en el dispositivo.
 */
export function GuideProvider({ children }) {
  const { user } = useAuth();
  const { model } = useData();
  const [prefs, setPrefs] = useState({
    dismissed: false,
    seen: false,
    statsVisited: false,
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    (async () => {
      try {
        const raw = user?.id
          ? await AsyncStorage.getItem(keyOf(user.id))
          : null;
        if (!cancelled && raw) setPrefs((p) => ({ ...p, ...JSON.parse(raw) }));
      } catch {}
      if (!cancelled) setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const update = useCallback(
    (patch) => {
      setPrefs((prev) => {
        const next = { ...prev, ...patch };
        if (user?.id)
          AsyncStorage.setItem(keyOf(user.id), JSON.stringify(next)).catch(
            () => {},
          );
        return next;
      });
    },
    [user?.id],
  );

  const steps = useMemo(() => {
    const { fx } = model;
    return [
      // Las tasas solo existen en Venezuela
      ...(fx.single
        ? []
        : [{ key: "rates", done: fx.ready("bcv") && fx.ready("bin") }]),
      { key: "entities", done: model.ents.length > 0 },
      { key: "moves", done: model.moves.length > 0 },
      {
        key: "details",
        done: model.moves.some((m) => m.items && m.items.length > 0),
      },
      { key: "stats", done: prefs.statsVisited },
    ];
  }, [model, prefs.statsVisited]);

  const doneCount = steps.filter((s) => s.done).length;
  // Quien ya tiene tasas, entidades, movimientos y detalle conoce la app: no se le insiste
  const basicsDone = steps
    .filter((s) => s.key !== "stats")
    .every((s) => s.done);
  const ready = loaded && model.ready;

  const value = {
    steps,
    doneCount,
    total: steps.length,
    firstPending: steps.find((s) => !s.done) || null,
    showCard: ready && !prefs.dismissed && !basicsDone,
    showDot: ready && !prefs.seen && !basicsDone,
    markSeen: useCallback(() => update({ seen: true }), [update]),
    dismiss: useCallback(
      () => update({ dismissed: true, seen: true }),
      [update],
    ),
    markStatsVisited: useCallback(
      () => update({ statsVisited: true }),
      [update],
    ),
  };

  return (
    <GuideContext.Provider value={value}>{children}</GuideContext.Provider>
  );
}

export const useGuide = () => useContext(GuideContext);
