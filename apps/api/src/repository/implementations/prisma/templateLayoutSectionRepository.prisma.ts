import type {
  CreateTemplateLayoutSectionInput,
  TemplateLayoutSectionRepository,
} from "../../interfaces/templateLayoutSectionRepository";
import type { LayoutPhase, TemplateLayoutSectionRecord } from "../../types";
import type { PrismaDb } from "./prismaTypes";

function toRecord(row: {
  id: string;
  templateId: string;
  phase: string;
  sortOrder: number;
  componentVersionId: string | null;
  props: unknown;
}): TemplateLayoutSectionRecord {
  return {
    id: row.id,
    templateId: row.templateId,
    phase: row.phase as LayoutPhase,
    sortOrder: row.sortOrder,
    componentVersionId: row.componentVersionId,
    props: row.props,
  };
}

export class PrismaTemplateLayoutSectionRepository implements TemplateLayoutSectionRepository {
  public constructor(private readonly db: PrismaDb) {}

  async create(
    input: CreateTemplateLayoutSectionInput,
  ): Promise<TemplateLayoutSectionRecord> {
    const row = await this.db.templateLayoutSection.create({
      data: {
        templateId: input.templateId,
        phase: input.phase,
        sortOrder: input.sortOrder,
        componentVersionId: input.componentVersionId ?? null,
        props: (input.props ?? {}) as object,
      },
    });
    return toRecord(row);
  }

  async listForTemplatePhase(
    templateId: string,
    phase: LayoutPhase,
  ): Promise<TemplateLayoutSectionRecord[]> {
    const rows = await this.db.templateLayoutSection.findMany({
      where: { templateId, phase },
      orderBy: { sortOrder: "asc" },
    });
    return rows.map(toRecord);
  }

  async update(
    id: string,
    input: Partial<
      Pick<
        TemplateLayoutSectionRecord,
        "sortOrder" | "componentVersionId" | "props"
      >
    >,
  ): Promise<TemplateLayoutSectionRecord> {
    const row = await this.db.templateLayoutSection.update({
      where: { id },
      data: {
        ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
        ...(input.componentVersionId !== undefined && {
          componentVersionId: input.componentVersionId,
        }),
        ...(input.props !== undefined && { props: input.props as object }),
      },
    });
    return toRecord(row);
  }

  async delete(id: string): Promise<void> {
    await this.db.templateLayoutSection.delete({ where: { id } });
  }

  async deleteAllForTemplate(templateId: string): Promise<void> {
    await this.db.templateLayoutSection.deleteMany({ where: { templateId } });
  }
}
