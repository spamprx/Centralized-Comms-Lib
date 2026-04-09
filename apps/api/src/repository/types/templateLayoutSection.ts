export type LayoutPhase = "DRAFT" | "ACTIVE";

export interface TemplateLayoutSectionRecord {
  id: string;
  templateId: string;
  phase: LayoutPhase;
  sortOrder: number;
  componentVersionId: string | null;
  props: unknown;
}
