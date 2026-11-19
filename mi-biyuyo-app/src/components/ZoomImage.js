import React, { useMemo, useRef } from "react";
import { Animated, Image, PanResponder, View } from "react-native";

const MAX_SCALE = 5;
const DOUBLE_TAP_MS = 300;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const dist = (t) => Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY);

/**
 * Imagen con zoom: pellizca con dos dedos para acercar o alejar, arrastra con uno para mover
 * la imagen ya ampliada y toca dos veces para acercar o volver al tamaño original.
 */
export default function ZoomImage({ uri, style }) {
  const sc = useRef(new Animated.Value(1)).current;
  const tx = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(0)).current;
  const size = useRef({ w: 1, h: 1 });
  // Estado actual (fuera del render para que el PanResponder lo lea siempre al día)
  const st = useRef({
    scale: 1,
    x: 0,
    y: 0,
    touches: 0,
    pinchD: 0,
    pinchScale: 1,
    baseX: 0,
    baseY: 0,
    originDx: 0,
    originDy: 0,
    lastTap: 0,
  }).current;

  const apply = () => {
    const maxX = ((st.scale - 1) * size.current.w) / 2;
    const maxY = ((st.scale - 1) * size.current.h) / 2;
    st.x = clamp(st.x, -maxX, maxX);
    st.y = clamp(st.y, -maxY, maxY);
    sc.setValue(st.scale);
    tx.setValue(st.x);
    ty.setValue(st.y);
  };

  const animateTo = (scale, x, y) => {
    st.scale = scale;
    st.x = x;
    st.y = y;
    Animated.parallel([
      Animated.timing(sc, { toValue: scale, duration: 180, useNativeDriver: true }),
      Animated.timing(tx, { toValue: x, duration: 180, useNativeDriver: true }),
      Animated.timing(ty, { toValue: y, duration: 180, useNativeDriver: true }),
    ]).start();
  };

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          st.touches = 0;
          st.moved = false;
        },
        onPanResponderMove: (evt, gs) => {
          const t = evt.nativeEvent.touches;
          if (Math.abs(gs.dx) > 6 || Math.abs(gs.dy) > 6 || t.length > 1)
            st.moved = true;
          // Cuando cambia la cantidad de dedos se toma un nuevo punto de partida
          if (t.length !== st.touches) {
            st.touches = t.length;
            st.baseX = st.x;
            st.baseY = st.y;
            st.originDx = gs.dx;
            st.originDy = gs.dy;
            if (t.length >= 2) {
              st.pinchD = dist(t) || 1;
              st.pinchScale = st.scale;
            }
            return;
          }
          if (t.length >= 2) {
            st.scale = clamp((st.pinchScale * dist(t)) / st.pinchD, 1, MAX_SCALE);
            apply();
          } else if (st.scale > 1) {
            st.x = st.baseX + (gs.dx - st.originDx);
            st.y = st.baseY + (gs.dy - st.originDy);
            apply();
          }
        },
        onPanResponderRelease: () => {
          st.touches = 0;
          if (st.scale < 1.02) {
            animateTo(1, 0, 0);
          } else apply();
          if (st.moved) return;
          // Doble toque: acerca o vuelve al tamaño original
          const now = Date.now();
          if (now - st.lastTap < DOUBLE_TAP_MS) {
            st.lastTap = 0;
            if (st.scale > 1.05) animateTo(1, 0, 0);
            else animateTo(2.5, 0, 0);
          } else st.lastTap = now;
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <View
      {...pan.panHandlers}
      onLayout={(e) => {
        size.current = {
          w: e.nativeEvent.layout.width,
          h: e.nativeEvent.layout.height,
        };
      }}
      style={[{ overflow: "hidden" }, style]}
    >
      <Animated.View
        style={{
          flex: 1,
          transform: [{ translateX: tx }, { translateY: ty }, { scale: sc }],
        }}
      >
        <Image
          source={{ uri }}
          resizeMode="contain"
          style={{ width: "100%", height: "100%" }}
        />
      </Animated.View>
    </View>
  );
}
