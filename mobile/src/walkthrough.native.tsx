import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { ResizeMode, Video } from "expo-av";
import { CameraView, useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { api } from "./api";
import { runningOnEmulator } from "./device";
import { useTheme } from "./theme";
import { useStyles } from "./styles";

async function keepVideo(uri: string) {
  const folder = `${FileSystem.documentDirectory}walkthroughs/`;
  await FileSystem.makeDirectoryAsync(folder, { intermediates: true });
  const dest = `${folder}walkthrough-${Date.now()}.mp4`;
  await FileSystem.copyAsync({ from: uri, to: dest });
  const info = await FileSystem.getInfoAsync(dest);
  if (!info.exists || ("size" in info && info.size === 0)) {
    throw new Error("The video file was empty.");
  }
  return dest;
}

function clock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function WalkthroughScreen({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles(colors);
  const camera = useRef<CameraView>(null);
  const [cameraPermission, requestCamera] = useCameraPermissions();
  const [micPermission, requestMic] = useMicrophonePermissions();
  const [phase, setPhase] = useState<"idle" | "preview" | "opening" | "recording" | "review" | "uploading" | "done">("idle");
  const [note, setNote] = useState("");
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(0);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const emulator = runningOnEmulator();

  useEffect(() => {
    if (phase !== "recording") return;
    const id = setInterval(() => setElapsed(Date.now() - startedAt.current), 250);
    return () => clearInterval(id);
  }, [phase]);

  function useClip(uri: string, duration: number | null | undefined) {
    setVideoUri(uri);
    setDurationMs(duration && duration > 0 ? duration : 0);
    setStatus(null);
    setPhase("review");
  }

  async function openCamera() {
    const cameraOk = cameraPermission?.granted ? cameraPermission : await requestCamera();
    const micOk = micPermission?.granted ? micPermission : await requestMic();
    if (!cameraOk.granted || !micOk.granted) {
      setStatus("Camera and microphone access are required for a walkthrough.");
      return;
    }
    setStatus(null);
    setReady(false);
    setPhase("preview");
  }

  function beginRecording() {
    if (!camera.current) {
      setStatus("The camera is still starting. Wait a second, then tap the circle.");
      return;
    }
    setStatus(null);
    setElapsed(0);
    setPhase("recording");
    startedAt.current = Date.now();
    const pending = camera.current.recordAsync({ maxDuration: 180 });
    pending
      .then(async (recorded) => {
        if (!recorded?.uri) {
          setPhase("preview");
          setStatus("No video was saved. Tap the circle and record a little longer.");
          return;
        }
        useClip(await keepVideo(recorded.uri), Date.now() - startedAt.current);
      })
      .catch((error: unknown) => {
        setPhase("preview");
        setStatus(error instanceof Error ? error.message : "Recording failed. Tap the circle and try again.");
      });
  }

  function stopRecording() {
    camera.current?.stopRecording();
  }

  function onShutter() {
    beginRecording();
  }

  async function recordWithPhoneCamera() {
    const cameraOk = cameraPermission?.granted ? cameraPermission : await requestCamera();
    const micOk = micPermission?.granted ? micPermission : await requestMic();
    if (!cameraOk.granted || !micOk.granted) {
      setPhase("idle");
      setStatus("Camera and microphone access are required for a walkthrough.");
      return;
    }
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        videoMaxDuration: 180,
      });
      if (result.canceled || !result.assets[0]) {
        setPhase(emulator ? "idle" : "preview");
        setStatus(null);
        return;
      }
      useClip(await keepVideo(result.assets[0].uri), result.assets[0].duration);
    } catch (error) {
      setPhase("idle");
      setStatus(error instanceof Error ? error.message : "The phone camera could not record. Use a saved video.");
    }
  }

  async function pickSavedVideo() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      });
      if (result.canceled || !result.assets[0]) {
        setPhase("idle");
        return;
      }
      useClip(await keepVideo(result.assets[0].uri), result.assets[0].duration);
    } catch (error) {
      setPhase("idle");
      setStatus(error instanceof Error ? error.message : "That video could not be saved.");
    }
  }

  async function send() {
    if (!videoUri) return;
    setPhase("uploading");
    setStatus("Sending the walkthrough to the office…");
    try {
      const form = new FormData();
      form.append("video", { uri: videoUri, name: "walkthrough.mp4", type: "video/mp4" } as unknown as Blob);
      form.append(
        "transcript",
        JSON.stringify({
          text: note.trim(),
          durationMs,
          segments: note.trim() ? [{ startMs: 0, endMs: Math.max(durationMs, 1), text: note.trim() }] : [],
        }),
      );
      form.append("capturedAt", new Date().toISOString());
      form.append("deviceInfo", "zonecam-mobile");
      const json = await api(`/api/v1/projects/${projectId}/walkthrough`, { method: "POST", body: form });
      setSummary(json.data?.summary ?? "Walkthrough sent.");
      setPhase("done");
      setStatus("Office checklist is ready.");
    } catch (error) {
      setPhase("review");
      setStatus(error instanceof Error ? error.message : "Upload failed. Try again.");
    }
  }

  if (phase === "opening") {
    return (
      <View style={styles.pad}>
        <Text style={styles.kicker}>Office checklist</Text>
        <Text style={styles.title}>Opening the camera</Text>
        <Text style={styles.help}>The room opens in the phone camera. Use W A S D to walk, hold Alt and move the mouse to look, then record and tap the checkmark.</Text>
      </View>
    );
  }

  if (phase === "preview" || phase === "recording") {
    const recording = phase === "recording";
    return (
      <View style={styles.flex}>
        <CameraView ref={camera} style={styles.flex} facing="back" mode="video" onCameraReady={() => setReady(true)} />
        <View style={styles.cameraTop} pointerEvents="none">
          <Text style={styles.cameraJob}>
            {recording ? `Recording ${clock(elapsed)}` : status || "Tap the circle. Tap it again to stop and save."}
          </Text>
        </View>
        <View style={styles.cameraBar}>
          <Pressable onPress={() => setPhase("idle")} hitSlop={12} style={styles.cameraSide}>
            <Text style={styles.cameraText}>Cancel</Text>
          </Pressable>
          {recording ? (
            <Pressable style={overlay.stop} onPress={stopRecording} accessibilityLabel="Stop recording">
              <View style={overlay.stopInner} />
            </Pressable>
          ) : (
            <Pressable style={styles.shutter} onPress={onShutter} accessibilityLabel="Start recording" />
          )}
          <View style={styles.cameraSide} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.pad}>
      <Pressable onPress={onClose} hitSlop={8}>
        <Text style={styles.link}>‹ Job</Text>
      </Pressable>
      <Text style={styles.kicker}>Office checklist</Text>
      <Text style={styles.title}>Video walkthrough</Text>
      {phase === "idle" ? (
        <>
          <Text style={styles.help}>
            Walk the site and talk as you go. ZoneCam sends the video to the office and turns your notes into a trade checklist.
          </Text>
          {status ? <Text style={styles.bannerDangerText}>{status}</Text> : null}
          <Pressable style={({ pressed }) => [styles.button, pressed && styles.pressed]} onPress={() => void openCamera()}>
            <Text style={styles.buttonText}>Start camera</Text>
          </Pressable>
          <Pressable style={({ pressed }) => [styles.secondary, pressed && styles.pressed]} onPress={() => void pickSavedVideo()}>
            <Text style={styles.secondaryText}>Use a saved video</Text>
          </Pressable>
        </>
      ) : null}
      {phase === "review" || phase === "uploading" ? (
        <>
          <Text style={styles.help}>
            Saved on this phone{durationMs > 0 ? ` · ${clock(durationMs)}` : ""}. Press play to watch it, then send it to the office.
          </Text>
          {videoUri ? (
            <Video
              source={{ uri: videoUri }}
              style={overlay.player}
              useNativeControls
              resizeMode={ResizeMode.CONTAIN}
              isLooping={false}
            />
          ) : null}
          <Text style={styles.label}>Notes for the checklist</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            multiline
            style={styles.note}
            placeholder="Roof damage on the north side…"
            placeholderTextColor={colors.faint}
          />
          {status ? <Text style={styles.help}>{status}</Text> : null}
          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.pressed, phase === "uploading" && styles.disabled]}
            disabled={phase === "uploading"}
            onPress={() => void send()}
          >
            <Text style={styles.buttonText}>{phase === "uploading" ? "Sending…" : "Send to office"}</Text>
          </Pressable>
        </>
      ) : null}
      {phase === "done" ? (
        <>
          <Text style={styles.help}>{summary}</Text>
          <Pressable style={({ pressed }) => [styles.button, pressed && styles.pressed]} onPress={onClose}>
            <Text style={styles.buttonText}>Back to the job</Text>
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

const overlay = StyleSheet.create({
  banner: {
    position: "absolute",
    top: 48,
    left: 16,
    right: 16,
    backgroundColor: "rgba(3,16,22,0.78)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 4,
  },
  hint: { color: "#fff", fontSize: 14, lineHeight: 20 },
  shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: "#fff" },
  stop: {
    width: 74,
    height: 74,
    borderRadius: 37,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  stopInner: { width: 28, height: 28, borderRadius: 6, backgroundColor: "#c23b3b" },
  player: { width: "100%", height: 220, borderRadius: 12, backgroundColor: "#000" },
});
