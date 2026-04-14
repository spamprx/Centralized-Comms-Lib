import { Tag } from "../types";

export interface TagRepository {
  getById(id: string): Promise<Tag | null>;
  getBySlug(slug: string): Promise<Tag | null>;
  getByName(name: string): Promise<Tag | null>;
  list(): Promise<Tag[]>;
  create(input: {
    name: string;
    slug: string;
    parentId?: string | null;
  }): Promise<Tag>;
  delete(id: string): Promise<void>;
  assignToContent(contentId: string, tagId: string): Promise<void>;
  removeFromContent(contentId: string, tagId: string): Promise<void>;
  listForContent(contentId: string): Promise<Tag[]>;
}
