import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "zonecam_token";
const API_KEY = "zonecam_api";

export async function getApiBase() {
  return (await SecureStore.getItemAsync(API_KEY)) || process.env.EXPO_PUBLIC_API_URL || "http://localhost:3001";
}

export async function setApiBase(url: string) {
  await SecureStore.setItemAsync(API_KEY, url.replace(/\/$/, ""));
}

export async function getToken() {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function api(path: string, init: RequestInit = {}) {
  const token = await getToken();
  const base = await getApiBase();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${base}${path}`, { ...init, headers });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}
