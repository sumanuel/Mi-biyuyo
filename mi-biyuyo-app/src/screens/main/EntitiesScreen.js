import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, PanResponder, View, TouchableOpacity } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { useData } from "../../contexts/DataContext";
import {
  Screen,
  Txt,
  H1,
  Tile,
  DispTabs,
  Pill,
  Empty,
  Button,
  EyeButton,
} from "../../components/ui";
import { KIND_ICON, PT, balanceNote } from "../../utils/ledger";
import { ENT_CCY_LABEL, maskMoney } from "../../utils/money";

export function ptSummary(e) {
  const v = (e.pd || []).filter(Boolean);
  if (e.pt === "none" || !v.length || !PT[e.pt]) return "Sin datos de pago";
  return PT[e.pt].label + " · " + (e.pt === "pm" ? e.pd[1] || v[0] : v[0]);
}

const GAP = 8;
const EDGE = 70; // zona junto al borde donde la lista se desplaza sola mientras se arrastra

/** Mueve el elemento `id` a la posición `to`. */
function moveTo(ids, id, to) {
  const rest = ids.filter((x) => x !== id);
  rest.splice(to, 0, id);
  return rest;
}

/**
 * Lista de entidades. Mantén presionada una y arrástrala para ordenarlas a tu gusto:
 * el orden se guarda en tu cuenta.
 */
