import {
  PrismaClient,
  Prisma,
  LifecycleState,
  Visibility,
  VersionChangeType,
  ReviewRequestStatus,
  ReviewAssignmentStatus,
  ReviewDecisionVerdict,
  TemplateStatus,
  LayoutPhase,
} from "@prisma/client";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/** Minimal TipTap JSON for editor library snapshot inserts / previews. */
function seedTipTapDoc(line: string): Prisma.InputJsonValue {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: line }],
      },
    ],
  };
}

// ── Resolved ID maps ────────────────────────────────────────────────────────

let userIds: Record<string, string> = {};
let roleIds: Record<string, string> = {};
let groupIds: Record<string, string> = {};
let workspaceIds: Record<string, string> = {};
let tagIds: Record<string, string> = {};
let channelIds: Record<string, string> = {};
let templateIds: Record<string, string> = {};
let contentIds: Record<string, string> = {};
let versionIds: Record<string, string> = {};
let reviewRequestIds: Record<string, string> = {};
let reviewAssignmentIds: Record<string, string> = {};
let coAuthorIds: Record<string, string> = {};
let componentIds: Record<string, string> = {};
let componentVersionIds: Record<string, string> = {};
let bindingIds: Record<string, string> = {};

// ── TipTap document helpers ─────────────────────────────────────────────────

function tiptapDoc(...blocks: object[]): Prisma.InputJsonValue {
  return { type: "doc", content: blocks } as unknown as Prisma.InputJsonValue;
}

function p(...runs: object[]) {
  return { type: "paragraph", content: runs };
}

function text(t: string, marks?: object[]) {
  const node: Record<string, unknown> = { type: "text", text: t };
  if (marks?.length) node.marks = marks;
  return node;
}

function bold(t: string) {
  return text(t, [{ type: "bold" }]);
}

function italic(t: string) {
  return text(t, [{ type: "italic" }]);
}

function heading(level: number, t: string) {
  return { type: "heading", attrs: { level }, content: [text(t)] };
}

function bulletList(...items: string[]) {
  return {
    type: "bulletList",
    content: items.map((i) => ({
      type: "listItem",
      content: [p(text(i))],
    })),
  };
}

function blockquote(t: string) {
  return { type: "blockquote", content: [p(text(t))] };
}

function codeBlock(code: string, language?: string) {
  return {
    type: "codeBlock",
    attrs: language ? { language } : {},
    content: [text(code)],
  };
}

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

async function seedWorkspaces() {
  const workspaces = [
    { key: "default", slug: "default", name: "Default workspace" },
    { key: "marketing", slug: "marketing", name: "Marketing workspace" },
  ];

  for (const w of workspaces) {
    const row = await prisma.workspace.upsert({
      where: { slug: w.slug },
      update: { name: w.name },
      create: { id: randomUUID(), slug: w.slug, name: w.name },
    });
    workspaceIds[w.key] = row.id;
  }
  console.log(`  ✔ ${workspaces.length} workspaces`);
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
    { name: "SMS", key: "sms", description: "SMS text messages" },
    { name: "Push Notification", key: "push", description: "Mobile and browser push notifications" },
  ];
  for (const c of channels) {
    const row = await prisma.channel.upsert({
      where: { key: c.key },
      update: { name: c.name, description: c.description },
      create: { id: randomUUID(), name: c.name, key: c.key, description: c.description },
    });
    channelIds[c.key] = row.id;
  }
  console.log(`  ✔ ${channels.length} channels`);
}

// ── Templates ───────────────────────────────────────────────────────────────

