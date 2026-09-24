import { useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as FileSystem from "expo-file-system";
import * as Location from "expo-location";
import { enqueueCapture, listQueue } from "./queue";
import { flushQueue } from "./sync";
import { runningOnEmulator } from "./device";
import { useTheme } from "./theme";
import { useStyles } from "./styles";

type Project = {
  id: string;
  name: string;
  number: string;
};

async function readLocation() {
  if (runningOnEmulator()) return { latitude: null as number | null, longitude: null as number | null };
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return { latitude: null, longitude: null };
    const pos = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000)),
    ]);
    if (!pos) return { latitude: null, longitude: null };
    return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
  } catch {
    return { latitude: null, longitude: null };
  }
}

export function CaptureScreen({
  project,
  category,
  description,
  onClose,
}: {
  project: Project;
  category?: string | null;
  description?: string | null;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles(colors);
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<"back" | "front">("back");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function storePhoto(uri: string) {
    const where = await readLocation();
    const capturedAt = new Date().toISOString();
    const clientUploadId = `${project.id}-${capturedAt}-${Math.random().toString(36).slice(2)}`;
    const filename = `job-${Date.now()}.jpg`;
    const dest = `${FileSystem.documentDirectory}captures/${filename}`;
    await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}captures`, { intermediates: true });
    await FileSystem.copyAsync({ from: uri, to: dest });
    const info = await FileSystem.getInfoAsync(dest);
    if (!info.exists) throw new Error("The photo file was not saved on this phone.");
    await enqueueCapture({
      id: clientUploadId,
      projectId: project.id,
      localUri: dest,
      filename,
      mimeType: "image/jpeg",
      sizeBytes: "size" in info ? info.size : 0,
      capturedAt,
      latitude: where.latitude,
      longitude: where.longitude,
      clientUploadId,
      status: "pending",
      attempts: 0,
      lastError: null,
      serverMediaId: null,
      category: category ?? null,
      description: description ?? null,
    });
    await flushQueue();
    const queued = await listQueue(project.id);
    const row = queued.find((item) => item.clientUploadId === clientUploadId);
    if (row?.status === "failed") {
      throw new Error(row.lastError || "The photo did not reach the office.");
    }
  }

  async function snap() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const photo = await camera.current?.takePictureAsync({ quality: 0.55 });
      if (!photo?.uri) return;
      await storePhoto(photo.uri);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The photo did not reach the office.");
    } finally {
      setSaving(false);
    }
  }

  if (!permission) return <View style={styles.center} />;
  if (!permission.granted) {
    return (
      <View style={styles.pad}>
        <Text style={styles.title}>Camera</Text>
        <Text style={styles.help}>Camera access is required to document the job.</Text>
        <Pressable style={({ pressed }) => [styles.button, pressed && styles.pressed]} onPress={requestPermission}>
          <Text style={styles.buttonText}>Allow camera</Text>
        </Pressable>
        <Pressable onPress={onClose} hitSlop={8} style={styles.secondary}>
          <Text style={styles.secondaryText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <CameraView ref={camera} style={styles.flex} facing={facing} />
      {error ? (
        <View style={styles.cameraNotice}>
          <Text style={styles.cameraText}>{error}</Text>
        </View>
      ) : null}
      <View style={styles.cameraBar}>
        <Pressable onPress={onClose} hitSlop={12} style={styles.cameraSide}>
          <Text style={styles.cameraText}>Done</Text>
        </Pressable>
        <Pressable style={styles.shutter} onPress={() => void snap()} disabled={saving} accessibilityLabel="Take photo" />
        <Pressable onPress={() => setFacing((value) => (value === "back" ? "front" : "back"))} hitSlop={12} style={styles.cameraSide}>
          <Text style={styles.cameraText}>Flip</Text>
        </Pressable>
      </View>
    </View>
  );
}
