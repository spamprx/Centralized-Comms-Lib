import { PrismaClient } from "@prisma/client";
import { randomUUID, createHash } from "crypto";

const prisma = new PrismaClient();

function hashPassword(plain: string): string {
  return createHash("sha256").update(plain).digest("hex");
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// ── Stable IDs ──────────────────────────────────────────────────────────────
// Pre-generated so we can reference them across models.

const userIds = {
  admin: randomUUID(),
  alice: randomUUID(),
  bob: randomUUID(),
  carol: randomUUID(),
  dave: randomUUID(),
  eve: randomUUID(),
};

const roleIds = {
  admin: randomUUID(),
  author: randomUUID(),
  reviewer: randomUUID(),
  audience: randomUUID(),
};

const groupIds = {
  engineering: randomUUID(),
  marketing: randomUUID(),
  leadership: randomUUID(),
};

const tagIds = {
  announcements: randomUUID(),
  engineering: randomUUID(),
  frontend: randomUUID(),
  backend: randomUUID(),
  hiring: randomUUID(),
  policy: randomUUID(),
  releases: randomUUID(),
};

const contentIds = {
  welcomePost: randomUUID(),
  engineeringUpdate: randomUUID(),
  hiringPolicy: randomUUID(),
  frontendGuide: randomUUID(),
  releaseNotes: randomUUID(),
  draftPost: randomUUID(),
};

const versionIds = {
  welcomeV1: randomUUID(),
  welcomeV2: randomUUID(),
  engineeringV1: randomUUID(),
  hiringV1: randomUUID(),
  frontendV1: randomUUID(),
  frontendV2: randomUUID(),
  releaseV1: randomUUID(),
  draftV1: randomUUID(),
};

const reviewRequestIds = {
  welcomeReview: randomUUID(),
  frontendReview: randomUUID(),
  hiringReview: randomUUID(),
};

const reviewAssignmentIds = {
  welcomeBob: randomUUID(),
  welcomeCarol: randomUUID(),
  frontendBob: randomUUID(),
  hiringCarol: randomUUID(),
};

// ── Permission matrix ───────────────────────────────────────────────────────

const RESOURCES = [
  "CONTENT",
  "TEMPLATE",
  "USER",
  "ROLE",
  "REVIEW",
  "TAG",
  "GROUP",
  "LOG",
] as const;

const ACTIONS = ["CREATE", "READ", "UPDATE", "DELETE"] as const;

type PermissionDef = { action: string; resource: string };

function fullAccess(): PermissionDef[] {
  return RESOURCES.flatMap((resource) =>
    ACTIONS.map((action) => ({ action, resource }))
  );
}

function readOnly(resources: string[]): PermissionDef[] {
  return resources.map((resource) => ({ action: "READ", resource }));
}

const ROLE_PERMISSIONS: Record<string, PermissionDef[]> = {
  admin: fullAccess(),
  author: [
    { action: "CREATE", resource: "CONTENT" },
    { action: "READ", resource: "CONTENT" },
    { action: "UPDATE", resource: "CONTENT" },
    { action: "DELETE", resource: "CONTENT" },
    { action: "READ", resource: "TEMPLATE" },
    { action: "CREATE", resource: "TAG" },
    { action: "READ", resource: "TAG" },
    { action: "CREATE", resource: "REVIEW" },
    { action: "READ", resource: "REVIEW" },
  ],
  reviewer: [
    { action: "READ", resource: "CONTENT" },
    { action: "READ", resource: "REVIEW" },
    { action: "UPDATE", resource: "REVIEW" },
    { action: "READ", resource: "TAG" },
  ],
  audience: readOnly(["CONTENT", "TAG"]),
};

// ── Seed functions ──────────────────────────────────────────────────────────

async function seedUsers() {
  const users = [
    {
      id: userIds.admin,
      email: "admin@comms.local",
      displayName: "System Admin",
      passwordHash: hashPassword("admin123"),
      avatarUrl: "https://api.dicebear.com/9.x/initials/svg?seed=SA",
      isActive: true,
    },
    {
      id: userIds.alice,
      email: "alice@comms.local",
      displayName: "Alice Johnson",
      passwordHash: hashPassword("alice123"),
      avatarUrl: "https://api.dicebear.com/9.x/initials/svg?seed=AJ",
      isActive: true,
    },
    {
      id: userIds.bob,
      email: "bob@comms.local",
      displayName: "Bob Martinez",
      passwordHash: hashPassword("bob123"),
      avatarUrl: "https://api.dicebear.com/9.x/initials/svg?seed=BM",
      isActive: true,
    },
    {
      id: userIds.carol,
      email: "carol@comms.local",
      displayName: "Carol Chen",
      passwordHash: hashPassword("carol123"),
      avatarUrl: "https://api.dicebear.com/9.x/initials/svg?seed=CC",
      isActive: true,
    },
    {
      id: userIds.dave,
      email: "dave@comms.local",
      displayName: "Dave Kumar",
      passwordHash: hashPassword("dave123"),
      avatarUrl: "https://api.dicebear.com/9.x/initials/svg?seed=DK",
      isActive: true,
    },
    {
      id: userIds.eve,
      email: "eve@comms.local",
      displayName: "Eve Deactivated",
      passwordHash: hashPassword("eve123"),
      avatarUrl: null,
      isActive: false,
    },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: u,
    });
  }
  console.log(`  ✔ ${users.length} users`);
}

