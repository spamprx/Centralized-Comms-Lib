CREATE TABLE "template_clusters" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "template_clusters_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "template_tags" (
    "id" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "templateId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "template_tags_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "templates" ADD COLUMN "clusterId" TEXT;

CREATE UNIQUE INDEX "template_clusters_workspaceId_name_key" ON "template_clusters"("workspaceId", "name");
CREATE INDEX "template_clusters_workspaceId_updatedAt_idx" ON "template_clusters"("workspaceId", "updatedAt");
CREATE UNIQUE INDEX "template_tags_templateId_tagId_key" ON "template_tags"("templateId", "tagId");
CREATE INDEX "template_tags_tagId_assignedAt_idx" ON "template_tags"("tagId", "assignedAt");
CREATE INDEX "templates_clusterId_idx" ON "templates"("clusterId");

ALTER TABLE "template_clusters" ADD CONSTRAINT "template_clusters_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "template_tags" ADD CONSTRAINT "template_tags_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "template_tags" ADD CONSTRAINT "template_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "templates" ADD CONSTRAINT "templates_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "template_clusters"("id") ON DELETE SET NULL ON UPDATE CASCADE;
