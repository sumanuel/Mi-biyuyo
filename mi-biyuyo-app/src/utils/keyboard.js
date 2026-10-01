import { useEffect, useState } from "react";
import { Keyboard, Platform, TextInput } from "react-native";

const SHOW = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
const HIDE = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

/** Altura del teclado (0 si está cerrado). */
export function useKeyboardHeight() {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener(SHOW, (e) =>
      setHeight(e?.endCoordinates?.height || 0),
    );
    const hide = Keyboard.addListener(HIDE, () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return height;
}

/** ¿Está abierto el teclado? */
export function useKeyboardVisible() {
  return useKeyboardHeight() > 0;
}

/**
 * Desplaza el ScrollView para que el campo enfocado quede visible sobre el teclado.
 * `delay` deja que el teclado termine de abrirse y de reducir el área visible.
 */
export function scrollIntoView(scrollRef, node, delay = 120, offset = 110) {
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
  }, delay);
}

/** Campo de texto que tiene el foco ahora mismo (si lo hay). */
export const focusedInput = () => TextInput.State?.currentlyFocusedInput?.();
