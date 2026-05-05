import { getPrismaClient, PrismaUnitOfWork } from "../../repository";
import type { AuditContext } from "../../shared/context";

const WHATSAPP_SUPPORTED_FIELD_TYPES = new Set([
  "paragraph",
  "bold",
  "italic",
  "strike",
  "code",
  "bullet_list",
  "ordered_list",
  "link",
  "richText",
  "media",
  "field",
]);

function slugifyKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeCompatibilityForChannel(
  channelKey: string,
  compatibility: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!compatibility) return {};
  if (channelKey !== "whatsapp") return compatibility;

  const out: Record<string, unknown> = { ...compatibility };
  const rawFieldTypes = compatibility.fieldTypes;
  if (Array.isArray(rawFieldTypes)) {
    out.fieldTypes = rawFieldTypes
      .map(String)
      .filter((t) => WHATSAPP_SUPPORTED_FIELD_TYPES.has(t));
  }

  const restrictions = compatibility.restrictions;
  if (
    restrictions &&
    typeof restrictions === "object" &&
    !Array.isArray(restrictions)
  ) {
    const r = { ...(restrictions as Record<string, unknown>) };
    // WhatsApp matrix does not support underline as a native format.
    r.supportsUnderline = false;
    out.restrictions = r;
  }

  return out;
}

export const channelService = {
  async list() {
    const repos = new PrismaUnitOfWork(getPrismaClient()).repos();
    return repos.channel.list();
  },

  async create(
    ctx: AuditContext,
    input: {
      name: string;
      key?: string;
      description?: string | null;
      priority?: number;
      compatibility?: Record<string, unknown>;
    },
  ): Promise<{
    channel: { id: string; name: string; key: string };
    conflict: boolean;
  }> {
    if (!ctx.isAdmin) {
      throw new Error("Only admins can create channels");
    }
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
        return {
          conflict: true,
          channel: { id: existing.id, name: existing.name, key: existing.key },
        };
      }
      const channel = await repos.channel.create({
        name,
        key,
        description: input.description ?? null,
        priority: Number.isFinite(input.priority) ? Number(input.priority) : 0,
        compatibility: normalizeCompatibilityForChannel(key, input.compatibility),
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
      return {
        conflict: false,
        channel: { id: channel.id, name: channel.name, key: channel.key },
      };
    });
  },

  async getById(id: string) {
    const repos = new PrismaUnitOfWork(getPrismaClient()).repos();
    return repos.channel.getById(id);
  },

  async update(
    ctx: AuditContext,
    id: string,
    input: {
      name?: string;
      key?: string;
      description?: string | null;
      priority?: number;
      compatibility?: Record<string, unknown>;
    },
  ): Promise<
    | { ok: true; channel: { id: string; name: string; key: string } }
    | { notFound: true }
    | { conflict: true }
  > {
    if (!ctx.isAdmin) {
      throw new Error("Only admins can update channels");
    }
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    return uow.withTransaction(async (repos) => {
      const existing = await repos.channel.getById(id);
      if (!existing) return { notFound: true } as const;

      const nextName = input.name?.trim();
      if (input.name !== undefined && (!nextName || nextName.length > 200)) {
        throw new Error("name must be at most 200 characters");
      }

      const nextKey =
        input.key !== undefined ? slugifyKey(input.key) : undefined;
      if (input.key !== undefined && !nextKey) {
        throw new Error("Could not derive a valid channel key");
      }
      if (nextKey && nextKey !== existing.key) {
        const byKey = await repos.channel.getByKey(nextKey);
        if (byKey && byKey.id !== id) return { conflict: true } as const;
      }

      const channel = await repos.channel.update(id, {
        ...(nextName !== undefined && { name: nextName }),
        ...(nextKey !== undefined && { key: nextKey }),
        ...(input.description !== undefined && {
          description: input.description,
        }),
        ...(input.priority !== undefined && {
          priority: Number(input.priority) || 0,
        }),
        ...(input.compatibility !== undefined && {
          compatibility: normalizeCompatibilityForChannel(
            (nextKey ?? existing.key).toLowerCase(),
            input.compatibility,
          ),
        }),
      });

      await repos.audit.append({
        action: "UPDATE",
        resource: "CHANNEL",
        resourceId: channel.id,
        newValue: {
          name: channel.name,
          key: channel.key,
          priority: channel.priority,
          compatibility: channel.compatibility,
        },
        actorId: ctx.actorId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });

      return {
        ok: true,
        channel: { id: channel.id, name: channel.name, key: channel.key },
      } as const;
    });
  },

  async remove(
    ctx: AuditContext,
    id: string,
  ): Promise<
    { ok: true } | { notFound: true } | { conflict: true; message: string }
  > {
    if (!ctx.isAdmin) {
      throw new Error("Only admins can delete channels");
    }
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    return uow.withTransaction(async (repos) => {
      const ch = await repos.channel.getById(id);
      if (!ch) return { notFound: true } as const;
      const bindingCount = await repos.channel.countBindings(id);
      if (bindingCount > 0) {
        return {
          conflict: true,
          message:
            "Channel is bound to one or more templates. Remove template bindings first.",
        } as const;
      }
      const deleted = await repos.channel.delete(id);
      if (!deleted) return { notFound: true } as const;

      await repos.audit.append({
        action: "DELETE",
        resource: "CHANNEL",
        resourceId: id,
        oldValue: { name: ch.name, key: ch.key },
        actorId: ctx.actorId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
      return { ok: true } as const;
    });
  },
};
