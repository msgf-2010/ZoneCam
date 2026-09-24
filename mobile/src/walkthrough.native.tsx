import { useEffect, useRef, useState } from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { ResizeMode, Video } from "expo-av";
import { CameraView, useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import * as VideoThumbnails from "expo-video-thumbnails";
import { api } from "./api";
import { runningOnEmulator } from "./device";
import { useTheme } from "./theme";
import { useStyles } from "./styles";

const speech = ExpoSpeechRecognitionModule as unknown as {
  start: (options: { lang: string; interimResults: boolean; continuous: boolean }) => void;
  stop: () => void;
  requestPermissionsAsync: () => Promise<{ granted: boolean }>;
};

const MAX_SHOTS = 14;

type Line = { startMs: number; endMs: number; text: string; shotUri: string | null };

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

function splitPhrases(text: string) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 4);
}

async function frameAt(videoUri: string, timeMs: number) {
  const shot = await VideoThumbnails.getThumbnailAsync(videoUri, { time: Math.max(0, timeMs), quality: 0.72 });
  const dest = `${FileSystem.cacheDirectory}walk-shot-${timeMs}-${Date.now()}.jpg`;
  await FileSystem.copyAsync({ from: shot.uri, to: dest });
  return dest;
}

export function WalkthroughScreen({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles(colors);
  const camera = useRef<CameraView>(null);
  const [cameraPermission, requestCamera] = useCameraPermissions();
  const [micPermission, requestMic] = useMicrophonePermissions();
  const [phase, setPhase] = useState<"idle" | "preview" | "recording" | "review" | "uploading" | "done">("idle");
  const [note, setNote] = useState("");
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [interim, setInterim] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const startedAt = useRef(0);
  const recordingRef = useRef(false);
  const cancelRef = useRef(false);
  const linesRef = useRef<Line[]>([]);
  const emulator = runningOnEmulator();

  useSpeechRecognitionEvent("result", (event) => {
    if (!recordingRef.current) return;
    const text = event.results[0]?.transcript?.trim() ?? "";
    if (!text) return;
    if (!event.isFinal) {
      setInterim(text);
      return;
    }
    const endMs = Math.max(0, Date.now() - startedAt.current);
    const phrases = splitPhrases(text);
    const spoken = phrases.length > 0 ? phrases : [text];
    const next = spoken
      .filter((phrase) => linesRef.current.length < MAX_SHOTS)
      .map((phrase, index) => ({
        startMs: Math.max(0, endMs - 1200 - (spoken.length - 1 - index) * 400),
        endMs,
        text: phrase,
        shotUri: null,
      }));
    if (next.length === 0) return;
    linesRef.current = [...linesRef.current, ...next];
    setLines(linesRef.current);
    setInterim("");
  });

  useSpeechRecognitionEvent("end", () => {
    if (!recordingRef.current) return;
    try {
      speech.start({ lang: "en-US", interimResults: true, continuous: true });
    } catch {
      /* recognizer restarts after each phrase on some phones */
    }
  });

  useSpeechRecognitionEvent("error", (event) => {
    if (event.error === "aborted" || event.error === "no-speech" || event.error === "speech-timeout") return;
    if (recordingRef.current) {
      setStatus("Still recording video. Voice notes paused — keep talking, or type them after you stop.");
    }
  });

  useEffect(() => {
    if (phase !== "recording") return;
    const id = setInterval(() => setElapsed(Date.now() - startedAt.current), 250);
    return () => clearInterval(id);
  }, [phase]);

  function rememberLines(next: Line[]) {
    linesRef.current = next;
    setLines(next);
  }

  async function attachFrames(uri: string, spoken: Line[]) {
    const next: Line[] = [];
    for (const line of spoken) {
      if (next.filter((row) => row.shotUri).length >= MAX_SHOTS) {
        next.push(line);
        continue;
      }
      try {
        next.push({ ...line, shotUri: await frameAt(uri, line.startMs) });
      } catch {
        next.push(line);
      }
    }
    return next;
  }

  async function useClip(uri: string, duration: number | null | undefined, spoken: Line[]) {
    const saved = await keepVideo(uri);
    const withFrames = await attachFrames(saved, spoken);
    setVideoUri(saved);
    setDurationMs(duration && duration > 0 ? duration : 0);
    rememberLines(withFrames);
    setStatus(withFrames.length === 0 ? "No voice notes were heard. Type what the office should do, one line per item." : null);
    setPhase("review");
  }

  async function listen() {
    const permission = await speech.requestPermissionsAsync();
    if (!permission.granted) {
      setStatus("Microphone access is required so each thing you say becomes a checklist item.");
      return false;
    }
    linesRef.current = [];
    setLines([]);
    setInterim("");
    try {
      speech.start({ lang: "en-US", interimResults: true, continuous: true });
      return true;
    } catch {
      setStatus("Voice notes could not start. The video will still record.");
      return false;
    }
  }

  function stopListening() {
    recordingRef.current = false;
    try {
      speech.stop();
    } catch {
      /* already stopped */
    }
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

  async function beginRecording() {
    if (!camera.current || !ready) {
      setStatus("The camera is still starting. Wait a second, then tap the circle.");
      return;
    }
    setStatus(null);
    setElapsed(0);
    startedAt.current = Date.now();
    recordingRef.current = true;
    setPhase("recording");
    const pending = camera.current.recordAsync({ maxDuration: 180 });
    void listen();
    pending
      .then(async (recorded) => {
        const cancelled = cancelRef.current;
        cancelRef.current = false;
        stopListening();
        if (cancelled) return;
        const spoken = [...linesRef.current];
        if (!recorded?.uri) {
          setPhase("preview");
          setStatus("No video was saved. Tap the circle and record a little longer.");
          return;
        }
        await useClip(recorded.uri, Date.now() - startedAt.current, spoken);
      })
      .catch((error: unknown) => {
        stopListening();
        setPhase("preview");
        setStatus(error instanceof Error ? error.message : "Recording failed. Tap the circle and try again.");
      });
  }

  function stopRecording() {
    camera.current?.stopRecording();
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
      await useClip(result.assets[0].uri, result.assets[0].duration, []);
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
      await useClip(result.assets[0].uri, result.assets[0].duration, []);
    } catch (error) {
      setPhase("idle");
      setStatus(error instanceof Error ? error.message : "That video could not be saved.");
    }
  }

  function updateLine(index: number, text: string) {
    rememberLines(linesRef.current.map((row, i) => (i === index ? { ...row, text } : row)));
  }

  async function send() {
    if (!videoUri) return;
    const typed = note.trim();
    const spoken = linesRef.current.filter((row) => row.text.trim());
    const checklistLines = typed
      ? [...spoken, { startMs: Math.max(0, durationMs), endMs: Math.max(durationMs, 1), text: typed, shotUri: null }]
      : spoken;
    setPhase("uploading");
    setStatus("Sending the walkthrough, voice notes, and screenshots to the office…");
    try {
      const form = new FormData();
      form.append("video", { uri: videoUri, name: "walkthrough.mp4", type: "video/mp4" } as unknown as Blob);
      let shotCursor = 0;
      const segments = checklistLines.map((row) => {
        const screenshotIndex = row.shotUri ? shotCursor++ : null;
        if (row.shotUri) {
          form.append("screenshots", { uri: row.shotUri, name: `walkthrough-${screenshotIndex}.jpg`, type: "image/jpeg" } as unknown as Blob);
        }
        return { startMs: row.startMs, endMs: row.endMs, text: row.text.trim(), screenshotIndex };
      });
      form.append(
        "transcript",
        JSON.stringify({
          text: segments.map((row) => row.text).join(" ").trim(),
          durationMs,
          segments,
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

  if (phase === "preview" || phase === "recording") {
    const recording = phase === "recording";
    const caption = interim || lines[lines.length - 1]?.text;
    return (
      <View style={styles.flex}>
        <CameraView ref={camera} style={styles.flex} facing="back" mode="video" mute={false} onCameraReady={() => setReady(true)} />
        <View style={styles.cameraTop} pointerEvents="none">
          <Text style={styles.cameraJob}>
            {recording ? `Recording ${clock(elapsed)}` : status || "Tap the circle. Say each item, then tap stop."}
          </Text>
          {recording && caption ? <Text style={overlay.caption}>{caption}</Text> : null}
        </View>
        <View style={styles.cameraBar}>
          <Pressable
            onPress={() => {
              cancelRef.current = true;
              stopListening();
              camera.current?.stopRecording();
              setPhase("idle");
            }}
            hitSlop={12}
            style={styles.cameraSide}
          >
            <Text style={styles.cameraText}>Cancel</Text>
          </Pressable>
          {recording ? (
            <Pressable style={overlay.stop} onPress={stopRecording} accessibilityLabel="Stop recording">
              <View style={overlay.stopInner} />
            </Pressable>
          ) : (
            <Pressable style={styles.shutter} onPress={() => void beginRecording()} accessibilityLabel="Start recording" />
          )}
          <View style={styles.cameraSide} />
        </View>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
      <Pressable onPress={onClose} hitSlop={8}>
        <Text style={styles.link}>‹ Job</Text>
      </Pressable>
      <Text style={styles.kicker}>Office checklist</Text>
      <Text style={styles.title}>Video walkthrough</Text>
      {phase === "idle" ? (
        <>
          <Text style={styles.help}>
            Walk the site and talk as you go. Each thing you say, like “this room needs to be painted”, becomes its own checklist item with a screenshot of what you were looking at.
          </Text>
          {status ? <Text style={styles.bannerDangerText}>{status}</Text> : null}
          <Pressable style={({ pressed }) => [styles.button, pressed && styles.pressed]} onPress={() => void openCamera()}>
            <Text style={styles.buttonText}>Start camera</Text>
          </Pressable>
          <Pressable style={({ pressed }) => [styles.secondary, pressed && styles.pressed]} onPress={() => void recordWithPhoneCamera()}>
            <Text style={styles.secondaryText}>Use the phone camera</Text>
          </Pressable>
          <Pressable style={({ pressed }) => [styles.secondary, pressed && styles.pressed]} onPress={() => void pickSavedVideo()}>
            <Text style={styles.secondaryText}>Use a saved video</Text>
          </Pressable>
        </>
      ) : null}
      {phase === "review" || phase === "uploading" ? (
        <>
          <Text style={styles.help}>
            Saved on this phone{durationMs > 0 ? ` · ${clock(durationMs)}` : ""}. Each spoken item is listed with the frame from that moment. Tap a photo to preview it.
          </Text>
          {videoUri ? (
            <Video source={{ uri: videoUri }} style={overlay.player} useNativeControls resizeMode={ResizeMode.CONTAIN} isLooping={false} />
          ) : null}
          {lines.map((line, index) => (
            <View key={`${line.startMs}-${index}`} style={styles.lineCard}>
              <Pressable onPress={() => line.shotUri && setPreviewUri(line.shotUri)} disabled={!line.shotUri} accessibilityLabel="Preview screenshot">
                {line.shotUri ? (
                  <Image source={{ uri: line.shotUri }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.thumbEmpty]}>
                    <Text style={styles.muted}>No shot</Text>
                  </View>
                )}
              </Pressable>
              <TextInput
                value={line.text}
                onChangeText={(text) => updateLine(index, text)}
                multiline
                style={styles.lineText}
                placeholderTextColor={colors.faint}
              />
            </View>
          ))}
          <Text style={styles.label}>Add another note</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            multiline
            style={styles.note}
            placeholder="Anything the voice notes missed…"
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
      <Modal visible={Boolean(previewUri)} animationType="fade" onRequestClose={() => setPreviewUri(null)} statusBarTranslucent>
        <View style={styles.previewBackdrop}>
          <Pressable onPress={() => setPreviewUri(null)} style={styles.previewClose} hitSlop={12}>
            <Text style={styles.cameraText}>Close</Text>
          </Pressable>
          {previewUri ? <Image source={{ uri: previewUri }} style={styles.previewImage} resizeMode="contain" /> : null}
        </View>
      </Modal>
    </ScrollView>
  );
}

const overlay = StyleSheet.create({
  caption: { color: "#fff", fontSize: 16, lineHeight: 22, marginTop: 8 },
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
