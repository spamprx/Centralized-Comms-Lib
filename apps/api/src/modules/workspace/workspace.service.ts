import { getPrismaClient } from "../../repository";

const DEFAULT_SLUG = process.env.DEFAULT_WORKSPACE_SLUG?.trim() || "default";

let cachedDefaultWorkspaceId: string | null = null;

export const workspaceService = {
  /** Workspace boundary for quotas when a template is attached; otherwise the default workspace. */
  async resolveWorkspaceIdForTemplate(
    templateId: string | null | undefined,
  ): Promise<string> {
    const tid = templateId?.trim();
    if (!tid) {
      return workspaceService.resolveDefaultWorkspaceId();
    }
    const prisma = getPrismaClient();
    const row = await prisma.template.findUnique({
      where: { id: tid },
      select: { workspaceId: true },
    });
    if (!row?.workspaceId) {
      return workspaceService.resolveDefaultWorkspaceId();
    }
    return row.workspaceId;
  },

  /** Resolves the default workspace used for template isolation until multi-workspace APIs exist. */
  async resolveDefaultWorkspaceId(): Promise<string> {
    if (cachedDefaultWorkspaceId) return cachedDefaultWorkspaceId;
    const prisma = getPrismaClient();
    const row = await prisma.workspace.findUnique({
      where: { slug: DEFAULT_SLUG },
    });
    if (!row?.id) {
      throw new Error(
        `Workspace "${DEFAULT_SLUG}" not found. Run database seed (seedWorkspace).`,
      );
    }
    cachedDefaultWorkspaceId = row.id;
    return row.id;
  },

  clearDefaultWorkspaceCache(): void {
    cachedDefaultWorkspaceId = null;
  },
};
