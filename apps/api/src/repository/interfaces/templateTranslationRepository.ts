import type { TemplateTranslationRow } from "../types";

export interface TemplateTranslationRepository {
  upsertMany(
    templateId: string,
    entries: Array<{ locale: string; key: string; value: string }>,
  ): Promise<void>;
  listByTemplateAndLocale(
    templateId: string,
    locale: string,
  ): Promise<TemplateTranslationRow[]>;
  listLocalesForTemplate(templateId: string): Promise<string[]>;
  deleteKey(templateId: string, locale: string, key: string): Promise<boolean>;
  listAllForTemplate(templateId: string): Promise<TemplateTranslationRow[]>;
  deleteAllForTemplate(templateId: string): Promise<void>;
}
