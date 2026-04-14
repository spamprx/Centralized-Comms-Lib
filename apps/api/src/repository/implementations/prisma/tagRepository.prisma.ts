import type { TagRepository } from "../../interfaces";
import type { Tag } from "../../types";
import type { PrismaDb } from "./prismaTypes";

function toTag(row: {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  createdAt: Date;
}): Tag {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    parentId: row.parentId,
    createdAt: row.createdAt,
  };
}

export class PrismaTagRepository implements TagRepository {
  public constructor(private readonly db: PrismaDb) {}

  async getById(id: string): Promise<Tag | null> {
    const row = await this.db.tag.findUnique({ where: { id } });
    return row ? toTag(row) : null;
  }

  async getBySlug(slug: string): Promise<Tag | null> {
    const row = await this.db.tag.findUnique({ where: { slug } });
    return row ? toTag(row) : null;
  }

  async getByName(name: string): Promise<Tag | null> {
    const row = await this.db.tag.findUnique({ where: { name } });
    return row ? toTag(row) : null;
  }

  async list(): Promise<Tag[]> {
    const rows = await this.db.tag.findMany({ orderBy: { name: "asc" } });
    return rows.map(toTag);
  }

  async create(input: {
    name: string;
    slug: string;
    parentId?: string | null;
  }): Promise<Tag> {
    const row = await this.db.tag.create({
      data: {
        name: input.name,
        slug: input.slug,
        parentId: input.parentId ?? null,
      },
    });
    return toTag(row);
  }

  async delete(id: string): Promise<void> {
    await this.db.tag.delete({ where: { id } });
  }

  async assignToContent(contentId: string, tagId: string): Promise<void> {
    await this.db.contentTag.create({
      data: { contentId, tagId },
    });
  }

  async removeFromContent(contentId: string, tagId: string): Promise<void> {
    await this.db.contentTag.deleteMany({
      where: { contentId, tagId },
    });
  }

  async listForContent(contentId: string): Promise<Tag[]> {
    const rows = await this.db.contentTag.findMany({
      where: { contentId },
      include: { tag: true },
    });
    return rows.map((r: any) => toTag(r.tag));
  }
}
