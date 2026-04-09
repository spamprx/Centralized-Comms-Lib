import type { Template, TemplateBinding, TemplateStatus, TemplateWithBindings } from "../types";

export interface CreateTemplateInput {
  workspaceId: string;
  name: string;
  slug: string;
  description?: string | null;
  authorId: string;
  draftLayout?: unknown | null;
  activeLayout?: unknown | null;
  status?: TemplateStatus;
  i18n?: Record<string, Record<string, string>>;
}

export interface UpdateTemplateInput {
  name?: string;
  slug?: string;
  description?: string | null;
  status?: TemplateStatus;
  draftLayout?: unknown | null;
  activeLayout?: unknown | null;
  i18n?: Record<string, Record<string, string>>;
}

export interface TemplateRepository {
  create(input: CreateTemplateInput): Promise<Template>;
  getById(id: string): Promise<Template | null>;
  getByIdWithBindings(id: string): Promise<TemplateWithBindings | null>;
  getByWorkspaceAndSlug(workspaceId: string, slug: string): Promise<Template | null>;
  findByWorkspaceAndName(workspaceId: string, name: string): Promise<Template | null>;
  list(workspaceId?: string): Promise<Template[]>;
  update(id: string, input: UpdateTemplateInput): Promise<Template>;
  delete(id: string): Promise<void>;
  countContentsUsingTemplate(templateId: string): Promise<number>;
  createBinding(templateId: string, channelId: string): Promise<TemplateBinding>;
  deleteBinding(templateId: string, bindingId: string): Promise<boolean>;
  getBinding(templateId: string, bindingId: string): Promise<TemplateBinding | null>;
  listBindings(templateId: string): Promise<TemplateBinding[]>;
}