async function seedTemplates() {
  const templates: {
    key: string;
    workspaceKey: string;
    name: string;
    slug: string;
    description: string;
    status: TemplateStatus;
    authorKey: string;
    draftLayout: Prisma.InputJsonValue;
    activeLayout: Prisma.InputJsonValue;
    i18n: Prisma.InputJsonValue;
  }[] = [
    {
      key: "blogPost",
      workspaceKey: "default",
      name: "Blog Post",
      slug: "blog-post",
      description: "Standard blog post layout with hero image, body, and author bio",
      status: TemplateStatus.ACTIVE,
      authorKey: "admin",
      draftLayout: {
        sections: [
          { id: "hero", type: "image", label: "Hero Image" },
          { id: "title", type: "heading", label: "Title" },
          { id: "body", type: "richtext", label: "Body" },
          { id: "authorBio", type: "richtext", label: "Author Bio" },
        ],
      },
      activeLayout: {
        sections: [
          { id: "hero", type: "image", label: "Hero Image" },
          { id: "title", type: "heading", label: "Title" },
          { id: "body", type: "richtext", label: "Body" },
          { id: "authorBio", type: "richtext", label: "Author Bio" },
        ],
      },
      i18n: {
        en: { title: "Title", body: "Body", authorBio: "About the Author" },
        es: { title: "Título", body: "Cuerpo", authorBio: "Sobre el Autor" },
      },
    },
    {
      key: "announcement",
      workspaceKey: "default",
      name: "Announcement",
      slug: "announcement",
      description: "Short announcement with banner, summary, and call-to-action",
      status: TemplateStatus.ACTIVE,
      authorKey: "admin",
      draftLayout: {
        sections: [
          { id: "banner", type: "image", label: "Banner" },
          { id: "headline", type: "heading", label: "Headline" },
          { id: "summary", type: "richtext", label: "Summary" },
          { id: "cta", type: "button", label: "Call to Action" },
        ],
      },
      activeLayout: {
        sections: [
          { id: "banner", type: "image", label: "Banner" },
          { id: "headline", type: "heading", label: "Headline" },
          { id: "summary", type: "richtext", label: "Summary" },
          { id: "cta", type: "button", label: "Call to Action" },
        ],
      },
      i18n: {
        en: { headline: "Headline", summary: "Summary", cta: "Learn More" },
        fr: { headline: "Titre", summary: "Résumé", cta: "En savoir plus" },
      },
    },
    {
      key: "policyDoc",
      workspaceKey: "default",
      name: "Policy Document",
      slug: "policy-document",
      description: "Formal policy document with numbered sections and approval block",
      status: TemplateStatus.ACTIVE,
      authorKey: "alice",
      draftLayout: {
        sections: [
          { id: "preamble", type: "richtext", label: "Preamble" },
          { id: "sections", type: "richtext", label: "Sections" },
          { id: "approval", type: "signature", label: "Approval Block" },
        ],
      },
      activeLayout: {
        sections: [
          { id: "preamble", type: "richtext", label: "Preamble" },
          { id: "sections", type: "richtext", label: "Sections" },
          { id: "approval", type: "signature", label: "Approval Block" },
        ],
      },
      i18n: { en: { preamble: "Preamble", sections: "Policy Sections" } },
    },
    {
      key: "emailNewsletter",
      workspaceKey: "marketing",
      name: "Email Newsletter",
      slug: "email-newsletter",
      description: "Weekly email newsletter layout for marketing campaigns",
      status: TemplateStatus.DRAFT,
      authorKey: "dave",
      draftLayout: {
        sections: [
          { id: "header", type: "image", label: "Header Logo" },
          { id: "greeting", type: "richtext", label: "Greeting" },
          { id: "stories", type: "repeater", label: "Story Cards" },
          { id: "footer", type: "richtext", label: "Footer / Unsubscribe" },
        ],
      },
      activeLayout: Prisma.DbNull as unknown as Prisma.InputJsonValue,
      i18n: { en: { greeting: "Hello!", footer: "Unsubscribe" } },
    },
  ];

  for (const t of templates) {
    const row = await prisma.template.upsert({
      where: {
        workspaceId_slug: { workspaceId: workspaceIds[t.workspaceKey], slug: t.slug },
      },
      update: {},
      create: {
        id: randomUUID(),
        workspaceId: workspaceIds[t.workspaceKey],
        name: t.name,
        slug: t.slug,
        description: t.description,
        status: t.status,
        authorId: userIds[t.authorKey],
        draftLayout: t.draftLayout,
        activeLayout: t.activeLayout,
        i18n: t.i18n,
      },
    });
    templateIds[t.key] = row.id;
  }
  console.log(`  ✔ ${templates.length} templates`);
}

async function seedTemplateTranslations() {
  const translations: {
    templateKey: string;
    locale: string;
    key: string;
    value: string;
  }[] = [
    { templateKey: "blogPost", locale: "en", key: "title", value: "Title" },
    { templateKey: "blogPost", locale: "en", key: "body", value: "Body" },
    { templateKey: "blogPost", locale: "en", key: "authorBio", value: "About the Author" },
    { templateKey: "blogPost", locale: "es", key: "title", value: "Título" },
    { templateKey: "blogPost", locale: "es", key: "body", value: "Cuerpo" },
    { templateKey: "blogPost", locale: "es", key: "authorBio", value: "Sobre el Autor" },
    { templateKey: "announcement", locale: "en", key: "headline", value: "Headline" },
    { templateKey: "announcement", locale: "en", key: "cta", value: "Learn More" },
    { templateKey: "announcement", locale: "fr", key: "headline", value: "Titre" },
    { templateKey: "announcement", locale: "fr", key: "cta", value: "En savoir plus" },
  ];

  for (const t of translations) {
    const templateId = templateIds[t.templateKey];
    await prisma.templateTranslation.upsert({
      where: { templateId_locale_key: { templateId, locale: t.locale, key: t.key } },
      update: { value: t.value },
      create: { templateId, locale: t.locale, key: t.key, value: t.value },
    });
  }
  console.log(`  ✔ ${translations.length} template translations`);
}

async function seedTemplateChannelBindings() {
  const bindings: { key: string; templateKey: string; channelKey: string }[] = [
    { key: "blogWeb", templateKey: "blogPost", channelKey: "web" },
    { key: "blogEmail", templateKey: "blogPost", channelKey: "email" },
    { key: "blogMobile", templateKey: "blogPost", channelKey: "mobile" },
    { key: "annWeb", templateKey: "announcement", channelKey: "web" },
    { key: "annEmail", templateKey: "announcement", channelKey: "email" },
    { key: "annPush", templateKey: "announcement", channelKey: "push" },
    { key: "policyWeb", templateKey: "policyDoc", channelKey: "web" },
    { key: "nlEmail", templateKey: "emailNewsletter", channelKey: "email" },
  ];

  for (const b of bindings) {
    const templateId = templateIds[b.templateKey];
    const channelId = channelIds[b.channelKey];
    const row = await prisma.templateChannelBinding.upsert({
      where: { templateId_channelId: { templateId, channelId } },
      update: {},
      create: { id: randomUUID(), templateId, channelId },
    });
    bindingIds[b.key] = row.id;
  }
  console.log(`  ✔ ${bindings.length} template-channel bindings`);
}

