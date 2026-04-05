import type { Channel } from "../types";

export interface ChannelRepository {
  list(): Promise<Channel[]>;
  getById(id: string): Promise<Channel | null>;
  getByKey(key: string): Promise<Channel | null>;
  create(input: { name: string; key: string; description?: string | null }): Promise<Channel>;
}
