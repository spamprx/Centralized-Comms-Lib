import { getPrismaClient } from "../../repository";
import type { AuditContext } from "../../shared/context";
import type { TemplateFormattingRules } from "./formattingRules.types";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

export const formattingRuleService = {
  async getForTemplate(templateId: string): Promise<{ id: string; rules: TemplateFormattingRules } | null> {
    const row = await getPrismaClient().templateFormattingRule.findUnique({
      where: { templateId },
    });
    if (!row) return null;
    return {
      id: row.id,
      rules: (isPlainObject(row.rules) ? row.rules : {}) as TemplateFormattingRules,
    };
  },

  async upsert(
    _ctx: AuditContext,
    templateId: string,
    rules: unknown,
  ): Promise<{ ok: true } | { notFound: true } | { invalid: true; message: string }> {
    if (!isPlainObject(rules)) {
      return { invalid: true, message: "rules must be a JSON object" };
    }
    const prisma = getPrismaClient();
    const tpl = await prisma.template.findUnique({ where: { id: templateId }, select: { id: true } });
    if (!tpl) return { notFound: true };

    await prisma.templateFormattingRule.upsert({
      where: { templateId },
      create: { templateId, rules: rules as object },
      update: { rules: rules as object },
    });
    return { ok: true };
  },

  async delete(
    _ctx: AuditContext,
    templateId: string,
  ): Promise<{ ok: true } | { notFound: true }> {
    const prisma = getPrismaClient();
    try {
      await prisma.templateFormattingRule.delete({ where: { templateId } });
      return { ok: true };
    } catch {
      return { notFound: true };
    }
  },
};

export async function getFormattingRulesForTemplateId(
  templateId: string | null | undefined,
): Promise<TemplateFormattingRules | null> {
  if (!templateId) return null;
  const row = await getPrismaClient().templateFormattingRule.findUnique({
    where: { templateId },
    select: { rules: true },
  });
  if (!row?.rules || !isPlainObject(row.rules)) return null;
  return row.rules as TemplateFormattingRules;
}