async function seedRoles() {
  const roles = [
    {
      id: roleIds.admin,
      name: "Admin",
      description: "Full system access",
      isSystem: true,
    },
    {
      id: roleIds.author,
      name: "Author",
      description: "Can create and manage own content",
      isSystem: true,
    },
    {
      id: roleIds.reviewer,
      name: "Reviewer",
      description: "Can review and approve content",
      isSystem: true,
    },
    {
      id: roleIds.audience,
      name: "Audience",
      description: "Read-only access to published content",
      isSystem: false,
    },
  ];

  for (const r of roles) {
    await prisma.role.upsert({
      where: { name: r.name },
      update: {},
      create: r,
    });
  }
  console.log(`  ✔ ${roles.length} roles`);
}

async function seedPermissions() {
  let count = 0;
  for (const [roleName, perms] of Object.entries(ROLE_PERMISSIONS)) {
    const roleId = roleIds[roleName as keyof typeof roleIds];
    for (const p of perms) {
      await prisma.permission.upsert({
        where: {
          roleId_action_resource: {
            roleId,
            action: p.action,
            resource: p.resource,
          },
        },
        update: {},
        create: { roleId, action: p.action, resource: p.resource },
      });
      count++;
    }
  }
  console.log(`  ✔ ${count} permissions`);
}

async function seedUserRoles() {
  const assignments: {
    userId: string;
    roleId: string;
    assignedById: string | null;
  }[] = [
    {
      userId: userIds.admin,
      roleId: roleIds.admin,
      assignedById: null,
    },
    {
      userId: userIds.alice,
      roleId: roleIds.author,
      assignedById: userIds.admin,
    },
    {
      userId: userIds.bob,
      roleId: roleIds.reviewer,
      assignedById: userIds.admin,
    },
    {
      userId: userIds.bob,
      roleId: roleIds.author,
      assignedById: userIds.admin,
    },
    {
      userId: userIds.carol,
      roleId: roleIds.reviewer,
      assignedById: userIds.admin,
    },
    {
      userId: userIds.dave,
      roleId: roleIds.audience,
      assignedById: userIds.admin,
    },
    {
      userId: userIds.eve,
      roleId: roleIds.audience,
      assignedById: userIds.admin,
    },
  ];

  for (const a of assignments) {
    await prisma.userRole.upsert({
      where: {
        userId_roleId: { userId: a.userId, roleId: a.roleId },
      },
      update: {},
      create: a,
    });
  }
  console.log(`  ✔ ${assignments.length} user-role assignments`);
}

async function seedGroups() {
  const groups = [
    {
      id: groupIds.engineering,
      name: "Engineering",
      description: "All engineering team members",
    },
    {
      id: groupIds.marketing,
      name: "Marketing",
      description: "Marketing and communications team",
    },
    {
      id: groupIds.leadership,
      name: "Leadership",
      description: "Executive and team leads",
    },
  ];

  for (const g of groups) {
    await prisma.userGroup.upsert({
      where: { name: g.name },
      update: {},
      create: g,
    });
  }
  console.log(`  ✔ ${groups.length} user groups`);
}