async function seedTemplateFormattingRules() {
  const rules: {
    templateKey: string;
    rules: Prisma.InputJsonValue;
  }[] = [
    {
      templateKey: "blogPost",
      rules: {
        fonts: { heading: "Georgia, serif", body: "Inter, sans-serif" },
        colors: { primary: "#1a73e8", secondary: "#5f6368", background: "#ffffff" },
        headings: { h1: { fontSize: "2rem", fontWeight: 700 }, h2: { fontSize: "1.5rem", fontWeight: 600 } },
        media: { maxImageWidth: 800, allowedFormats: ["jpg", "png", "webp"] },
      },
    },
    {
      templateKey: "announcement",
      rules: {
        fonts: { heading: "Roboto, sans-serif", body: "Roboto, sans-serif" },
        colors: { primary: "#e8710a", secondary: "#333333", background: "#fff8f0" },
        headings: { h1: { fontSize: "1.75rem", fontWeight: 700 } },
        media: { maxImageWidth: 600, allowedFormats: ["jpg", "png"] },
      },
    },
    {
      templateKey: "policyDoc",
      rules: {
        fonts: { heading: "Times New Roman, serif", body: "Times New Roman, serif" },
        colors: { primary: "#1a1a2e", secondary: "#16213e", background: "#ffffff" },
        headings: { h1: { fontSize: "1.5rem", fontWeight: 700 }, h2: { fontSize: "1.25rem", fontWeight: 600 } },
        media: { maxImageWidth: 400, allowedFormats: ["png"] },
      },
    },
  ];

  for (const r of rules) {
    const templateId = templateIds[r.templateKey];
    // templateFormattingRule may not be in generated client yet; use $executeRawUnsafe
    const id = randomUUID();
    await prisma.$executeRawUnsafe(
      `INSERT INTO template_formatting_rules (id, "templateId", rules, "createdAt", "updatedAt")
       VALUES ($1, $2, $3::jsonb, NOW(), NOW())
       ON CONFLICT ("templateId") DO UPDATE SET rules = EXCLUDED.rules, "updatedAt" = NOW()`,
      id, templateId, JSON.stringify(r.rules),
    );
  }
  console.log(`  ✔ ${rules.length} template formatting rules`);
}

// ── Components ──────────────────────────────────────────────────────────────

async function seedComponents() {
  const components: {
    key: string;
    componentKey: string;
    name: string;
    description: string;
  }[] = [
    { key: "heroImage", componentKey: "hero-image", name: "Hero Image", description: "Full-width hero image with optional overlay text" },
    { key: "authorCard", componentKey: "author-card", name: "Author Card", description: "Compact author bio card with avatar and links" },
    { key: "ctaButton", componentKey: "cta-button", name: "CTA Button", description: "Configurable call-to-action button" },
    { key: "codeSnippet", componentKey: "code-snippet", name: "Code Snippet", description: "Syntax-highlighted code block with copy button" },
    { key: "legalFooter", componentKey: "legal-footer", name: "Legal Footer", description: "Standard legal disclaimer and copyright footer" },
  ];

  for (const c of components) {
    const row = await prisma.component.upsert({
      where: { key: c.componentKey },
      update: { name: c.name, description: c.description },
      create: { id: randomUUID(), key: c.componentKey, name: c.name, description: c.description },
    });
    componentIds[c.key] = row.id;
  }
  console.log(`  ✔ ${components.length} components`);
}

async function seedComponentVersions() {
  const versions: {
    key: string;
    componentKey: string;
    version: string;
    linkRefs: Prisma.InputJsonValue;
    propSchema: Prisma.InputJsonValue;
    bodyJson: Prisma.InputJsonValue;
  }[] = [
    {
      key: "heroV1", componentKey: "heroImage", version: "1.0.0",
      linkRefs: [],
      propSchema: { type: "object", properties: { src: { type: "string" }, alt: { type: "string" }, overlayText: { type: "string" } } },
      bodyJson: seedTipTapDoc("Hero Image — version 1.0.0 (seeded component body)."),
    },
    {
      key: "heroV2", componentKey: "heroImage", version: "2.0.0",
      linkRefs: ["hero-image@1.0.0"],
      propSchema: { type: "object", properties: { src: { type: "string" }, alt: { type: "string" }, overlayText: { type: "string" }, gradient: { type: "boolean" } } },
      bodyJson: seedTipTapDoc("Hero Image — version 2.0.0 (seeded component body)."),
    },
    {
      key: "authorCardV1", componentKey: "authorCard", version: "1.0.0",
      linkRefs: [],
      propSchema: { type: "object", properties: { name: { type: "string" }, bio: { type: "string" }, avatarUrl: { type: "string" } } },
      bodyJson: seedTipTapDoc("Author Card — version 1.0.0 (seeded component body)."),
    },
    {
      key: "ctaV1", componentKey: "ctaButton", version: "1.0.0",
      linkRefs: [],
      propSchema: { type: "object", properties: { label: { type: "string" }, href: { type: "string" }, variant: { type: "string", enum: ["primary", "secondary", "outline"] } } },
      bodyJson: seedTipTapDoc("CTA Button — version 1.0.0 (seeded component body)."),
    },
    {
      key: "codeSnippetV1", componentKey: "codeSnippet", version: "1.0.0",
      linkRefs: [],
      propSchema: { type: "object", properties: { code: { type: "string" }, language: { type: "string" }, showLineNumbers: { type: "boolean" } } },
      bodyJson: seedTipTapDoc("Code Snippet — version 1.0.0 (seeded component body)."),
    },
    {
      key: "legalFooterV1", componentKey: "legalFooter", version: "1.0.0",
      linkRefs: [],
      propSchema: { type: "object", properties: { companyName: { type: "string" }, year: { type: "number" } } },
      bodyJson: seedTipTapDoc("Legal Footer — version 1.0.0 (seeded component body)."),
    },
  ];

  for (const v of versions) {
    const cid = componentIds[v.componentKey];
    const row = await prisma.componentVersion.upsert({
      where: { componentId_version: { componentId: cid, version: v.version } },
      update: { linkRefs: v.linkRefs, propSchema: v.propSchema, bodyJson: v.bodyJson },
      create: {
        id: randomUUID(),
        componentId: cid,
        version: v.version,
        linkRefs: v.linkRefs,
        propSchema: v.propSchema,
        bodyJson: v.bodyJson,
      },
    });
    componentVersionIds[v.key] = row.id;
  }
  console.log(`  ✔ ${versions.length} component versions`);
}

