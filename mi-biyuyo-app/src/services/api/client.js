import axios from "axios";
import { Platform } from "react-native";

// La URL de la API sale de EXPO_PUBLIC_API_URL (archivo .env, ver .env.example).
// Sin la variable se usa la de desarrollo: localhost en web/iOS y 10.0.2.2 en el emulador de
// Android. En un celular físico hay que definirla con la IP de la PC o la URL del servidor.
const DEV_URL =
  Platform.OS === "android"
    ? "http://10.0.2.2:3001/api"
    : "http://localhost:3001/api";

export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_URL || DEV_URL
).replace(/\/+$/, "");

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

export function createAuthClient(token) {
  return axios.create({
    baseURL: API_BASE_URL,
    timeout: 15000,
    headers: { Authorization: `Bearer ${token}` },
  });
}

export default client;
