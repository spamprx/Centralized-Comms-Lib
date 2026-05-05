import { getPrismaClient, PrismaUnitOfWork } from "../../repository";
import { Prisma } from "@prisma/client";

type ActivityType = "PUBLISHED" | "COMMENTED" | "CREATED";
type BookmarkNotificationType = "BODY_UPDATED" | "PUBLISHED";
type UserPushNotificationType = "PUSH_SENT";

export type ProfileActivityItem = {
  id: string;
  type: ActivityType;
  contentId: string;
  contentTitle: string;
  timestamp: Date;
};

export type ProfileBookmarkFolder = {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  bookmarkCount: number;
};

export type ProfileBookmarkNotification = {
  id: string;
  contentId: string;
  contentTitle: string;
  type: BookmarkNotificationType;
  message: string;
  createdAt: Date;
  readAt: Date | null;
};

export type ProfilePushNotification = {
  id: string;
  type: UserPushNotificationType;
  title: string;
  body: string;
  createdAt: Date;
  readAt: Date | null;
};

const FCM_TOKEN_MIN_LENGTH = 20;
const FCM_TOKEN_MAX_LENGTH = 4096;

function normalizeAndValidateFcmToken(raw: string): string {
  const token = raw.trim();
  if (token.length < FCM_TOKEN_MIN_LENGTH || token.length > FCM_TOKEN_MAX_LENGTH) {
    throw new Error("Invalid FCM token: length is outside allowed bounds");
  }
  if (!/^[A-Za-z0-9:_.-]+$/.test(token)) {
    throw new Error("Invalid FCM token: unsupported characters");
  }
  return token;
}

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

  async listPushRecipientCandidates(): Promise<
    Array<{ id: string; displayName: string; email: string; isActive: boolean }>
  > {
    const prisma = getPrismaClient();
    const rows = await prisma.user.findMany({
      where: { isActive: true },
      orderBy: [{ displayName: "asc" }, { email: "asc" }],
      select: {
        id: true,
        displayName: true,
        email: true,
        isActive: true,
      },
      take: 500,
    });
    return rows;
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
    folderId?: string | null,
  ): Promise<
    Array<{
      id: string;
      contentId: string;
      title: string;
      contentType: "ARTICLE" | "VIDEO" | "PODCAST" | "DOCUMENT";
      savedAt: Date;
      folderId: string | null;
      folderName: string | null;
    }>
  > {
    const prisma = getPrismaClient();
    const q = query?.trim().toLowerCase();
    const items = await prisma.contentBookmark.findMany({
      where: {
        userId,
        ...(folderId === null ? { folderId: null } : {}),
        ...(typeof folderId === "string" && folderId.trim()
          ? { folderId: folderId.trim() }
          : {}),
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
        folder: {
          select: {
            id: true,
            name: true,
          },
        },
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
        folder: { id: string; name: string } | null;
      }) => ({
        id: item.id,
        contentId: item.contentId,
        title: item.content.title,
        contentType: item.content.contentType,
        savedAt: item.createdAt,
        folderId: item.folder?.id ?? null,
        folderName: item.folder?.name ?? null,
      }),
    );
  },

  async listBookmarkFolders(userId: string): Promise<ProfileBookmarkFolder[]> {
    const prisma = getPrismaClient();
    const rows = await prisma.bookmarkFolder.findMany({
      where: { userId },
      orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
      include: {
        _count: {
          select: { bookmarks: true },
        },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      bookmarkCount: row._count.bookmarks,
    }));
  },

  async createBookmarkFolder(
    userId: string,
    name: string,
  ): Promise<ProfileBookmarkFolder> {
    const prisma = getPrismaClient();
    const row = await prisma.bookmarkFolder.create({
      data: { userId, name: name.trim() },
      include: { _count: { select: { bookmarks: true } } },
    });
    return {
      id: row.id,
      name: row.name,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      bookmarkCount: row._count.bookmarks,
    };
  },

  async renameBookmarkFolder(
    userId: string,
    folderId: string,
    name: string,
  ): Promise<ProfileBookmarkFolder | null> {
    const prisma = getPrismaClient();
    const existing = await prisma.bookmarkFolder.findFirst({
      where: { id: folderId, userId },
      select: { id: true },
    });
    if (!existing) return null;
    const row = await prisma.bookmarkFolder.update({
      where: { id: folderId },
      data: { name: name.trim() },
      include: { _count: { select: { bookmarks: true } } },
    });
    return {
      id: row.id,
      name: row.name,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      bookmarkCount: row._count.bookmarks,
    };
  },

  async deleteBookmarkFolder(userId: string, folderId: string): Promise<boolean> {
    const prisma = getPrismaClient();
    const existing = await prisma.bookmarkFolder.findFirst({
      where: { id: folderId, userId },
      select: { id: true },
    });
    if (!existing) return false;
    await prisma.contentBookmark.updateMany({
      where: { userId, folderId },
      data: { folderId: null },
    });
    await prisma.bookmarkFolder.delete({ where: { id: folderId } });
    return true;
  },

  async moveBookmark(
    userId: string,
    bookmarkId: string,
    folderId: string | null,
  ): Promise<{
    id: string;
    folderId: string | null;
    folderName: string | null;
  } | null> {
    const prisma = getPrismaClient();
    const bookmark = await prisma.contentBookmark.findFirst({
      where: { id: bookmarkId, userId },
      select: { id: true },
    });
    if (!bookmark) return null;
    if (folderId) {
      const folder = await prisma.bookmarkFolder.findFirst({
        where: { id: folderId, userId },
        select: { id: true },
      });
      if (!folder) return null;
    }
    const updated = await prisma.contentBookmark.update({
      where: { id: bookmarkId },
      data: { folderId: folderId ?? null },
      include: {
        folder: { select: { id: true, name: true } },
      },
    });
    return {
      id: updated.id,
      folderId: updated.folder?.id ?? null,
      folderName: updated.folder?.name ?? null,
    };
  },

  async listBookmarkNotifications(
    userId: string,
    unreadOnly = false,
  ): Promise<ProfileBookmarkNotification[]> {
    const prisma = getPrismaClient();
    const rows = await prisma.contentBookmarkNotification.findMany({
      where: {
        userId,
        ...(unreadOnly ? { readAt: null } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        content: { select: { id: true, title: true } },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      contentId: row.content.id,
      contentTitle: row.content.title,
      type: row.type as BookmarkNotificationType,
      message: row.message,
      createdAt: row.createdAt,
      readAt: row.readAt,
    }));
  },

  async markBookmarkNotificationRead(
    userId: string,
    notificationId: string,
  ): Promise<boolean> {
    const prisma = getPrismaClient();
    const row = await prisma.contentBookmarkNotification.findFirst({
      where: { id: notificationId, userId },
      select: { id: true },
    });
    if (!row) return false;
    await prisma.contentBookmarkNotification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });
    return true;
  },

  async markAllBookmarkNotificationsRead(userId: string): Promise<number> {
    const prisma = getPrismaClient();
    const out = await prisma.contentBookmarkNotification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return out.count;
  },

  async listPushNotifications(
    userId: string,
    unreadOnly = false,
  ): Promise<ProfilePushNotification[]> {
    const prisma = getPrismaClient();
    const rows = await prisma.userPushNotification.findMany({
      where: {
        userId,
        ...(unreadOnly ? { readAt: null } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return rows.map((row) => ({
      id: row.id,
      type: row.type as UserPushNotificationType,
      title: row.title,
      body: row.body,
      createdAt: row.createdAt,
      readAt: row.readAt,
    }));
  },

  async markPushNotificationRead(userId: string, notificationId: string): Promise<boolean> {
    const prisma = getPrismaClient();
    const row = await prisma.userPushNotification.findFirst({
      where: { id: notificationId, userId },
      select: { id: true },
    });
    if (!row) return false;
    await prisma.userPushNotification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });
    return true;
  },

  async markAllPushNotificationsRead(userId: string): Promise<number> {
    const prisma = getPrismaClient();
    const out = await prisma.userPushNotification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return out.count;
  },

  async saveDeviceFcmToken(
    userId: string,
    input: { token: string; deviceId: string; userAgent?: string | null },
  ): Promise<{ id: string; deviceId: string; updatedAt: Date }> {
    const prisma = getPrismaClient();
    const token = normalizeAndValidateFcmToken(input.token);
    const deviceId = input.deviceId.trim();
    if (!deviceId) {
      throw new Error("Invalid FCM token: deviceId is required");
    }
    try {
      const row = await prisma.userDeviceFcmToken.upsert({
        where: {
          userId_deviceId: {
            userId,
            deviceId,
          },
        },
        create: {
          userId,
          deviceId,
          token,
          userAgent: input.userAgent ?? null,
        },
        update: {
          token,
          userAgent: input.userAgent ?? null,
          lastSeenAt: new Date(),
        },
        select: {
          id: true,
          deviceId: true,
          updatedAt: true,
        },
      });
      return row;
    } catch (err) {
      // Token can already exist for a prior device/user mapping.
      // Rebind it to the current authenticated user/device.
      if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") {
        throw err;
      }
      const row = await prisma.userDeviceFcmToken.update({
        where: { token },
        data: {
          userId,
          deviceId,
          userAgent: input.userAgent ?? null,
          lastSeenAt: new Date(),
        },
        select: {
          id: true,
          deviceId: true,
          updatedAt: true,
        },
      });
      return row;
    }
  },

  async deleteDeviceFcmToken(
    userId: string,
    deviceId: string,
  ): Promise<{ deleted: boolean }> {
    const prisma = getPrismaClient();
    const normalizedDeviceId = deviceId.trim();
    if (!normalizedDeviceId) return { deleted: false };
    const out = await prisma.userDeviceFcmToken.deleteMany({
      where: {
        userId,
        deviceId: normalizedDeviceId,
      },
    });
    return { deleted: out.count > 0 };
  },
};
