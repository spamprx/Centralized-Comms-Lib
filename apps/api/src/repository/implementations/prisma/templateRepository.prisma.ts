import type {
  CreateTemplateInput,
  TemplateRepository,
  UpdateTemplateInput,
} from "../../interfaces/templateRepository";
import type {
  Template,
  TemplateBinding,
  TemplateStatus,
  TemplateWithBindings,
} from "../../types";
import { normalizeI18nFromDb } from "../../templateI18n";
import type { PrismaDb } from "./prismaTypes";

function toBinding(row: {
  id: string;
  templateId: string;
  channelId: string;
  createdAt: Date;
}): TemplateBinding {
  return {
    id: row.id,
    templateId: row.templateId,
    channelId: row.channelId,
    createdAt: row.createdAt,
  };
}

function toTemplate(row: {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  draftLayout: unknown;
  activeLayout: unknown;
  i18n: unknown;
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
}): Template {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    slug: row.slug,
    description: row.description,
    status: row.status as TemplateStatus,
    draftLayout: row.draftLayout ?? null,
    activeLayout: row.activeLayout ?? null,
    i18n: normalizeI18nFromDb(row.i18n),
    authorId: row.authorId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PrismaTemplateRepository implements TemplateRepository {
  public constructor(private readonly db: PrismaDb) {}

  async create(input: CreateTemplateInput): Promise<Template> {
    const row = await this.db.template.create({
      data: {
        workspaceId: input.workspaceId,
        name: input.name,
        slug: input.slug,
        description: input.description ?? null,
        authorId: input.authorId,
        status: input.status ?? "DRAFT",
        draftLayout: input.draftLayout ?? undefined,
        activeLayout: input.activeLayout ?? undefined,
        i18n: (input.i18n ?? {}) as object,
      },
    });
    return toTemplate(row);
  }

  async getById(id: string): Promise<Template | null> {
    const row = await this.db.template.findUnique({ where: { id } });
    return row ? toTemplate(row) : null;
  }

  async getByIdWithBindings(id: string): Promise<TemplateWithBindings | null> {
    const row = await this.db.template.findUnique({
      where: { id },
      include: { bindings: true },
    });
    if (!row) return null;
    return {
      ...toTemplate(row),
      bindings: row.bindings.map(toBinding),
    };
  }

  async getByWorkspaceAndSlug(
    workspaceId: string,
    slug: string,
  ): Promise<Template | null> {
    const row = await this.db.template.findUnique({
      where: { workspaceId_slug: { workspaceId, slug } },
    });
    return row ? toTemplate(row) : null;
  }

  async findByWorkspaceAndName(
    workspaceId: string,
    name: string,
  ): Promise<Template | null> {
    const row = await this.db.template.findUnique({
      where: { workspaceId_name: { workspaceId, name } },
    });
    return row ? toTemplate(row) : null;
  }

  async list(workspaceId?: string): Promise<Template[]> {
    const rows = await this.db.template.findMany({
      where: workspaceId ? { workspaceId } : undefined,
      orderBy: { updatedAt: "desc" },
    });
    return rows.map(toTemplate);
  }

  async update(id: string, input: UpdateTemplateInput): Promise<Template> {
    const row = await this.db.template.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.slug !== undefined && { slug: input.slug }),
        ...(input.description !== undefined && {
          description: input.description,
        }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.draftLayout !== undefined && {
          draftLayout: input.draftLayout ?? undefined,
        }),
        ...(input.activeLayout !== undefined && {
          activeLayout: input.activeLayout ?? undefined,
        }),
        ...(input.i18n !== undefined && { i18n: input.i18n as object }),
      },
    });
    return toTemplate(row);
  }

  async delete(id: string): Promise<void> {
    await this.db.template.delete({ where: { id } });
  }

  async countContentsUsingTemplate(templateId: string): Promise<number> {
    return this.db.content.count({ where: { templateId } });
  }

  async createBinding(
    templateId: string,
    channelId: string,
  ): Promise<TemplateBinding> {
    const row = await this.db.templateChannelBinding.create({
      data: { templateId, channelId },
    });
    return toBinding(row);
  }

  async deleteBinding(templateId: string, bindingId: string): Promise<boolean> {
    const res = await this.db.templateChannelBinding.deleteMany({
      where: { id: bindingId, templateId },
    });
    return res.count > 0;
  }

  async getBinding(
    templateId: string,
    bindingId: string,
  ): Promise<TemplateBinding | null> {
    const row = await this.db.templateChannelBinding.findFirst({
      where: { id: bindingId, templateId },
    });
    return row ? toBinding(row) : null;
  }

  async listBindings(templateId: string): Promise<TemplateBinding[]> {
    const rows = await this.db.templateChannelBinding.findMany({
      where: { templateId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toBinding);
  }
}