async function seedTemplateLayoutSections() {
  const sections: {
    templateKey: string;
    phase: LayoutPhase;
    sortOrder: number;
    componentVersionKey: string | null;
    props: Prisma.InputJsonValue;
  }[] = [
    { templateKey: "blogPost", phase: LayoutPhase.ACTIVE, sortOrder: 0, componentVersionKey: "heroV2", props: { src: "/images/placeholder.jpg", alt: "Blog hero" } },
    { templateKey: "blogPost", phase: LayoutPhase.ACTIVE, sortOrder: 1, componentVersionKey: null, props: { sectionType: "richtext", fieldId: "body" } },
    { templateKey: "blogPost", phase: LayoutPhase.ACTIVE, sortOrder: 2, componentVersionKey: "authorCardV1", props: { showAvatar: true } },
    { templateKey: "announcement", phase: LayoutPhase.ACTIVE, sortOrder: 0, componentVersionKey: "heroV1", props: { src: "/images/banner.jpg", overlayText: "Important Update" } },
    { templateKey: "announcement", phase: LayoutPhase.ACTIVE, sortOrder: 1, componentVersionKey: null, props: { sectionType: "richtext", fieldId: "summary" } },
    { templateKey: "announcement", phase: LayoutPhase.ACTIVE, sortOrder: 2, componentVersionKey: "ctaV1", props: { label: "Read More", variant: "primary" } },
    { templateKey: "emailNewsletter", phase: LayoutPhase.DRAFT, sortOrder: 0, componentVersionKey: "heroV1", props: { src: "/images/logo.png" } },
    { templateKey: "emailNewsletter", phase: LayoutPhase.DRAFT, sortOrder: 1, componentVersionKey: null, props: { sectionType: "richtext", fieldId: "stories" } },
    { templateKey: "emailNewsletter", phase: LayoutPhase.DRAFT, sortOrder: 2, componentVersionKey: "legalFooterV1", props: { companyName: "Comms Corp", year: 2026 } },
  ];

  for (const s of sections) {
    const templateId = templateIds[s.templateKey];
    const componentVersionId = s.componentVersionKey ? componentVersionIds[s.componentVersionKey] : null;
    await prisma.templateLayoutSection.upsert({
      where: { templateId_phase_sortOrder: { templateId, phase: s.phase, sortOrder: s.sortOrder } },
      update: {},
      create: { id: randomUUID(), templateId, phase: s.phase, sortOrder: s.sortOrder, componentVersionId, props: s.props },
    });
  }
  console.log(`  ✔ ${sections.length} template layout sections`);
}

// ── Content (with template links) ───────────────────────────────────────────

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
    templateKey: string | null;
  }[] = [
    { key: "welcomePost", title: "Welcome to the Comms Platform", slug: "welcome-to-comms-platform", lifecycleState: LifecycleState.PUBLISHED, visibility: Visibility.PUBLIC, aiGenerated: false, authorKey: "admin", visibilityGroupKey: null, templateKey: "blogPost" },
    { key: "engineeringUpdate", title: "Q1 Engineering Update", slug: "q1-engineering-update", lifecycleState: LifecycleState.PUBLISHED, visibility: Visibility.PRIVATE_TO_GROUP, aiGenerated: false, authorKey: "alice", visibilityGroupKey: "engineering", templateKey: "blogPost" },
    { key: "hiringPolicy", title: "Updated Hiring Policy 2026", slug: "updated-hiring-policy-2026", lifecycleState: LifecycleState.IN_REVIEW, visibility: Visibility.PRIVATE, aiGenerated: false, authorKey: "alice", visibilityGroupKey: null, templateKey: "policyDoc" },
    { key: "frontendGuide", title: "Frontend Development Guidelines", slug: "frontend-development-guidelines", lifecycleState: LifecycleState.IN_REVIEW, visibility: Visibility.PUBLIC, aiGenerated: false, authorKey: "bob", visibilityGroupKey: null, templateKey: "blogPost" },
    { key: "releaseNotes", title: "Platform v2.0 Release Notes", slug: "platform-v2-release-notes", lifecycleState: LifecycleState.ARCHIVED, visibility: Visibility.PUBLIC, aiGenerated: false, authorKey: "alice", visibilityGroupKey: null, templateKey: "announcement" },
    { key: "draftPost", title: "AI-Assisted Content Creation Guide", slug: "ai-assisted-content-creation-guide", lifecycleState: LifecycleState.DRAFT, visibility: Visibility.HIDDEN, aiGenerated: true, authorKey: "carol", visibilityGroupKey: null, templateKey: null },
  ];

  for (const c of contents) {
    const row = await prisma.content.upsert({
      where: { slug: c.slug },
      update: { templateId: c.templateKey ? templateIds[c.templateKey] : null },
      create: {
        id: randomUUID(),
        title: c.title,
        slug: c.slug,
        lifecycleState: c.lifecycleState,
        visibility: c.visibility,
        aiGenerated: c.aiGenerated,
        authorId: userIds[c.authorKey],
        visibilityGroupId: c.visibilityGroupKey ? groupIds[c.visibilityGroupKey] : null,
        templateId: c.templateKey ? templateIds[c.templateKey] : null,
      },
    });
    contentIds[c.key] = row.id;
  }
  console.log(`  ✔ ${contents.length} content items`);
}

// ── Content versions with TipTap bodies ─────────────────────────────────────

