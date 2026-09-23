import { Platform } from "react-native";

export function runningOnEmulator() {
  if (Platform.OS !== "android") return false;
  const info = Platform.constants as { Fingerprint?: string; Model?: string; Brand?: string; Manufacturer?: string };
  const haystack = `${info.Fingerprint ?? ""} ${info.Model ?? ""} ${info.Brand ?? ""} ${info.Manufacturer ?? ""}`.toLowerCase();
  return haystack.includes("generic") || haystack.includes("emulator") || haystack.includes("sdk_gphone") || haystack.includes("android sdk");
}
