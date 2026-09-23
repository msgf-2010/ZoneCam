import { deleteItem, getItem, setItem } from "./storage";

const TOKEN_KEY = "zonecam_token";
const API_KEY = "zonecam_api";

export async function getApiBase() {
  if (!__DEV__) {
    const configured = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "");
    if (!configured) throw new Error("This app is not connected to a ZoneCam server.");
    return configured;
  }
  return (await getItem(API_KEY)) || process.env.EXPO_PUBLIC_API_URL || "http://localhost:3001";
}

export async function setApiBase(url: string) {
  await setItem(API_KEY, url.replace(/\/$/, ""));
}

export async function getToken() {
  return getItem(TOKEN_KEY);
}

export async function setToken(token: string) {
  await setItem(TOKEN_KEY, token);
}

export async function clearToken() {
  await deleteItem(TOKEN_KEY);
}

export async function api(path: string, init: RequestInit = {}) {
  const token = await getToken();
  const base = await getApiBase();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, { ...init, headers });
  } catch {
    throw new Error(`Can't reach ${base}. Start the website on this computer, and keep the phone on the same network.`);
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}