async function seedContentVersions() {
  const versions: {
    key: string;
    versionNumber: number;
    changeType: VersionChangeType;
    title: string;
    body: Prisma.InputJsonValue;
    metadataSnapshot: Prisma.InputJsonValue;
    contentKey: string;
    authorKey: string;
  }[] = [
    {
      key: "welcomeV1", versionNumber: 1, changeType: VersionChangeType.MANUAL_SAVE,
      title: "Welcome to the Comms Platform",
      body: tiptapDoc(
        heading(1, "Welcome to the Comms Platform"),
        p(text("We are excited to introduce the "), bold("Centralized Communications Library"), text(" — a single platform for creating, reviewing, and distributing content across all your channels.")),
        heading(2, "What You Can Do"),
        bulletList(
          "Create and collaborate on content with your team",
          "Use templates to maintain consistent branding",
          "Distribute content to web, email, mobile, and more",
          "Track engagement with built-in analytics",
        ),
        p(text("Whether you are an author drafting a policy document, a reviewer ensuring quality, or a reader consuming the latest updates, the Comms Library has you covered.")),
        blockquote("The best communication platform is the one your whole organisation actually uses."),
        p(text("Get started by exploring the template library or creating your first draft. If you have questions, reach out to the platform team at "), italic("support@comms.local"), text(".")),
      ),
      metadataSnapshot: { wordCount: 450, readTime: "2 min" },
      contentKey: "welcomePost", authorKey: "admin",
    },
    {
      key: "welcomeV2", versionNumber: 2, changeType: VersionChangeType.STATE_TRANSITION,
      title: "Welcome to the Comms Platform",
      body: tiptapDoc(
        heading(1, "Welcome to the Comms Platform"),
        p(text("We are excited to introduce the "), bold("Centralized Communications Library"), text(" — a single platform for creating, reviewing, and distributing content across all your channels.")),
        heading(2, "What You Can Do"),
        bulletList(
          "Create and collaborate on content with your team in real time",
          "Use AI-powered drafting to accelerate content creation",
          "Apply templates to maintain consistent branding across channels",
          "Distribute content to web, email, SMS, mobile, and push notifications",
          "Track engagement with built-in analytics dashboards",
        ),
        heading(2, "Getting Started"),
        p(text("Head to the "), bold("Template Library"), text(" to pick a starting layout, or click "), bold("New Content"), text(" to begin from scratch. Every piece of content goes through a review workflow before publication.")),
        blockquote("The best communication platform is the one your whole organisation actually uses."),
        p(text("Questions? Reach out to "), italic("support@comms.local"), text(" or open a Q&A thread in your team's shared space.")),
      ),
      metadataSnapshot: { wordCount: 520, readTime: "3 min", to: "PUBLISHED" },
      contentKey: "welcomePost", authorKey: "admin",
    },
    {
      key: "engineeringV1", versionNumber: 1, changeType: VersionChangeType.MANUAL_SAVE,
      title: "Q1 Engineering Update",
      body: tiptapDoc(
        heading(1, "Q1 2026 Engineering Update"),
        p(text("This quarter the engineering team shipped several major improvements to the Comms Library platform. Here is a summary of what changed and what is coming next.")),
        heading(2, "Infrastructure"),
        bulletList(
          "Migrated primary database to PostgreSQL 16 with connection pooling",
          "Deployed Elasticsearch 8 for full-text search with stemming and synonyms",
          "Added Redis caching layer for search result memoisation",
          "Set up nightly vector reindex job for title embeddings (384-dim cosine)",
        ),
        heading(2, "Backend"),
        bulletList(
          "Implemented transactional outbox pattern for reliable event delivery",
          "Added circuit breaker for AI service calls",
          "Content versioning now stores immutable snapshots with word-level diff support",
          "Rate limiting and AI quota enforcement at the gateway layer",
        ),
        heading(2, "Frontend"),
        bulletList(
          "Launched new TipTap-based WYSIWYG editor with collaborative cursors",
          "Template layout builder with drag-and-drop sections",
          "Real-time review comment threads with @-mention support",
        ),
        heading(2, "What is Next"),
        p(text("In Q2 we will focus on multi-channel distribution (email, SMS, push), audience analytics dashboards, and AI-powered content clustering.")),
      ),
      metadataSnapshot: { wordCount: 1200, readTime: "6 min" },
      contentKey: "engineeringUpdate", authorKey: "alice",
    },
    {
      key: "hiringV1", versionNumber: 1, changeType: VersionChangeType.MANUAL_SAVE,
      title: "Updated Hiring Policy 2026",
      body: tiptapDoc(
        heading(1, "Updated Hiring Policy 2026"),
        p(bold("Effective Date: "), text("1 March 2026")),
        p(bold("Approved By: "), text("Leadership Team")),
        heading(2, "1. Purpose"),
        p(text("This policy establishes guidelines for recruiting, interviewing, and onboarding new team members to ensure a fair, consistent, and inclusive process across all departments.")),
        heading(2, "2. Scope"),
        p(text("This policy applies to all full-time, part-time, and contract positions within the organisation. It covers the entire hiring lifecycle from requisition to offer acceptance.")),
        heading(2, "3. Requisition Process"),
        bulletList(
          "All new positions must be approved by the department head and HR",
          "Job descriptions must include core responsibilities, required qualifications, and salary range",
          "Internal candidates should be considered before external posting",
        ),
        heading(2, "4. Interview Guidelines"),
        bulletList(
          "A minimum of two interviewers per candidate is required",
          "Structured interview questions must be used to ensure consistency",
          "All interviewers must complete unconscious bias training annually",
          "Feedback must be submitted within 48 hours of the interview",
        ),
        heading(2, "5. Offer and Onboarding"),
        p(text("Offers must be approved by the hiring manager and HR before being extended. New hires will receive a structured onboarding plan spanning their first 90 days.")),
        heading(2, "6. Equal Opportunity"),
        p(text("The organisation is committed to equal employment opportunity. Hiring decisions shall be made without regard to race, colour, religion, sex, national origin, age, disability, or any other protected characteristic.")),
      ),
      metadataSnapshot: { wordCount: 3500, readTime: "15 min" },
      contentKey: "hiringPolicy", authorKey: "alice",
    },
    {
      key: "frontendV1", versionNumber: 1, changeType: VersionChangeType.MANUAL_SAVE,
      title: "Frontend Development Guidelines",
      body: tiptapDoc(
        heading(1, "Frontend Development Guidelines"),
        p(text("This document outlines coding standards, tooling, and best practices for frontend development on the Comms Library platform.")),
        heading(2, "Tech Stack"),
        bulletList(
          "React 19 with TypeScript strict mode",
          "Vite for bundling and dev server",
          "Material UI (MUI) as the component library",
          "React Router for client-side routing",
          "TanStack Query for server state management",
        ),
        heading(2, "Project Structure"),
        codeBlock(
          "apps/web/src/\n  components/   # Shared UI components\n  hooks/        # Custom React hooks\n  pages/        # Route-level page components\n  routes/       # Route configuration\n  services/     # API client functions\n  utils/        # Pure utility functions",
          "text",
        ),
        heading(2, "Component Conventions"),
        bulletList(
          "Use functional components with hooks exclusively",
          "Co-locate styles, tests, and types with component files",
          "Prefer named exports over default exports",
          "Keep components under 200 lines; extract sub-components early",
        ),
        heading(2, "State Management"),
        p(text("Use TanStack Query for all server data. Local UI state should use "), italic("useState"), text(" or "), italic("useReducer"), text(". Avoid prop drilling beyond 2 levels — use context or composition instead.")),
      ),
      metadataSnapshot: { wordCount: 2000, readTime: "10 min" },
      contentKey: "frontendGuide", authorKey: "bob",
    },
    {
      key: "frontendV2", versionNumber: 2, changeType: VersionChangeType.RESTORE,
      title: "Frontend Development Guidelines v2",
      body: tiptapDoc(
        heading(1, "Frontend Development Guidelines v2"),
        p(text("This document outlines coding standards, tooling, and best practices for frontend development on the Comms Library platform. "), bold("Updated March 2026.")),
        heading(2, "Tech Stack"),
        bulletList(
          "React 19 with TypeScript strict mode",
          "Vite 6 for bundling and dev server",
          "Material UI (MUI) v6 as the component library",
          "React Router v7 for client-side routing",
          "TanStack Query v5 for server state management",
        ),
        heading(2, "Project Structure"),
        codeBlock(
          "apps/web/src/\n  components/   # Shared UI components\n  hooks/        # Custom React hooks\n  pages/        # Route-level page components\n  routes/       # Route configuration\n  services/     # API client functions\n  utils/        # Pure utility functions",
          "text",
        ),
        heading(2, "Component Conventions"),
        bulletList(
          "Use functional components with hooks exclusively",
          "Co-locate styles, tests, and types with component files",
          "Prefer named exports over default exports",
          "Keep components under 200 lines; extract sub-components early",
          "Use React.memo only when profiling shows re-render cost",
        ),
        heading(2, "Testing"),
        bulletList(
          "Unit tests with Vitest for utility functions and hooks",
          "Component tests with Testing Library for interactive behaviour",
          "E2E tests with Playwright for critical user flows",
        ),
        heading(2, "Accessibility"),
        p(text("All interactive components must be keyboard-navigable and pass WCAG 2.1 AA. Use "), italic("axe-core"), text(" in CI to catch regressions.")),
      ),
      metadataSnapshot: { wordCount: 2200, readTime: "11 min" },
      contentKey: "frontendGuide", authorKey: "bob",
    },
    {
      key: "releaseV1", versionNumber: 1, changeType: VersionChangeType.MANUAL_SAVE,
      title: "Platform v2.0 Release Notes",
      body: tiptapDoc(
        heading(1, "Platform v2.0 Release Notes"),
        p(bold("Release Date: "), text("15 January 2026")),
        heading(2, "Highlights"),
        bulletList(
          "New template engine with multi-channel rendering",
          "Full-text search powered by Elasticsearch with typo tolerance",
          "AI-assisted draft generation (GPT-4 integration)",
          "Collaborative editing with real-time cursor sharing",
          "Review workflow with configurable quorum policies",
        ),
        heading(2, "Breaking Changes"),
        bulletList(
          "Content API v1 endpoints deprecated; migrate to /api/v2/content",
          "Template schema updated — run migration before deploying",
        ),
        heading(2, "Bug Fixes"),
        bulletList(
          "Fixed race condition in co-author session handoff",
          "Resolved search index lag on rapid publishes",
          "Corrected permission check for group-scoped visibility",
        ),
      ),
      metadataSnapshot: { wordCount: 800, readTime: "4 min" },
      contentKey: "releaseNotes", authorKey: "alice",
    },
    {
      key: "draftV1", versionNumber: 1, changeType: VersionChangeType.AI_GENERATED,
      title: "AI-Assisted Content Creation Guide",
      body: tiptapDoc(
        heading(1, "AI-Assisted Content Creation Guide"),
        p(italic("This draft was generated by AI and is pending human review.")),
        heading(2, "Introduction"),
        p(text("Artificial intelligence can dramatically accelerate content creation by generating first drafts, suggesting edits, and automating repetitive formatting tasks. This guide explains how to use the Comms Library's AI features effectively.")),
        heading(2, "Generating a Draft"),
        bulletList(
          "Click 'New Content' and select 'AI Draft' from the creation options",
          "Provide a topic, target audience, and optional outline",
          "The system routes your prompt to the AI service and returns a structured draft",
          "AI-generated content is flagged with an 'AI Generated' badge for transparency",
        ),
        heading(2, "Editing AI Output"),
        p(text("Always review AI-generated content for accuracy, tone, and completeness. The AI provides a starting point — your expertise turns it into publication-quality material.")),
        heading(2, "Best Practices"),
        bulletList(
          "Be specific in your prompts to get better results",
          "Use the regenerate button to try alternative phrasings",
          "Check all facts and figures — AI can hallucinate statistics",
          "Run the content pipeline (grammar, compliance, formatting) before submitting for review",
        ),
      ),
      metadataSnapshot: { wordCount: 600, readTime: "3 min", model: "gpt-4" },
      contentKey: "draftPost", authorKey: "carol",
    },
  ];

  for (const v of versions) {
    const cId = contentIds[v.contentKey];
    const row = await prisma.contentVersion.upsert({
      where: { contentId_versionNumber: { contentId: cId, versionNumber: v.versionNumber } },
      update: { body: v.body },
      create: {
        id: randomUUID(),
        versionNumber: v.versionNumber,
        changeType: v.changeType,
        title: v.title,
        body: v.body,
        metadataSnapshot: v.metadataSnapshot,
        contentId: cId,
        authorId: userIds[v.authorKey],
      },
    });
    versionIds[v.key] = row.id;
  }
  console.log(`  ✔ ${versions.length} content versions (with TipTap bodies)`);
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
    { key: "engBob", contentKey: "engineeringUpdate", userKey: "bob", requestedByKey: "alice", status: "ACCEPTED" },
    { key: "hiringCarol", contentKey: "hiringPolicy", userKey: "carol", requestedByKey: "alice", status: "PENDING" },
  ];

  for (const e of entries) {
    const contentId = contentIds[e.contentKey];
    const userId = userIds[e.userKey];
    const requestedById = userIds[e.requestedByKey];

    const row = await prisma.contentCoAuthor.upsert({
      where: { contentId_userId: { contentId, userId } },
      update: { status: e.status },
      create: { id: randomUUID(), contentId, userId, requestedById, status: e.status },
    });
    coAuthorIds[e.key] = row.id;
  }
  console.log(`  ✔ ${entries.length} content co-author entries`);
}

