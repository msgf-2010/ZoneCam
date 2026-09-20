import { classifyTrade, GENERAL_TRADE, sortTrades, tradeDisplayName } from "@/lib/trades";
import { formatWalkthroughClock, type WalkthroughSegment } from "@/lib/walkthrough";

export type WalkthroughChecklistItem = {
  trade: string;
  title: string;
  notes: string;
  timestampMs: number;
  screenshotIndex: number | null;
};

export type WalkthroughChecklistResult = {
  summary: string;
  items: WalkthroughChecklistItem[];
};

const FILLER = /\b(um+|uh+|like|you know|so yeah|anyway)\b/gi;
const VERB_START =
  /^(photograph|photo|repair|replace|fix|install|paint|prime|caulk|check|inspect|review|clean|remove|adjust|seal|patch|document|follow up|call|order|test|verify)\b/i;

function cleanSpeech(text: string) {
  return text
    .replace(FILLER, " ")
    .replace(/\s+/g, " ")
    .replace(/^[,.\s]+/, "")
    .trim();
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|(?<=\s)and then\s+/i)
    .map(cleanSpeech)
    .filter((part) => part.length >= 8);
}

export function toChecklistTitle(text: string, trade: string) {
  const cleaned = cleanSpeech(text).replace(/^(the\s+office\s+should|we need to|need to|please)\s+/i, "");
  if (!cleaned) return `Review ${trade.toLowerCase()} item`;
  const clipped = cleaned.length > 110 ? `${cleaned.slice(0, 107).replace(/\s+\S*$/, "")}…` : cleaned;
  if (VERB_START.test(clipped)) {
    return clipped.charAt(0).toUpperCase() + clipped.slice(1);
  }
  const lower = clipped.toLowerCase();
  if (/\b(leak|leaking)\b/.test(lower)) return `Repair leak: ${clipped}`;
  if (/\b(paint|peel|scuff)\b/.test(lower)) return `Paint: ${clipped}`;
  if (/\b(broken|damage|damaged|crack)\b/.test(lower)) return `Document damage: ${clipped}`;
  if (/\b(missing|replace)\b/.test(lower)) return `Replace: ${clipped}`;
  if (/\b(install)\b/.test(lower)) return `Install: ${clipped}`;
  return `Follow up: ${clipped.charAt(0).toUpperCase() + clipped.slice(1)}`;
}

function nearestScreenshotIndex(timestampMs: number, screenshotCount: number, durationMs: number) {
  if (screenshotCount <= 0) return null;
  if (screenshotCount === 1) return 0;
  const duration = Math.max(durationMs, 1);
  const ratio = Math.min(1, Math.max(0, timestampMs / duration));
  return Math.min(screenshotCount - 1, Math.round(ratio * (screenshotCount - 1)));
}

function segmentsFromTranscript(input: { transcript: string; segments: WalkthroughSegment[]; durationMs: number }) {
  if (input.segments.length > 0) {
    return input.segments
      .map((segment) => ({
        startMs: Math.max(0, segment.startMs),
        endMs: Math.max(segment.startMs, segment.endMs),
        text: cleanSpeech(segment.text),
        screenshotIndex: segment.screenshotIndex ?? null,
      }))
      .filter((segment) => segment.text.length >= 4);
  }
  const parts = splitSentences(input.transcript);
  if (parts.length === 0) return [];
  const step = Math.floor(Math.max(input.durationMs, parts.length * 1000) / parts.length);
  return parts.map((text, index) => ({
    startMs: index * step,
    endMs: (index + 1) * step,
    text,
    screenshotIndex: null as number | null,
  }));
}

export function buildWalkthroughChecklist(input: {
  jobName?: string;
  jobType?: string;
  durationMs?: number;
  transcript: string;
  segments: WalkthroughSegment[];
  screenshotCount: number;
}): WalkthroughChecklistResult {
  const durationMs = Math.max(0, input.durationMs ?? 0);
  const segments = segmentsFromTranscript({
    transcript: input.transcript,
    segments: input.segments,
    durationMs,
  });

  const items: WalkthroughChecklistItem[] = [];
  let previousTrade = GENERAL_TRADE.name;

  if (segments.length === 0) {
    const count = Math.max(1, Math.min(input.screenshotCount || 1, 8));
    const step = count > 1 ? Math.floor(Math.max(durationMs, 1000) / count) : 0;
    for (let index = 0; index < count; index += 1) {
      const timestampMs = index * step;
      items.push({
        trade: GENERAL_TRADE.name,
        title: `Review walkthrough footage at ${formatWalkthroughClock(timestampMs)}`,
        notes: input.transcript.trim() || "No voice notes were captured. Review the video.",
        timestampMs,
        screenshotIndex: input.screenshotCount > 0 ? Math.min(index, input.screenshotCount - 1) : null,
      });
    }
  } else {
    for (const segment of segments) {
      const trade = classifyTrade(segment.text, previousTrade);
      previousTrade = trade;
      const screenshotIndex =
        segment.screenshotIndex != null && segment.screenshotIndex >= 0 && segment.screenshotIndex < input.screenshotCount
          ? segment.screenshotIndex
          : nearestScreenshotIndex(segment.startMs, input.screenshotCount, durationMs);
      items.push({
        trade: tradeDisplayName(trade),
        title: toChecklistTitle(segment.text, trade),
        notes: segment.text,
        timestampMs: segment.startMs,
        screenshotIndex,
      });
    }
  }

  const merged: WalkthroughChecklistItem[] = [];
  if (segments.length === 0) {
    merged.push(...items);
  } else {
    for (const item of items) {
      const last = merged[merged.length - 1];
      if (
        last &&
        last.trade === item.trade &&
        item.timestampMs - last.timestampMs < 8000 &&
        last.notes.length + item.notes.length < 280
      ) {
        last.notes = `${last.notes} ${item.notes}`.trim();
        last.title = toChecklistTitle(last.notes, last.trade);
        if (last.screenshotIndex == null) last.screenshotIndex = item.screenshotIndex;
        continue;
      }
      merged.push({ ...item });
    }
  }

  const capped = merged.slice(0, 40);
  const trades = sortTrades([...new Set(capped.map((item) => item.trade))]);
  const job = [input.jobType, input.jobName].filter(Boolean).join(" · ");
  const voice = input.transcript.trim();
  const voiceBit = voice ? ` Voice: ${voice.slice(0, 220)}${voice.length > 220 ? "…" : ""}` : " No speech-to-text was captured; use the video audio.";
  const summary = `Walkthrough${job ? ` for ${job}` : ""} (${formatWalkthroughClock(durationMs)}). ${capped.length} office item${
    capped.length === 1 ? "" : "s"
  } across ${trades.join(", ") || GENERAL_TRADE.name}.${voiceBit}`;

  const ordered = [...capped].sort((a, b) => {
    const tradeCmp = sortTrades([a.trade, b.trade]).indexOf(a.trade) - sortTrades([a.trade, b.trade]).indexOf(b.trade);
    if (a.trade !== b.trade) {
      return sortTrades([a.trade, b.trade])[0] === a.trade ? -1 : 1;
    }
    return a.timestampMs - b.timestampMs || tradeCmp;
  });

  return { summary, items: ordered };
}
