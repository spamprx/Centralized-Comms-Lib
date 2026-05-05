import { Prisma } from "@prisma/client";

import type { ComponentRegistryRepository } from "../../interfaces/componentRegistryRepository";
import type {
  ComponentLibraryRecord,
  ComponentRecord,
  ComponentVersionRecord,
} from "../../types";
import type { PrismaDb } from "./prismaTypes";

function toComponent(row: {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: "CONTENT" | "MEDIA" | "CTA" | "LEGAL" | "OTHER";
  createdAt: Date;
  updatedAt: Date;
}): ComponentRecord {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    category: row.category,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toVersion(row: {
  id: string;
  componentId: string;
  version: string;
  bodyJson: unknown;
  linkRefs: unknown;
  propSchema: unknown;
  createdAt: Date;
}): ComponentVersionRecord {
  return {
    id: row.id,
    componentId: row.componentId,
    version: row.version,
    bodyJson: row.bodyJson ?? null,
    linkRefs: row.linkRefs,
    propSchema: row.propSchema ?? null,
    createdAt: row.createdAt,
  };
}

export class PrismaComponentRegistryRepository implements ComponentRegistryRepository {
  public constructor(private readonly db: PrismaDb) {}

  async createComponent(input: {
    key: string;
    name: string;
    description?: string | null;
    category?: "CONTENT" | "MEDIA" | "CTA" | "LEGAL" | "OTHER";
  }): Promise<ComponentRecord> {
    const row = await this.db.component.create({
      data: {
        key: input.key,
        name: input.name,
        description: input.description ?? null,
        category: input.category ?? "OTHER",
      },
    });
    return toComponent(row);
  }

  async getComponentById(id: string): Promise<ComponentRecord | null> {
    const row = await this.db.component.findUnique({ where: { id } });
    return row ? toComponent(row) : null;
  }

  async getComponentByKey(key: string): Promise<ComponentRecord | null> {
    const row = await this.db.component.findUnique({ where: { key } });
    return row ? toComponent(row) : null;
  }

  async listComponents(): Promise<ComponentRecord[]> {
    const rows = await this.db.component.findMany({ orderBy: { key: "asc" } });
    return rows.map(toComponent);
  }

  async listComponentsWithLatestVersion(input?: {
    category?: "CONTENT" | "MEDIA" | "CTA" | "LEGAL" | "OTHER";
  }): Promise<ComponentLibraryRecord[]> {
    const rows = await this.db.component.findMany({
      where: input?.category ? { category: input.category } : undefined,
      orderBy: { key: "asc" },
      include: {
        versions: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });
    return rows.map((row) => {
      const c = toComponent(row);
      const v = row.versions[0];
      return {
        ...c,
        latestVersion: v
          ? {
              id: v.id,
              version: v.version,
              bodyJson:
                v.bodyJson === null || v.bodyJson === undefined
                  ? null
                  : (v.bodyJson as unknown),
            }
          : null,
      };
    });
  }

  async createVersion(input: {
    componentId: string;
    version: string;
    bodyJson?: unknown | null;
    linkRefs?: unknown;
    propSchema?: unknown | null;
  }): Promise<ComponentVersionRecord> {
    const row = await this.db.componentVersion.create({
      data: {
        componentId: input.componentId,
        version: input.version,
        bodyJson:
          input.bodyJson === undefined
            ? undefined
            : input.bodyJson === null
              ? Prisma.JsonNull
              : (input.bodyJson as Prisma.InputJsonValue),
        linkRefs: (input.linkRefs ?? []) as object,
        propSchema:
          input.propSchema === undefined
            ? undefined
            : input.propSchema === null
              ? Prisma.JsonNull
              : (input.propSchema as Prisma.InputJsonValue),
      },
    });
    return toVersion(row);
  }

  async getVersionById(id: string): Promise<ComponentVersionRecord | null> {
    const row = await this.db.componentVersion.findUnique({ where: { id } });
    return row ? toVersion(row) : null;
  }

  async listVersionsForComponent(
    componentId: string,
  ): Promise<ComponentVersionRecord[]> {
    const rows = await this.db.componentVersion.findMany({
      where: { componentId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toVersion);
  }

  async updateVersionBodyJson(
    versionId: string,
    bodyJson: unknown | null,
  ): Promise<ComponentVersionRecord> {
    const row = await this.db.componentVersion.update({
      where: { id: versionId },
      data: {
        bodyJson:
          bodyJson === null
            ? Prisma.JsonNull
            : (bodyJson as Prisma.InputJsonValue),
      },
    });
    return toVersion(row);
  }
}
