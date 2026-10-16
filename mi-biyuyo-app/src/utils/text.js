// Utilidades de texto para agrupar y buscar nombres escritos de distintas formas.

/**
 * Minúsculas, sin tildes y sin espacios sobrantes: «  Jamón » → «jamon».
 * La eñe también se ignora («piña» = «pina»), porque muchos teclados no la tienen.
 */
export function plain(text) {
  return String(text ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Raíz aproximada de una palabra para que singular y plural coincidan: jamones → jamon,
// tomates → tomat, tomate → tomat, lápices → lapiz. No tiene que ser una palabra real:
// solo se usa como clave para agrupar. Las palabras de 3 letras o menos no se tocan.
function stemWord(word) {
  let s = word;
  if (s.length <= 3) return s;
  if (s.length > 4 && s.endsWith("ces"))
    s = s.slice(0, -3) + "z"; // lapices → lapiz
  else if (s.length > 4 && s.endsWith("es"))
    s = s.slice(0, -2); // limones → limon
  else if (s.endsWith("s")) s = s.slice(0, -1); // quesos → queso
  if (s.length > 3 && s.endsWith("e")) s = s.slice(0, -1); // tomate → tomat
  return s;
}

/**
 * Clave para agrupar ítems: ignora mayúsculas, tildes y plural.
 * «Jamón», «jamon» y «jamones» dan la misma clave.
 */
export function itemKey(name) {
  return plain(name).split(" ").map(stemWord).join(" ");
}

/** ¿`haystack` contiene `query`, sin importar mayúsculas ni tildes? */
export function textHas(haystack, query) {
  const q = plain(query);
  return !q || plain(haystack).includes(q);
}