async function seedGroupMemberships() {
  const memberships: { userId: string; groupId: string }[] = [
    { userId: userIds.admin, groupId: groupIds.leadership },
    { userId: userIds.alice, groupId: groupIds.engineering },
    { userId: userIds.bob, groupId: groupIds.engineering },
    { userId: userIds.carol, groupId: groupIds.engineering },
    { userId: userIds.carol, groupId: groupIds.leadership },
    { userId: userIds.dave, groupId: groupIds.marketing },
  ];

  for (const m of memberships) {
    await prisma.userGroupMembership.upsert({
      where: {
        userId_groupId: { userId: m.userId, groupId: m.groupId },
      },
      update: {},
      create: m,
    });
  }
  console.log(`  ✔ ${memberships.length} group memberships`);
}

async function seedTags() {
  const tags: {
    id: string;
    name: string;
    slug: string;
    parentId: string | null;
  }[] = [
    {
      id: tagIds.announcements,
      name: "Announcements",
      slug: "announcements",
      parentId: null,
    },
    {
      id: tagIds.engineering,
      name: "Engineering",
      slug: "engineering",
      parentId: null,
    },
    {
      id: tagIds.frontend,
      name: "Frontend",
      slug: "frontend",
      parentId: tagIds.engineering,
    },
    {
      id: tagIds.backend,
      name: "Backend",
      slug: "backend",
      parentId: tagIds.engineering,
    },
    {
      id: tagIds.hiring,
      name: "Hiring",
      slug: "hiring",
      parentId: null,
    },
    {
      id: tagIds.policy,
      name: "Policy",
      slug: "policy",
      parentId: null,
    },
    {
      id: tagIds.releases,
      name: "Releases",
      slug: "releases",
      parentId: tagIds.engineering,
    },
  ];

  // Parent tags first, then children
  const parents = tags.filter((t) => !t.parentId);
  const children = tags.filter((t) => t.parentId);

  for (const t of [...parents, ...children]) {
    await prisma.tag.upsert({
      where: { name: t.name },
      update: {},
      create: t,
    });
  }
  console.log(`  ✔ ${tags.length} tags`);
}

async function seedContent() {
  const contents = [
    {
      id: contentIds.welcomePost,
      title: "Welcome to the Comms Platform",
      slug: "welcome-to-comms-platform",
      lifecycleState: "PUBLISHED",
      visibility: "PUBLIC",
      aiGenerated: false,
      authorId: userIds.admin,
      visibilityGroupId: null,
    },
    {
      id: contentIds.engineeringUpdate,
      title: "Q1 Engineering Update",
      slug: "q1-engineering-update",
      lifecycleState: "PUBLISHED",
      visibility: "PRIVATE_TO_GROUP",
      aiGenerated: false,
      authorId: userIds.alice,
      visibilityGroupId: groupIds.engineering,
    },
    {
      id: contentIds.hiringPolicy,
      title: "Updated Hiring Policy 2026",
      slug: "updated-hiring-policy-2026",
      lifecycleState: "IN_REVIEW",
      visibility: "PRIVATE",
      aiGenerated: false,
      authorId: userIds.alice,
      visibilityGroupId: null,
    },
    {
      id: contentIds.frontendGuide,
      title: "Frontend Development Guidelines",
      slug: "frontend-development-guidelines",
      lifecycleState: "IN_REVIEW",
      visibility: "PUBLIC",
      aiGenerated: false,
      authorId: userIds.bob,
      visibilityGroupId: null,
    },
    {
      id: contentIds.releaseNotes,
      title: "Platform v2.0 Release Notes",
      slug: "platform-v2-release-notes",
      lifecycleState: "ARCHIVED",
      visibility: "PUBLIC",
      aiGenerated: false,
      authorId: userIds.alice,
      visibilityGroupId: null,
    },
    {
      id: contentIds.draftPost,
      title: "AI-Assisted Content Creation Guide",
      slug: "ai-assisted-content-creation-guide",
      lifecycleState: "DRAFT",
      visibility: "HIDDEN",
      aiGenerated: true,
      authorId: userIds.carol,
      visibilityGroupId: null,
    },
  ];

  for (const c of contents) {
    await prisma.content.upsert({
      where: { slug: c.slug },
      update: {},
      create: c,
    });
  }
  console.log(`  ✔ ${contents.length} content items`);
}

