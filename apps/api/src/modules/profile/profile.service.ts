import { getPrismaClient, PrismaUnitOfWork } from "../../repository";

type ActivityType = "PUBLISHED" | "COMMENTED" | "CREATED";

export type ProfileActivityItem = {
  id: string;
  type: ActivityType;
  contentId: string;
  contentTitle: string;
  timestamp: Date;
};

export const profileService = {
  /**
   * Records a lightweight “still here” ping for admin presence / “Active now”.
   * No-op for deactivated accounts.
   */
  async recordPresencePing(
    userId: string,
  ): Promise<{ presencePingAt: Date } | null> {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    const at = await uow.repos().userRole.touchPresencePingAt(userId);
    if (!at) return null;
    return { presencePingAt: at };
  },

  async clearPresencePing(userId: string): Promise<void> {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    await uow.repos().userRole.clearPresencePingAt(userId);
  },

  async getMe(userId: string): Promise<{
    id: string;
    displayName: string;
    email: string;
    role: string;
    avatarUrl: string | null;
    location: string | null;
    bio: string | null;
    stats: {
      contentCreated: number;
      totalViews: number;
      following: number;
    };
  } | null> {
    const prisma = getPrismaClient();
    const [user, roles, contentCreated, totalViews, following] =
      await Promise.all([
        prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, displayName: true, email: true, avatarUrl: true },
        }),
        prisma.userRole.findMany({
          where: { userId },
          include: { role: { select: { name: true } } },
        }),
        prisma.content.count({ where: { authorId: userId } }),
        prisma.contentView.count({
          where: {
            content: { authorId: userId },
          },
        }),
        prisma.contentBookmark.count({ where: { userId } }),
      ]);
    if (!user) return null;
    const role = roles.some(
      (r: { role: { name: string } }) => r.role.name.toUpperCase() === "ADMIN",
    )
      ? "System Admin"
      : "Content Manager";
    return {
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      role,
      avatarUrl: user.avatarUrl,
      location: null,
      bio: null,
      stats: {
        contentCreated,
        totalViews,
        following,
      },
    };
  },

  async updateMe(
    userId: string,
    input: { displayName?: string; email?: string },
  ): Promise<{ id: string; displayName: string; email: string } | null> {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    return uow.withTransaction(async (repos) => {
      const existing = await repos.userRole.getUserById(userId);
      if (!existing) return null;
      const updated = await repos.userRole.updateUser(userId, {
        displayName:
          typeof input.displayName === "string"
            ? input.displayName.trim()
            : undefined,
        email:
          typeof input.email === "string"
            ? input.email.trim().toLowerCase()
            : undefined,
      });
      await repos.audit.append({
        action: "UPDATE",
        resource: "USER",
        resourceId: userId,
        actorId: userId,
        oldValue: {
          displayName: existing.displayName,
          email: existing.email,
        },
        newValue: {
          displayName: updated.displayName,
          email: updated.email,
        },
      });
      return {
        id: updated.id,
        displayName: updated.displayName,
        email: updated.email,
      };
    });
  },

  async listActivity(
    userId: string,
    limit = 12,
  ): Promise<ProfileActivityItem[]> {
    const prisma = getPrismaClient();
    const [published, commented, created] = await Promise.all([
      prisma.content.findMany({
        where: { authorId: userId, lifecycleState: "PUBLISHED" },
        orderBy: { updatedAt: "desc" },
        take: limit,
        select: { id: true, title: true, updatedAt: true },
      }),
      prisma.contentComment.findMany({
        where: { authorId: userId },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
          id: true,
          createdAt: true,
          content: { select: { id: true, title: true } },
        },
      }),
      prisma.content.findMany({
        where: { authorId: userId },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: { id: true, title: true, createdAt: true },
      }),
    ]);

    const rows: ProfileActivityItem[] = [
      ...published.map((p: { id: string; title: string; updatedAt: Date }) => ({
        id: `published-${p.id}-${p.updatedAt.toISOString()}`,
        type: "PUBLISHED" as const,
        contentId: p.id,
        contentTitle: p.title,
        timestamp: p.updatedAt,
      })),
      ...commented.map(
        (c: {
          id: string;
          createdAt: Date;
          content: { id: string; title: string };
        }) => ({
          id: `commented-${c.id}`,
          type: "COMMENTED" as const,
          contentId: c.content.id,
          contentTitle: c.content.title,
          timestamp: c.createdAt,
        }),
      ),
      ...created.map((c: { id: string; title: string; createdAt: Date }) => ({
        id: `created-${c.id}-${c.createdAt.toISOString()}`,
        type: "CREATED" as const,
        contentId: c.id,
        contentTitle: c.title,
        timestamp: c.createdAt,
      })),
    ];

    return rows
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  },

  async listBookmarks(
    userId: string,
    query?: string,
  ): Promise<
    Array<{
      id: string;
      contentId: string;
      title: string;
      contentType: "ARTICLE" | "VIDEO" | "PODCAST" | "DOCUMENT";
      savedAt: Date;
    }>
  > {
    const prisma = getPrismaClient();
    const q = query?.trim().toLowerCase();
    const items = await prisma.contentBookmark.findMany({
      where: {
        userId,
        ...(q
          ? {
              content: {
                title: {
                  contains: q,
                  mode: "insensitive",
                },
              },
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        content: {
          select: {
            id: true,
            title: true,
            contentType: true,
          },
        },
      },
      take: 50,
    });
    return items.map(
      (item: {
        id: string;
        contentId: string;
        createdAt: Date;
        content: {
          title: string;
          contentType: "ARTICLE" | "VIDEO" | "PODCAST" | "DOCUMENT";
        };
      }) => ({
        id: item.id,
        contentId: item.contentId,
        title: item.content.title,
        contentType: item.content.contentType,
        savedAt: item.createdAt,
      }),
    );
  },
};
