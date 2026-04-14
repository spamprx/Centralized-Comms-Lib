import { getPrismaClient, PrismaUnitOfWork } from "../../repository";
import type { ComponentVersionRecord, TipTapDocument } from "../../repository/types";
import type { AuditContext } from "../../shared/context";
import { contentService } from "../content/content.service";
import {
  collectLinkedComponentVersionIds,
  isTipTapDoc,
  refreshLinkedNodesInDocument,
} from "./libraryComponent";

function docsEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export type PropagateLinkedComponentResult =
  | {
      componentVersionId: string;
      updatedContentIds: string[];
      skippedUnchanged: number;
      skippedFormatting: Array<{ contentId: string; reason: string }>;
    }
  | { notFound: true };

/**
 * Refreshes linked `commsLibraryComponent` nodes from the registry for every content item whose
 * **latest** version body references `componentVersionId` in linked mode. Detached nodes are never modified.
 */
export async function propagateLinkedComponentToContent(
  ctx: AuditContext,
  componentVersionId: string,
): Promise<PropagateLinkedComponentResult> {
  const prisma = getPrismaClient();
  const uow = new PrismaUnitOfWork(prisma);
  const repos = uow.repos();

  const ver = await repos.componentRegistry.getVersionById(componentVersionId);
  if (!ver) {
    return { notFound: true };
  }

  const canonical: TipTapDocument | null =
    ver.bodyJson != null && isTipTapDoc(ver.bodyJson) ? (ver.bodyJson as TipTapDocument) : null;
  const canonicalMap = new Map<string, TipTapDocument | null>([[componentVersionId, canonical]]);

  const candidates = await repos.content.listLatestContentVersionsMaybeReferencingComponentVersion(
    componentVersionId,
  );

  const updatedContentIds: string[] = [];
  let skippedUnchanged = 0;
  const skippedFormatting: Array<{ contentId: string; reason: string }> = [];

  for (const row of candidates) {
    if (!row.body) continue;
    const linkedIds = collectLinkedComponentVersionIds(row.body);
    if (!linkedIds.includes(componentVersionId)) continue;

    const refreshed = refreshLinkedNodesInDocument(row.body, canonicalMap);
    if (docsEqual(row.body, refreshed)) {
      skippedUnchanged += 1;
      continue;
    }

    const result = await contentService.savePropagatedBody(ctx, row.contentId, refreshed);
    if ("invalidFormatting" in result) {
      skippedFormatting.push({
        contentId: row.contentId,
        reason: `formatting violations (${result.violations.length})`,
      });
      continue;
    }
    if ("notFound" in result || "invalidState" in result) {
      skippedFormatting.push({
        contentId: row.contentId,
        reason: "notFound" in result ? "content missing" : `state ${result.state}`,
      });
      continue;
    }
    updatedContentIds.push(row.contentId);
  }

  return {
    componentVersionId,
    updatedContentIds,
    skippedUnchanged,
    skippedFormatting,
  };
}

/**
 * Optionally updates canonical `bodyJson`, then optionally pushes that body into all linked usages.
 */
export async function patchComponentVersionCanonicalBody(
  ctx: AuditContext,
  versionId: string,
  bodyJson: unknown | null | undefined,
  options: { propagate: boolean },
): Promise<
  | { record: ComponentVersionRecord; propagation?: PropagateLinkedComponentResult }
  | { notFound: true }
> {
  const prisma = getPrismaClient();
  const repos = new PrismaUnitOfWork(prisma).repos();
  const existing = await repos.componentRegistry.getVersionById(versionId);
  if (!existing) {
    return { notFound: true };
  }
  let record = existing;
  if (bodyJson !== undefined) {
    record = await repos.componentRegistry.updateVersionBodyJson(versionId, bodyJson);
  }
  if (!options.propagate) {
    return { record };
  }
  const propagation = await propagateLinkedComponentToContent(ctx, versionId);
  return { record, propagation };
}
