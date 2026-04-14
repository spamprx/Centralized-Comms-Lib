import { getPrismaClient, PrismaUnitOfWork, type Repositories } from "../../repository";
import type { Template, TemplateBinding, TemplateStatus, TemplateWithBindings } from "../../repository/types";
import type { LayoutPhase } from "../../repository/types";
import type { AuditContext } from "../../shared/context";
import { mergeI18n, parseI18nPatch, type I18nStrings } from "../../shared/validation/i18nPatch";
import {
  flattenRegions,
  parseAndValidateLayoutConfig,
  regenerateLayoutIds,
} from "../../shared/validation/layoutConfig";
import { workspaceService } from "../workspace/workspace.service";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
function deepCloneJson<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function flattenI18nForRows(strings: I18nStrings): Array<{ locale: string; key: string; value: string }> {
  const rows: Array<{ locale: string; key: string; value: string }> = [];
  for (const [locale, bundle] of Object.entries(strings)) {
    for (const [key, value] of Object.entries(bundle)) {
      rows.push({ locale, key, value });
    }
  }
  return rows;
}

async function uniqueTemplateSlug(
  repos: Pick<Repositories, "template">,
  workspaceId: string,
  baseName: string,
): Promise<string> {
  let candidate = slugify(baseName);
  if (!candidate) candidate = "template";
  for (let i = 0; i < 64; i++) {
    const existing = await repos.template.getByWorkspaceAndSlug(workspaceId, candidate);
    if (!existing) return candidate;
    candidate = `${slugify(baseName)}-${Date.now().toString(36)}${i}`;
  }
  throw new Error("Could not allocate a unique template slug");
}

/** Resolves a display name that does not violate @@unique([workspaceId, name]). */
async function allocateUniqueCloneName(
  repos: Pick<Repositories, "template">,
  workspaceId: string,
  sourceName: string,
): Promise<string> {
  let candidate = `${sourceName} (Copy)`;
  let suffix = 1;
  while (await repos.template.findByWorkspaceAndName(workspaceId, candidate)) {
    suffix += 1;
    candidate = `${sourceName} (Copy ${suffix})`;
  }
  return candidate;
}

function validateName(name: unknown): string {
  if (typeof name !== "string") throw new Error("name must be a string");
  const t = name.trim();
  if (t.length < 1 || t.length > 200) throw new Error("name must be 1–200 characters");
  return t;
}

