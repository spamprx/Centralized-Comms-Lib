import { getPrismaClient } from "../../repository";

const DEFAULT_SLUG = process.env.DEFAULT_WORKSPACE_SLUG?.trim() || "default";

let cachedDefaultWorkspaceId: string | null = null;

export const workspaceService = {
  /** Resolves the default workspace used for template isolation until multi-workspace APIs exist. */
  async resolveDefaultWorkspaceId(): Promise<string> {
    if (cachedDefaultWorkspaceId) return cachedDefaultWorkspaceId;
    const prisma = getPrismaClient();
    const row = await prisma.workspace.findUnique({ where: { slug: DEFAULT_SLUG } });
    if (!row?.id) {
      throw new Error(`Workspace "${DEFAULT_SLUG}" not found. Run database seed (seedWorkspace).`);
    }
    cachedDefaultWorkspaceId = row.id;
    return row.id;
  },

  clearDefaultWorkspaceCache(): void {
    cachedDefaultWorkspaceId = null;
  },
};
