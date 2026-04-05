export type TemplateStatus = "DRAFT" | "ACTIVE";

export interface TemplateBinding {
  id: string;
  templateId: string;
  channelId: string;
  createdAt: Date;
}

export interface Template {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: TemplateStatus;
  draftLayout: unknown | null;
  activeLayout: unknown | null;
  i18n: Record<string, Record<string, string>>;
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateWithBindings extends Template {
  bindings: TemplateBinding[];
}
