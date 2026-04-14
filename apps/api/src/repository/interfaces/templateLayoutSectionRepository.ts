import type { LayoutPhase, TemplateLayoutSectionRecord } from "../types";

export interface CreateTemplateLayoutSectionInput {
  templateId: string;
  phase: LayoutPhase;
  sortOrder: number;
  componentVersionId?: string | null;
  props?: unknown;
}

export interface TemplateLayoutSectionRepository {
  create(
    input: CreateTemplateLayoutSectionInput,
  ): Promise<TemplateLayoutSectionRecord>;
  listForTemplatePhase(
    templateId: string,
    phase: LayoutPhase,
  ): Promise<TemplateLayoutSectionRecord[]>;
  update(
    id: string,
    input: Partial<
      Pick<
        TemplateLayoutSectionRecord,
        "sortOrder" | "componentVersionId" | "props"
      >
    >,
  ): Promise<TemplateLayoutSectionRecord>;
  delete(id: string): Promise<void>;
  deleteAllForTemplate(templateId: string): Promise<void>;
}
