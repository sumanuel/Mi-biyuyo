// Recibos pendientes: fotos que el usuario toma con prisa para registrar el gasto después.
// Todo queda en el teléfono (fotos en la carpeta de la app y la lista en AsyncStorage, por usuario):
// no se sube nada al servidor, no hace falta Premium y se pierde si se desinstala la app.
import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "../contexts/AuthContext";

export const MAX_PENDING = 50;
const DIR = () => `${FileSystem.documentDirectory}recibos-pendientes/`;
const KEY = (uid) => `@mb_pending_receipts_${uid}`;

// Lista en memoria por usuario + oyentes (Inicio, lista, formulario y Elegir categoría la comparten)
const cache = {};
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());

async function readList(uid) {
  if (cache[uid]) return cache[uid];
  let list = [];
  try {
    const raw = await AsyncStorage.getItem(KEY(uid));
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) list = parsed;
  } catch {
    list = [];
  }
  cache[uid] = list;
  return list;
}

async function writeList(uid, list) {
  cache[uid] = list;
  await AsyncStorage.setItem(KEY(uid), JSON.stringify(list));
  emit();
}

/** Abre la cámara y deja la foto en la carpeta de la app. Devuelve { id, uri } o null si cancela. */
export async function captureReceipt(uid) {
  if (Platform.OS === "web")
    throw new Error("Los recibos pendientes solo están en el teléfono");
  if ((await readList(uid)).length >= MAX_PENDING)
    throw new Error(
      `Ya tienes ${MAX_PENDING} recibos pendientes. Elimina alguno para guardar otro`,
    );
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted)
    throw new Error("Permite el acceso a la cámara para tomar la foto");
  const res = await ImagePicker.launchCameraAsync({ quality: 0.5 });
  if (res.canceled || !res.assets?.length) return null;
  await FileSystem.makeDirectoryAsync(DIR(), { intermediates: true }).catch(
    () => {},
  );
  const id = `r${Date.now()}`;
  const uri = `${DIR()}${id}.jpg`;
  await FileSystem.copyAsync({ from: res.assets[0].uri, to: uri });
  return { id, uri };
}

/** Guarda en la lista una foto ya tomada, con su descripción opcional. */
export async function saveReceipt(uid, { id, uri }, note) {
  const list = await readList(uid);
  await writeList(uid, [
    { id, uri, note: String(note || "").trim(), at: Date.now() },
    ...list,
  ]);
}

/** Borra la foto del teléfono (sin tocar la lista): para cuando se cancela antes de guardar. */
export const discardFile = (uri) =>
  FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});

export async function setReceiptNote(uid, id, note) {
  const list = await readList(uid);
  await writeList(
    uid,
    list.map((r) =>
      r.id === id ? { ...r, note: String(note || "").trim() } : r,
    ),
  );
}

export async function removeReceipt(uid, id) {
  const list = await readList(uid);
  const r = list.find((x) => x.id === id);
  if (r) await discardFile(r.uri);
  await writeList(
    uid,
    list.filter((x) => x.id !== id),
  );
}

/** La foto como data URI, lista para adjuntarla como recibo del movimiento (Premium). */
export async function receiptData(r) {
  const b64 = await FileSystem.readAsStringAsync(r.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return `data:image/jpeg;base64,${b64}`;
}

/** Lista de recibos pendientes del usuario actual (más reciente primero) y sus acciones. */
export function usePendingReceipts() {
  const { user } = useAuth();
  const uid = user?.id;
  const [list, setList] = useState(() => (uid && cache[uid]) || []);

  useEffect(() => {
    if (!uid) {
      setList([]);
      return undefined;
    }
    let alive = true;
    const pull = () => readList(uid).then((l) => alive && setList(l));
    pull();
    listeners.add(pull);
    return () => {
      alive = false;
      listeners.delete(pull);
    };
  }, [uid]);

  const capture = useCallback(() => captureReceipt(uid), [uid]);
  const save = useCallback(
    (photo, note) => saveReceipt(uid, photo, note),
    [uid],
  );
  const setNote = useCallback(
    (id, note) => setReceiptNote(uid, id, note),
    [uid],
  );
  const remove = useCallback((id) => removeReceipt(uid, id), [uid]);

  return { list, capture, save, setNote, remove };
}
