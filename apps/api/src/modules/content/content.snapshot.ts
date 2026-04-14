import type { Repositories } from "../../repository";
import type { AuditContext } from "../../shared/context";

export async function recordSnapshotForVersion(
  repos: Repositories,
  ctx: AuditContext,
  contentId: string,
  toVersionNumber: number,
  kind: "MANUAL_SAVE" | "STATE_TRANSITION",
  extra?: Record<string, unknown>,
): Promise<void> {
  const fromVersionNumber = toVersionNumber > 1 ? toVersionNumber - 1 : null;
  await repos.contentSnapshot.create({
    contentId,
    fromVersionNumber,
    toVersionNumber,
    diffMetadata: { kind, at: new Date().toISOString(), ...extra },
    createdById: ctx.actorId,
  });
}
