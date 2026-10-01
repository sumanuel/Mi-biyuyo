import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  PanResponder,
  View,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { useData } from "../../contexts/DataContext";
import { Screen, Txt, H1, Tile } from "../../components/ui";
import { META, TYPES } from "../../utils/ledger";

const GAP = 10;
const CELL_H = 112;
const EDGE = 70; // zona junto al borde donde la lista se desplaza sola mientras se arrastra

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

/** Mueve el elemento `id` a la posición `to`. */
function moveTo(ids, id, to) {
  const rest = ids.filter((x) => x !== id);
  rest.splice(to, 0, id);
  return rest;
}

/**
 * Elegir tipo de movimiento y categoría (pestaña "Registrar").
 * Mantén presionada una categoría y arrástrala para ponerla donde prefieras: el orden
 * se guarda en tu cuenta.
 */
export default function PickScreen({ navigation, route }) {
  const { colors } = useTheme();
  const { model, actions, showToast } = useData();
  const { width, fontScale } = useWindowDimensions();
  const [type, setType] = useState(route.params?.type || "gasto");

  // 3 columnas exactas; 2 en pantallas muy angostas (< 340 dp) o con letra muy grande (>= 1,3x),
  // donde los nombres no caben en tarjetas tan estrechas.
  const cols = width < 340 || fontScale >= 1.3 ? 2 : 3;
  const cellW = Math.floor((width - 32 - GAP * (cols - 1)) / cols);

  // Los accesos rápidos de Inicio y Deudas llegan con un tipo distinto.
  useEffect(() => {
    if (route.params?.type) setType(route.params.type);
  }, [route.params?.type, route.params?.ts]);

  const meta = META[type];
  const t = colors[type];
  const cats = model.cats.filter((c) => c.type === type && c.active);

  // Orden local mientras se arrastra y hasta que llegue el guardado del servidor
  const [order, setOrder] = useState(null);
  const serverKey = cats.map((c) => c.id).join(",");
  useEffect(() => setOrder(null), [serverKey, type]);
  const list = useMemo(
    () =>
      order
        ? order.map((id) => cats.find((c) => c.id === id)).filter(Boolean)
        : cats,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [order, serverKey],
  );

  /* ---------- arrastrar para reordenar ---------- */
  const [dragId, setDragId] = useState(null);
  const [scrollOn, setScrollOn] = useState(true);
  const pos = useRef(new Animated.ValueXY()).current;
  const gridRef = useRef(null);
  const scrollRef = useRef(null);
  const scrollY = useRef(0);
  const drag = useRef({ active: false });
  const touch = useRef({ x: 0, y: 0 }); // dónde apoyó el dedo
  // Valores actuales para el PanResponder (se crea una sola vez)
  const live = useRef({});
  live.current = { cols, cellW, list, type, actions, showToast };

  const stopAuto = () => {
    clearInterval(drag.current.timer);
    drag.current.timer = null;
  };

  const update = (moveX, moveY) => {
    const d = drag.current;
    if (!d.active) return;
    const { cols: c, cellW: w, list: items } = live.current;
    d.lastX = moveX;
    d.lastY = moveY;
    const gridY = d.gridY0 - (scrollY.current - d.scroll0);
    const relX = moveX - d.gridX;
    const relY = moveY - gridY;
    pos.setValue({ x: relX - d.offX, y: relY - d.offY });

    const rows = Math.ceil(items.length / c);
    const col = clamp(Math.floor(relX / (w + GAP)), 0, c - 1);
    const row = clamp(Math.floor(relY / (CELL_H + GAP)), 0, rows - 1);
    const to = Math.min(row * c + col, items.length - 1);
    if (to !== d.to) {
      d.to = to;
      d.ids = moveTo(d.ids, d.id, to);
      setOrder(d.ids);
    }

    // Se desplaza sola cerca de los bordes
    const dir =
      moveY < d.svTop + EDGE ? -1 : moveY > d.svTop + d.svH - EDGE ? 1 : 0;
    if (dir && !d.timer) {
      d.timer = setInterval(() => {
        const y = Math.max(0, scrollY.current + dir * 9);
        scrollRef.current?.scrollTo({ y, animated: false });
        scrollY.current = y;
        update(d.lastX, d.lastY);
      }, 16);
    } else if (!dir) stopAuto();
  };

  const finish = () => {
    const d = drag.current;
    if (!d.active) return;
    stopAuto();
    d.active = false;
    setDragId(null);
    setScrollOn(true);
    const changed = d.ids.join(",") !== d.startIds.join(",");
    if (changed) {
      live.current.actions.reorderCategories(d.ids).catch(() => {
        live.current.showToast("No se pudo guardar el orden");
        setOrder(null);
      });
    } else setOrder(null);
  };

  const pan = useRef(
    PanResponder.create({
      // Cuando ya hay un arrastre en curso, este contenedor toma los movimientos del dedo
      onMoveShouldSetPanResponderCapture: () => drag.current.active,
      onStartShouldSetPanResponderCapture: () => false,
      onPanResponderMove: (_e, g) => update(g.moveX, g.moveY),
      onPanResponderRelease: finish,
      onPanResponderTerminate: finish,
      onPanResponderTerminationRequest: () => !drag.current.active,
    }),
  ).current;

  const startDrag = (id, index) => {
    const { x: pageX, y: pageY } = touch.current;
    const { cols: c, cellW: w, list: items } = live.current;
    gridRef.current?.measureInWindow((gx, gy) => {
      scrollRef.current?.measureInWindow?.((_sx, sy, _sw, sh) => {
        const cellX = (index % c) * (w + GAP);
        const cellY = Math.floor(index / c) * (CELL_H + GAP);
        drag.current = {
          active: true,
          id,
          to: index,
          ids: items.map((x) => x.id),
          startIds: items.map((x) => x.id),
          gridX: gx,
          gridY0: gy,
          scroll0: scrollY.current,
          offX: pageX - gx - cellX,
          offY: pageY - gy - cellY,
          svTop: sy,
          svH: sh,
          lastX: pageX,
          lastY: pageY,
          timer: null,
        };
        pos.setValue({ x: cellX, y: cellY });
        setScrollOn(false);
        setDragId(id);
      });
    });
  };

  useEffect(() => stopAuto, []);

  const dragged = list.find((c) => c.id === dragId);

  const cell = (c, i, ghost = false) => (
    <View
      key={ghost ? "ghost" : c.id}
      style={{
        width: cellW,
        height: CELL_H,
        paddingVertical: 12,
        paddingHorizontal: 6,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: ghost ? t.strong : colors.border,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        opacity: !ghost && c.id === dragId ? 0.25 : 1,
      }}
    >
      <Tile
        icon={c.icon}
        soft={t.soft}
        fg={t.fg}
        size={cols === 2 ? 52 : 48}
        radius={16}
        iconSize={cols === 2 ? 26 : 24}
      />
      <Txt
        numberOfLines={2}
        style={{
          fontSize: 12.5,
          fontWeight: "600",
          lineHeight: 15,
          textAlign: "center",
        }}
      >
        {c.name}
      </Txt>
    </View>
  );

  return (
    <Screen scroll={false}>
      <View style={{ padding: 16, paddingTop: 20, paddingBottom: 12, gap: 14 }}>
        <H1>Nuevo movimiento</H1>
        <View
          style={{
            flexDirection: "row",
            gap: 4,
            padding: 4,
            backgroundColor: colors.segment,
            borderRadius: 14,
          }}
        >
          {TYPES.map((k) => {
            const active = k === type;
            return (
              <TouchableOpacity
                key={k}
                onPress={() => setType(k)}
                activeOpacity={0.8}
                accessibilityState={{ selected: active }}
                style={{
                  flex: 1,
                  minHeight: 44,
                  borderRadius: 10,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: active ? colors[k].strong : "transparent",
                }}
              >
                <Txt
                  style={{
                    fontSize: 12.5,
                    fontWeight: "700",
                    color: active ? "#ffffff" : colors.textSecondary,
                  }}
                >
                  {META[k].short}
                </Txt>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={{ gap: 2 }}>
          <Txt style={{ fontSize: 17, fontWeight: "800" }}>{meta.question}</Txt>
          <Txt style={{ fontSize: 13, color: colors.textSecondary }}>
            {meta.hint}
          </Txt>
          <Txt
            style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}
          >
            Mantén presionada una categoría y arrástrala para ordenarlas a tu
            gusto.
          </Txt>
        </View>
      </View>
      <ScrollView
        ref={scrollRef}
        scrollEnabled={scrollOn}
        scrollEventThrottle={16}
        onScroll={(e) => {
          scrollY.current = e.nativeEvent.contentOffset.y;
        }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 2,
          paddingBottom: 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View
          ref={gridRef}
          collapsable={false}
          {...pan.panHandlers}
          style={{ flexDirection: "row", flexWrap: "wrap", gap: GAP }}
        >
          {list.map((c, i) => (
            <TouchableOpacity
              key={c.id}
              activeOpacity={0.85}
              delayLongPress={350}
              onPress={() =>
                navigation.navigate("MovementForm", { catId: c.id })
              }
              onPressIn={(e) => {
                touch.current = {
                  x: e.nativeEvent.pageX,
                  y: e.nativeEvent.pageY,
                };
              }}
              onLongPress={() => startDrag(c.id, i)}
              accessibilityHint="Mantén presionado para moverla"
            >
              {cell(c, i)}
            </TouchableOpacity>
          ))}

          {dragged ? (
            <Animated.View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                zIndex: 20,
                elevation: 8,
                shadowColor: "#000",
                shadowOpacity: 0.25,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 6 },
                transform: [...pos.getTranslateTransform(), { scale: 1.06 }],
              }}
            >
              {cell(dragged, 0, true)}
            </Animated.View>
          ) : null}
        </View>
        {cats.length === 0 ? (
          <Txt style={{ color: colors.textSecondary, padding: 8 }}>
            No hay categorías para este tipo.
          </Txt>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
