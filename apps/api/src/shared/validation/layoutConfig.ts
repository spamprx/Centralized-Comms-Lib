/**
 * Validates template layout JSON: versioned schema with typed regions.
 */
export interface LayoutRegion {
  id: string;
  type: string;
  props?: Record<string, unknown>;
}

export interface LayoutConfig {
  version: number;
  regions: LayoutRegion[];
}

export function parseAndValidateLayoutConfig(raw: unknown): LayoutConfig | null {
  if (raw == null) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.version !== "number" || !Number.isInteger(o.version) || o.version < 1) {
    return null;
  }
  if (!Array.isArray(o.regions)) return null;
  for (const r of o.regions) {
    if (!r || typeof r !== "object" || Array.isArray(r)) return null;
    const reg = r as Record<string, unknown>;
    if (typeof reg.id !== "string" || !reg.id.trim()) return null;
    if (typeof reg.type !== "string" || !reg.type.trim()) return null;
    if (reg.props != null && (typeof reg.props !== "object" || Array.isArray(reg.props))) {
      return null;
    }
  }
  return o as unknown as LayoutConfig;
}

export function assertLayoutConfig(raw: unknown): LayoutConfig {
  const parsed = parseAndValidateLayoutConfig(raw);
  if (!parsed) {
    throw new Error("Invalid layout config: expected { version: int >= 1, regions: [{ id, type, props? }] }");
  }
  return parsed;
}
