import { useRef } from "react";
import { Keyboard } from "react-native";
import { scrollIntoView } from "../utils/keyboard";

/**
 * Pasa de un campo al siguiente con la tecla «Siguiente» del teclado.
 * Uso: const chain = useFocusChain(); <Input {...chain(0)} /> <Input {...chain(1, { last: true, onSubmit })} />
 * Si la pantalla usa su propio ScrollView, pásalo: useFocusChain(scrollRef).
 * Salta los campos que no estén en pantalla; el último cierra el teclado (o ejecuta onSubmit).
 */
export function useFocusChain(scrollRef) {
  const refs = useRef([]);

  const focusFrom = (i, onSubmit) => {
    const next = refs.current.findIndex((r, idx) => idx > i && !!r);
    if (next >= 0) refs.current[next].focus();
    else {
      Keyboard.dismiss();
      onSubmit?.();
    }
  };

  return (i, { last = false, onSubmit } = {}) => ({
    ref: (node) => {
      refs.current[i] = node;
    },
    returnKeyType: last ? "done" : "next",
    blurOnSubmit: false,
    submitBehavior: "submit", // sin cerrar el teclado al pasar al siguiente campo
    onFocus: scrollRef
      ? () => scrollIntoView(scrollRef, refs.current[i])
      : undefined,
    onSubmitEditing: () => focusFrom(i, onSubmit),
  });
}
