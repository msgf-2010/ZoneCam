"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  extensionForMime,
  formatWalkthroughClock,
  pickRecorderMime,
  WALKTHROUGH_FRAME_INTERVAL_MS,
  WALKTHROUGH_MAX_MS,
  WALKTHROUGH_MAX_SCREENSHOTS,
  type WalkthroughSegment,
} from "@/lib/walkthrough";

type Shot = { url: string; timestampMs: number; blob: Blob };
type SpeechCtor = new () => {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function speechCtor(): SpeechCtor | null {
  const w = window as Window & { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

async function canvasFrame(video: HTMLVideoElement, timestampMs: number): Promise<Shot | null> {
  if (!video.videoWidth || !video.videoHeight) return null;
  const canvas = document.createElement("canvas");
  const maxW = 1280;
  const scale = Math.min(1, maxW / video.videoWidth);
  canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
  canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.72));
  if (!blob) return null;
  return { blob, timestampMs, url: URL.createObjectURL(blob) };
}

function waitForSeek(video: HTMLVideoElement, timeSec: number) {
  return new Promise<void>((resolve, reject) => {
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
      resolve();
    };
    const onError = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
      reject(new Error("Could not seek video."));
    };
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);
    video.currentTime = Math.min(Math.max(0, timeSec), Math.max(0, (video.duration || 0) - 0.08));
  });
}

