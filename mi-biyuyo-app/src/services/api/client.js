import axios from "axios";

// localhost funciona en emulador Android; para dispositivo físico usar IP LAN de la PC
export const API_BASE_URL = "http://192.168.1.2:3001/api";

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
