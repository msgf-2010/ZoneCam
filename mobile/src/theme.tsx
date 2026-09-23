import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ActivityIndicator, SafeAreaView } from "react-native";
import { getItem, setItem } from "./storage";

const THEME_KEY = "zonecam_theme";

export type ThemeName = "dark" | "light";

export type Palette = {
  bg: string;
  elevated: string;
  ink: string;
  muted: string;
  faint: string;
  line: string;
  kicker: string;
  primary: string;
  primaryInk: string;
  danger: string;
  dangerBg: string;
  ok: string;
  okBg: string;
  busy: string;
  busyBg: string;
  chipBg: string;
  chipInk: string;
  inputBg: string;
  check: string;
  checkOn: string;
  statusBar: "light" | "dark";
};

export const themes: Record<ThemeName, Palette> = {
  dark: {
    bg: "#07141a",
    elevated: "#10262c",
    ink: "#f6f3ec",
    muted: "#c5d5d2",
    faint: "#8fb8b4",
    line: "rgba(255,255,255,0.12)",
    kicker: "#9cd7d2",
    primary: "#f3c27a",
    primaryInk: "#07141a",
    danger: "#fb7185",
    dangerBg: "rgba(251,113,133,0.14)",
    ok: "#7dcea0",
    okBg: "rgba(125,206,160,0.12)",
    busy: "#f3c27a",
    busyBg: "rgba(243,194,122,0.12)",
    chipBg: "rgba(156,215,210,0.14)",
    chipInk: "#9cd7d2",
    inputBg: "rgba(0,0,0,0.28)",
    check: "rgba(255,255,255,0.16)",
    checkOn: "#f3c27a",
    statusBar: "light",
  },
  light: {
    bg: "#f4f1ea",
    elevated: "#fffdf8",
    ink: "#142226",
    muted: "#57534e",
    faint: "#78716c",
    line: "#e7e0d4",
    kicker: "#1c4b5a",
    primary: "#1c4b5a",
    primaryInk: "#fffdf8",
    danger: "#b42318",
    dangerBg: "#fdecea",
    ok: "#0f766e",
    okBg: "#e7f6f2",
    busy: "#9a6b24",
    busyBg: "#f8edd6",
    chipBg: "#e7f0ef",
    chipInk: "#1c4b5a",
    inputBg: "#ffffff",
    check: "#e7e0d4",
    checkOn: "#1c4b5a",
    statusBar: "dark",
  },
};

type ThemeValue = {
  name: ThemeName;
  colors: Palette;
  setName: (name: ThemeName) => void;
};

const ThemeContext = createContext<ThemeValue | null>(null);

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside ThemeProvider");
  return value;
}

async function loadThemeName(): Promise<ThemeName> {
  const stored = await getItem(THEME_KEY);
  return stored === "light" ? "light" : "dark";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [name, setNameState] = useState<ThemeName | null>(null);

  useEffect(() => {
    loadThemeName()
      .then(setNameState)
      .catch(() => setNameState("dark"));
  }, []);

  const value = useMemo<ThemeValue | null>(() => {
    if (!name) return null;
    return {
      name,
      colors: themes[name],
      setName: (next) => {
        setNameState(next);
        void setItem(THEME_KEY, next);
      },
    };
  }, [name]);

  if (!value) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: themes.dark.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={themes.dark.kicker} />
      </SafeAreaView>
    );
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
