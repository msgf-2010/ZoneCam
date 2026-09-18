import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Location from "expo-location";
import * as FileSystem from "expo-file-system";
import NetInfo from "@react-native-community/netinfo";
import { StatusBar } from "expo-status-bar";
import { api, clearToken, getApiBase, getToken, setApiBase, setToken } from "./src/api";
import { enqueueCapture, listQueue, updateQueue, type QueueRow } from "./src/queue";
import { flushQueue, queueSummary } from "./src/sync";

type Session = {
  user: { firstName: string; lastName: string };
  company: { name: string };
  token?: string;
};

type Project = {
  id: string;
  name: string;
  number: string;
  startDate?: string | null;
  projectStatus: { name: string };
};

type Screen = "login" | "jobs" | "project" | "camera";

export default function App() {
  const [screen, setScreen] = useState<Screen>("login");
  const [session, setSession] = useState<Session | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (token) {
        try {
          const json = await api("/api/v1/auth/session");
          setSession(json.data);
          setScreen("jobs");
        } catch {
          await clearToken();
        }
      }
      setReady(true);
    })();
    const sub = NetInfo.addEventListener((state) => {
      if (state.isConnected) void flushQueue();
    });
    return () => sub();
  }, []);

  if (!ready) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      {screen === "login" ? (
        <LoginScreen
          onLoggedIn={(data) => {
            setSession(data);
            setScreen("jobs");
          }}
        />
      ) : null}
      {screen === "jobs" && session ? (
        <JobsScreen
          session={session}
          onOpen={(item) => {
            setProject(item);
            setScreen("project");
          }}
          onLogout={async () => {
            await clearToken();
            setSession(null);
            setScreen("login");
          }}
        />
      ) : null}
      {screen === "project" && project ? (
        <ProjectScreen
          project={project}
          onBack={() => setScreen("jobs")}
          onCamera={() => setScreen("camera")}
        />
      ) : null}
      {screen === "camera" && project ? (
        <CaptureScreen project={project} onClose={() => setScreen("project")} />
      ) : null}
    </SafeAreaView>
  );
}

