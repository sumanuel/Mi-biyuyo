// Adjuntar recibos: foto (cámara) o archivo (imagen/PDF). Devuelve { name, data (data URI) }.
import { Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";

const MAX_BYTES = 6 * 1024 * 1024;

export async function takePhoto() {
  if (Platform.OS !== "web") {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error("Permite el acceso a la cámara para tomar la foto");
  }
  const launch =
    Platform.OS === "web"
      ? ImagePicker.launchImageLibraryAsync
      : ImagePicker.launchCameraAsync;
  const res = await launch({ quality: 0.5, base64: true });
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  const mime = a.mimeType || "image/jpeg";
  return {
    name: a.fileName || "Foto_recibo.jpg",
    data: `data:${mime};base64,${a.base64}`,
  };
}

export async function pickFile() {
  const res = await DocumentPicker.getDocumentAsync({
    type: ["image/*", "application/pdf"],
    copyToCacheDirectory: true,
  });
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  if (a.size && a.size > MAX_BYTES)
    throw new Error("El archivo supera los 6 MB");
  const blob = await (await fetch(a.uri)).blob();
  const data = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(blob);
  });
  return { name: a.name || "Recibo", data };
}
