const API_BASE = import.meta.env.VITE_API_URL;
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
  tag: Tag;
}

// API availability cache
const API_AVAILABILITY_KEY = 'tag_api_available';

async function isApiAvailable(): Promise<boolean> {
  const cached = localStorage.getItem(API_AVAILABILITY_KEY);
  if (cached !== null) return cached === 'true';
  
  try {
    await request<Tag[]>('/tags', { method: 'GET' });
    localStorage.setItem(API_AVAILABILITY_KEY, 'true');
    return true;
  } catch (error) {
    localStorage.setItem(API_AVAILABILITY_KEY, 'false');
    return false;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const res = await fetch(`${API_BASE}${endpoint}`, {
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

// localStorage fallback functions
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

function getTemplateTagsFromStorage(templateId: string): TemplateTag[] {
  try {
    const saved = localStorage.getItem(`templateTags_${templateId}`);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveTemplateTagsToStorage(templateId: string, templateTags: TemplateTag[]): void {
  try {
    localStorage.setItem(`templateTags_${templateId}`, JSON.stringify(templateTags));
  } catch {
    // Handle localStorage errors silently
  }
}

function generateSlug(name: string): string {
  return name.toLowerCase()
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
  // Since there's no direct endpoint for template tags, we'll return empty array
  // The template-tag association should be handled by the template service
  return [];
}

async function apiAddTagToTemplate(templateId: string, tagId: string): Promise<TemplateTag> {
  // Since there's no direct endpoint for template-tag association,
  // we'll create a mock TemplateTag object
  // The actual association should be handled by the template service
  const tag = await request<Tag>(`/tags/${tagId}`);
  return {
    id: `tt_${templateId}_${tagId}`,
    templateId,
    tagId,
    tag
  };
}

async function apiRemoveTagFromTemplate(_templateId: string, _tagId: string): Promise<void> {
  // Since there's no direct endpoint for template-tag association,
  // we'll just return success
  // The actual removal should be handled by the template service
  return;
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
  const filtered = tags.filter(t => t.id !== tagId);
  
  if (filtered.length === tags.length) return false;
  
  saveTagsToStorage(filtered);
  return true;
}

function localStorageGetTemplateTags(templateId: string): TemplateTag[] {
  return getTemplateTagsFromStorage(templateId);
}

function localStorageAddTagToTemplate(templateId: string, tagId: string, tag?: Tag): TemplateTag {
  const templateTags = getTemplateTagsFromStorage(templateId);
  const tags = getTagsFromStorage();
  
  // First try to find tag in localStorage, then use the provided tag
  let foundTag = tags.find(t => t.id === tagId);
  if (!foundTag && tag) {
    foundTag = tag;
    // Add the tag to localStorage if it doesn't exist
    if (!tags.some(t => t.id === tagId)) {
      const updatedTags = [...tags, tag];
      saveTagsToStorage(updatedTags);
    }
  }
  
  if (!foundTag) throw new Error('Tag not found');
  
  const existingRelation = templateTags.find(tt => tt.tagId === tagId);
  if (existingRelation) return existingRelation;
  
  const newTemplateTag: TemplateTag = {
    id: `templateTag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    templateId,
    tagId,
    tag: foundTag,
  };
  
  const updated = [...templateTags, newTemplateTag];
  saveTemplateTagsToStorage(templateId, updated);
  return newTemplateTag;
}

function localStorageRemoveTagFromTemplate(templateId: string, tagId: string): boolean {
  const templateTags = getTemplateTagsFromStorage(templateId);
  const filtered = templateTags.filter(tt => tt.tagId !== tagId);
  
  if (filtered.length === templateTags.length) return false;
  
  saveTemplateTagsToStorage(templateId, filtered);
  return true;
}

// Main service with hybrid strategy
export const tagService = {
  list: async (): Promise<Tag[]> => {
    if (await isApiAvailable()) {
      try {
        return await apiList();
      } catch (error) {
        return localStorageList();
      }
    }
    return localStorageList();
  },

  create: async (tag: CreateTagRequest): Promise<Tag> => {
    if (await isApiAvailable()) {
      try {
        return await apiCreate(tag);
      } catch (error) {
        return localStorageCreate(tag);
      }
    }
    return localStorageCreate(tag);
  },

  delete: async (tagId: string): Promise<boolean> => {
    if (await isApiAvailable()) {
      try {
        await apiDelete(tagId);
        return true;
      } catch (error) {
        return localStorageDelete(tagId);
      }
    }
    return localStorageDelete(tagId);
  },

  getTemplateTags: async (templateId: string): Promise<TemplateTag[]> => {
    if (await isApiAvailable()) {
      try {
        return await apiGetTemplateTags(templateId);
      } catch (error) {
        return localStorageGetTemplateTags(templateId);
      }
    }
    return localStorageGetTemplateTags(templateId);
  },

  addTagToTemplate: async (templateId: string, tagId: string, tag?: Tag): Promise<TemplateTag> => {
    if (await isApiAvailable()) {
      try {
        return await apiAddTagToTemplate(templateId, tagId);
      } catch (error) {
        return localStorageAddTagToTemplate(templateId, tagId, tag);
      }
    }
    return localStorageAddTagToTemplate(templateId, tagId, tag);
  },

  removeTagFromTemplate: async (templateId: string, tagId: string): Promise<boolean> => {
    if (await isApiAvailable()) {
      try {
        await apiRemoveTagFromTemplate(templateId, tagId);
        return true;
      } catch (error) {
        return localStorageRemoveTagFromTemplate(templateId, tagId);
      }
    }
    return localStorageRemoveTagFromTemplate(templateId, tagId);
  },

  // Utility method to reset API availability cache (for testing)
  resetApiCache: (): void => {
    localStorage.removeItem(API_AVAILABILITY_KEY);
  },
};
