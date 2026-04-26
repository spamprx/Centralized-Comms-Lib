import { resolveApiV1Base } from '../lib/apiBase';
const API_BASE = resolveApiV1Base();
import { getAuthToken } from './tokenStore';

export interface Tag {
  id: string;
  name: string;
  slug: string;
}

export interface CreateTagRequest {
  name: string;
}

export interface TemplateTag {
  id: string;
  templateId: string;
  tagId: string;
  assignedAt?: string;
  tag: Tag;
}

const ENABLE_LOCAL_FALLBACK = String(import.meta.env.VITE_ENABLE_TAG_LOCAL_FALLBACK ?? 'false') === 'true';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const token = getAuthToken();
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    credentials: 'include',
    ...options,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(err.error || err.message || `HTTP ${res.status}`);
  }

  return res.json();
}

function getTagsFromStorage(): Tag[] {
  try {
    const saved = localStorage.getItem('tags');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveTagsToStorage(tags: Tag[]): void {
  try {
    localStorage.setItem('tags', JSON.stringify(tags));
  } catch {
    // Handle localStorage errors silently
  }
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

// API methods
async function apiList(): Promise<Tag[]> {
  return request<Tag[]>('/tags');
}

async function apiCreate(tag: CreateTagRequest): Promise<Tag> {
  return request<Tag>('/tags', {
    method: 'POST',
    body: JSON.stringify(tag),
  });
}

async function apiDelete(tagId: string): Promise<void> {
  return request<void>(`/tags/${tagId}`, {
    method: 'DELETE',
  });
}

async function apiGetTemplateTags(_templateId: string): Promise<TemplateTag[]> {
  return request<TemplateTag[]>(`/templates/${_templateId}/tags`);
}

async function apiAddTagToTemplate(templateId: string, tagId: string): Promise<TemplateTag> {
  return request<TemplateTag>(`/templates/${templateId}/tags`, {
    method: 'POST',
    body: JSON.stringify({ tagId }),
  });
}

async function apiRemoveTagFromTemplate(templateId: string, tagId: string): Promise<void> {
  return request<void>(`/templates/${templateId}/tags/${tagId}`, {
    method: 'DELETE',
  });
}

// localStorage methods
function localStorageList(): Tag[] {
  return getTagsFromStorage();
}

function localStorageCreate(tag: CreateTagRequest): Tag {
  const tags = getTagsFromStorage();
  const newTag: Tag = {
    id: `tag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: tag.name,
    slug: generateSlug(tag.name),
  };

  const updated = [...tags, newTag];
  saveTagsToStorage(updated);
  return newTag;
}

function localStorageDelete(tagId: string): boolean {
  const tags = getTagsFromStorage();
  const filtered = tags.filter((t) => t.id !== tagId);

  if (filtered.length === tags.length) return false;

  saveTagsToStorage(filtered);
  return true;
}

function localStorageAddTagToTemplate(templateId: string, tagId: string, tag?: Tag): TemplateTag {
  const tags = getTagsFromStorage();

  // First try to find tag in localStorage, then use the provided tag
  let foundTag = tags.find((t) => t.id === tagId);
  if (!foundTag && tag) {
    foundTag = tag;
    // Add the tag to localStorage if it doesn't exist
    if (!tags.some((t) => t.id === tagId)) {
      const updatedTags = [...tags, tag];
      saveTagsToStorage(updatedTags);
    }
  }

  if (!foundTag) throw new Error('Tag not found');

  return { id: `local_${templateId}_${tagId}`, templateId, tagId, tag: foundTag };
}

function localStorageRemoveTagFromTemplate(templateId: string, tagId: string): boolean {
  void templateId;
  void tagId;
  return true;
}

export const tagService = {
  list: async (): Promise<Tag[]> => {
    try {
      return await apiList();
    } catch (error) {
      if (ENABLE_LOCAL_FALLBACK) return localStorageList();
      throw error;
    }
  },

  create: async (tag: CreateTagRequest): Promise<Tag> => {
    try {
      return await apiCreate(tag);
    } catch (error) {
      if (ENABLE_LOCAL_FALLBACK) return localStorageCreate(tag);
      throw error;
    }
  },

  delete: async (tagId: string): Promise<boolean> => {
    try {
      await apiDelete(tagId);
      return true;
    } catch (error) {
      if (ENABLE_LOCAL_FALLBACK) return localStorageDelete(tagId);
      throw error;
    }
  },

  getTemplateTags: async (templateId: string): Promise<TemplateTag[]> => {
    return apiGetTemplateTags(templateId);
  },

  addTagToTemplate: async (templateId: string, tagId: string, tag?: Tag): Promise<TemplateTag> => {
    try {
      return await apiAddTagToTemplate(templateId, tagId);
    } catch (error) {
      if (ENABLE_LOCAL_FALLBACK) return localStorageAddTagToTemplate(templateId, tagId, tag);
      throw error;
    }
  },

  removeTagFromTemplate: async (templateId: string, tagId: string): Promise<boolean> => {
    try {
      await apiRemoveTagFromTemplate(templateId, tagId);
      return true;
    } catch (error) {
      if (ENABLE_LOCAL_FALLBACK) return localStorageRemoveTagFromTemplate(templateId, tagId);
      throw error;
    }
  },
};