function templateToJSON(t: Template): Record<string, unknown> {
  return {
    id: t.id,
    workspaceId: t.workspaceId,
    name: t.name,
    slug: t.slug,
    description: t.description,
    status: t.status,
    draftLayout: t.draftLayout,
    activeLayout: t.activeLayout,
    i18n: t.i18n,
    authorId: t.authorId,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

const LAYOUT_PHASES: LayoutPhase[] = ["DRAFT", "ACTIVE"];

export const templateService = {
  templateToJSON,

  async create(
    ctx: AuditContext,
    input: { name: string; description?: string | null; draftLayout?: unknown | null },
  ): Promise<Template> {
    const name = validateName(input.name);
    const workspaceId = await workspaceService.resolveDefaultWorkspaceId();
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    return uow.withTransaction(async (repos) => {
      const slug = await uniqueTemplateSlug(repos, workspaceId, name);
      if (input.draftLayout != null) {
        const parsed = parseAndValidateLayoutConfig(input.draftLayout);
        if (!parsed) throw new Error("Invalid draftLayout schema");
      }
      const template = await repos.template.create({
        workspaceId,
        name,
        slug,
        description: input.description ?? null,
        authorId: ctx.actorId,
        draftLayout: input.draftLayout ?? null,
        status: "DRAFT",
        i18n: {},
      });
      await repos.audit.append({
        action: "CREATE",
        resource: "TEMPLATE",
        resourceId: template.id,
        newValue: { workspaceId, name, slug },
        actorId: ctx.actorId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
      return template;
    });
  },

  async list(): Promise<Template[]> {
    const workspaceId = await workspaceService.resolveDefaultWorkspaceId();
    const repos = new PrismaUnitOfWork(getPrismaClient()).repos();
    return repos.template.list(workspaceId);
  },

  async getById(id: string): Promise<Template | null> {
    const repos = new PrismaUnitOfWork(getPrismaClient()).repos();
    return repos.template.getById(id);
  },

  async getByIdWithBindings(id: string): Promise<TemplateWithBindings | null> {
    const repos = new PrismaUnitOfWork(getPrismaClient()).repos();
    return repos.template.getByIdWithBindings(id);
  },

  async update(
    ctx: AuditContext,
    id: string,
    input: { name?: string; description?: string | null; slug?: string; status?: TemplateStatus },
  ): Promise<
    | { ok: true; template: Template }
    | { notFound: true }
    | { conflict: true; message: string }
    | { invalid: true; message: string }
  > {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    return uow.withTransaction(async (repos) => {
      const current = await repos.template.getById(id);
      if (!current) return { notFound: true } as const;

      const patch: {
        name?: string;
        description?: string | null;
        slug?: string;
        status?: TemplateStatus;
      } = {};

      if (input.name !== undefined) {
        patch.name = validateName(input.name);
        const taken = await repos.template.findByWorkspaceAndName(current.workspaceId, patch.name);
        if (taken && taken.id !== id) {
          return { conflict: true, message: "name already in use in this workspace" } as const;
        }
      }
      if (input.description !== undefined) {
        patch.description = input.description;
      }
      if (input.slug !== undefined) {
        if (typeof input.slug !== "string" || !input.slug.trim()) {
          return { invalid: true, message: "slug must be a non-empty string" } as const;
        }
        const s = slugify(input.slug.trim());
        if (!s) return { invalid: true, message: "slug must contain alphanumeric characters" } as const;
        const taken = await repos.template.getByWorkspaceAndSlug(current.workspaceId, s);
        if (taken && taken.id !== id) {
          return { conflict: true, message: "slug already in use in this workspace" } as const;
        }
        patch.slug = s;
      }
      if (input.status !== undefined) {
        if (input.status === "ACTIVE") {
          return {
            invalid: true,
            message: "Use POST /templates/:id/activate to set ACTIVE",
          } as const;
        }
        if (input.status === "DRAFT" && current.status === "ACTIVE") {
          patch.status = "DRAFT";
        } else if (input.status !== current.status) {
          return { invalid: true, message: "Invalid status transition" } as const;
        }
      }

      if (Object.keys(patch).length === 0) {
        return { ok: true, template: current };
      }

      const template = await repos.template.update(id, patch);
      await repos.audit.append({
        action: "UPDATE",
        resource: "TEMPLATE",
        resourceId: id,
        oldValue: { name: current.name, slug: current.slug, status: current.status },
        newValue: patch,
        actorId: ctx.actorId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
      return { ok: true, template } as const;
    });
  },

  async delete(
    ctx: AuditContext,
    id: string,
  ): Promise<
    { ok: true } | { notFound: true } | { inUse: true; reason: string }
  > {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    return uow.withTransaction(async (repos) => {
      const current = await repos.template.getById(id);
      if (!current) return { notFound: true } as const;
      if (current.status === "ACTIVE") {
        return { inUse: true, reason: "Cannot delete an ACTIVE template; deactivate first" } as const;
      }
      const n = await repos.template.countContentsUsingTemplate(id);
      if (n > 0) {
        return { inUse: true, reason: `Template is referenced by ${n} content item(s)` } as const;
      }
      await repos.template.delete(id);
      await repos.audit.append({
        action: "DELETE",
        resource: "TEMPLATE",
        resourceId: id,
        oldValue: { name: current.name, slug: current.slug },
        actorId: ctx.actorId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
      return { ok: true } as const;
    });
  },

  async clone(
    ctx: AuditContext,
    sourceId: string,
  ): Promise<
    | { ok: true; template: TemplateWithBindings }
    | { notFound: true }
  > {
    const workspaceId = await workspaceService.resolveDefaultWorkspaceId();
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    return uow.withTransaction(async (repos) => {
      const src = await repos.template.getByIdWithBindings(sourceId);
      if (!src) return { notFound: true } as const;

      const name = await allocateUniqueCloneName(repos, workspaceId, src.name);
      const slug = await uniqueTemplateSlug(repos, workspaceId, name);
      const draftLayout = src.draftLayout != null ? regenerateLayoutIds(deepCloneJson(src.draftLayout)) : null;
      const activeLayout =
        src.activeLayout != null ? regenerateLayoutIds(deepCloneJson(src.activeLayout)) : null;
      const i18n = deepCloneJson(src.i18n) as I18nStrings;

      const created = await repos.template.create({
        workspaceId,
        name,
        slug,
        description: src.description,
        authorId: ctx.actorId,
        status: "DRAFT",
        draftLayout,
        activeLayout,
        i18n,
      });

      for (const b of src.bindings) {
        await repos.template.createBinding(created.id, b.channelId);
      }

      const translationRows = await repos.templateTranslation.listAllForTemplate(src.id);
      if (translationRows.length > 0) {
        await repos.templateTranslation.upsertMany(
          created.id,
          translationRows.map((r) => ({ locale: r.locale, key: r.key, value: r.value })),
        );
      }

      for (const phase of LAYOUT_PHASES) {
        const secs = await repos.templateLayoutSection.listForTemplatePhase(src.id, phase);
        for (const s of secs) {
          await repos.templateLayoutSection.create({
            templateId: created.id,
            phase,
            sortOrder: s.sortOrder,
            componentVersionId: s.componentVersionId,
            props: deepCloneJson(s.props),
          });
        }
      }

      const withBindings = await repos.template.getByIdWithBindings(created.id);
      if (!withBindings) throw new Error("Clone failed: template missing after create");

      await repos.audit.append({
        action: "TEMPLATE_CLONED",
        resource: "TEMPLATE",
        resourceId: created.id,
        newValue: {
          sourceTemplateId: sourceId,
          targetTemplateId: created.id,
          name,
          slug,
          workspaceId,
        },
        actorId: ctx.actorId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });

      return { ok: true, template: withBindings } as const;
    });
  },

  async saveDraftLayout(
    ctx: AuditContext,
    id: string,
    layout: unknown,
  ): Promise<{ ok: true; template: Template } | { notFound: true } | { invalid: true; message: string }> {
    const parsed = parseAndValidateLayoutConfig(layout);
    if (!parsed) {
      return { invalid: true, message: "Invalid layout config schema" } as const;
    }
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    return uow.withTransaction(async (repos) => {
      const current = await repos.template.getById(id);
      if (!current) return { notFound: true } as const;
      const template = await repos.template.update(id, { draftLayout: parsed });
      await repos.audit.append({
        action: "UPDATE",
        resource: "TEMPLATE",
        resourceId: id,
        newValue: { draftLayoutSaved: true },
        actorId: ctx.actorId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
      return { ok: true, template } as const;
    });
  },

  async patchI18n(
    ctx: AuditContext,
    id: string,
    rawPatch: unknown,
  ): Promise<{ ok: true; template: Template } | { notFound: true } | { invalid: true; message: string }> {
    let patch: I18nStrings;
    try {
      patch = parseI18nPatch(rawPatch);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { invalid: true, message } as const;
    }
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    return uow.withTransaction(async (repos) => {
      const current = await repos.template.getById(id);
      if (!current) return { notFound: true } as const;
      const merged = mergeI18n(current.i18n, patch);
      const template = await repos.template.update(id, { i18n: merged });
      const rows = flattenI18nForRows(patch);
      if (rows.length > 0) {
        await repos.templateTranslation.upsertMany(id, rows);
      }
      await repos.audit.append({
        action: "UPDATE",
        resource: "TEMPLATE",
        resourceId: id,
        newValue: { i18nLocales: Object.keys(patch) },
        actorId: ctx.actorId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
      return { ok: true, template } as const;
    });
  },

  async activate(
    ctx: AuditContext,
    id: string,
  ): Promise<
    | { ok: true; template: Template }
    | { notFound: true }
    | { invalid: true; message: string }
  > {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    return uow.withTransaction(async (repos) => {
      const current = await repos.template.getByIdWithBindings(id);
      if (!current) return { notFound: true } as const;
      if (current.draftLayout == null) {
        return { invalid: true, message: "Cannot activate without a draft layout" } as const;
      }
      const layout = parseAndValidateLayoutConfig(current.draftLayout);
      if (!layout) {
        return { invalid: true, message: "Draft layout failed schema validation" } as const;
      }
      if (flattenRegions(layout).length < 1) {
        return { invalid: true, message: "Layout must declare at least one region" } as const;
      }
      if (current.bindings.length < 1) {
        return {
          invalid: true,
          message: "Activate requires at least one channel binding",
        } as const;
      }

      for (const b of current.bindings) {
        const ch = await repos.channel.getById(b.channelId);
        if (!ch) {
          return {
            invalid: true,
            message: `Binding references missing channel ${b.channelId}`,
          } as const;
        }
      }

      const activeLayout = deepCloneJson(layout);
      const template = await repos.template.update(id, {
        status: "ACTIVE",
        activeLayout,
      });

      await repos.audit.append({
        action: "UPDATE",
        resource: "TEMPLATE",
        resourceId: id,
        newValue: { status: "ACTIVE", activated: true },
        actorId: ctx.actorId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });

      return { ok: true, template } as const;
    });
  },

  async addBinding(
    ctx: AuditContext,
    templateId: string,
    channelId: string,
  ): Promise<
    | { ok: true; binding: TemplateBinding }
    | { notFound: true }
    | { conflict: true }
    | { invalid: true; message: string }
  > {
    if (!channelId?.trim()) {
      return { invalid: true, message: "channelId is required" } as const;
    }
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    return uow.withTransaction(async (repos) => {
      const template = await repos.template.getById(templateId);
      if (!template) return { notFound: true } as const;
      const channel = await repos.channel.getById(channelId);
      if (!channel) return { notFound: true } as const;

      const existing = await repos.template.listBindings(templateId);
      if (existing.some((b) => b.channelId === channelId)) {
        return { conflict: true } as const;
      }

      try {
        const binding = await repos.template.createBinding(templateId, channelId);
        await repos.audit.append({
          action: "CREATE",
          resource: "TEMPLATE_BINDING",
          resourceId: binding.id,
          newValue: { templateId, channelId },
          actorId: ctx.actorId,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        });
        return { ok: true, binding } as const;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("Unique constraint") || msg.includes("unique constraint")) {
          return { conflict: true } as const;
        }
        throw e;
      }
    });
  },

  async removeBinding(
    ctx: AuditContext,
    templateId: string,
    bindingId: string,
  ): Promise<{ ok: true } | { notFound: true }> {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    return uow.withTransaction(async (repos) => {
      const b = await repos.template.getBinding(templateId, bindingId);
      if (!b) return { notFound: true } as const;
      await repos.template.deleteBinding(templateId, bindingId);
      await repos.audit.append({
        action: "DELETE",
        resource: "TEMPLATE_BINDING",
        resourceId: bindingId,
        oldValue: { templateId, channelId: b.channelId },
        actorId: ctx.actorId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
      return { ok: true } as const;
    });
  },
};
