import {
  PrismaClient,
  Prisma,
  LifecycleState,
  Visibility,
  VersionChangeType,
  ReviewRequestStatus,
  ReviewAssignmentStatus,
  ReviewDecisionVerdict,
} from "@prisma/client";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ── Resolved ID maps ────────────────────────────────────────────────────────
// Populated at runtime after upserting each entity so we always reference
// the real DB IDs, even on repeated runs.

let userIds: Record<string, string> = {};
let roleIds: Record<string, string> = {};
let groupIds: Record<string, string> = {};
let tagIds: Record<string, string> = {};
let contentIds: Record<string, string> = {};
let versionIds: Record<string, string> = {};
let reviewRequestIds: Record<string, string> = {};
let reviewAssignmentIds: Record<string, string> = {};
let coAuthorIds: Record<string, string> = {};

// ── Permission matrix ───────────────────────────────────────────────────────

const RESOURCES = [
  "CONTENT", "TEMPLATE", "USER", "ROLE", "REVIEW", "TAG", "GROUP", "LOG",
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
  Admin: fullAccess(),
  Author: [
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
  Reviewer: [
    { action: "READ", resource: "CONTENT" },
    { action: "READ", resource: "REVIEW" },
    { action: "UPDATE", resource: "REVIEW" },
    { action: "READ", resource: "TAG" },
  ],
  Audience: readOnly(["CONTENT", "TAG"]),
};

// ── Seed functions ──────────────────────────────────────────────────────────

async function seedUsers() {
  const users = [
    { key: "admin", email: "admin@comms.local", displayName: "System Admin", password: "admin123", avatarUrl: "https://api.dicebear.com/9.x/initials/svg?seed=SA", isActive: true },
    { key: "alice", email: "alice@comms.local", displayName: "Alice Johnson", password: "alice123", avatarUrl: "https://api.dicebear.com/9.x/initials/svg?seed=AJ", isActive: true },
    { key: "bob", email: "bob@comms.local", displayName: "Bob Martinez", password: "bob123", avatarUrl: "https://api.dicebear.com/9.x/initials/svg?seed=BM", isActive: true },
    { key: "carol", email: "carol@comms.local", displayName: "Carol Chen", password: "carol123", avatarUrl: "https://api.dicebear.com/9.x/initials/svg?seed=CC", isActive: true },
    { key: "dave", email: "dave@comms.local", displayName: "Dave Kumar", password: "dave123", avatarUrl: "https://api.dicebear.com/9.x/initials/svg?seed=DK", isActive: true },
    { key: "eve", email: "eve@comms.local", displayName: "Eve Deactivated", password: "eve123", avatarUrl: null as string | null, isActive: false },
  ];

  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, 12);
    const row = await prisma.user.upsert({
      where: { email: u.email },
      update: { passwordHash },
      create: {
        id: randomUUID(),
        email: u.email,
        displayName: u.displayName,
        passwordHash,
        avatarUrl: u.avatarUrl,
        isActive: u.isActive,
      },
    });
    userIds[u.key] = row.id;
  }
  console.log(`  ✔ ${users.length} users`);
}

async function seedRoles() {
  const roles = [
    { key: "Admin", name: "Admin", description: "Full system access", isSystem: true },
    { key: "Author", name: "Author", description: "Can create and manage own content", isSystem: true },
    { key: "Reviewer", name: "Reviewer", description: "Can review and approve content", isSystem: true },
    { key: "Audience", name: "Audience", description: "Read-only access to published content", isSystem: false },
  ];

  for (const r of roles) {
    const row = await prisma.role.upsert({
      where: { name: r.name },
      update: {},
      create: { id: randomUUID(), name: r.name, description: r.description, isSystem: r.isSystem },
    });
    roleIds[r.key] = row.id;
  }
  console.log(`  ✔ ${roles.length} roles`);
}

async function seedPermissions() {
  let count = 0;
  for (const [roleName, perms] of Object.entries(ROLE_PERMISSIONS)) {
    const rid = roleIds[roleName];
    if (!rid) continue;
    for (const p of perms) {
      await prisma.permission.upsert({
        where: { roleId_action_resource: { roleId: rid, action: p.action, resource: p.resource } },
        update: {},
        create: { roleId: rid, action: p.action, resource: p.resource },
      });
      count++;
    }
  }
  console.log(`  ✔ ${count} permissions`);
}

