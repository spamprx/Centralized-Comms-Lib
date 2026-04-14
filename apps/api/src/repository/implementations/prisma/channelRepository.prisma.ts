import type { ChannelRepository } from "../../interfaces/channelRepository";
import type { Channel } from "../../types";
import type { PrismaDb } from "./prismaTypes";

function toChannel(row: {
  id: string;
  name: string;
  key: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}): Channel {
  return {
    id: row.id,
    name: row.name,
    key: row.key,
    description: row.description,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PrismaChannelRepository implements ChannelRepository {
  public constructor(private readonly db: PrismaDb) {}

  async list(): Promise<Channel[]> {
    const rows = await this.db.channel.findMany({ orderBy: { name: "asc" } });
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
  }): Promise<Channel> {
    const row = await this.db.channel.create({
      data: {
        name: input.name,
        key: input.key,
        description: input.description ?? null,
      },
    });
    return toChannel(row);
  }
}
