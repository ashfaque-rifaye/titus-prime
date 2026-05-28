/**
 * Typed in-process pub/sub bus for agent communication.
 *
 * This is the actual message-passing layer the narrative refers to. Every cross-
 * agent escalation in Titus-Prime (e.g. Treasury → Collection priority mode) goes
 * through here. The bus is intentionally simple: synchronous fan-out to all
 * subscribers, plus an async-iterator helper so server-sent-events can stream a
 * run's transcript to the browser.
 */
import type { AgentEvent, EventListener } from "./types";

export class EventBus {
  private listeners = new Set<EventListener>();
  /** Per-run history kept in memory so subscribers that join late see context. */
  private historyByRun = new Map<string, AgentEvent[]>();
  private readonly historyCap = 200;

  subscribe(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: AgentEvent): void {
    // Persist to per-run history for late-joining subscribers and replay.
    if ("runId" in event && event.runId) {
      const arr = this.historyByRun.get(event.runId) ?? [];
      arr.push(event);
      if (arr.length > this.historyCap) arr.shift();
      this.historyByRun.set(event.runId, arr);
    }
    // Fan-out. Listener errors must not break the bus.
    for (const l of this.listeners) {
      try {
        const r = l(event);
        // Best-effort handling of async listener rejections.
        if (r && typeof (r as Promise<unknown>).catch === "function") {
          (r as Promise<unknown>).catch((e) => {
            // eslint-disable-next-line no-console
            console.error("[bus] listener error", e);
          });
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("[bus] listener throw", e);
      }
    }
  }

  history(runId: string): AgentEvent[] {
    return this.historyByRun.get(runId) ?? [];
  }

  /** Yields every future event matching the given runId until the run completes. */
  async *stream(runId: string): AsyncGenerator<AgentEvent> {
    // Replay anything already buffered for this run.
    for (const e of this.history(runId)) yield e;

    // Then attach a live subscriber.
    const queue: AgentEvent[] = [];
    let resolve: (() => void) | null = null;
    let closed = false;
    const unsub = this.subscribe((e) => {
      if (!("runId" in e) || e.runId !== runId) return;
      queue.push(e);
      if (e.kind === "run.completed" || e.kind === "run.failed") closed = true;
      resolve?.();
      resolve = null;
    });

    try {
      while (true) {
        if (queue.length > 0) {
          const e = queue.shift()!;
          yield e;
          continue;
        }
        if (closed) return;
        await new Promise<void>((r) => (resolve = r));
      }
    } finally {
      unsub();
    }
  }
}

/**
 * Process-wide singleton. The orchestrator and every agent share this bus.
 * In a real production deploy you'd swap this for Redis Streams / NATS / Kafka,
 * but for an in-process Nitro server it's sufficient and lets us avoid extra infra.
 */
declare global {
  // eslint-disable-next-line no-var
  var __TITUS_BUS__: EventBus | undefined;
}

export const bus: EventBus = globalThis.__TITUS_BUS__ ?? (globalThis.__TITUS_BUS__ = new EventBus());
