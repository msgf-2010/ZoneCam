export type JobName =
  | "media.process"
  | "email.send"
  | "ai.analyze-media"
  | "report.generate";

export interface JobQueue {
  enqueue<T>(name: JobName, payload: T): Promise<void>;
  register<T>(name: JobName, handler: (payload: T) => Promise<void>): void;
}

type Handler = (payload: unknown) => Promise<void>;

export class InlineJobQueue implements JobQueue {
  private handlers = new Map<JobName, Handler>();

  register<T>(name: JobName, handler: (payload: T) => Promise<void>) {
    this.handlers.set(name, (payload) => handler(payload as T));
  }

  async enqueue<T>(name: JobName, payload: T) {
    const handler = this.handlers.get(name);
    if (!handler) {
      console.warn(`[jobs] no handler for ${name}`);
      return;
    }
    queueMicrotask(() => {
      handler(payload).catch((error) => console.error(`[jobs] ${name} failed`, error));
    });
  }
}

let queue: JobQueue | undefined;

export function getJobQueue(): JobQueue {
  if (!queue) queue = new InlineJobQueue();
  return queue;
}
