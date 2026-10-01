import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";

/** ¿Está abierto el teclado? */
export function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => setVisible(true),
    );
    const hide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setVisible(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return visible;
}

/**
 * Desplaza el ScrollView para que el campo enfocado quede visible sobre el teclado.
 * Espera un momento a que el teclado termine de abrirse y de reducir el área visible.
 */
export function scrollIntoView(scrollRef, node, offset = 110) {
  if (Platform.OS === "web" || !scrollRef?.current || !node) return;
  setTimeout(() => {
    const sv = scrollRef.current;
    const inner = sv?.getInnerViewRef?.();
    if (!inner || !node.measureLayout) return;
    node.measureLayout(
      inner,
      (_x, y) => sv.scrollTo({ y: Math.max(0, y - offset), animated: true }),
      () => {},
    );
  }, 280);
}