export default function EntitiesScreen({ navigation }) {
  const { colors } = useTheme();
  const { model, dv, hideBalance, toggleHideBalance, actions, showToast } =
    useData();
  const shareOf = (b) =>
    b < -0.005
      ? "Saldo negativo"
      : model.balance > 0 && b > 0
        ? Math.round((b / model.balance) * 100) + "% del total"
        : "0% del total";

  // Orden local mientras se arrastra y hasta que llegue el guardado del servidor
  const [order, setOrder] = useState(null);
  const serverKey = model.ents.map((e) => e.id).join(",");
  useEffect(() => setOrder(null), [serverKey]);
  const list = useMemo(
    () =>
      order
        ? order.map((id) => model.ents.find((e) => e.id === id)).filter(Boolean)
        : model.ents,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [order, serverKey],
  );

  /* ---------- arrastrar para reordenar ---------- */
  const [dragId, setDragId] = useState(null);
  const [scrollOn, setScrollOn] = useState(true);
  const [listW, setListW] = useState(0);
  const pos = useRef(new Animated.Value(0)).current;
  const listRef = useRef(null);
  const scrollRef = useRef(null);
  const scrollY = useRef(0);
  const heights = useRef({}); // alto de cada fila (varía según sus etiquetas)
  const drag = useRef({ active: false });
  const touch = useRef({ y: 0 });
  const live = useRef({});
  live.current = { list, actions, showToast };

  const stopAuto = () => {
    clearInterval(drag.current.timer);
    drag.current.timer = null;
  };

  const update = (moveY) => {
    const d = drag.current;
    if (!d.active) return;
    d.lastY = moveY;
    const listY = d.listY0 - (scrollY.current - d.scroll0);
    const relY = moveY - listY;
    pos.setValue(relY - d.offY);

    // Posición destino: cuántas filas (sin la arrastrada) quedan por encima del dedo
    let top = 0;
    let to = 0;
    d.startIds
      .filter((id) => id !== d.id)
      .forEach((id) => {
        const h = heights.current[id] || 0;
        if (top + h / 2 < relY) to += 1;
        top += h + GAP;
      });
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
        update(d.lastY);
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
    if (d.ids.join(",") !== d.startIds.join(",")) {
      live.current.actions.reorderEntities(d.ids).catch(() => {
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
      onPanResponderMove: (_e, g) => update(g.moveY),
      onPanResponderRelease: finish,
      onPanResponderTerminate: finish,
      onPanResponderTerminationRequest: () => !drag.current.active,
    }),
  ).current;

  const startDrag = (id, index) => {
    const { y: pageY } = touch.current;
    const items = live.current.list;
    listRef.current?.measureInWindow((_gx, gy) => {
      scrollRef.current?.measureInWindow?.((_sx, sy, _sw, sh) => {
        const rowY = items
          .slice(0, index)
          .reduce((a, x) => a + (heights.current[x.id] || 0) + GAP, 0);
        drag.current = {
          active: true,
          id,
          to: index,
          ids: items.map((x) => x.id),
          startIds: items.map((x) => x.id),
          listY0: gy,
          scroll0: scrollY.current,
          offY: pageY - gy - rowY,
          svTop: sy,
          svH: sh,
          lastY: pageY,
          timer: null,
        };
        pos.setValue(rowY);
        setScrollOn(false);
        setDragId(id);
      });
    });
  };

  useEffect(() => stopAuto, []);

  const dragged = list.find((e) => e.id === dragId);

  const row = (e, ghost) => {
    const k = colors.kind[e.kind] || colors.kind.otro;
    const b = model.entBal(e);
    return (
      <View
        onLayout={
          ghost
            ? undefined
            : (ev) => {
                heights.current[e.id] = ev.nativeEvent.layout.height;
              }
        }
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingVertical: 12,
          paddingHorizontal: 14,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: ghost ? colors.accent : colors.border,
          borderRadius: 14,
          opacity: !ghost && e.id === dragId ? 0.25 : 1,
        }}
      >
        <Tile
          icon={KIND_ICON[e.kind] || "card"}
          soft={k.soft}
          fg={k.fg}
          size={44}
          radius={14}
          iconSize={22}
        />
        <View style={{ flex: 1, gap: 3 }}>
          <Txt numberOfLines={1} style={{ fontSize: 15, fontWeight: "700" }}>
            {e.name}
          </Txt>
          <Txt
            numberOfLines={1}
            style={{ fontSize: 12, color: colors.textSecondary }}
          >
            {ENT_CCY_LABEL[e.ccy] + " · " + ptSummary(e)}
          </Txt>
        </View>
        <View style={{ alignItems: "flex-end", gap: 3, maxWidth: "40%" }}>
          <Txt style={{ fontSize: 15, fontWeight: "800" }}>{dv(b)}</Txt>
          {e.include ? (
            <Txt style={{ fontSize: 11, color: colors.textSecondary }}>
              {shareOf(b)}
            </Txt>
          ) : (
            <Pill
              label="No suma a Mi saldo"
              bg={colors.chip}
              fg={colors.textSecondary}
              style={{ alignSelf: "flex-end" }}
            />
          )}
          {model.isLow(e) ? (
            <Pill
              label="Saldo bajo"
              bg={colors.warn.bg}
              fg={colors.warn.fg}
              style={{ alignSelf: "flex-end" }}
            />
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <Screen
      pull
      innerRef={scrollRef}
      scrollEnabled={scrollOn}
      onScroll={(e) => {
        scrollY.current = e.nativeEvent.contentOffset.y;
      }}
    >
      <H1>Entidades</H1>
      <DispTabs height={40} />

      <View
        style={{
          backgroundColor: colors.accentDark,
          borderRadius: 20,
          paddingVertical: 18,
          paddingHorizontal: 20,
          gap: 4,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: -6,
            marginBottom: -4,
          }}
        >
          <Txt
            style={{
              fontSize: 12,
              fontWeight: "700",
              letterSpacing: 0.96,
              color: "rgba(255,255,255,0.85)",
            }}
          >
            SALDO TOTAL
          </Txt>
          <EyeButton hidden={hideBalance} onPress={toggleHideBalance} />
        </View>
        <Txt
          style={{
            fontSize: 30,
            fontWeight: "800",
            letterSpacing: -0.6,
            color: "#ffffff",
          }}
        >
          {hideBalance ? maskMoney(dv(model.balance)) : dv(model.balance)}
        </Txt>
        <Txt style={{ fontSize: 12, color: "rgba(255,255,255,0.85)" }}>
          {balanceNote(model)}
        </Txt>
      </View>

      <View
        ref={listRef}
        collapsable={false}
        onLayout={(ev) => setListW(ev.nativeEvent.layout.width)}
        {...pan.panHandlers}
        style={{ gap: GAP }}
      >
        {list.length === 0 ? (
          <Empty text="Aún no tienes entidades. Crea una para llevar tu saldo." />
        ) : null}
        {list.map((e, i) => (
          <TouchableOpacity
            key={e.id}
            activeOpacity={0.85}
            delayLongPress={350}
            onPress={() => navigation.navigate("EntityDetail", { id: e.id })}
            onPressIn={(ev) => {
              touch.current = { y: ev.nativeEvent.pageY };
            }}
            onLongPress={() => startDrag(e.id, i)}
            accessibilityLabel={`${e.name}, saldo ${dv(model.entBal(e))}`}
            accessibilityHint="Mantén presionado para moverla"
          >
            {row(e, false)}
          </TouchableOpacity>
        ))}

        {dragged ? (
          <Animated.View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: listW,
              zIndex: 20,
              elevation: 8,
              shadowColor: "#000",
              shadowOpacity: 0.25,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 6 },
              transform: [{ translateY: pos }, { scale: 1.02 }],
            }}
          >
            {row(dragged, true)}
          </Animated.View>
        ) : null}
      </View>
      {list.length > 1 ? (
        <Txt style={{ fontSize: 12, color: colors.textSecondary }}>
          Mantén presionada una entidad y arrástrala para ordenarlas a tu gusto.
        </Txt>
      ) : null}

      <View style={{ flexDirection: "row", gap: 10 }}>
        <Button
          label="Nueva entidad"
          height={50}
          style={{ flex: 1, borderRadius: 14 }}
          onPress={() => navigation.navigate("EntityForm")}
        />
        <Button
          label="Transferir"
          outline
          height={50}
          style={{ flex: 1, borderRadius: 14 }}
          disabled={model.ents.length < 2}
          onPress={() => navigation.navigate("Transfer")}
        />
      </View>
    </Screen>
  );
}
