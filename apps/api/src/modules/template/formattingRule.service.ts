import { getPrismaClient, PrismaUnitOfWork } from "../../repository";
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
    ctx: AuditContext,
    templateId: string,
    rules: unknown,
  ): Promise<{ ok: true } | { notFound: true } | { invalid: true; message: string }> {
    if (!isPlainObject(rules)) {
      return { invalid: true, message: "rules must be a JSON object" };
    }
    const prisma = getPrismaClient();
    const tpl = await prisma.template.findUnique({ where: { id: templateId }, select: { id: true } });
    if (!tpl) return { notFound: true };

    const existing = await prisma.templateFormattingRule.findUnique({ where: { templateId } });
    await prisma.templateFormattingRule.upsert({
      where: { templateId },
      create: { templateId, rules: rules as object },
      update: { rules: rules as object },
    });
    const repos = new PrismaUnitOfWork(prisma).repos();
    await repos.audit.append({
      action: existing ? "UPDATE" : "CREATE",
      resource: "TEMPLATE_FORMATTING_RULE",
      resourceId: templateId,
      oldValue: existing ? existing.rules : undefined,
      newValue: rules,
      actorId: ctx.actorId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    return { ok: true };
  },

  async delete(
    ctx: AuditContext,
    templateId: string,
  ): Promise<{ ok: true } | { notFound: true }> {
    const prisma = getPrismaClient();
    const existing = await prisma.templateFormattingRule.findUnique({ where: { templateId } });
    if (!existing) return { notFound: true };
    await prisma.templateFormattingRule.delete({ where: { templateId } });
    const repos = new PrismaUnitOfWork(prisma).repos();
    await repos.audit.append({
      action: "DELETE",
      resource: "TEMPLATE_FORMATTING_RULE",
      resourceId: templateId,
      oldValue: existing.rules,
      actorId: ctx.actorId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    return { ok: true };
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