// ── Citations ───────────────────────────────────────────────────────────────

async function seedContentCitations() {
  const citations: {
    contentKey: string;
    referenceType: string;
    referenceId: string;
    label: string;
    metadata: Prisma.InputJsonValue;
  }[] = [
    {
      contentKey: "frontendGuide", referenceType: "URL", referenceId: "https://react.dev",
      label: "React Documentation",
      metadata: { format: "APA", authors: ["Meta Platforms"], year: 2026, title: "React – A JavaScript library for building user interfaces", url: "https://react.dev" },
    },
    {
      contentKey: "frontendGuide", referenceType: "URL", referenceId: "https://vitejs.dev",
      label: "Vite Documentation",
      metadata: { format: "APA", authors: ["Evan You"], year: 2026, title: "Vite – Next Generation Frontend Tooling", url: "https://vitejs.dev" },
    },
    {
      contentKey: "frontendGuide", referenceType: "URL", referenceId: "https://mui.com",
      label: "Material UI Documentation",
      metadata: { format: "APA", authors: ["MUI"], year: 2026, title: "MUI: The React component library", url: "https://mui.com" },
    },
    {
      contentKey: "hiringPolicy", referenceType: "INTERNAL", referenceId: contentIds.welcomePost ?? "pending",
      label: "Platform Welcome Post",
      metadata: { format: "IEEE", title: "Welcome to the Comms Platform", internalContentSlug: "welcome-to-comms-platform" },
    },
    {
      contentKey: "engineeringUpdate", referenceType: "URL", referenceId: "https://www.elastic.co/guide/en/elasticsearch/reference/8.x/index.html",
      label: "Elasticsearch 8 Reference",
      metadata: { format: "APA", authors: ["Elastic"], year: 2026, title: "Elasticsearch Reference [8.x]", url: "https://www.elastic.co/guide/en/elasticsearch/reference/8.x/index.html" },
    },
    {
      contentKey: "draftPost", referenceType: "URL", referenceId: "https://openai.com/research",
      label: "OpenAI Research",
      metadata: { format: "MLA", authors: ["OpenAI"], year: 2025, title: "OpenAI Research Publications", url: "https://openai.com/research" },
    },
  ];

  for (const c of citations) {
    const contentId = contentIds[c.contentKey];
    if (c.referenceType === "INTERNAL" && c.referenceId === "pending") {
      c.referenceId = contentIds.welcomePost;
    }
    await prisma.contentCitation.create({
      data: { contentId, referenceType: c.referenceType, referenceId: c.referenceId, label: c.label, metadata: c.metadata },
    });
  }
  console.log(`  ✔ ${citations.length} content citations`);
}

