export type BatchRecipientRow = {
  user_id: string;
  wa_number: string;
  field_values: Record<string, string>;
};

/** RFC4180-style line split (handles quoted fields and doubled quotes). */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
        continue;
      }
      inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur.trim());
  return out;
}

function requireCols(header: string[], names: string[]): Record<string, number> {
  const lower = header.map((h) => h.trim().toLowerCase());
  const out: Record<string, number> = {};
  for (const name of names) {
    const i = lower.indexOf(name.toLowerCase());
    if (i < 0) {
      throw new Error(`Missing required column: ${name}`);
    }
    out[name] = i;
  }
  return out;
}

/** CSV with header row: user_id, wa_number, and each token column. Quoted fields supported. */
export function parseRecipientsCsv(csvText: string, tokenKeys: string[]): BatchRecipientRow[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) {
    throw new Error('CSV needs a header row and at least one data row');
  }
  const header = splitCsvLine(lines[0]).map((h) => h.replace(/^"|"$/g, '').trim());
  const col = requireCols(header, ['user_id', 'wa_number', ...tokenKeys]);
  const rows: BatchRecipientRow[] = [];
  for (let li = 1; li < lines.length; li++) {
    const cols = splitCsvLine(lines[li]).map((c) => c.replace(/^"|"$/g, '').trim());
    const field_values: Record<string, string> = {};
    for (const k of tokenKeys) {
      const v = cols[col[k]] ?? '';
      field_values[k] = v;
    }
    rows.push({
      user_id: cols[col.user_id] ?? '',
      wa_number: cols[col.wa_number] ?? '',
      field_values,
    });
  }
  return rows;
}

export function parseRecipientsJson(jsonText: string, tokenKeys: string[]): BatchRecipientRow[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText) as unknown;
  } catch {
    throw new Error('Invalid JSON');
  }
  if (!Array.isArray(parsed)) {
    throw new Error('JSON must be an array of recipient objects');
  }
  const rows: BatchRecipientRow[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const user_id = String(o.user_id ?? '').trim();
    const wa_number = String(o.wa_number ?? '').trim();
    if (!user_id || !wa_number) {
      throw new Error('Each row must include user_id and wa_number');
    }
    const field_values: Record<string, string> = {};
    for (const k of tokenKeys) {
      if (o[k] === undefined || o[k] === null) {
        throw new Error(`Missing token field "${k}" on row for user_id=${user_id}`);
      }
      field_values[k] = String(o[k]).trim();
    }
    rows.push({ user_id, wa_number, field_values });
  }
  if (rows.length === 0) {
    throw new Error('No valid rows in JSON array');
  }
  return rows;
}