function LoginScreen({ onLoggedIn }: { onLoggedIn: (session: Session) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      await setApiBase(apiUrl);
      const json = await api("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
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
    <ScrollView contentContainerStyle={styles.pad}>
      <Text style={styles.kicker}>ZONECAM FIELD</Text>
      <Text style={styles.title}>Sign in</Text>
      <Text style={styles.help}>Same account as the office web app. Photos upload to the shared ZoneCam API.</Text>
      <Text style={styles.label}>API URL</Text>
      <TextInput value={apiUrl} onChangeText={setApiUrl} autoCapitalize="none" style={styles.input} />
      <Text style={styles.label}>Email</Text>
      <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" style={styles.input} />
      <Text style={styles.label}>Password</Text>
      <TextInput value={password} onChangeText={setPassword} secureTextEntry style={styles.input} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={styles.button} onPress={submit} disabled={pending}>
        <Text style={styles.buttonText}>{pending ? "Signing in…" : "Sign in"}</Text>
      </Pressable>
    </ScrollView>
  );
}

function JobsScreen({
  session,
  onOpen,
  onLogout,
}: {
  session: Session;
  onOpen: (project: Project) => void;
  onLogout: () => void;
}) {
  const [jobs, setJobs] = useState<Project[]>([]);
  const [summary, setSummary] = useState("");

  async function refresh() {
    const json = await api("/api/v1/projects?today=1");
    const fallback = json.data?.length ? json.data : (await api("/api/v1/projects")).data;
    setJobs(fallback ?? []);
    const stats = await queueSummary();
    if (stats.failed) setSummary(`${stats.failed} uploads failed — Retry`);
    else if (stats.uploading || stats.pending) setSummary(`Uploading ${stats.uploading} · ${stats.pending} waiting`);
    else setSummary("All photos uploaded");
  }

  useEffect(() => {
    refresh().catch(() => undefined);
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <Text style={styles.kicker}>{session.company.name}</Text>
      <Text style={styles.title}>Today’s jobs</Text>
      <Text style={styles.help}>{summary}</Text>
      {jobs.map((job) => (
        <Pressable key={job.id} style={styles.card} onPress={() => onOpen(job)}>
          <Text style={styles.cardTitle}>
            {job.number} · {job.name}
          </Text>
          <Text style={styles.muted}>{job.projectStatus?.name}</Text>
        </Pressable>
      ))}
      <Pressable style={styles.secondary} onPress={onLogout}>
        <Text>Log out</Text>
      </Pressable>
    </ScrollView>
  );
}

function ProjectScreen({ project, onBack, onCamera }: { project: Project; onBack: () => void; onCamera: () => void }) {
  const [remote, setRemote] = useState<Array<{ id: string; originalFilename: string; urls: { thumbnail: string } }>>([]);
  const [local, setLocal] = useState<QueueRow[]>([]);
  const [summary, setSummary] = useState("");
  const [checklists, setChecklists] = useState<
    Array<{ id: string; name: string; items: Array<{ id: string; title: string; isComplete: boolean }> }>
  >([]);
  const [tasks, setTasks] = useState<Array<{ id: string; title: string; status: string }>>([]);

  async function refresh() {
    const json = await api(`/api/v1/projects/${project.id}/media`);
    setRemote(json.data?.items ?? []);
    setLocal(await listQueue(project.id));
    const stats = await queueSummary(project.id);
    setSummary(
      stats.failed
        ? `${stats.failed} failed — Retry`
        : stats.pending + stats.uploading
          ? `${stats.pending + stats.uploading} waiting to upload`
          : "All photos uploaded",
    );
    try {
      const lists = await api(`/api/v1/projects/${project.id}/checklists`);
      setChecklists(lists.data ?? []);
    } catch {
      setChecklists([]);
    }
    try {
      const jobTasks = await api(`/api/v1/tasks?projectId=${project.id}`);
      setTasks(jobTasks.data ?? []);
    } catch {
      setTasks([]);
    }
  }

  useEffect(() => {
    refresh().catch(() => undefined);
  }, [project.id]);

  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <Pressable onPress={onBack}>
        <Text style={styles.link}>Jobs</Text>
      </Pressable>
      <Text style={styles.title}>{project.name}</Text>
      <Text style={styles.help}>{summary}</Text>
      <Pressable style={styles.button} onPress={onCamera}>
        <Text style={styles.buttonText}>Take photo</Text>
      </Pressable>
      <Text style={styles.label}>Checklists</Text>
      {checklists.map((list) => (
        <View key={list.id} style={styles.card}>
          <Text style={styles.cardTitle}>{list.name}</Text>
          {list.items.map((item) => (
            <Pressable
              key={item.id}
              style={styles.row}
              onPress={async () => {
                try {
                  await api(`/api/v1/checklist-items/${item.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ isComplete: !item.isComplete }),
                  });
                  await refresh();
                } catch {
                  /* authorization is enforced by the API */
                }
              }}
            >
              <Text style={styles.rowTitle}>
                {item.isComplete ? "☑ " : "☐ "}
                {item.title}
              </Text>
            </Pressable>
          ))}
        </View>
      ))}
      <Text style={styles.label}>Tasks</Text>
      {tasks.map((task) => (
        <Pressable
          key={task.id}
          style={styles.row}
          onPress={async () => {
            if (task.status === "completed") return;
            try {
              await api(`/api/v1/tasks/${task.id}/complete`, { method: "POST" });
              await refresh();
            } catch {
              /* API enforces tasks.complete */
            }
          }}
        >
          <Text style={styles.rowTitle}>{task.title}</Text>
          <Text style={styles.muted}>{task.status}</Text>
        </Pressable>
      ))}
      <Pressable
        style={styles.secondary}
        onPress={async () => {
          const failed = (await listQueue(project.id)).filter((r) => r.status === "failed");
          for (const row of failed) await updateQueue(row.id, { status: "retrying" });
          await flushQueue();
          await refresh();
        }}
      >
        <Text>Retry failed uploads</Text>
      </Pressable>
      <Text style={styles.label}>On this device</Text>
      {local.map((row) => (
        <View key={row.id} style={styles.row}>
          <Text style={styles.rowTitle}>{row.filename}</Text>
          <Text style={styles.muted}>{row.status}</Text>
        </View>
      ))}
      <Text style={styles.label}>On the job</Text>
      {remote.map((item) => (
        <Text key={item.id} style={styles.rowTitle}>
          {item.originalFilename}
        </Text>
      ))}
    </ScrollView>
  );
}

function CaptureScreen({ project, onClose }: { project: Project; onClose: () => void }) {
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<"back" | "front">("back");

  if (!permission) return <View style={styles.center} />;
  if (!permission.granted) {
    return (
      <View style={styles.pad}>
        <Text style={styles.help}>Camera access is required to document the job.</Text>
        <Pressable style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Allow camera</Text>
        </Pressable>
      </View>
    );
  }

  async function snap() {
    const photo = await camera.current?.takePictureAsync({ quality: 0.7 });
    if (!photo?.uri) return;
    let latitude: number | null = null;
    let longitude: number | null = null;
    const locPerm = await Location.requestForegroundPermissionsAsync();
    if (locPerm.granted) {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      latitude = pos.coords.latitude;
      longitude = pos.coords.longitude;
    }
    const capturedAt = new Date().toISOString();
    const clientUploadId = `${project.id}-${capturedAt}-${Math.random().toString(36).slice(2)}`;
    const filename = `job-${Date.now()}.jpg`;
    const dest = `${FileSystem.documentDirectory}captures/${filename}`;
    await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}captures`, { intermediates: true });
    await FileSystem.copyAsync({ from: photo.uri, to: dest });
    const info = await FileSystem.getInfoAsync(dest);
    await enqueueCapture({
      id: clientUploadId,
      projectId: project.id,
      localUri: dest,
      filename,
      mimeType: "image/jpeg",
      sizeBytes: info.exists && "size" in info ? info.size : 0,
      capturedAt,
      latitude,
      longitude,
      clientUploadId,
      status: "pending",
      attempts: 0,
      lastError: null,
      serverMediaId: null,
    });
    void flushQueue();
  }

  return (
    <View style={styles.flex}>
      <CameraView ref={camera} style={styles.flex} facing={facing} />
      <View style={styles.cameraBar}>
        <Pressable onPress={onClose}>
          <Text style={styles.cameraText}>Done</Text>
        </Pressable>
        <Pressable style={styles.shutter} onPress={snap} />
        <Pressable onPress={() => setFacing((value) => (value === "back" ? "front" : "back"))}>
          <Text style={styles.cameraText}>Flip</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f4f1ea" },
  flex: { flex: 1, backgroundColor: "#000" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  pad: { padding: 20, gap: 10 },
  kicker: { letterSpacing: 2, color: "#1c4b5a", fontSize: 12 },
  title: { fontSize: 28, fontWeight: "700", color: "#1c1917" },
  help: { color: "#57534e", marginBottom: 8 },
  label: { marginTop: 8, fontWeight: "600" },
  input: { backgroundColor: "#fff", borderColor: "#e7e0d4", borderWidth: 1, borderRadius: 10, padding: 12 },
  button: { backgroundColor: "#1c4b5a", borderRadius: 12, padding: 16, alignItems: "center", marginTop: 12 },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  secondary: { padding: 14, alignItems: "center" },
  card: { backgroundColor: "#fffdf8", borderColor: "#e7e0d4", borderWidth: 1, borderRadius: 12, padding: 14, marginTop: 8 },
  cardTitle: { fontWeight: "700" },
  muted: { color: "#57534e" },
  error: { color: "#b42318" },
  link: { color: "#1c4b5a", fontWeight: "600" },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8 },
  rowTitle: { flex: 1 },
  cameraBar: {
    position: "absolute",
    bottom: 24,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  cameraText: { color: "#fff", fontSize: 16 },
  shutter: { width: 72, height: 72, borderRadius: 36, backgroundColor: "#fff" },
});
