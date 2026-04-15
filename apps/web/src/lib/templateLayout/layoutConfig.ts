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

function parseRegionsFromCellRaw(raw: Record<string, unknown>): TemplateLayoutRegion[] | null {
  if (Array.isArray(raw.regions)) {
    const regions: TemplateLayoutRegion[] = [];
    for (const r of raw.regions) {
      if (!isRegion(r)) return null;
      regions.push(r);
    }
    if (regions.length === 0) return null;
    return regions;
  }
  if (raw.region != null && isRegion(raw.region)) {
    return [raw.region];
  }
  return null;
}

function parseCell(raw: unknown): LayoutCell | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== 'string' || !raw.id.trim()) return null;
  const fg = raw.flexGrow;
  if (typeof fg !== 'number' || !Number.isFinite(fg) || fg <= 0) return null;
  const regions = parseRegionsFromCellRaw(raw);
  if (!regions) return null;
  return { id: raw.id, flexGrow: fg, regions };
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
        regions: [region],
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

/** Total blocks (regions) across all cells */
export function layoutRegionCount(config: TemplateLayoutConfig | null): number {
  return flattenRegions(config).length;
}

/** @deprecated Prefer layoutRegionCount — counts table cells (columns), not stacked blocks */
export function layoutCellCount(config: TemplateLayoutConfig | null): number {
  if (!config?.rows?.length) return 0;
  return config.rows.reduce((n, row) => n + row.cells.length, 0);
}

export function flattenRegions(config: TemplateLayoutConfig | null): TemplateLayoutRegion[] {
  if (!config?.rows?.length) return [];
  const out: TemplateLayoutRegion[] = [];
  for (const row of config.rows) {
    for (const cell of row.cells) {
      for (const r of cell.regions) {
        out.push(r);
      }
    }
  }
  return out;
}

export type RegionPosition = { rowIndex: number; cellIndex: number; regionIndex: number };

export function findRegionPosition(rows: LayoutRow[], regionId: string): RegionPosition | null {
  for (let ri = 0; ri < rows.length; ri++) {
    const cells = rows[ri].cells;
    for (let ci = 0; ci < cells.length; ci++) {
      const regs = cells[ci].regions;
      for (let rgi = 0; rgi < regs.length; rgi++) {
        if (regs[rgi].id === regionId) return { rowIndex: ri, cellIndex: ci, regionIndex: rgi };
      }
    }
  }
  return null;
}

/** @deprecated use findRegionPosition */
export function findCellForRegion(
  rows: LayoutRow[],
  regionId: string,
): { rowIndex: number; cellIndex: number } | null {
  const p = findRegionPosition(rows, regionId);
  return p ? { rowIndex: p.rowIndex, cellIndex: p.cellIndex } : null;
}

export function mapRegion(
  rows: LayoutRow[],
  regionId: string,
  mapFn: (r: TemplateLayoutRegion) => TemplateLayoutRegion,
): LayoutRow[] {
  const pos = findRegionPosition(rows, regionId);
  if (!pos) return rows;
  return rows.map((row, ri) => {
    if (ri !== pos.rowIndex) return row;
    return {
      ...row,
      cells: row.cells.map((cell, ci) => {
        if (ci !== pos.cellIndex) return cell;
        return {
          ...cell,
          regions: cell.regions.map((r, rgi) => (rgi === pos.regionIndex ? mapFn(r) : r)),
        };
      }),
    };
  });
}

export function removeRegionFromRows(rows: LayoutRow[], regionId: string): LayoutRow[] {
  const pos = findRegionPosition(rows, regionId);
  if (!pos) return rows;
  return rows
    .map((row, ri) => {
      if (ri !== pos.rowIndex) return row;
      const nextCells = row.cells
        .map((cell, ci) => {
          if (ci !== pos.cellIndex) return cell;
          const nextRegs = cell.regions.filter((r) => r.id !== regionId);
          return { ...cell, regions: nextRegs };
        })
        .filter((cell) => cell.regions.length > 0);
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
    cells: [{ id: crypto.randomUUID(), flexGrow: 1, regions: [region] }],
  };
  return [...rows, row];
}

export function addColumnToRow(
  rows: LayoutRow[],
  rowId: string,
  region: TemplateLayoutRegion,
): LayoutRow[] {
  return rows.map((row) => {
    if (row.id !== rowId) return row;
    const cell: LayoutCell = {
      id: crypto.randomUUID(),
      flexGrow: 1,
      regions: [region],
    };
    return { ...row, cells: [...row.cells, cell] };
  });
}

/** Stack another block inside an existing column (same CSS grid track). */
export function addRegionToCell(
  rows: LayoutRow[],
  rowId: string,
  cellId: string,
  region: TemplateLayoutRegion,
): LayoutRow[] {
  return rows.map((row) => {
    if (row.id !== rowId) return row;
    return {
      ...row,
      cells: row.cells.map((cell) =>
        cell.id === cellId ? { ...cell, regions: [...cell.regions, region] } : cell,
      ),
    };
  });
}

/** Set every column in a row to equal fr share (simple “balanced grid”). */
export function equalizeRowColumns(rows: LayoutRow[], rowId: string): LayoutRow[] {
  return rows.map((row) => {
    if (row.id !== rowId) return row;
    if (row.cells.length < 2) return row;
    return {
      ...row,
      cells: row.cells.map((c) => ({ ...c, flexGrow: 1 })),
    };
  });
}

/** Editor: fr tracks + fixed gutters for column resize handles */
export function rowGridTemplateColumns(cells: LayoutCell[], gutterPx = 12): string {
  if (cells.length === 0) return '';
  const parts: string[] = [];
  for (let i = 0; i < cells.length; i++) {
    parts.push(`minmax(0,${cells[i].flexGrow}fr)`);
    if (i < cells.length - 1) parts.push(`${gutterPx}px`);
  }
  return parts.join(' ');
}

/** Preview / read-only: same proportions, no resize gutters */
export function previewRowGridTemplateColumns(cells: LayoutCell[]): string {
  if (cells.length === 0) return '';
  return cells.map((c) => `minmax(0,${c.flexGrow}fr)`).join(' ');
}
