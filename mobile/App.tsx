import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, SafeAreaView, StatusBar as NativeStatusBar, ScrollView, Text, TextInput, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { api, clearToken, getApiBase, getToken, setApiBase, setToken } from "./src/api";
import { flushQueue } from "./src/sync";
import { watchConnection } from "./src/network";
import { FieldHome } from "./src/field-home";
import { ThemeProvider, useTheme } from "./src/theme";
import { useStyles } from "./src/styles";
import type { FieldSession } from "./src/field";

type Screen = "login" | "app";

export default function App() {
  return (
    <ThemeProvider>
      <FieldApp />
    </ThemeProvider>
  );
}

function FieldApp() {
  const { colors } = useTheme();
  const styles = useStyles(colors);
  const [screen, setScreen] = useState<Screen>("login");
  const [session, setSession] = useState<FieldSession | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (token) {
        try {
          const json = await api("/api/v1/auth/session");
          setSession(json.data);
          setScreen("app");
        } catch {
          await clearToken();
        }
      }
      setReady(true);
    })();
    const sub = watchConnection(() => {
      void flushQueue();
    });
    return () => sub();
  }, []);

  if (!ready) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.kicker} />
      </SafeAreaView>
    );
  }

  const statusBar = colors.statusBar;

  const androidTop = Platform.OS === "android" ? Math.max(NativeStatusBar.currentHeight ?? 0, 40) : 0;

  return (
    <SafeAreaView style={[styles.safe, androidTop ? { paddingTop: androidTop } : null]}>
      <StatusBar style={statusBar} />
      {screen === "login" ? (
        <LoginScreen
          onLoggedIn={(data) => {
            setSession(data);
            setScreen("app");
          }}
        />
      ) : null}
      {screen === "app" && session ? (
        <FieldHome
          session={session}
          onLogout={async () => {
            await clearToken();
            setSession(null);
            setScreen("login");
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

function LoginScreen({ onLoggedIn }: { onLoggedIn: (session: FieldSession) => void }) {
  const { colors } = useTheme();
  const styles = useStyles(colors);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [apiUrl, setApiUrl] = useState("http://localhost:3001");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    getApiBase().then(setApiUrl).catch(() => undefined);
  }, []);

  async function submit() {
    setPending(true);
    setError(null);
    try {
      if (__DEV__) await setApiBase(apiUrl.trim());
      const json = await api("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (!json.data?.token) throw new Error("No session token returned.");
      await setToken(json.data.token);
      onLoggedIn(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
      <View style={styles.topRow}>
        <Text style={styles.brand}>ZONECAM FIELD</Text>
        <ThemeToggle />
      </View>
      <Text style={styles.title}>Sign in</Text>
      <Text style={styles.help}>
        Your company has to invite you before this sign-in will work. Accept that email invite, then use the same email and password here. This app has no signup.
      </Text>
      {__DEV__ ? (
        <>
          <Text style={styles.label}>API URL</Text>
          <TextInput
            value={apiUrl}
            onChangeText={setApiUrl}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
            placeholderTextColor={colors.faint}
          />
        </>
      ) : null}
      <Text style={styles.label}>Email</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        style={styles.input}
        placeholderTextColor={colors.faint}
      />
      <Text style={styles.label}>Password</Text>
      <View style={styles.passwordField}>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.input, styles.passwordInput]}
          placeholderTextColor={colors.faint}
        />
        <Pressable
          onPress={() => setShowPassword((current) => !current)}
          hitSlop={8}
          style={({ pressed }) => [styles.passwordToggle, pressed && styles.pressed]}
          accessibilityLabel={showPassword ? "Hide password" : "Show password"}
        >
          <EyeIcon open={showPassword} color={colors.faint} />
        </Pressable>
      </View>
      {error ? (
        <View style={styles.bannerDanger}>
          <Text style={styles.bannerDangerText}>{error}</Text>
        </View>
      ) : null}
      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.pressed, pending && styles.disabled]}
        onPress={submit}
        disabled={pending}
      >
        <Text style={styles.buttonText}>{pending ? "Signing in…" : "Sign in"}</Text>
      </Pressable>
    </ScrollView>
  );
}

function EyeIcon({ open, color }: { open: boolean; color: string }) {
  return (
    <View style={{ width: 22, height: 16, alignItems: "center", justifyContent: "center" }}>
      <View
        style={{
          width: 20,
          height: 12,
          borderRadius: 8,
          borderWidth: 1.5,
          borderColor: color,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: color }} />
      </View>
      {open ? null : (
        <View
          style={{
            position: "absolute",
            width: 22,
            height: 1.5,
            backgroundColor: color,
            transform: [{ rotate: "-35deg" }],
          }}
        />
      )}
    </View>
  );
}

function ThemeToggle() {
  const { name, colors, setName } = useTheme();
  const styles = useStyles(colors);
  const next = name === "dark" ? "light" : "dark";
  return (
    <Pressable
      onPress={() => setName(next)}
      hitSlop={8}
      style={({ pressed }) => [styles.themeToggle, pressed && styles.pressed]}
      accessibilityLabel={next === "light" ? "Switch to light theme" : "Switch to dark theme"}
    >
      <Text style={styles.themeToggleText}>{next === "light" ? "Light" : "Dark"}</Text>
    </Pressable>
  );
}