async function framesFromFile(file: Blob, timestampsMs: number[]) {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Could not read that video."));
    });
    const durationMs = Math.round((video.duration || 0) * 1000);
    const times =
      timestampsMs.length > 0
        ? timestampsMs
        : Array.from({ length: Math.min(WALKTHROUGH_MAX_SCREENSHOTS, Math.max(1, Math.ceil(durationMs / WALKTHROUGH_FRAME_INTERVAL_MS))) }, (_, i) =>
            Math.min(durationMs, i * WALKTHROUGH_FRAME_INTERVAL_MS + 400),
          );
    const unique = [...new Set(times.map((ms) => Math.max(0, ms)))].slice(0, WALKTHROUGH_MAX_SCREENSHOTS);
    const shots: Shot[] = [];
    for (const ms of unique) {
      await waitForSeek(video, ms / 1000);
      const shot = await canvasFrame(video, ms);
      if (shot) shots.push(shot);
    }
    return { shots, durationMs };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function FieldWalkthrough({ projectId }: { projectId: string }) {
  const router = useRouter();
  const liveRef = useRef<HTMLVideoElement>(null);
  const playbackRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const speechRef = useRef<InstanceType<SpeechCtor> | null>(null);
  const recordingRef = useRef(false);
  const startedAtRef = useRef(0);
  const lastFrameAtRef = useRef(0);
  const shotCountRef = useRef(0);
  const frameTimerRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);
  const voiceRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceStreamRef = useRef<MediaStream | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);

  const [phase, setPhase] = useState<"idle" | "live" | "recording" | "review" | "uploading" | "done">("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [interim, setInterim] = useState("");
  const [segments, setSegments] = useState<WalkthroughSegment[]>([]);
  const [shots, setShots] = useState<Shot[]>([]);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [speechAvailable, setSpeechAvailable] = useState(true);
  const [voiceRecording, setVoiceRecording] = useState(false);
  const [result, setResult] = useState<{ summary: string; trades: string[]; itemCount: number } | null>(null);

  useEffect(() => {
    setSpeechAvailable(Boolean(speechCtor()));
    return () => {
      stopEverything();
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if ((phase === "live" || phase === "recording") && liveRef.current && streamRef.current) {
      liveRef.current.srcObject = streamRef.current;
      void liveRef.current.play().catch(() => undefined);
    }
  }, [phase]);

  function stopTracks() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  function stopSpeech() {
    try {
      speechRef.current?.abort();
    } catch {
      /* already stopped */
    }
    speechRef.current = null;
  }

  function stopVoiceTracks() {
    if (voiceRecorderRef.current && voiceRecorderRef.current.state !== "inactive") {
      try {
        voiceRecorderRef.current.stop();
      } catch {
        /* ignore */
      }
    }
    voiceRecorderRef.current = null;
    voiceStreamRef.current?.getTracks().forEach((track) => track.stop());
    voiceStreamRef.current = null;
  }

  function stopEverything() {
    recordingRef.current = false;
    if (frameTimerRef.current) window.clearInterval(frameTimerRef.current);
    if (tickRef.current) window.clearInterval(tickRef.current);
    frameTimerRef.current = null;
    tickRef.current = null;
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try {
        recorderRef.current.stop();
      } catch {
        /* ignore */
      }
    }
    stopVoiceTracks();
    stopSpeech();
    stopTracks();
  }

  async function grabLiveFrame(force = false) {
    const video = liveRef.current;
    if (!video) return;
    const now = Date.now() - startedAtRef.current;
    if (!force && now - lastFrameAtRef.current < 2500) return;
    if (shotCountRef.current >= WALKTHROUGH_MAX_SCREENSHOTS) return;
    const shot = await canvasFrame(video, now);
    if (!shot) return;
    lastFrameAtRef.current = now;
    shotCountRef.current += 1;
    setShots((current) => (current.length >= WALKTHROUGH_MAX_SCREENSHOTS ? current : [...current, shot]));
  }

  function startSpeech() {
    const Ctor = speechCtor();
    if (!Ctor) {
      setSpeechAvailable(false);
      return;
    }
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onresult = (event) => {
      let live = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const row = event.results[i];
        const text = row[0]?.transcript?.trim() ?? "";
        if (!text) continue;
        if (row.isFinal) {
          const startMs = Date.now() - startedAtRef.current;
          setSegments((current) => [...current, { startMs: Math.max(0, startMs - 2500), endMs: startMs, text }]);
          setInterim("");
          void grabLiveFrame(true);
        } else {
          live = text;
        }
      }
      if (live) setInterim(live);
    };
    rec.onend = () => {
      if (recordingRef.current) {
        try {
          rec.start();
        } catch {
          /* restart races */
        }
      }
    };
    rec.onerror = () => undefined;
    speechRef.current = rec;
    try {
      rec.start();
    } catch {
      setSpeechAvailable(false);
    }
  }

  async function openCamera() {
    setStatus("Turning on camera and mic…");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      setPhase("live");
      setStatus("Point at the work. Narrate what the office should follow up on.");
    } catch {
      setStatus("Camera or microphone was blocked. You can still upload a saved video.");
    }
  }

  async function beginRecording() {
    const stream = streamRef.current;
    if (!stream) {
      await openCamera();
      return;
    }
    chunksRef.current = [];
    setSegments([]);
    setShots((current) => {
      current.forEach((shot) => URL.revokeObjectURL(shot.url));
      return [];
    });
    shotCountRef.current = 0;
    setInterim("");
    setElapsedMs(0);
    startedAtRef.current = Date.now();
    lastFrameAtRef.current = 0;
    recordingRef.current = true;
    const mime = pickRecorderMime("video");
    const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    recorderRef.current = recorder;
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunksRef.current.push(event.data);
    };
    recorder.start(1000);
    startSpeech();
    setPhase("recording");
    setStatus("Recording. Talk through each issue as you walk.");
    void grabLiveFrame(true);
    frameTimerRef.current = window.setInterval(() => {
      if (Date.now() - startedAtRef.current >= WALKTHROUGH_MAX_MS) {
        void finishRecording();
        return;
      }
      void grabLiveFrame(false);
    }, WALKTHROUGH_FRAME_INTERVAL_MS);
    tickRef.current = window.setInterval(() => setElapsedMs(Date.now() - startedAtRef.current), 250);
  }

  async function finishRecording() {
    if (!recordingRef.current && phase !== "recording") return;
    recordingRef.current = false;
    if (frameTimerRef.current) window.clearInterval(frameTimerRef.current);
    if (tickRef.current) window.clearInterval(tickRef.current);
    frameTimerRef.current = null;
    tickRef.current = null;
    stopSpeech();
    const recorder = recorderRef.current;
    const blob = await new Promise<Blob>((resolve) => {
      if (!recorder || recorder.state === "inactive") {
        resolve(new Blob(chunksRef.current, { type: recorder?.mimeType || "video/webm" }));
        return;
      }
      recorder.onstop = () => resolve(new Blob(chunksRef.current, { type: recorder.mimeType || "video/webm" }));
      try {
        recorder.stop();
      } catch {
        resolve(new Blob(chunksRef.current, { type: recorder.mimeType || "video/webm" }));
      }
    });
    stopTracks();
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    const url = URL.createObjectURL(blob);
    setVideoBlob(blob);
    setVideoUrl(url);
    setElapsedMs(Date.now() - startedAtRef.current);
    setPhase("review");
    setStatus("Review the voice notes, then send them to the office.");
  }

  async function loadSavedVideo(file: File) {
    setStatus("Reading video and pulling screenshots…");
    try {
      const { shots: extracted, durationMs } = await framesFromFile(file, []);
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      setShots((current) => {
        current.forEach((shot) => URL.revokeObjectURL(shot.url));
        return extracted;
      });
                      shotCountRef.current = extracted.length;
      const url = URL.createObjectURL(file);
      setVideoBlob(file);
      setVideoUrl(url);
      setElapsedMs(durationMs);
      setSegments([]);
      setPhase("review");
      setStatus("Add a voice note or type what the office should do, then send.");
    } catch {
      setStatus("Could not read that video. Try recording on this phone instead.");
    }
  }

  async function recordVoiceNote() {
    setStatus("Listening for a voice note…");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voiceStreamRef.current = stream;
      const mime = pickRecorderMime("audio");
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      voiceChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) voiceChunksRef.current.push(event.data);
      };
      voiceRecorderRef.current = recorder;
      recordingRef.current = true;
      startedAtRef.current = Date.now() - elapsedMs;
      startSpeech();
      recorder.start();
      setVoiceRecording(true);
      setStatus("Recording voice note. Tap stop when you are done.");
    } catch {
      setStatus("Microphone was blocked. Type the notes instead.");
    }
  }

  async function stopVoiceNote() {
    recordingRef.current = false;
    setVoiceRecording(false);
    stopSpeech();
    const recorder = voiceRecorderRef.current;
    const blob = await new Promise<Blob>((resolve) => {
      if (!recorder || recorder.state === "inactive") {
        resolve(new Blob(voiceChunksRef.current, { type: recorder?.mimeType || "audio/webm" }));
        return;
      }
      recorder.onstop = () => resolve(new Blob(voiceChunksRef.current, { type: recorder.mimeType || "audio/webm" }));
      recorder.stop();
    });
    voiceStreamRef.current?.getTracks().forEach((track) => track.stop());
    voiceStreamRef.current = null;
    voiceRecorderRef.current = null;
    setAudioBlob(blob);
    setStatus("Voice note saved.");
  }

  function updateSegment(index: number, text: string) {
    setSegments((current) => current.map((row, i) => (i === index ? { ...row, text } : row)));
  }

  async function send() {
    if (!videoBlob) {
      setStatus("Record a walkthrough first.");
      return;
    }
    setPhase("uploading");
    setStatus("Sending video, voice, and screenshots to the office…");
    const form = new FormData();
    const videoType = videoBlob.type || "video/webm";
    form.set("video", new File([videoBlob], `walkthrough.${extensionForMime(videoType, "webm")}`, { type: videoType }));
    if (audioBlob) {
      const audioType = audioBlob.type || "audio/webm";
      form.set("audio", new File([audioBlob], `walkthrough-voice.${extensionForMime(audioType, "webm")}`, { type: audioType }));
    }
    shots.forEach((shot, index) => {
      form.append("screenshots", new File([shot.blob], `walkthrough-${String(index + 1).padStart(2, "0")}.jpg`, { type: "image/jpeg" }));
    });
    const withFrames = segments.map((segment) => {
      let screenshotIndex: number | null = null;
      let best = Infinity;
      shots.forEach((shot, index) => {
        const delta = Math.abs(shot.timestampMs - segment.startMs);
        if (delta < best) {
          best = delta;
          screenshotIndex = index;
        }
      });
      return { ...segment, screenshotIndex };
    });
    form.set(
      "transcript",
      JSON.stringify({
        text: [...withFrames.map((row) => row.text), interim].filter(Boolean).join(" ").trim(),
        durationMs: elapsedMs,
        segments: withFrames.map((row, index) => ({
          ...row,
          screenshotIndex: row.screenshotIndex ?? (shots[index] ? index : null),
        })),
      }),
    );
    form.set("capturedAt", new Date().toISOString());
    form.set("deviceInfo", navigator.userAgent.slice(0, 180));
    const res = await fetch(`/api/v1/projects/${projectId}/walkthrough`, { method: "POST", body: form });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setPhase("review");
      setStatus(json.error ?? "Upload failed. Try again.");
      return;
    }
    const data = json.data as { summary?: string; trades?: string[]; checklist?: { items?: unknown[] } };
    setResult({
      summary: data.summary ?? "Walkthrough sent.",
      trades: data.trades ?? [],
      itemCount: data.checklist?.items?.length ?? 0,
    });
    setPhase("done");
    setStatus("Office checklist is ready.");
    router.refresh();
  }

  const transcriptText = segments.map((row) => row.text).join(" ");

  return (
    <div className="field-stack">
      {phase === "idle" ? (
        <>
          <p className="field-lead">
            Walk the site, talk as you go, and ZoneCam will turn the video and voice notes into a trade checklist for the office — with a screenshot on each item.
          </p>
          <button type="button" className="field-shutter" onClick={() => void openCamera()}>
            Start camera walkthrough
          </button>
          <div className="field-shutter-wrap field-shutter-wrap-secondary">
            <span className="field-secondary field-secondary-fill">Use a saved video</span>
            <input
              className="field-file-hit"
              type="file"
              accept="video/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void loadSavedVideo(file);
              }}
            />
          </div>
        </>
      ) : null}

      {phase === "live" || phase === "recording" ? (
        <div className="field-walk-stage">
          <video ref={liveRef} className="field-walk-video" autoPlay muted playsInline />
          {phase === "recording" ? (
            <div className="field-rec-badge">
              <span className="field-rec-dot" />
              REC {formatWalkthroughClock(elapsedMs)}
            </div>
          ) : null}
          {(interim || segments.at(-1)?.text) && (
            <p className="field-captions">{interim || segments.at(-1)?.text}</p>
          )}
        </div>
      ) : null}

      {phase === "live" ? (
        <button type="button" className="field-shutter" onClick={() => void beginRecording()}>
          Record video + voice
        </button>
      ) : null}

      {phase === "recording" ? (
        <button type="button" className="field-primary" onClick={() => void finishRecording()}>
          Stop and review
        </button>
      ) : null}

      {phase === "review" || phase === "uploading" || phase === "done" ? (
        <>
          {videoUrl ? (
            <video ref={playbackRef} className="field-walk-video field-walk-video-review" src={videoUrl} controls playsInline />
          ) : null}
          <p className="field-label">Voice notes ({formatWalkthroughClock(elapsedMs)})</p>
          {segments.length === 0 ? (
            <textarea
              className="field-note"
              rows={4}
              placeholder="Type what you said, or add a voice note if speech-to-text did not run."
              value={transcriptText}
              onChange={(e) =>
                setSegments(e.target.value.trim() ? [{ startMs: 0, endMs: elapsedMs, text: e.target.value }] : [])
              }
            />
          ) : (
            <ul className="field-seg-list">
              {segments.map((segment, index) => (
                <li key={`${segment.startMs}-${index}`} className="field-seg">
                  <span className="field-seg-time">{formatWalkthroughClock(segment.startMs)}</span>
                  <textarea
                    className="field-note"
                    rows={2}
                    value={segment.text}
                    onChange={(e) => updateSegment(index, e.target.value)}
                  />
                </li>
              ))}
            </ul>
          )}
          {!speechAvailable ? (
            <p className="field-empty">Live captions are not available on this browser. The office still gets the video audio.</p>
          ) : null}
          {phase === "review" && voiceRecording ? (
            <button type="button" className="field-primary" onClick={() => void stopVoiceNote()}>
              Stop voice note
            </button>
          ) : null}
          {phase === "review" && !audioBlob && !voiceRecording ? (
            <button type="button" className="field-ghost" onClick={() => void recordVoiceNote()}>
              Add extra voice note
            </button>
          ) : null}
          {shots.length > 0 ? (
            <div>
              <p className="field-label">{shots.length} automatic screenshots</p>
              <div className="field-thumbs">
                {shots.map((shot) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={shot.url} src={shot.url} alt={`Frame at ${formatWalkthroughClock(shot.timestampMs)}`} />
                ))}
              </div>
            </div>
          ) : (
            <p className="field-empty">No screenshots yet — the office will still get the video.</p>
          )}
        </>
      ) : null}

      {phase === "review" ? (
        <button type="button" className="field-shutter" onClick={() => void send()}>
          Send checklist to office
        </button>
      ) : null}

      {phase === "uploading" ? <p className="field-status">Working… this can take a few seconds.</p> : null}

      {phase === "done" && result ? (
        <div className="field-walk-done">
          <p className="field-lead">{result.summary}</p>
          <p className="field-status">
            {result.itemCount} item{result.itemCount === 1 ? "" : "s"}
            {result.trades.length ? ` · ${result.trades.join(" · ")}` : ""}
          </p>
          <button type="button" className="field-secondary" onClick={() => router.push(`/field/${projectId}`)}>
            Back to job
          </button>
        </div>
      ) : null}

      {status ? <p className="field-status">{status}</p> : null}

      {phase === "live" || phase === "recording" ? (
        <button
          type="button"
          className="field-ghost"
          onClick={() => {
            stopEverything();
            setPhase("idle");
            setStatus(null);
          }}
        >
          Cancel
        </button>
      ) : null}
    </div>
  );
}
