import { getPrismaClient, PrismaUnitOfWork } from "../../repository";
import type { AuditContext } from "../../shared/context";
import { bumpSearchCacheEpoch } from "../../shared/cache/redisClient";
import { publishEvent } from "../../integration";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export const tagService = {
  async create(
    ctx: AuditContext,
    input: { name: string; parentId?: string | null },
  ): Promise<{
    tag: { id: string; name: string; slug: string };
    conflict: boolean;
  }> {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    const result = await uow.withTransaction(async (repos) => {
      const existing = await repos.tag.getByName(input.name);
      if (existing) return { conflict: true, tag: existing } as const;
      if (input.parentId) {
        const parent = await repos.tag.getById(input.parentId);
        if (!parent) {
          throw new Error("Parent tag not found");
        }
      }
      const slug = slugify(input.name);
      const tag = await repos.tag.create({
        name: input.name,
        slug,
        parentId: input.parentId ?? null,
      });
      await repos.audit.append({
        action: "CREATE",
        resource: "TAG",
        resourceId: tag.id,
        newValue: { name: input.name, slug, parentId: input.parentId ?? null },
        actorId: ctx.actorId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
      await publishEvent(repos.outbox, {
        aggregateType: "TAG",
        aggregateId: tag.id,
        eventType: "TEMPLATE.METADATA_CHANGED",
        payload: { reason: "TAG_CREATED", tagId: tag.id, slug: tag.slug },
      });
      return { conflict: false, tag } as const;
    });
    await bumpSearchCacheEpoch();
    return result;
  },

  async list() {
    const repos = new PrismaUnitOfWork(getPrismaClient()).repos();
    return repos.tag.list();
  },

  async getById(id: string) {
    const repos = new PrismaUnitOfWork(getPrismaClient()).repos();
    return repos.tag.getById(id);
  },

  async delete(ctx: AuditContext, tagId: string): Promise<void> {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    await uow.withTransaction(async (repos) => {
      await repos.tag.delete(tagId);
      await repos.audit.append({
        action: "DELETE",
        resource: "TAG",
        resourceId: tagId,
        actorId: ctx.actorId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
      await publishEvent(repos.outbox, {
        aggregateType: "TAG",
        aggregateId: tagId,
        eventType: "TEMPLATE.METADATA_CHANGED",
        payload: { reason: "TAG_DELETED", tagId },
      });
    });
    await bumpSearchCacheEpoch();
  },
};
