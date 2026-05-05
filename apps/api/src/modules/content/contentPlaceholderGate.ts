import { getPrismaClient } from "../../repository";
import type { Content, TipTapDocument } from "../../repository/types";
import { collectPlaceholderKeysFromBlocks } from "../whatsapp-send/whatsappSend.service";

export async function templateHasChannelBindings(templateId: string): Promise<boolean> {
  const prisma = getPrismaClient();
  const n = await prisma.templateChannelBinding.count({ where: { templateId } });
  return n > 0;
}

/**
 * Content created from a template that has no channel bindings (“unrestricted / unbounded” layout).
 * For these, merge tokens cannot be filled at send time via a channel CSV row — they must exist in the saved body.
 */
export async function contentUsesUnboundLayoutTemplate(content: Content): Promise<boolean> {
  if (!content.templateId) return false;
  return !(await templateHasChannelBindings(content.templateId));
}

export function listUnresolvedPlaceholderKeysFromTipTapBody(body: unknown): string[] {
  if (!body || typeof body !== "object") return [];
  const doc = body as { type?: string };
  if (doc.type !== "doc") return [];
  const blocks = [
    {
      id: "__body__",
      type: "richText" as const,
      props: { doc: body as TipTapDocument },
    },
  ];
  return [...collectPlaceholderKeysFromBlocks(blocks as never).requiredRowKeys];
}

export async function assertNoUnresolvedPlaceholdersForUnboundTemplate(
  _content: Content,
  body: unknown,
): Promise<{ ok: true } | { unfilled: true; keys: string[] }> {
  const keys = listUnresolvedPlaceholderKeysFromTipTapBody(body);
  if (keys.length === 0) return { ok: true };
  return { unfilled: true, keys };
}