async function seedUserRoles() {
  const assignments: { userKey: string; roleKey: string; assignedByKey: string | null }[] = [
    { userKey: "admin", roleKey: "Admin", assignedByKey: null },
    { userKey: "alice", roleKey: "Author", assignedByKey: "admin" },
    { userKey: "bob", roleKey: "Reviewer", assignedByKey: "admin" },
    { userKey: "bob", roleKey: "Author", assignedByKey: "admin" },
    { userKey: "carol", roleKey: "Reviewer", assignedByKey: "admin" },
    { userKey: "dave", roleKey: "Audience", assignedByKey: "admin" },
    { userKey: "eve", roleKey: "Audience", assignedByKey: "admin" },
  ];

  for (const a of assignments) {
    const userId = userIds[a.userKey];
    const roleId = roleIds[a.roleKey];
    const assignedById = a.assignedByKey ? userIds[a.assignedByKey] : null;
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId } },
      update: {},
      create: { userId, roleId, assignedById },
    });
  }
  console.log(`  ✔ ${assignments.length} user-role assignments`);
}

async function seedGroups() {
  const groups = [
    { key: "engineering", name: "Engineering", description: "All engineering team members" },
    { key: "marketing", name: "Marketing", description: "Marketing and communications team" },
    { key: "leadership", name: "Leadership", description: "Executive and team leads" },
  ];

  for (const g of groups) {
    const row = await prisma.userGroup.upsert({
      where: { name: g.name },
      update: {},
      create: { id: randomUUID(), name: g.name, description: g.description },
    });
    groupIds[g.key] = row.id;
  }
  console.log(`  ✔ ${groups.length} user groups`);
}

async function seedGroupMemberships() {
  const memberships: { userKey: string; groupKey: string }[] = [
    { userKey: "admin", groupKey: "leadership" },
    { userKey: "alice", groupKey: "engineering" },
    { userKey: "bob", groupKey: "engineering" },
    { userKey: "carol", groupKey: "engineering" },
    { userKey: "carol", groupKey: "leadership" },
    { userKey: "dave", groupKey: "marketing" },
  ];

  for (const m of memberships) {
    const userId = userIds[m.userKey];
    const groupId = groupIds[m.groupKey];
    await prisma.userGroupMembership.upsert({
      where: { userId_groupId: { userId, groupId } },
      update: {},
      create: { userId, groupId },
    });
  }
  console.log(`  ✔ ${memberships.length} group memberships`);
}

async function seedWorkspace() {
  await prisma.workspace.upsert({
    where: { slug: "default" },
    update: { name: "Default workspace" },
    create: { id: randomUUID(), slug: "default", name: "Default workspace" },
  });
  console.log("  ✔ default workspace");
}

async function seedTags() {
  const parentTags = [
    { key: "announcements", name: "Announcements", slug: "announcements" },
    { key: "engineering", name: "Engineering", slug: "engineering" },
    { key: "hiring", name: "Hiring", slug: "hiring" },
    { key: "policy", name: "Policy", slug: "policy" },
  ];

  for (const t of parentTags) {
    const row = await prisma.tag.upsert({
      where: { name: t.name },
      update: {},
      create: { id: randomUUID(), name: t.name, slug: t.slug, parentId: null },
    });
    tagIds[t.key] = row.id;
  }

  const childTags = [
    { key: "frontend", name: "Frontend", slug: "frontend", parentKey: "engineering" },
    { key: "backend", name: "Backend", slug: "backend", parentKey: "engineering" },
    { key: "releases", name: "Releases", slug: "releases", parentKey: "engineering" },
  ];

  for (const t of childTags) {
    const row = await prisma.tag.upsert({
      where: { name: t.name },
      update: {},
      create: { id: randomUUID(), name: t.name, slug: t.slug, parentId: tagIds[t.parentKey] },
    });
    tagIds[t.key] = row.id;
  }

  console.log(`  ✔ ${parentTags.length + childTags.length} tags`);
}

