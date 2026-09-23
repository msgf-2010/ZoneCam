import { useEffect, useState } from "react";
import { Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { ResizeMode, Video } from "expo-av";
import * as FileSystem from "expo-file-system";
import * as VideoThumbnails from "expo-video-thumbnails";

const posters = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();

function cacheName(id: string) {
  return id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) || "clip";
}

async function frameFor(id: string, uri: string) {
  const saved = posters.get(id);
  if (saved) return saved;
  const pending = inflight.get(id);
  if (pending) return pending;
  const job = grabFrame(id, uri)
    .then((path) => {
      posters.set(id, path);
      inflight.delete(id);
      return path;
    })
    .catch((error) => {
      inflight.delete(id);
      throw error;
    });
  inflight.set(id, job);
  return job;
}

async function grabFrame(id: string, uri: string) {
  const cached = `${FileSystem.cacheDirectory}zonecam-poster-${cacheName(id)}.jpg`;
  const info = await FileSystem.getInfoAsync(cached);
  if (info.exists) return cached;
  let shotUri: string;
  try {
    shotUri = (await VideoThumbnails.getThumbnailAsync(uri, { time: 400, quality: 0.7 })).uri;
  } catch {
    if (!uri.startsWith("http")) throw new Error("Could not read a frame from this video.");
    const video = `${FileSystem.cacheDirectory}zonecam-clip-${cacheName(id)}.mp4`;
    const file = await FileSystem.getInfoAsync(video);
    if (!file.exists) await FileSystem.downloadAsync(uri, video);
    shotUri = (await VideoThumbnails.getThumbnailAsync(video, { time: 400, quality: 0.7 })).uri;
  }
  await FileSystem.copyAsync({ from: shotUri, to: cached }).catch(() => undefined);
  const copied = await FileSystem.getInfoAsync(cached);
  return copied.exists ? cached : shotUri;
}

export function VideoTile({ id, uri }: { id: string; uri: string }) {
  const [poster, setPoster] = useState<string | null>(posters.get(id) ?? null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    frameFor(id, uri)
      .then((path) => {
        if (alive) setPoster(path);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [id, uri]);

  return (
    <>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel="Play video" style={tile.card}>
        {poster ? <Image source={{ uri: poster }} style={tile.fill} /> : <View style={tile.fill} />}
        <View style={tile.play} pointerEvents="none">
          <View style={tile.badge}>
            <Text style={tile.mark}>▶</Text>
          </View>
        </View>
      </Pressable>
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)} statusBarTranslucent>
        <View style={tile.screen}>
          <Pressable onPress={() => setOpen(false)} style={tile.close} hitSlop={12}>
            <Text style={tile.closeText}>Close</Text>
          </Pressable>
          {open ? <Video source={{ uri }} style={tile.video} useNativeControls shouldPlay resizeMode={ResizeMode.CONTAIN} /> : null}
        </View>
      </Modal>
    </>
  );
}

const tile = StyleSheet.create({
  card: { width: 168, height: 112, borderRadius: 12, overflow: "hidden", backgroundColor: "#10262c" },
  fill: { width: "100%", height: "100%" },
  play: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  mark: { color: "#fff", fontSize: 16, marginLeft: 2 },
  screen: { flex: 1, backgroundColor: "#000", paddingTop: 36 },
  close: { paddingHorizontal: 20, paddingVertical: 12 },
  closeText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  video: { flex: 1, width: "100%" },
});
