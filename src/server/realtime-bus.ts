import { createRealtimePublisher, type RealtimeEvent } from "@/server/adapters/realtime";

type Listener = (event: RealtimeEvent) => void;

const globalBus = globalThis as unknown as { zonecamRealtime?: Map<string, Set<Listener>> };

function channels() {
  if (!globalBus.zonecamRealtime) globalBus.zonecamRealtime = new Map();
  return globalBus.zonecamRealtime;
}

export function subscribeCompany(companyId: string, listener: Listener) {
  const map = channels();
  const set = map.get(companyId) ?? new Set<Listener>();
  set.add(listener);
  map.set(companyId, set);
  return () => {
    set.delete(listener);
    if (set.size === 0) map.delete(companyId);
  };
}

export async function fanoutRealtime(event: RealtimeEvent) {
  await createRealtimePublisher().publish(event);
  for (const listener of channels().get(event.companyId) ?? []) {
    listener(event);
  }
}