async function seedChannels() {
  const channels = [
    { name: "Web", key: "web", description: "Browser / responsive surfaces" },
    { name: "Email", key: "email", description: "Email clients" },
    { name: "Mobile", key: "mobile", description: "Native / in-app surfaces" },
  ];
  for (const c of channels) {
    await prisma.channel.upsert({
      where: { key: c.key },
      update: { name: c.name, description: c.description },
      create: { id: randomUUID(), name: c.name, key: c.key, description: c.description },
    });
  }
  console.log(`  ✔ ${channels.length} channels`);
}

async function seedContent() {
  const contents: {
    key: string;
    title: string;
    slug: string;
    lifecycleState: LifecycleState;
    visibility: Visibility;
    aiGenerated: boolean;
    authorKey: string;
    visibilityGroupKey: string | null;
  }[] = [
    { key: "welcomePost", title: "Welcome to the Comms Platform", slug: "welcome-to-comms-platform", lifecycleState: LifecycleState.PUBLISHED, visibility: Visibility.PUBLIC, aiGenerated: false, authorKey: "admin", visibilityGroupKey: null },
    { key: "engineeringUpdate", title: "Q1 Engineering Update", slug: "q1-engineering-update", lifecycleState: LifecycleState.PUBLISHED, visibility: Visibility.PRIVATE_TO_GROUP, aiGenerated: false, authorKey: "alice", visibilityGroupKey: "engineering" },
    { key: "hiringPolicy", title: "Updated Hiring Policy 2026", slug: "updated-hiring-policy-2026", lifecycleState: LifecycleState.IN_REVIEW, visibility: Visibility.PRIVATE, aiGenerated: false, authorKey: "alice", visibilityGroupKey: null },
    { key: "frontendGuide", title: "Frontend Development Guidelines", slug: "frontend-development-guidelines", lifecycleState: LifecycleState.IN_REVIEW, visibility: Visibility.PUBLIC, aiGenerated: false, authorKey: "bob", visibilityGroupKey: null },
    { key: "releaseNotes", title: "Platform v2.0 Release Notes", slug: "platform-v2-release-notes", lifecycleState: LifecycleState.ARCHIVED, visibility: Visibility.PUBLIC, aiGenerated: false, authorKey: "alice", visibilityGroupKey: null },
    { key: "draftPost", title: "AI-Assisted Content Creation Guide", slug: "ai-assisted-content-creation-guide", lifecycleState: LifecycleState.DRAFT, visibility: Visibility.HIDDEN, aiGenerated: true, authorKey: "carol", visibilityGroupKey: null },
  ];

  for (const c of contents) {
    const row = await prisma.content.upsert({
      where: { slug: c.slug },
      update: {},
      create: {
        id: randomUUID(),
        title: c.title,
        slug: c.slug,
        lifecycleState: c.lifecycleState,
        visibility: c.visibility,
        aiGenerated: c.aiGenerated,
        authorId: userIds[c.authorKey],
        visibilityGroupId: c.visibilityGroupKey ? groupIds[c.visibilityGroupKey] : null,
      },
    });
    contentIds[c.key] = row.id;
  }
  console.log(`  ✔ ${contents.length} content items`);
}

