import type { OutboxRepository } from "../../interfaces";
import type { OutboxEvent, OutboxEventInput } from "../../types";
import type { PrismaDb } from "./prismaTypes";

function toOutbox(row: {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: unknown;
  createdAt: Date;
  processedAt: Date | null;
  retryCount: number;
}): OutboxEvent {
  return {
    id: row.id,
    aggregateType: row.aggregateType,
    aggregateId: row.aggregateId,
    eventType: row.eventType,
    payload: row.payload,
    createdAt: row.createdAt,
    processedAt: row.processedAt,
    retryCount: row.retryCount,
  };
}

export class PrismaOutboxRepository implements OutboxRepository {
  public constructor(private readonly db: PrismaDb) {}

  async add(event: OutboxEventInput): Promise<OutboxEvent> {
    const row = await this.db.outboxEvent.create({
      data: {
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        eventType: event.eventType,
        payload: event.payload as any,
      },
    });
    return toOutbox(row);
  }

  async listUnprocessed(limit: number): Promise<OutboxEvent[]> {
    const rows = await this.db.outboxEvent.findMany({
      where: { processedAt: null },
      orderBy: { createdAt: "asc" },
      take: limit,
    });
    return rows.map(toOutbox);
  }

  async markProcessed(eventId: string, processedAt: Date = new Date()): Promise<void> {
    await this.db.outboxEvent.update({
      where: { id: eventId },
      data: { processedAt },
    });
  }

  async incrementRetry(eventId: string): Promise<void> {
    await this.db.outboxEvent.update({
      where: { id: eventId },
      data: { retryCount: { increment: 1 } },
    });
  }
}

