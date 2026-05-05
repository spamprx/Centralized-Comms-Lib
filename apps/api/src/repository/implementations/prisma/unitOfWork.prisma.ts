import type { PrismaClient, Prisma } from "@prisma/client";

import type {
  AssetRepository,
  AuditLogRepository,
  ChannelRepository,
  ComponentRegistryRepository,
  ContentCitationRepository,
  ContentRepository,
  ContentSnapshotRepository,
  OutboxRepository,
  ReviewPolicyRepository,
  ReviewRepository,
  TagRepository,
  TemplateLayoutSectionRepository,
  TemplateRepository,
  TemplateTranslationRepository,
  UserRoleRepository,
  WorkspaceRepository,
} from "../../interfaces";

import { PrismaAssetRepository } from "./assetRepository.prisma";
import { PrismaAuditLogRepository } from "./auditLogRepository.prisma";
import { PrismaChannelRepository } from "./channelRepository.prisma";
import { PrismaComponentRegistryRepository } from "./componentRegistryRepository.prisma";
import { PrismaContentCitationRepository } from "./contentCitationRepository.prisma";
import { PrismaContentRepository } from "./contentRepository.prisma";
import { PrismaContentSnapshotRepository } from "./contentSnapshotRepository.prisma";
import { PrismaOutboxRepository } from "./outboxRepository.prisma";
import { PrismaReviewPolicyRepository } from "./reviewPolicyRepository.prisma";
import { PrismaReviewRepository } from "./reviewRepository.prisma";
import { PrismaTagRepository } from "./tagRepository.prisma";
import { PrismaTemplateLayoutSectionRepository } from "./templateLayoutSectionRepository.prisma";
import { PrismaTemplateRepository } from "./templateRepository.prisma";
import { PrismaTemplateTranslationRepository } from "./templateTranslationRepository.prisma";
import { PrismaUserRoleRepository } from "./userRoleRepository.prisma";
import { PrismaWorkspaceRepository } from "./workspaceRepository.prisma";
import type { PrismaDb } from "./prismaTypes";

export interface Repositories {
  content: ContentRepository;
  userRole: UserRoleRepository;
  tag: TagRepository;
  review: ReviewRepository;
  reviewPolicy: ReviewPolicyRepository;
  audit: AuditLogRepository;
  outbox: OutboxRepository;
  channel: ChannelRepository;
  template: TemplateRepository;
  workspace: WorkspaceRepository;
  templateTranslation: TemplateTranslationRepository;
  componentRegistry: ComponentRegistryRepository;
  templateLayoutSection: TemplateLayoutSectionRepository;
  contentCitation: ContentCitationRepository;
  contentSnapshot: ContentSnapshotRepository;
  asset: AssetRepository;
}

export function createPrismaRepositories(
  db: PrismaDb | Prisma.TransactionClient,
): Repositories {
  return {
    content: new PrismaContentRepository(db),
    userRole: new PrismaUserRoleRepository(db),
    tag: new PrismaTagRepository(db),
    review: new PrismaReviewRepository(db),
    reviewPolicy: new PrismaReviewPolicyRepository(db),
    audit: new PrismaAuditLogRepository(db),
    outbox: new PrismaOutboxRepository(db),
    channel: new PrismaChannelRepository(db),
    template: new PrismaTemplateRepository(db),
    workspace: new PrismaWorkspaceRepository(db),
    templateTranslation: new PrismaTemplateTranslationRepository(db),
    componentRegistry: new PrismaComponentRegistryRepository(db),
    templateLayoutSection: new PrismaTemplateLayoutSectionRepository(db),
    contentCitation: new PrismaContentCitationRepository(db),
    contentSnapshot: new PrismaContentSnapshotRepository(db),
    asset: new PrismaAssetRepository(db),
  };
}

export class PrismaUnitOfWork {
  public constructor(private readonly prisma: PrismaClient) {}

  repos(): Repositories {
    return createPrismaRepositories(this.prisma);
  }

  async withTransaction<T>(
    fn: (repos: Repositories) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx: any) =>
      fn(createPrismaRepositories(tx)),
    );
  }
}
