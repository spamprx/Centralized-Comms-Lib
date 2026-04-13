import type {
  LayoutCell,
  LayoutRow,
  TemplateLayoutConfig,
  TemplateLayoutRegion,
} from '../../services/templateCrudService';

export const LAYOUT_VERSION = 2;

/** Minimum flex share when resizing columns (relative units) */
export const MIN_CELL_FLEX = 0.12;

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function isRegion(v: unknown): v is TemplateLayoutRegion {
  if (!isRecord(v)) return false;
  if (typeof v.id !== 'string' || !v.id.trim()) return false;
  if (typeof v.type !== 'string' || !v.type.trim()) return false;
  if (v.props != null && (typeof v.props !== 'object' || Array.isArray(v.props))) return false;
  return true;
}

function parseCell(raw: unknown): LayoutCell | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== 'string' || !raw.id.trim()) return null;
  const fg = raw.flexGrow;
  if (typeof fg !== 'number' || !Number.isFinite(fg) || fg <= 0) return null;
  if (!isRegion(raw.region)) return null;
  return { id: raw.id, flexGrow: fg, region: raw.region };
}

function parseRow(raw: unknown): LayoutRow | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== 'string' || !raw.id.trim()) return null;
  if (!Array.isArray(raw.cells) || raw.cells.length === 0) return null;
  const cells: LayoutCell[] = [];
  for (const c of raw.cells) {
    const cell = parseCell(c);
    if (!cell) return null;
    cells.push(cell);
  }
  return { id: raw.id, cells };
}

function migrateRegionsToRows(regions: TemplateLayoutRegion[]): LayoutRow[] {
  return regions.map((region) => ({
    id: `row_${region.id}`,
    cells: [
      {
        id: `cell_${region.id}`,
        flexGrow: 1,
        region,
      },
    ],
  }));
}

/**
 * Parse persisted layout JSON. Supports v1 flat `regions` and v2 `rows`.
 * Returns null if invalid.
 */
export function parseTemplateLayout(raw: unknown): TemplateLayoutConfig | null {
  if (raw == null || !isRecord(raw)) return null;
  const version = raw.version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) return null;

  if (Array.isArray(raw.rows)) {
    if (raw.rows.length === 0) {
      return { version: LAYOUT_VERSION, rows: [] };
    }
    const rows: LayoutRow[] = [];
    for (const r of raw.rows) {
      const row = parseRow(r);
      if (!row) return null;
      rows.push(row);
    }
    return { version: LAYOUT_VERSION, rows };
  }

  if (Array.isArray(raw.regions)) {
    const regions: TemplateLayoutRegion[] = [];
    for (const r of raw.regions) {
      if (!isRegion(r)) return null;
      regions.push(r);
    }
    return { version: LAYOUT_VERSION, rows: migrateRegionsToRows(regions) };
  }

  return null;
}

export function layoutCellCount(config: TemplateLayoutConfig | null): number {
  if (!config?.rows?.length) return 0;
  return config.rows.reduce((n, row) => n + row.cells.length, 0);
}

export function flattenRegions(config: TemplateLayoutConfig | null): TemplateLayoutRegion[] {
  if (!config?.rows?.length) return [];
  const out: TemplateLayoutRegion[] = [];
  for (const row of config.rows) {
    for (const cell of row.cells) {
      out.push(cell.region);
    }
  }
  return out;
}

export function findCellForRegion(
  rows: LayoutRow[],
  regionId: string,
): { rowIndex: number; cellIndex: number } | null {
  for (let ri = 0; ri < rows.length; ri++) {
    const cells = rows[ri].cells;
    for (let ci = 0; ci < cells.length; ci++) {
      if (cells[ci].region.id === regionId) return { rowIndex: ri, cellIndex: ci };
    }
  }
  return null;
}

export function mapRegion(
  rows: LayoutRow[],
  regionId: string,
  mapFn: (r: TemplateLayoutRegion) => TemplateLayoutRegion,
): LayoutRow[] {
  const pos = findCellForRegion(rows, regionId);
  if (!pos) return rows;
  return rows.map((row, ri) => {
    if (ri !== pos.rowIndex) return row;
    return {
      ...row,
      cells: row.cells.map((cell, ci) =>
        ci === pos.cellIndex ? { ...cell, region: mapFn(cell.region) } : cell,
      ),
    };
  });
}

export function removeRegionFromRows(rows: LayoutRow[], regionId: string): LayoutRow[] {
  const pos = findCellForRegion(rows, regionId);
  if (!pos) return rows;
  return rows
    .map((row, ri) => {
      if (ri !== pos.rowIndex) return row;
      const nextCells = row.cells.filter((c) => c.region.id !== regionId);
      if (nextCells.length === 0) return null;
      if (nextCells.length === 1) {
        return { ...row, cells: [{ ...nextCells[0], flexGrow: 1 }] };
      }
      return { ...row, cells: nextCells };
    })
    .filter((r): r is LayoutRow => r !== null);
}

export function addRowWithRegion(rows: LayoutRow[], region: TemplateLayoutRegion): LayoutRow[] {
  const row: LayoutRow = {
    id: crypto.randomUUID(),
    cells: [{ id: crypto.randomUUID(), flexGrow: 1, region }],
  };
  return [...rows, row];
}

export function addColumnToRow(rows: LayoutRow[], rowId: string, region: TemplateLayoutRegion): LayoutRow[] {
  return rows.map((row) => {
    if (row.id !== rowId) return row;
    const cell: LayoutCell = {
      id: crypto.randomUUID(),
      flexGrow: 1,
      region,
    };
    return { ...row, cells: [...row.cells, cell] };
  });
}
