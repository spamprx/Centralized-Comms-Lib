import { resolveApiV1Base } from '../lib/apiBase';
const API_BASE = resolveApiV1Base();
import { csrfHeader } from './tokenStore';
import type { Tag } from './tagService';
import type { Binding } from './channelService';

export type TemplateStatus = 'active' | 'draft' | 'archived';

export interface Template {
  id: string;
  name: string;
  description: string;
  content: string;
  status: TemplateStatus;
  createdAt: string;
  updatedAt: string;
  tags?: Tag[];
  bindings?: Binding[];
}

export interface CreateTemplateRequest {
  name: string;
  description: string;
  content: string;
  status?: TemplateStatus;
}

export interface UpdateTemplateRequest {
  name?: string;
  description?: string;
  content?: string;
  status?: TemplateStatus;
}

// API availability cache
const API_AVAILABILITY_KEY = 'template_api_available';

async function isApiAvailable(): Promise<boolean> {
  // Check if we've already determined API availability
  const cached = localStorage.getItem(API_AVAILABILITY_KEY);
  if (cached !== null) return cached === 'true';

  try {
    // Try to make a simple API call to check availability
    await request<Template[]>('/templates', { method: 'GET' });
    localStorage.setItem(API_AVAILABILITY_KEY, 'true');
    return true;
  } catch (error) {
    localStorage.setItem(API_AVAILABILITY_KEY, 'false');
    return false;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...csrfHeader(method),
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
function getTemplatesFromStorage(): Template[] {
  try {
    const saved = localStorage.getItem('templates');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveTemplatesToStorage(templates: Template[]): void {
  try {
    localStorage.setItem('templates', JSON.stringify(templates));
  } catch {
    // Handle localStorage errors silently
  }
}

function generateCopyName(name: string, existingTemplates: Template[]): string {
  // Check if name already has (Copy) suffix
  const copyRegex = /^(.*) \(Copy(?: (\d+))?\)$/;
  const match = name.match(copyRegex);

  if (match) {
    // Already a copy, increment the number
    const baseName = match[1];
    const copyNumber = match[2] ? parseInt(match[2]) + 1 : 2;

    // Find the next available number
    let newName = `${baseName} (Copy ${copyNumber})`;
    let counter = copyNumber + 1;

    while (existingTemplates.some((t) => t.name === newName)) {
      newName = `${baseName} (Copy ${counter})`;
      counter++;
    }

    return newName;
  } else {
    // Original template, add (Copy)
    let newName = `${name} (Copy)`;
    let counter = 2;

    while (existingTemplates.some((t) => t.name === newName)) {
      newName = `${name} (Copy ${counter})`;
      counter++;
    }

    return newName;
  }
}

function createDeepCopy(template: Template): Template {
  return {
    ...template,
    id: `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: generateCopyName(template.name, getTemplatesFromStorage()),
    status: 'draft' as TemplateStatus,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: [...(template.tags || [])], // Copy tags array
  };
}

// API methods
async function apiList(): Promise<Template[]> {
  return request<Template[]>('/templates');
}

async function apiGetById(id: string): Promise<Template> {
  return request<Template>(`/templates/${id}`);
}

async function apiCreate(template: CreateTemplateRequest): Promise<Template> {
  return request<Template>('/templates', {
    method: 'POST',
    body: JSON.stringify(template),
  });
}

async function apiUpdate(id: string, template: UpdateTemplateRequest): Promise<Template> {
  return request<Template>(`/templates/${id}`, {
    method: 'POST',
    body: JSON.stringify(template),
  });
}

async function apiDelete(id: string): Promise<void> {
  return request<void>(`/templates/${id}`, {
    method: 'DELETE',
  });
}

async function apiClone(id: string): Promise<Template> {
  return request<Template>(`/templates/${id}/clone`, {
    method: 'POST',
  });
}

// localStorage methods
function localStorageList(): Template[] {
  return getTemplatesFromStorage();
}

function localStorageGetById(id: string): Template | null {
  const templates = getTemplatesFromStorage();
  return templates.find((t) => t.id === id) || null;
}

function localStorageCreate(template: CreateTemplateRequest): Template {
  const templates = getTemplatesFromStorage();
  const newTemplate: Template = {
    id: `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    ...template,
    status: template.status || 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: [],
  };

  const updated = [...templates, newTemplate];
  saveTemplatesToStorage(updated);
  return newTemplate;
}

function localStorageUpdate(id: string, updates: UpdateTemplateRequest): Template | null {
  const templates = getTemplatesFromStorage();
  const index = templates.findIndex((t) => t.id === id);

  if (index === -1) return null;

  const updated = {
    ...templates[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  templates[index] = updated;
  saveTemplatesToStorage(templates);
  return updated;
}

function localStorageDelete(id: string): boolean {
  const templates = getTemplatesFromStorage();
  const filtered = templates.filter((t) => t.id !== id);

  if (filtered.length === templates.length) return false;

  saveTemplatesToStorage(filtered);
  return true;
}

function localStorageClone(id: string): Template | null {
  const templates = getTemplatesFromStorage();
  const original = templates.find((t) => t.id === id);

  if (!original) return null;

  const cloned = createDeepCopy(original);
  // Clone the tags as well
  cloned.tags = [...(original.tags || [])];

  const updated = [...templates, cloned];
  saveTemplatesToStorage(updated);
  return cloned;
}

// Main service with hybrid strategy
export const templateService = {
  list: async (): Promise<Template[]> => {
    if (await isApiAvailable()) {
      try {
        return await apiList();
      } catch (error) {
        // Fallback to localStorage
        return localStorageList();
      }
    }
    return localStorageList();
  },

  getById: async (id: string): Promise<Template | null> => {
    if (await isApiAvailable()) {
      try {
        return await apiGetById(id);
      } catch (error) {
        // Fallback to localStorage
        return localStorageGetById(id);
      }
    }
    return localStorageGetById(id);
  },

  create: async (template: CreateTemplateRequest): Promise<Template> => {
    if (await isApiAvailable()) {
      try {
        return await apiCreate(template);
      } catch (error) {
        // Fallback to localStorage
        return localStorageCreate(template);
      }
    }
    return localStorageCreate(template);
  },

  update: async (id: string, template: UpdateTemplateRequest): Promise<Template | null> => {
    if (await isApiAvailable()) {
      try {
        return await apiUpdate(id, template);
      } catch (error) {
        // Fallback to localStorage
        return localStorageUpdate(id, template);
      }
    }
    return localStorageUpdate(id, template);
  },

  delete: async (id: string): Promise<boolean> => {
    if (await isApiAvailable()) {
      try {
        await apiDelete(id);
        return true;
      } catch (error) {
        // Fallback to localStorage
        return localStorageDelete(id);
      }
    }
    return localStorageDelete(id);
  },

  clone: async (id: string): Promise<Template | null> => {
    if (await isApiAvailable()) {
      try {
        return await apiClone(id);
      } catch (error) {
        // Fallback to localStorage
        return localStorageClone(id);
      }
    }
    return localStorageClone(id);
  },

  // Utility method to reset API availability cache (for testing)
  resetApiCache: (): void => {
    localStorage.removeItem(API_AVAILABILITY_KEY);
  },
};
