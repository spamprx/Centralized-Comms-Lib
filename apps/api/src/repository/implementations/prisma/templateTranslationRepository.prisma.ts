import type { TemplateTranslationRepository } from "../../interfaces/templateTranslationRepository";
import type { TemplateTranslationRow } from "../../types";
import type { PrismaDb } from "./prismaTypes";

function toRow(r: {
  id: string;
  templateId: string;
  locale: string;
  key: string;
  value: string;
  createdAt: Date;
  updatedAt: Date;
}): TemplateTranslationRow {
  return {
    id: r.id,
    templateId: r.templateId,
    locale: r.locale,
    key: r.key,
    value: r.value,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export class PrismaTemplateTranslationRepository implements TemplateTranslationRepository {
  public constructor(private readonly db: PrismaDb) {}

  async upsertMany(
    templateId: string,
    entries: Array<{ locale: string; key: string; value: string }>,
  ): Promise<void> {
    for (const e of entries) {
      await this.db.templateTranslation.upsert({
        where: {
          templateId_locale_key: {
            templateId,
            locale: e.locale,
            key: e.key,
          },
        },
        create: {
          templateId,
          locale: e.locale,
          key: e.key,
          value: e.value,
        },
        update: { value: e.value },
      });
    }
  }

  async listByTemplateAndLocale(templateId: string, locale: string): Promise<TemplateTranslationRow[]> {
    const rows = await this.db.templateTranslation.findMany({
      where: { templateId, locale },
      orderBy: { key: "asc" },
    });
    return rows.map(toRow);
  }

  async listLocalesForTemplate(templateId: string): Promise<string[]> {
    const rows = await this.db.templateTranslation.findMany({
      where: { templateId },
      distinct: ["locale"],
      select: { locale: true },
    });
    return rows.map((r: { locale: string }) => r.locale);
  }

  async deleteKey(templateId: string, locale: string, key: string): Promise<boolean> {
    const r = await this.db.templateTranslation.deleteMany({
      where: { templateId, locale, key },
    });
    return r.count > 0;
  }

  async listAllForTemplate(templateId: string): Promise<TemplateTranslationRow[]> {
    const rows = await this.db.templateTranslation.findMany({
      where: { templateId },
      orderBy: [{ locale: "asc" }, { key: "asc" }],
    });
    return rows.map(toRow);
  }

  async deleteAllForTemplate(templateId: string): Promise<void> {
    await this.db.templateTranslation.deleteMany({ where: { templateId } });
  }
}