// ── Snapshots ───────────────────────────────────────────────────────────────

async function seedContentSnapshots() {
  const snapshots: {
    contentKey: string;
    fromVersionNumber: number | null;
    toVersionNumber: number;
    diffMetadata: Prisma.InputJsonValue;
    createdByKey: string;
  }[] = [
    {
      contentKey: "welcomePost", fromVersionNumber: null, toVersionNumber: 1,
      diffMetadata: { type: "initial", addedWords: 450, removedWords: 0 },
      createdByKey: "admin",
    },
    {
      contentKey: "welcomePost", fromVersionNumber: 1, toVersionNumber: 2,
      diffMetadata: { type: "state_transition", addedWords: 70, removedWords: 0, transition: "DRAFT→PUBLISHED" },
      createdByKey: "admin",
    },
    {
      contentKey: "frontendGuide", fromVersionNumber: 1, toVersionNumber: 2,
      diffMetadata: { type: "restore", addedWords: 200, removedWords: 50, sections: ["Testing", "Accessibility"] },
      createdByKey: "bob",
    },
    {
      contentKey: "engineeringUpdate", fromVersionNumber: null, toVersionNumber: 1,
      diffMetadata: { type: "initial", addedWords: 1200, removedWords: 0 },
      createdByKey: "alice",
    },
  ];

  for (const s of snapshots) {
    const contentId = contentIds[s.contentKey];
    await prisma.contentSnapshot.create({
      data: {
        contentId,
        fromVersionNumber: s.fromVersionNumber,
        toVersionNumber: s.toVersionNumber,
        diffMetadata: s.diffMetadata,
        createdById: userIds[s.createdByKey],
      },
    });
  }
  console.log(`  ✔ ${snapshots.length} content snapshots`);
}

