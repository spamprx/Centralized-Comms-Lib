import type { ChannelRepository } from "../../interfaces/channelRepository";
import type { Channel } from "../../types";
import type { PrismaDb } from "./prismaTypes";

function toChannel(row: {
  id: string;
  name: string;
  key: string;
  description: string | null;
  priority: number;
  compatibility: unknown;
  createdAt: Date;
  updatedAt: Date;
}): Channel {
  return {
    id: row.id,
    name: row.name,
    key: row.key,
    description: row.description,
    priority: row.priority,
    compatibility:
      row.compatibility && typeof row.compatibility === "object"
        ? (row.compatibility as Record<string, unknown>)
        : {},
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PrismaChannelRepository implements ChannelRepository {
  public constructor(private readonly db: PrismaDb) {}

  async list(): Promise<Channel[]> {
    const rows = await this.db.channel.findMany({
      orderBy: [{ priority: "desc" }, { name: "asc" }],
    });
    return rows.map(toChannel);
  }

  async getById(id: string): Promise<Channel | null> {
    const row = await this.db.channel.findUnique({ where: { id } });
    return row ? toChannel(row) : null;
  }

  async getByKey(key: string): Promise<Channel | null> {
    const row = await this.db.channel.findUnique({ where: { key } });
    return row ? toChannel(row) : null;
  }

  async create(input: {
    name: string;
    key: string;
    description?: string | null;
    priority?: number;
    compatibility?: Record<string, unknown>;
  }): Promise<Channel> {
    const row = await this.db.channel.create({
      data: {
        name: input.name,
        key: input.key,
        description: input.description ?? null,
        priority: input.priority ?? 0,
        compatibility: (input.compatibility ?? {}) as object,
      },
    });
    return toChannel(row);
  }

  async update(
    id: string,
    input: {
      name?: string;
      key?: string;
      description?: string | null;
      priority?: number;
      compatibility?: Record<string, unknown>;
    },
  ): Promise<Channel> {
    const row = await this.db.channel.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.key !== undefined && { key: input.key }),
        ...(input.description !== undefined && {
          description: input.description,
        }),
        ...(input.priority !== undefined && { priority: input.priority }),
        ...(input.compatibility !== undefined && {
          compatibility: input.compatibility as object,
        }),
      },
    });
    return toChannel(row);
  }

  async delete(id: string): Promise<boolean> {
    const res = await this.db.channel.deleteMany({ where: { id } });
    return res.count > 0;
  }

  async countBindings(id: string): Promise<number> {
    return this.db.templateChannelBinding.count({ where: { channelId: id } });
  }
}
