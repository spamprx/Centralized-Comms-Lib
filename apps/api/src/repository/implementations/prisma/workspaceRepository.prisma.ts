import type { WorkspaceRepository } from "../../interfaces/workspaceRepository";
import type { Workspace } from "../../types";
import type { PrismaDb } from "./prismaTypes";

function toWorkspace(row: {
  id: string;
  slug: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}): Workspace {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PrismaWorkspaceRepository implements WorkspaceRepository {
  public constructor(private readonly db: PrismaDb) {}

  async getById(id: string): Promise<Workspace | null> {
    const row = await this.db.workspace.findUnique({ where: { id } });
    return row ? toWorkspace(row) : null;
  }

  async getBySlug(slug: string): Promise<Workspace | null> {
    const row = await this.db.workspace.findUnique({ where: { slug } });
    return row ? toWorkspace(row) : null;
  }

  async create(input: { slug: string; name: string }): Promise<Workspace> {
    const row = await this.db.workspace.create({
      data: { slug: input.slug, name: input.name },
    });
    return toWorkspace(row);
  }
}
