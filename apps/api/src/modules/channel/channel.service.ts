import { getPrismaClient, PrismaUnitOfWork } from "../../repository";
import type { AuditContext } from "../../shared/context";

function slugifyKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export const channelService = {
  async list() {
    const repos = new PrismaUnitOfWork(getPrismaClient()).repos();
    return repos.channel.list();
  },

  async create(
    ctx: AuditContext,
    input: { name: string; key?: string; description?: string | null },
  ): Promise<{ channel: { id: string; name: string; key: string }; conflict: boolean }> {
    const name = input.name?.trim();
    if (!name || name.length > 200) {
      throw new Error("name is required and must be at most 200 characters");
    }
    const key = slugifyKey(input.key ?? name);
    if (!key) {
      throw new Error("Could not derive a valid channel key");
    }

    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    return uow.withTransaction(async (repos) => {
      const existing = await repos.channel.getByKey(key);
      if (existing) {
        return { conflict: true, channel: { id: existing.id, name: existing.name, key: existing.key } };
      }
      const channel = await repos.channel.create({
        name,
        key,
        description: input.description ?? null,
      });
      await repos.audit.append({
        action: "CREATE",
        resource: "CHANNEL",
        resourceId: channel.id,
        newValue: { name: channel.name, key: channel.key },
        actorId: ctx.actorId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
      return { conflict: false, channel: { id: channel.id, name: channel.name, key: channel.key } };
    });
  },

  async getById(id: string) {
    const repos = new PrismaUnitOfWork(getPrismaClient()).repos();
    return repos.channel.getById(id);
  },
};
