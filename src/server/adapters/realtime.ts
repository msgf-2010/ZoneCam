export type RealtimeEvent = {
  companyId: string;
  projectId?: string;
  type: string;
  payload: unknown;
};

export interface RealtimePublisher {
  publish(event: RealtimeEvent): Promise<void>;
}

export class MemoryRealtimePublisher implements RealtimePublisher {
  async publish(event: RealtimeEvent) {
    if (process.env.NODE_ENV === "development") {
      console.info(`[realtime] ${event.type} company=${event.companyId}`);
    }
  }
}

export function createRealtimePublisher(): RealtimePublisher {
  return new MemoryRealtimePublisher();
}