async function seedContentVersions() {
  const versions: {
    key: string;
    versionNumber: number;
    changeType: VersionChangeType;
    title: string;
    metadataSnapshot: Prisma.InputJsonValue;
    contentKey: string;
    authorKey: string;
  }[] = [
    { key: "welcomeV1", versionNumber: 1, changeType: VersionChangeType.MANUAL_SAVE, title: "Welcome to the Comms Platform", metadataSnapshot: { wordCount: 450, readTime: "2 min" }, contentKey: "welcomePost", authorKey: "admin" },
    { key: "welcomeV2", versionNumber: 2, changeType: VersionChangeType.STATE_TRANSITION, title: "Welcome to the Comms Platform", metadataSnapshot: { wordCount: 520, readTime: "3 min" }, contentKey: "welcomePost", authorKey: "admin" },
    { key: "engineeringV1", versionNumber: 1, changeType: VersionChangeType.MANUAL_SAVE, title: "Q1 Engineering Update", metadataSnapshot: { wordCount: 1200, readTime: "6 min" }, contentKey: "engineeringUpdate", authorKey: "alice" },
    { key: "hiringV1", versionNumber: 1, changeType: VersionChangeType.MANUAL_SAVE, title: "Updated Hiring Policy 2026", metadataSnapshot: { wordCount: 3500, readTime: "15 min" }, contentKey: "hiringPolicy", authorKey: "alice" },
    { key: "frontendV1", versionNumber: 1, changeType: VersionChangeType.MANUAL_SAVE, title: "Frontend Development Guidelines", metadataSnapshot: { wordCount: 2000, readTime: "10 min" }, contentKey: "frontendGuide", authorKey: "bob" },
    { key: "frontendV2", versionNumber: 2, changeType: VersionChangeType.RESTORE, title: "Frontend Development Guidelines v2", metadataSnapshot: { wordCount: 2200, readTime: "11 min" }, contentKey: "frontendGuide", authorKey: "bob" },
    { key: "releaseV1", versionNumber: 1, changeType: VersionChangeType.MANUAL_SAVE, title: "Platform v2.0 Release Notes", metadataSnapshot: { wordCount: 800, readTime: "4 min" }, contentKey: "releaseNotes", authorKey: "alice" },
    { key: "draftV1", versionNumber: 1, changeType: VersionChangeType.AI_GENERATED, title: "AI-Assisted Content Creation Guide", metadataSnapshot: { wordCount: 600, readTime: "3 min", model: "gpt-4" }, contentKey: "draftPost", authorKey: "carol" },
  ];

  for (const v of versions) {
    const cId = contentIds[v.contentKey];
    const row = await prisma.contentVersion.upsert({
      where: { contentId_versionNumber: { contentId: cId, versionNumber: v.versionNumber } },
      update: {},
      create: {
        id: randomUUID(),
        versionNumber: v.versionNumber,
        changeType: v.changeType,
        title: v.title,
        metadataSnapshot: v.metadataSnapshot,
        contentId: cId,
        authorId: userIds[v.authorKey],
      },
    });
    versionIds[v.key] = row.id;
  }
  console.log(`  ✔ ${versions.length} content versions`);
}

async function seedContentTags() {
  const links: { contentKey: string; tagKey: string }[] = [
    { contentKey: "welcomePost", tagKey: "announcements" },
    { contentKey: "engineeringUpdate", tagKey: "engineering" },
    { contentKey: "engineeringUpdate", tagKey: "announcements" },
    { contentKey: "hiringPolicy", tagKey: "hiring" },
    { contentKey: "hiringPolicy", tagKey: "policy" },
    { contentKey: "frontendGuide", tagKey: "frontend" },
    { contentKey: "frontendGuide", tagKey: "engineering" },
    { contentKey: "releaseNotes", tagKey: "releases" },
    { contentKey: "releaseNotes", tagKey: "engineering" },
    { contentKey: "draftPost", tagKey: "engineering" },
  ];

  for (const ct of links) {
    const contentId = contentIds[ct.contentKey];
    const tagId = tagIds[ct.tagKey];
    await prisma.contentTag.upsert({
      where: { contentId_tagId: { contentId, tagId } },
      update: {},
      create: { contentId, tagId },
    });
  }
  console.log(`  ✔ ${links.length} content-tag links`);
}

async function seedContentCoAuthors() {
  const entries: {
    key: string;
    contentKey: string;
    userKey: string;
    requestedByKey: string;
    status: "PENDING" | "ACCEPTED" | "REJECTED";
  }[] = [
    // Alice (author) adds Bob as co-author on Q1 Engineering Update (accepted)
    {
      key: "engBob",
      contentKey: "engineeringUpdate",
      userKey: "bob",
      requestedByKey: "alice",
      status: "ACCEPTED",
    },
    // Alice adds Carol as co-author on Hiring Policy (pending)
    {
      key: "hiringCarol",
      contentKey: "hiringPolicy",
      userKey: "carol",
      requestedByKey: "alice",
      status: "PENDING",
    },
  ];

  for (const e of entries) {
    const contentId = contentIds[e.contentKey];
    const userId = userIds[e.userKey];
    const requestedById = userIds[e.requestedByKey];

    const row = await prisma.contentCoAuthor.upsert({
      where: { contentId_userId: { contentId, userId } },
      update: { status: e.status },
      create: {
        id: randomUUID(),
        contentId,
        userId,
        requestedById,
        status: e.status,
      },
    });
    coAuthorIds[e.key] = row.id;
  }
  console.log(`  ✔ ${entries.length} content co-author entries`);
}

