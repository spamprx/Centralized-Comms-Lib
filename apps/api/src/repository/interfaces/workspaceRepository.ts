import type { Workspace } from "../types";

export interface WorkspaceRepository {
  getById(id: string): Promise<Workspace | null>;
  getBySlug(slug: string): Promise<Workspace | null>;
  create(input: { slug: string; name: string }): Promise<Workspace>;
}