async function seedContentVersions() {
  const versions = [
    {
      id: versionIds.welcomeV1,
      versionNumber: 1,
      changeType: "MANUAL_SAVE",
      title: "Welcome to the Comms Platform",
      metadataSnapshot: { wordCount: 450, readTime: "2 min" },
      contentId: contentIds.welcomePost,
      authorId: userIds.admin,
    },
    {
      id: versionIds.welcomeV2,
      versionNumber: 2,
      changeType: "STATE_TRANSITION",
      title: "Welcome to the Comms Platform",
      metadataSnapshot: { wordCount: 520, readTime: "3 min" },
      contentId: contentIds.welcomePost,
      authorId: userIds.admin,
    },
    {
      id: versionIds.engineeringV1,
      versionNumber: 1,
      changeType: "MANUAL_SAVE",
      title: "Q1 Engineering Update",
      metadataSnapshot: { wordCount: 1200, readTime: "6 min" },
      contentId: contentIds.engineeringUpdate,
      authorId: userIds.alice,
    },
    {
      id: versionIds.hiringV1,
      versionNumber: 1,
      changeType: "MANUAL_SAVE",
      title: "Updated Hiring Policy 2026",
      metadataSnapshot: { wordCount: 3500, readTime: "15 min" },
      contentId: contentIds.hiringPolicy,
      authorId: userIds.alice,
    },
    {
      id: versionIds.frontendV1,
      versionNumber: 1,
      changeType: "MANUAL_SAVE",
      title: "Frontend Development Guidelines",
      metadataSnapshot: { wordCount: 2000, readTime: "10 min" },
      contentId: contentIds.frontendGuide,
      authorId: userIds.bob,
    },
    {
      id: versionIds.frontendV2,
      versionNumber: 2,
      changeType: "RESTORE",
      title: "Frontend Development Guidelines v2",
      metadataSnapshot: { wordCount: 2200, readTime: "11 min" },
      contentId: contentIds.frontendGuide,
      authorId: userIds.bob,
    },
    {
      id: versionIds.releaseV1,
      versionNumber: 1,
      changeType: "MANUAL_SAVE",
      title: "Platform v2.0 Release Notes",
      metadataSnapshot: { wordCount: 800, readTime: "4 min" },
      contentId: contentIds.releaseNotes,
      authorId: userIds.alice,
    },
    {
      id: versionIds.draftV1,
      versionNumber: 1,
      changeType: "AI_GENERATED",
      title: "AI-Assisted Content Creation Guide",
      metadataSnapshot: {
        wordCount: 600,
        readTime: "3 min",
        model: "gpt-4",
      },
      contentId: contentIds.draftPost,
      authorId: userIds.carol,
    },
  ];

  for (const v of versions) {
    await prisma.contentVersion.upsert({
      where: {
        contentId_versionNumber: {
          contentId: v.contentId,
          versionNumber: v.versionNumber,
        },
      },
      update: {},
      create: v,
    });
  }
  console.log(`  ✔ ${versions.length} content versions`);
}

async function seedContentTags() {
  const contentTags: { contentId: string; tagId: string }[] = [
    { contentId: contentIds.welcomePost, tagId: tagIds.announcements },
    { contentId: contentIds.engineeringUpdate, tagId: tagIds.engineering },
    { contentId: contentIds.engineeringUpdate, tagId: tagIds.announcements },
    { contentId: contentIds.hiringPolicy, tagId: tagIds.hiring },
    { contentId: contentIds.hiringPolicy, tagId: tagIds.policy },
    { contentId: contentIds.frontendGuide, tagId: tagIds.frontend },
    { contentId: contentIds.frontendGuide, tagId: tagIds.engineering },
    { contentId: contentIds.releaseNotes, tagId: tagIds.releases },
    { contentId: contentIds.releaseNotes, tagId: tagIds.engineering },
    { contentId: contentIds.draftPost, tagId: tagIds.engineering },
  ];

  for (const ct of contentTags) {
    await prisma.contentTag.upsert({
      where: {
        contentId_tagId: {
          contentId: ct.contentId,
          tagId: ct.tagId,
        },
      },
      update: {},
      create: ct,
    });
  }
  console.log(`  ✔ ${contentTags.length} content-tag links`);
}