async function seedReviewRequests() {
  const requests: {
    key: string;
    status: ReviewRequestStatus;
    quorumRequired: number;
    contentKey: string;
    versionKey: string;
    requestedByKey: string;
  }[] = [
    { key: "welcomeReview", status: ReviewRequestStatus.CLOSED, quorumRequired: 2, contentKey: "welcomePost", versionKey: "welcomeV2", requestedByKey: "admin" },
    { key: "frontendReview", status: ReviewRequestStatus.OPEN, quorumRequired: 1, contentKey: "frontendGuide", versionKey: "frontendV2", requestedByKey: "bob" },
    { key: "hiringReview", status: ReviewRequestStatus.OPEN, quorumRequired: 1, contentKey: "hiringPolicy", versionKey: "hiringV1", requestedByKey: "alice" },
  ];

  for (const r of requests) {
    const row = await prisma.reviewRequest.upsert({
      where: { id: reviewRequestIds[r.key] ?? "00000000-0000-0000-0000-000000000000" },
      update: {},
      create: {
        id: randomUUID(),
        status: r.status,
        quorumRequired: r.quorumRequired,
        contentId: contentIds[r.contentKey],
        contentVersionId: versionIds[r.versionKey],
        requestedById: userIds[r.requestedByKey],
      },
    });
    reviewRequestIds[r.key] = row.id;
  }
  console.log(`  ✔ ${requests.length} review requests`);
}

async function seedReviewAssignments() {
  const assignments: {
    key: string;
    status: ReviewAssignmentStatus;
    requestKey: string;
    reviewerKey: string;
    assignedByKey: string;
    completedAt: Date | null;
  }[] = [
    { key: "welcomeBob", status: ReviewAssignmentStatus.COMPLETED, requestKey: "welcomeReview", reviewerKey: "bob", assignedByKey: "admin", completedAt: new Date("2026-02-15T14:30:00Z") },
    { key: "welcomeCarol", status: ReviewAssignmentStatus.COMPLETED, requestKey: "welcomeReview", reviewerKey: "carol", assignedByKey: "admin", completedAt: new Date("2026-02-16T09:00:00Z") },
    { key: "frontendBob", status: ReviewAssignmentStatus.IN_PROGRESS, requestKey: "frontendReview", reviewerKey: "bob", assignedByKey: "alice", completedAt: null },
    { key: "hiringCarol", status: ReviewAssignmentStatus.PENDING, requestKey: "hiringReview", reviewerKey: "carol", assignedByKey: "admin", completedAt: null },
  ];

  for (const a of assignments) {
    const reviewRequestId = reviewRequestIds[a.requestKey];
    const reviewerId = userIds[a.reviewerKey];
    const row = await prisma.reviewAssignment.upsert({
      where: { reviewRequestId_reviewerId: { reviewRequestId, reviewerId } },
      update: {},
      create: {
        id: randomUUID(),
        status: a.status,
        reviewRequestId,
        reviewerId,
        assignedById: userIds[a.assignedByKey],
        completedAt: a.completedAt,
      },
    });
    reviewAssignmentIds[a.key] = row.id;
  }
  console.log(`  ✔ ${assignments.length} review assignments`);
}

async function seedReviewDecisions() {
  const decisions: {
    verdict: ReviewDecisionVerdict;
    comment: string;
    isAutoApproval: boolean;
    decidedAt: Date;
    assignmentKey: string;
  }[] = [
    { verdict: ReviewDecisionVerdict.APPROVED, comment: "Content looks great, well-structured and informative.", isAutoApproval: false, decidedAt: new Date("2026-02-15T14:30:00Z"), assignmentKey: "welcomeBob" },
    { verdict: ReviewDecisionVerdict.APPROVED, comment: "Good to go. Minor typo on paragraph 3 but not blocking.", isAutoApproval: false, decidedAt: new Date("2026-02-16T09:00:00Z"), assignmentKey: "welcomeCarol" },
  ];

  for (const d of decisions) {
    const assignmentId = reviewAssignmentIds[d.assignmentKey];
    await prisma.reviewDecision.upsert({
      where: { reviewAssignmentId: assignmentId },
      update: {},
      create: {
        verdict: d.verdict,
        comment: d.comment,
        isAutoApproval: d.isAutoApproval,
        decidedAt: d.decidedAt,
        reviewAssignmentId: assignmentId,
      },
    });
  }
  console.log(`  ✔ ${decisions.length} review decisions`);
}

