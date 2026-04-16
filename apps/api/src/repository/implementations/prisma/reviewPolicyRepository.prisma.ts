import type { ReviewPolicyRepository } from "../../interfaces";
import type {
  CreateReviewPolicyInput,
  ReviewPolicy,
  UpdateReviewPolicyInput,
} from "../../types";
import type { PrismaDb } from "./prismaTypes";

function toPolicy(row: {
  id: string;
  contentType: string;
  channelId: string | null;
  userGroupId: string | null;
  quorumRequired: number;
  isActive: boolean;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}): ReviewPolicy {
  return {
    id: row.id,
    contentType: row.contentType as any,
    channelId: row.channelId,
    userGroupId: row.userGroupId,
    quorumRequired: row.quorumRequired,
    isActive: row.isActive,
    createdById: row.createdById,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PrismaReviewPolicyRepository implements ReviewPolicyRepository {
  public constructor(private readonly db: PrismaDb) {}

  async list(): Promise<ReviewPolicy[]> {
    const rows = await this.db.reviewPolicy.findMany({
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toPolicy);
  }

  async getById(id: string): Promise<ReviewPolicy | null> {
    const row = await this.db.reviewPolicy.findUnique({ where: { id } });
    return row ? toPolicy(row) : null;
  }

  async create(input: CreateReviewPolicyInput): Promise<ReviewPolicy> {
    const row = await this.db.reviewPolicy.create({
      data: {
        contentType: input.contentType as any,
        channelId: input.channelId ?? null,
        userGroupId: input.userGroupId ?? null,
        quorumRequired: input.quorumRequired,
        isActive: input.isActive ?? true,
        createdById: input.createdById ?? null,
      },
    });
    return toPolicy(row);
  }

  async update(
    id: string,
    input: UpdateReviewPolicyInput,
  ): Promise<ReviewPolicy> {
    const row = await this.db.reviewPolicy.update({
      where: { id },
      data: {
        ...(input.contentType !== undefined && {
          contentType: input.contentType as any,
        }),
        ...(input.channelId !== undefined && { channelId: input.channelId }),
        ...(input.userGroupId !== undefined && {
          userGroupId: input.userGroupId,
        }),
        ...(input.quorumRequired !== undefined && {
          quorumRequired: input.quorumRequired,
        }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
    });
    return toPolicy(row);
  }

  async delete(id: string): Promise<void> {
    await this.db.reviewPolicy.delete({ where: { id } });
  }

  async listActiveCandidates(input: {
    contentType: ReviewPolicy["contentType"];
    channelId: string | null;
    userGroupIds: string[];
  }): Promise<ReviewPolicy[]> {
    const channelClause =
      input.channelId == null
        ? { channelId: null }
        : { OR: [{ channelId: null }, { channelId: input.channelId }] };

    const groupClause =
      input.userGroupIds.length === 0
        ? { userGroupId: null }
        : {
            OR: [
              { userGroupId: null },
              { userGroupId: { in: input.userGroupIds } },
            ],
          };

    const rows = await this.db.reviewPolicy.findMany({
      where: {
        isActive: true,
        contentType: input.contentType as any,
        AND: [channelClause, groupClause],
      },
      orderBy: [
        { userGroupId: "asc" },
        { channelId: "asc" },
        { quorumRequired: "desc" },
      ],
    });
    return rows.map(toPolicy);
  }
}
