import { AssetLinkStatus } from "@prisma/client";

import { getPrismaClient } from "../../repository";
import { publishEventStandalone } from "../../integration";

function normalizeUrls(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out = new Set<string>();
  for (const row of input) {
    if (typeof row !== "string") continue;
    const trimmed = row.trim();
    if (!trimmed) continue;
    try {
      const u = new URL(trimmed);
      if (u.protocol === "http:" || u.protocol === "https:") out.add(u.toString());
    } catch {
      continue;
    }
  }
  return [...out];
}

async function probeUrl(url: string): Promise<{
  status: AssetLinkStatus;
  httpStatusCode: number | null;
  errorMessage: string | null;
}> {
  try {
    const head = await fetch(url, { method: "HEAD", redirect: "follow" });
    if (head.ok) {
      return { status: AssetLinkStatus.VALID, httpStatusCode: head.status, errorMessage: null };
    }
    const get = await fetch(url, { method: "GET", redirect: "follow" });
    return {
      status: get.ok ? AssetLinkStatus.VALID : AssetLinkStatus.BROKEN,
      httpStatusCode: get.status,
      errorMessage: get.ok ? null : `HTTP ${get.status}`,
    };
  } catch (err) {
    return {
      status: AssetLinkStatus.BROKEN,
      httpStatusCode: null,
      errorMessage: err instanceof Error ? err.message : "Network error",
    };
  }
}

export const linkIntegrityService = {
  normalizeUrls,

  async attachLinks(assetId: string, urls: unknown): Promise<{ added: number }> {
    const prisma = getPrismaClient();
    const validUrls = normalizeUrls(urls);
    let added = 0;
    for (const url of validUrls) {
      await prisma.assetLinkCheck.upsert({
        where: { assetId_url: { assetId, url } },
        update: {},
        create: { assetId, url, status: AssetLinkStatus.PENDING },
      });
      added += 1;
    }
    return { added };
  },

  async listForAsset(assetId: string) {
    return getPrismaClient().assetLinkCheck.findMany({
      where: { assetId },
      orderBy: [{ updatedAt: "desc" }],
    });
  },

  async scanPending(limit: number): Promise<{ scanned: number; broken: number }> {
    const prisma = getPrismaClient();
    const rows = await prisma.assetLinkCheck.findMany({
      where: {
        OR: [{ status: AssetLinkStatus.PENDING }, { status: AssetLinkStatus.BROKEN }],
      },
      orderBy: [{ updatedAt: "asc" }],
      take: limit,
    });
    let scanned = 0;
    let broken = 0;
    for (const row of rows) {
      const result = await probeUrl(row.url);
      await prisma.assetLinkCheck.update({
        where: { id: row.id },
        data: {
          status: result.status,
          httpStatusCode: result.httpStatusCode,
          errorMessage: result.errorMessage,
          checkedAt: new Date(),
        },
      });
      scanned += 1;
      if (result.status === AssetLinkStatus.BROKEN) {
        broken += 1;
        await publishEventStandalone({
          aggregateType: "ASSET",
          aggregateId: row.assetId,
          eventType: "ASSET.LINK_BROKEN",
          payload: {
            assetId: row.assetId,
            linkCheckId: row.id,
            url: row.url,
            errorMessage: result.errorMessage,
            httpStatusCode: result.httpStatusCode,
          },
        });
      }
    }
    return { scanned, broken };
  },
};