async function seedReviewRequests() {
  const requests = [
    {
      id: reviewRequestIds.welcomeReview,
      status: "CLOSED",
      quorumRequired: 2,
      contentId: contentIds.welcomePost,
      contentVersionId: versionIds.welcomeV2,
      requestedById: userIds.admin,
    },
    {
      id: reviewRequestIds.frontendReview,
      status: "OPEN",
      quorumRequired: 1,
      contentId: contentIds.frontendGuide,
      contentVersionId: versionIds.frontendV2,
      requestedById: userIds.bob,
    },
    {
      id: reviewRequestIds.hiringReview,
      status: "OPEN",
      quorumRequired: 1,
      contentId: contentIds.hiringPolicy,
      contentVersionId: versionIds.hiringV1,
      requestedById: userIds.alice,
    },
  ];

  for (const r of requests) {
    await prisma.reviewRequest.upsert({
      where: { id: r.id },
      update: {},
      create: r,
    });
  }
  console.log(`  ✔ ${requests.length} review requests`);
}

async function seedReviewAssignments() {
  const assignments = [
    {
      id: reviewAssignmentIds.welcomeBob,
      status: "COMPLETED",
      reviewRequestId: reviewRequestIds.welcomeReview,
      reviewerId: userIds.bob,
      assignedById: userIds.admin,
      completedAt: new Date("2026-02-15T14:30:00Z"),
    },
    {
      id: reviewAssignmentIds.welcomeCarol,
      status: "COMPLETED",
      reviewRequestId: reviewRequestIds.welcomeReview,
      reviewerId: userIds.carol,
      assignedById: userIds.admin,
      completedAt: new Date("2026-02-16T09:00:00Z"),
    },
    {
      id: reviewAssignmentIds.frontendBob,
      status: "IN_PROGRESS",
      reviewRequestId: reviewRequestIds.frontendReview,
      reviewerId: userIds.bob,
      assignedById: userIds.alice,
      completedAt: null,
    },
    {
      id: reviewAssignmentIds.hiringCarol,
      status: "PENDING",
      reviewRequestId: reviewRequestIds.hiringReview,
      reviewerId: userIds.carol,
      assignedById: userIds.admin,
      completedAt: null,
    },
  ];

  for (const a of assignments) {
    await prisma.reviewAssignment.upsert({
      where: {
        reviewRequestId_reviewerId: {
          reviewRequestId: a.reviewRequestId,
          reviewerId: a.reviewerId,
        },
      },
      update: {},
      create: a,
    });
  }
  console.log(`  ✔ ${assignments.length} review assignments`);
}

async function seedReviewDecisions() {
  const decisions = [
    {
      verdict: "APPROVED",
      comment: "Content looks great, well-structured and informative.",
      isAutoApproval: false,
      decidedAt: new Date("2026-02-15T14:30:00Z"),
      reviewAssignmentId: reviewAssignmentIds.welcomeBob,
    },
    {
      verdict: "APPROVED",
      comment:
        "Good to go. Minor typo on paragraph 3 but not blocking.",
      isAutoApproval: false,
      decidedAt: new Date("2026-02-16T09:00:00Z"),
      reviewAssignmentId: reviewAssignmentIds.welcomeCarol,
    },
  ];

  for (const d of decisions) {
    await prisma.reviewDecision.upsert({
      where: { reviewAssignmentId: d.reviewAssignmentId },
      update: {},
      create: d,
    });
  }
  console.log(`  ✔ ${decisions.length} review decisions`);
}

