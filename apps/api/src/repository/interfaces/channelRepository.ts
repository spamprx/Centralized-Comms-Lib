import type { Channel } from "../types";

export interface ChannelRepository {
  list(): Promise<Channel[]>;
  getById(id: string): Promise<Channel | null>;
  getByKey(key: string): Promise<Channel | null>;
  create(input: {
    name: string;
    key: string;
    description?: string | null;
    priority?: number;
    compatibility?: Record<string, unknown>;
  }): Promise<Channel>;
  update(
    id: string,
    input: {
      name?: string;
      key?: string;
      description?: string | null;
      priority?: number;
      compatibility?: Record<string, unknown>;
    },
  ): Promise<Channel>;
  countBindings(id: string): Promise<number>;
  delete(id: string): Promise<boolean>;
}
