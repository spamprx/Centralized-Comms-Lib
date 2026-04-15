export interface Channel {
  id: string;
  name: string;
  key: string;
  description: string | null;
  priority: number;
  compatibility: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}
