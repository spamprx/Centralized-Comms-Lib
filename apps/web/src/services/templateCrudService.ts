import { getAuthToken } from './tokenStore';

const API_BASE = import.meta.env.VITE_API_URL;

export type TemplateStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export type TemplateRecord = {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  description: string | null;
  status: TemplateStatus;
  draftLayout: unknown;
  activeLayout: unknown;
  i18n: unknown;
  authorId: string;
  createdAt: string;
  updatedAt: string;
  bindings?: Array<{ id: string; channelId: string; createdAt: string }>;
};

type ListFilters = {
  search?: string;
  status?: TemplateStatus | 'ALL';
};

export type CreateTemplateInput = {
  name: string;
  description?: string;
  draftLayout?: unknown;
};

export type UpdateTemplateInput = {
  name?: string;
  description?: string | null;
  slug?: string;
  status?: TemplateStatus;
};

/** Matches API shared/validation/layoutConfig.ts */
export type TemplateLayoutRegion = {
  id: string;
  type: string;
  props?: Record<string, unknown>;
};

/** One resizable column within a row (side-by-side with other cells). */
export type LayoutCell = {
  id: string;
  /** Relative width; rendered as CSS grid `fr` tracks */
  flexGrow: number;
  /** Blocks stacked top → bottom in this column (two+ = “left column, two rows”). */
  regions: TemplateLayoutRegion[];
};

export type LayoutRow = {
  id: string;
  cells: LayoutCell[];
};

export type TemplateLayoutConfig = {
  version: number;
  /** v2+: rows of cells; legacy flat `regions` is migrated when parsing */
  rows: LayoutRow[];
};

export type ChannelRecord = {
  id: string;
  name: string;
  key: string;
  description: string;
  createdAt: string;
  updatedAt: string;
};

export type TemplateBindingRecord = {
  id: string;
  templateId: string;
  channelId: string;
  createdAt: string;
};

export type TemplateI18nTable = {
  templateId: string;
  defaultLocale: string;
  requiredLocales: string[];
  keys: string[];
  translations: Record<string, Record<string, string>>;
};

export type TemplateI18nResolvedValue = {
  templateId: string;
  key: string;
  locale: string;
  value: string | null;
  sourceLocale: string | null;
  usedFallback: boolean;
};

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

function matchesFilters(t: TemplateRecord, filters?: ListFilters): boolean {
  if (!filters) return true;
  const q = filters.search?.trim().toLowerCase();
  if (q) {
    const hay = `${t.name} ${t.slug} ${t.description ?? ''}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  if (filters.status && filters.status !== 'ALL' && t.status !== filters.status) return false;
  return true;
}

export const templateCrudService = {
  async list(filters?: ListFilters): Promise<TemplateRecord[]> {
    const rows = await request<TemplateRecord[]>('/templates');
    return rows.filter((t) => matchesFilters(t, filters));
  },

  async getById(id: string): Promise<TemplateRecord> {
    return request<TemplateRecord>(`/templates/${id}`);
  },

  async create(input: CreateTemplateInput): Promise<TemplateRecord> {
    return request<TemplateRecord>('/templates', {
      method: 'POST',
      body: JSON.stringify({
        name: input.name,
        description: input.description ?? null,
        draftLayout: input.draftLayout ?? null,
      }),
    });
  },

  async update(id: string, input: UpdateTemplateInput): Promise<TemplateRecord> {
    return request<TemplateRecord>(`/templates/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },

  async remove(id: string): Promise<void> {
    await request<{ message: string }>(`/templates/${id}`, {
      method: 'DELETE',
    });
  },

  async clone(id: string): Promise<TemplateRecord> {
    return request<TemplateRecord>(`/templates/${id}/clone`, {
      method: 'POST',
    });
  },

  async listChannels(): Promise<ChannelRecord[]> {
    return request<ChannelRecord[]>('/channels');
  },

  async addChannelBinding(
    templateId: string,
    input: { channelId: string; layoutConfig?: unknown },
  ): Promise<TemplateBindingRecord> {
    return request<TemplateBindingRecord>(`/templates/${templateId}/bindings`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async removeChannelBinding(templateId: string, bindingId: string): Promise<void> {
    await request<{ message: string }>(`/templates/${templateId}/bindings/${bindingId}`, {
      method: 'DELETE',
    });
  },

  async patchI18n(
    templateId: string,
    patch: Record<string, Record<string, string>>,
  ): Promise<TemplateRecord> {
    return request<TemplateRecord>(`/templates/${templateId}/i18n`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  },

  async getI18nTable(templateId: string): Promise<TemplateI18nTable> {
    return request<TemplateI18nTable>(`/templates/${templateId}/i18n`);
  },

  async resolveI18nValue(
    templateId: string,
    input: { locale: string; key: string },
  ): Promise<TemplateI18nResolvedValue> {
    const qs = new URLSearchParams({
      locale: input.locale,
      key: input.key,
    });
    return request<TemplateI18nResolvedValue>(`/templates/${templateId}/i18n/resolve?${qs.toString()}`);
  },

  async saveDraftLayout(templateId: string, layout: TemplateLayoutConfig): Promise<TemplateRecord> {
    return request<TemplateRecord>(`/templates/${templateId}/layout/draft`, {
      method: 'PATCH',
      body: JSON.stringify({ layout }),
    });
  },

  async activateTemplate(templateId: string): Promise<TemplateRecord> {
    return request<TemplateRecord>(`/templates/${templateId}/activate`, {
      method: 'POST',
    });
  },
};

