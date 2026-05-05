import { resolveApiV1Base } from '../lib/apiBase';
import { csrfHeader } from './tokenStore';

const API_BASE = resolveApiV1Base();

export type AssetPlacement = 'MY_ASSETS' | 'LIBRARY';

export type AssetCategoryApi =
  | 'image'
  | 'video'
  | 'document'
  | 'audio'
  | 'other';

export type AssetRecord = {
  id: string;
  ownerUserId: string;
  workspaceId: string | null;
  placement: AssetPlacement;
  category: AssetCategoryApi;
  bucket: string;
  objectKey: string;
  originalFilename: string | null;
  mimeType: string;
  sizeBytes: string | null;
  etag: string | null;
  sha256: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type UploadIntentResponse = {
  asset: AssetRecord;
  uploadUrl: string;
  expiresIn: number;
  headers: { 'Content-Type': string };
};

export type ViewLinkResponse = {
  url: string;
  expiresIn: number;
  expiresAt: string;
};

export type ShareLibraryLinkResponse = ViewLinkResponse;
export type LinkCheckRecord = {
  id: string;
  assetId: string;
  url: string;
  status: 'PENDING' | 'VALID' | 'BROKEN';
  httpStatusCode: number | null;
  errorMessage: string | null;
  checkedAt: string | null;
  updatedAt: string;
};

function joinApiUrl(endpoint: string): string {
  const base = API_BASE.endsWith('/') ? API_BASE.slice(0, -1) : API_BASE;
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${base}${path}`;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = joinApiUrl(endpoint);
  const method = (options.method ?? 'GET').toUpperCase();
  const hasBody = options.body !== undefined && options.body !== null && method !== 'GET';
  const res = await fetch(url, {
    headers: {
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...csrfHeader(method),
      ...options.headers,
    },
    credentials: 'include',
    ...options,
  });

  if (res.status === 204) {
    return undefined as T;
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Request failed' }));
    const baseMsg =
      typeof err.error === 'string'
        ? err.error
        : typeof err.message === 'string'
          ? err.message
          : `HTTP ${res.status}`;
    throw new Error(
      baseMsg === 'Route not found' || import.meta.env.DEV
        ? `${baseMsg} — ${method} ${url}`
        : baseMsg,
    );
  }

  return res.json() as Promise<T>;
}

/** Infer API category from browser File (MIME-first). */
export function inferAssetCategory(file: File): AssetCategoryApi {
  const t = file.type.trim().toLowerCase();
  if (t.startsWith('image/')) return 'image';
  if (t.startsWith('video/')) return 'video';
  if (t.startsWith('audio/')) return 'audio';
  if (
    t === 'application/pdf' ||
    t.includes('wordprocessing') ||
    t.includes('msword') ||
    t === 'text/plain'
  ) {
    return 'document';
  }
  return 'other';
}

export const assetService = {
  async list(params?: {
    placement?: AssetPlacement;
    category?: AssetCategoryApi;
    limit?: number;
    offset?: number;
  }): Promise<{ items: AssetRecord[]; total: number }> {
    const q = new URLSearchParams();
    if (params?.placement) q.set('placement', params.placement);
    if (params?.category) q.set('category', params.category);
    if (params?.limit !== undefined) q.set('limit', String(params.limit));
    if (params?.offset !== undefined) q.set('offset', String(params.offset));
    const qs = q.toString();
    return request(`/assets${qs ? `?${qs}` : ''}`);
  },

  async uploadIntent(body: {
    filename: string;
    mimeType: string;
    category: AssetCategoryApi;
    placement: AssetPlacement;
    sizeBytes?: number;
  }): Promise<UploadIntentResponse> {
    return request('/assets/upload-intent', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async finalize(assetId: string): Promise<{ asset: AssetRecord }> {
    return request(`/assets/${encodeURIComponent(assetId)}/finalize`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },

  async putToPresignedUrl(uploadUrl: string, file: File, contentType: string): Promise<void> {
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': contentType },
    });
    if (!res.ok) {
      throw new Error(`Upload failed (${res.status})`);
    }
  },

  async uploadFile(
    file: File,
    opts: { placement: AssetPlacement; category?: AssetCategoryApi },
  ): Promise<{ asset: AssetRecord; viewUrl: string }> {
    const category = opts.category ?? inferAssetCategory(file);
    const intent = await this.uploadIntent({
      filename: file.name,
      mimeType: file.type || 'application/octet-stream',
      category,
      placement: opts.placement,
      sizeBytes: file.size,
    });
    await this.putToPresignedUrl(intent.uploadUrl, file, intent.headers['Content-Type']);
    const fin = await this.finalize(intent.asset.id);
    const view = await this.getViewLink(fin.asset.id, 604800);
    return { asset: fin.asset, viewUrl: view.url };
  },

  async getViewLink(assetId: string, expiresInSeconds?: number): Promise<ViewLinkResponse> {
    const q =
      expiresInSeconds !== undefined ? `?expiresInSeconds=${expiresInSeconds}` : '';
    return request(`/assets/${encodeURIComponent(assetId)}/view-link${q}`);
  },

  async deleteAsset(assetId: string): Promise<void> {
    await request(`/assets/${encodeURIComponent(assetId)}`, { method: 'DELETE' });
  },

  async registerUsage(
    assetId: string,
    body: {
      targetType: 'CONTENT' | 'TEMPLATE' | 'OTHER';
      targetId: string;
      fieldPath?: string | null;
    },
  ): Promise<{ id: string }> {
    return request(`/assets/${encodeURIComponent(assetId)}/usages`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async shareLibraryLink(
    assetId: string,
    expiresInSeconds?: number,
  ): Promise<ShareLibraryLinkResponse> {
    return request(`/library/${encodeURIComponent(assetId)}/share-link`, {
      method: 'POST',
      body: JSON.stringify(
        expiresInSeconds !== undefined ? { expiresInSeconds } : {},
      ),
    });
  },

  async attachLinkChecks(assetId: string, urls: string[]): Promise<{ added: number }> {
    return request(`/assets/${encodeURIComponent(assetId)}/link-checks`, {
      method: 'POST',
      body: JSON.stringify({ urls }),
    });
  },

  async listLinkChecks(assetId: string): Promise<LinkCheckRecord[]> {
    return request(`/assets/${encodeURIComponent(assetId)}/link-checks`);
  },
};
