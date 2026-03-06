import { OutboxEvent, OutboxEventInput } from "../types";

export interface OutboxRepository {
  add(event: OutboxEventInput): Promise<OutboxEvent>;
  listUnprocessed(limit: number): Promise<OutboxEvent[]>;
  markProcessed(eventId: string, processedAt?: Date): Promise<void>;
  incrementRetry(eventId: string): Promise<void>;
}

