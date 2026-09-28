import axios from "axios";

// Use your machine's LAN IP when testing on a physical device (e.g., 192.168.x.x)
export const API_BASE_URL = "http://localhost:3001/api";

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