async function seedAuditLogs() {
  const logs = [
    {
      action: "CREATE",
      resource: "USER",
      resourceId: userIds.alice,
      oldValue: null,
      newValue: { email: "alice@comms.local", displayName: "Alice Johnson" },
      ipAddress: "192.168.1.10",
      userAgent: "Mozilla/5.0 (Admin Panel)",
      actorId: userIds.admin,
    },
    {
      action: "CREATE",
      resource: "CONTENT",
      resourceId: contentIds.welcomePost,
      oldValue: null,
      newValue: {
        title: "Welcome to the Comms Platform",
        state: "DRAFT",
      },
      ipAddress: "192.168.1.10",
      userAgent: "Mozilla/5.0 (Admin Panel)",
      actorId: userIds.admin,
    },
    {
      action: "UPDATE",
      resource: "CONTENT",
      resourceId: contentIds.welcomePost,
      oldValue: { lifecycleState: "DRAFT" },
      newValue: { lifecycleState: "PUBLISHED" },
      ipAddress: "192.168.1.10",
      userAgent: "Mozilla/5.0 (Admin Panel)",
      actorId: userIds.admin,
    },
    {
      action: "CREATE",
      resource: "CONTENT",
      resourceId: contentIds.engineeringUpdate,
      oldValue: null,
      newValue: { title: "Q1 Engineering Update", state: "DRAFT" },
      ipAddress: "10.0.0.42",
      userAgent: "Mozilla/5.0 (Linux; Workstation)",
      actorId: userIds.alice,
    },
    {
      action: "UPDATE",
      resource: "CONTENT",
      resourceId: contentIds.engineeringUpdate,
      oldValue: { lifecycleState: "DRAFT" },
      newValue: { lifecycleState: "PUBLISHED" },
      ipAddress: "10.0.0.42",
      userAgent: "Mozilla/5.0 (Linux; Workstation)",
      actorId: userIds.alice,
    },
    {
      action: "CREATE",
      resource: "REVIEW",
      resourceId: reviewRequestIds.welcomeReview,
      oldValue: null,
      newValue: { contentId: contentIds.welcomePost, quorum: 2 },
      ipAddress: "192.168.1.10",
      userAgent: "Mozilla/5.0 (Admin Panel)",
      actorId: userIds.admin,
    },
    {
      action: "UPDATE",
      resource: "ROLE",
      resourceId: roleIds.audience,
      oldValue: { description: "Basic access" },
      newValue: {
        description: "Read-only access to published content",
      },
      ipAddress: "192.168.1.10",
      userAgent: "Mozilla/5.0 (Admin Panel)",
      actorId: userIds.admin,
    },
  ];

  await prisma.auditLog.createMany({ data: logs });
  console.log(`  ✔ ${logs.length} audit logs`);
}

async function seedOutboxEvents() {
  const events = [
    {
      aggregateType: "Content",
      aggregateId: contentIds.welcomePost,
      eventType: "content.published",
      payload: {
        contentId: contentIds.welcomePost,
        title: "Welcome to the Comms Platform",
        authorId: userIds.admin,
      },
      processedAt: new Date("2026-02-15T15:00:00Z"),
    },
    {
      aggregateType: "Content",
      aggregateId: contentIds.engineeringUpdate,
      eventType: "content.published",
      payload: {
        contentId: contentIds.engineeringUpdate,
        title: "Q1 Engineering Update",
        authorId: userIds.alice,
      },
      processedAt: new Date("2026-03-01T10:00:00Z"),
    },
    {
      aggregateType: "Review",
      aggregateId: reviewRequestIds.frontendReview,
      eventType: "review.requested",
      payload: {
        reviewRequestId: reviewRequestIds.frontendReview,
        contentId: contentIds.frontendGuide,
        requestedById: userIds.bob,
      },
      processedAt: null,
    },
    {
      aggregateType: "User",
      aggregateId: userIds.eve,
      eventType: "user.deactivated",
      payload: {
        userId: userIds.eve,
        reason: "Account inactive for 90 days",
      },
      processedAt: null,
      retryCount: 2,
    },
  ];

  await prisma.outboxEvent.createMany({ data: events });
  console.log(`  ✔ ${events.length} outbox events`);
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Seeding transactional database...\n");

  await seedUsers();
  await seedRoles();
  await seedPermissions();
  await seedUserRoles();
  await seedGroups();
  await seedGroupMemberships();
  await seedTags();
  await seedContent();
  await seedContentVersions();
  await seedContentTags();
  await seedReviewRequests();
  await seedReviewAssignments();
  await seedReviewDecisions();
  await seedAuditLogs();
  await seedOutboxEvents();

  console.log("\nSeed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