async function seedAuditLogs() {
  const logs: Prisma.AuditLogCreateManyInput[] = [
    {
      action: "CREATE", resource: "USER", resourceId: userIds.alice,
      newValue: { email: "alice@comms.local", displayName: "Alice Johnson" },
      ipAddress: "192.168.1.10", userAgent: "Mozilla/5.0 (Admin Panel)", actorId: userIds.admin,
    },
    {
      action: "CREATE", resource: "CONTENT", resourceId: contentIds.welcomePost,
      newValue: { title: "Welcome to the Comms Platform", state: "DRAFT" },
      ipAddress: "192.168.1.10", userAgent: "Mozilla/5.0 (Admin Panel)", actorId: userIds.admin,
    },
    {
      action: "UPDATE", resource: "CONTENT", resourceId: contentIds.welcomePost,
      oldValue: { lifecycleState: "DRAFT" }, newValue: { lifecycleState: "PUBLISHED" },
      ipAddress: "192.168.1.10", userAgent: "Mozilla/5.0 (Admin Panel)", actorId: userIds.admin,
    },
    {
      action: "CREATE", resource: "CONTENT", resourceId: contentIds.engineeringUpdate,
      newValue: { title: "Q1 Engineering Update", state: "DRAFT" },
      ipAddress: "10.0.0.42", userAgent: "Mozilla/5.0 (Linux; Workstation)", actorId: userIds.alice,
    },
    {
      action: "UPDATE", resource: "CONTENT", resourceId: contentIds.engineeringUpdate,
      oldValue: { lifecycleState: "DRAFT" }, newValue: { lifecycleState: "PUBLISHED" },
      ipAddress: "10.0.0.42", userAgent: "Mozilla/5.0 (Linux; Workstation)", actorId: userIds.alice,
    },
    {
      action: "CREATE", resource: "REVIEW", resourceId: reviewRequestIds.welcomeReview,
      newValue: { contentId: contentIds.welcomePost, quorum: 2 },
      ipAddress: "192.168.1.10", userAgent: "Mozilla/5.0 (Admin Panel)", actorId: userIds.admin,
    },
    {
      action: "UPDATE", resource: "ROLE", resourceId: roleIds.Audience,
      oldValue: { description: "Basic access" }, newValue: { description: "Read-only access to published content" },
      ipAddress: "192.168.1.10", userAgent: "Mozilla/5.0 (Admin Panel)", actorId: userIds.admin,
    },
  ];

  await prisma.auditLog.createMany({ data: logs });
  console.log(`  ✔ ${logs.length} audit logs`);
}

async function seedOutboxEvents() {
  const events: Prisma.OutboxEventCreateManyInput[] = [
    {
      aggregateType: "Content", aggregateId: contentIds.welcomePost,
      eventType: "content.published",
      payload: { contentId: contentIds.welcomePost, title: "Welcome to the Comms Platform", authorId: userIds.admin },
      processedAt: new Date("2026-02-15T15:00:00Z"),
    },
    {
      aggregateType: "Content", aggregateId: contentIds.engineeringUpdate,
      eventType: "content.published",
      payload: { contentId: contentIds.engineeringUpdate, title: "Q1 Engineering Update", authorId: userIds.alice },
      processedAt: new Date("2026-03-01T10:00:00Z"),
    },
    {
      aggregateType: "Review", aggregateId: reviewRequestIds.frontendReview,
      eventType: "review.requested",
      payload: { reviewRequestId: reviewRequestIds.frontendReview, contentId: contentIds.frontendGuide, requestedById: userIds.bob },
      processedAt: null,
    },
    {
      aggregateType: "User", aggregateId: userIds.eve,
      eventType: "user.deactivated",
      payload: { userId: userIds.eve, reason: "Account inactive for 90 days" },
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
  await seedWorkspace();
  await seedTags();
  await seedChannels();
  await seedContent();
  await seedContentVersions();
  await seedContentTags();
  await seedContentCoAuthors();
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
