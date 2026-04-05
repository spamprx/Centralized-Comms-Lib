import type { PrismaClient, Prisma } from "@prisma/client";

import type {
  AuditLogRepository,
  ChannelRepository,
  ContentRepository,
  OutboxRepository,
  ReviewRepository,
  TagRepository,
  TemplateRepository,
  UserRoleRepository,
} from "../../interfaces";

import { PrismaAuditLogRepository } from "./auditLogRepository.prisma";
import { PrismaChannelRepository } from "./channelRepository.prisma";
import { PrismaContentRepository } from "./contentRepository.prisma";
import { PrismaOutboxRepository } from "./outboxRepository.prisma";
import { PrismaReviewRepository } from "./reviewRepository.prisma";
import { PrismaTagRepository } from "./tagRepository.prisma";
import { PrismaTemplateRepository } from "./templateRepository.prisma";
import { PrismaUserRoleRepository } from "./userRoleRepository.prisma";
import type { PrismaDb } from "./prismaTypes";

export interface Repositories {
  content: ContentRepository;
  userRole: UserRoleRepository;
  tag: TagRepository;
  review: ReviewRepository;
  audit: AuditLogRepository;
  outbox: OutboxRepository;
  channel: ChannelRepository;
  template: TemplateRepository;
}

export function createPrismaRepositories(db: PrismaDb | Prisma.TransactionClient): Repositories {
  return {
    content: new PrismaContentRepository(db),
    userRole: new PrismaUserRoleRepository(db),
    tag: new PrismaTagRepository(db),
    review: new PrismaReviewRepository(db),
    audit: new PrismaAuditLogRepository(db),
    outbox: new PrismaOutboxRepository(db),
    channel: new PrismaChannelRepository(db),
    template: new PrismaTemplateRepository(db),
  };
}

export class PrismaUnitOfWork {
  public constructor(private readonly prisma: PrismaClient) {}

  repos(): Repositories {
    return createPrismaRepositories(this.prisma);
  }

  async withTransaction<T>(fn: (repos: Repositories) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx: any) =>
      fn(createPrismaRepositories(tx)),
    );
  }
}