// ── Analytics events ────────────────────────────────────────────────────────

async function seedContentAnalyticsEvents() {
  const events: { contentId: string; eventType: string; metadata: object }[] = [
    { contentId: contentIds.welcomePost, eventType: "view", metadata: { userId: userIds.dave, source: "web" } },
    { contentId: contentIds.welcomePost, eventType: "view", metadata: { userId: userIds.bob, source: "web" } },
    { contentId: contentIds.welcomePost, eventType: "view", metadata: { userId: userIds.carol, source: "mobile" } },
    { contentId: contentIds.welcomePost, eventType: "like", metadata: { userId: userIds.dave } },
    { contentId: contentIds.welcomePost, eventType: "like", metadata: { userId: userIds.bob } },
    { contentId: contentIds.welcomePost, eventType: "share", metadata: { userId: userIds.dave, channel: "email" } },
    { contentId: contentIds.welcomePost, eventType: "reading_time", metadata: { userId: userIds.dave, seconds: 145 } },
    { contentId: contentIds.welcomePost, eventType: "reading_time", metadata: { userId: userIds.bob, seconds: 200 } },
    { contentId: contentIds.engineeringUpdate, eventType: "view", metadata: { userId: userIds.bob, source: "web" } },
    { contentId: contentIds.engineeringUpdate, eventType: "view", metadata: { userId: userIds.carol, source: "web" } },
    { contentId: contentIds.engineeringUpdate, eventType: "view", metadata: { userId: userIds.alice, source: "web" } },
    { contentId: contentIds.engineeringUpdate, eventType: "like", metadata: { userId: userIds.bob } },
    { contentId: contentIds.engineeringUpdate, eventType: "bookmark", metadata: { userId: userIds.carol } },
    { contentId: contentIds.engineeringUpdate, eventType: "reading_time", metadata: { userId: userIds.bob, seconds: 340 } },
    { contentId: contentIds.releaseNotes, eventType: "view", metadata: { userId: userIds.dave, source: "email" } },
    { contentId: contentIds.releaseNotes, eventType: "view", metadata: { userId: userIds.alice, source: "web" } },
  ];

  // contentAnalyticsEvent may not be in generated client yet; use raw insert
  for (const e of events) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO content_analytics_events (id, "contentId", "eventType", metadata, "createdAt")
       VALUES ($1, $2, $3, $4::jsonb, NOW())`,
      randomUUID(), e.contentId, e.eventType, JSON.stringify(e.metadata),
    );
  }
  console.log(`  ✔ ${events.length} content analytics events`);
}

// ── Reviews ─────────────────────────────────────────────────────────────────

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

async function seedReviewComments() {
  const comments: {
    body: string;
    assignmentKey: string;
    authorKey: string;
  }[] = [
    { body: "The introduction paragraph could be more concise. Consider trimming the first two sentences into one.", assignmentKey: "welcomeBob", authorKey: "bob" },
    { body: "I noticed the analytics bullet point mentions dashboards — are those ready for launch?", assignmentKey: "welcomeCarol", authorKey: "carol" },
    { body: "Good catch on the typo. I've noted it for the next revision.", assignmentKey: "welcomeCarol", authorKey: "admin" },
    { body: "The code structure section is very helpful. Could you also add a section on testing conventions?", assignmentKey: "frontendBob", authorKey: "bob" },
    { body: "Section 4 on interview guidelines needs a note about remote interview accommodations.", assignmentKey: "hiringCarol", authorKey: "carol" },
  ];

  for (const c of comments) {
    const reviewAssignmentId = reviewAssignmentIds[c.assignmentKey];
    const authorId = userIds[c.authorKey];
    await prisma.reviewComment.create({
      data: { body: c.body, reviewAssignmentId, authorId },
    });
  }
  console.log(`  ✔ ${comments.length} review comments`);
}

// ── Audit logs & outbox ─────────────────────────────────────────────────────

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
    {
      action: "CREATE", resource: "TEMPLATE", resourceId: templateIds.blogPost,
      newValue: { name: "Blog Post", status: "ACTIVE" },
      ipAddress: "192.168.1.10", userAgent: "Mozilla/5.0 (Admin Panel)", actorId: userIds.admin,
    },
    {
      action: "CREATE", resource: "TEMPLATE", resourceId: templateIds.announcement,
      newValue: { name: "Announcement", status: "ACTIVE" },
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

  // Foundation
  await seedUsers();
  await seedRoles();
  await seedPermissions();
  await seedUserRoles();
  await seedGroups();
  await seedGroupMemberships();
  await seedWorkspaces();
  await seedTags();
  await seedChannels();

  // Templates & components (before content so content can reference templates)
  await seedTemplates();
  await seedTemplateTranslations();
  await seedTemplateChannelBindings();
  await seedTemplateFormattingRules();
  await seedComponents();
  await seedComponentVersions();
  await seedTemplateLayoutSections();

  // Content with TipTap bodies
  await seedContent();
  await seedContentVersions();
  await seedContentTags();
  await seedContentCoAuthors();
  await seedContentCitations();
  await seedContentSnapshots();
  await seedContentAnalyticsEvents();

  // Reviews
  await seedReviewRequests();
  await seedReviewAssignments();
  await seedReviewDecisions();
  await seedReviewComments();

  // Operational
  await seedAuditLogs();
  await seedOutboxEvents();

  console.log("\nSeed complete ✔");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
