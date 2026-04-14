import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { EditorContent, useEditor } from '@tiptap/react';
import type { JSONContent } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Braces,
  CheckCircle,
  Columns2,
  Columns3,
  Eye,
  GripVertical,
  Image as ImageIcon,
  Loader2,
  Monitor,
  Plus,
  Save,
  Settings2,
  Smartphone,
  Text,
  Trash2,
  X,
} from 'lucide-react';
import {
  templateCrudService,
  type LayoutRow,
  type TemplateLayoutConfig,
  type TemplateLayoutRegion,
  type TemplateRecord,
} from '../../services/templateCrudService';
import {
  LAYOUT_VERSION,
  MIN_CELL_FLEX,
  addColumnToRow,
  addRegionToCell,
  addRowWithRegion,
  equalizeRowColumns,
  flattenRegions,
  layoutRegionCount,
  mapRegion,
  parseTemplateLayout,
  removeRegionFromRows,
  previewRowGridTemplateColumns,
  rowGridTemplateColumns,
} from '../../lib/templateLayout/layoutConfig';
import TemplateComponentPalette from './TemplateComponentPalette';
import {
  TextBlockModal,
  MediaBlockModal,
  FieldBlockModal,
  type TextBlockFormValues,
  type MediaBlockFormValues,
  type FieldBlockFormValues,
} from './TemplateBlockModals';

export { LAYOUT_VERSION, parseTemplateLayout } from '../../lib/templateLayout/layoutConfig';

export const REGION_TYPES = {
  richText: 'richText',
  media: 'media',
  field: 'field',
} as const;

function emptyDoc(): JSONContent {
  return { type: 'doc', content: [{ type: 'paragraph' }] };
}

function docFromSectionTitle(sectionTitle: string): JSONContent {
  const t = sectionTitle.trim();
  if (!t) return emptyDoc();
  return {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: t }] },
      { type: 'paragraph' },
    ],
  };
}

function ensureRichDoc(props: Record<string, unknown> | undefined): JSONContent {
  const doc = props?.doc;
  if (doc && typeof doc === 'object' && !Array.isArray(doc) && (doc as JSONContent).type === 'doc') {
    return doc as JSONContent;
  }
  return emptyDoc();
}

type RichTextEditorProps = {
  initialDoc: JSONContent;
  placeholder: string;
  onDocChange: (doc: JSONContent) => void;
};

function RichTextEditor({ initialDoc, placeholder, onDocChange }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: {
          rel: 'noopener noreferrer nofollow',
          target: '_blank',
        },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: initialDoc,
    onUpdate: ({ editor: ed }) => {
      onDocChange(ed.getJSON());
    },
    editorProps: {
      attributes: {
        class:
          'min-h-[132px] px-4 py-3 text-sm text-app-text leading-relaxed outline-none prose prose-invert max-w-none',
      },
    },
  });

  return <EditorContent editor={editor} />;
}

type SortableRegionProps = {
  region: TemplateLayoutRegion;
  onUpdateDoc: (id: string, doc: JSONContent) => void;
  onConfigure: (id: string) => void;
  onRemove: (id: string) => void;
};

function SortableRegionCard({ region, onUpdateDoc, onConfigure, onRemove }: SortableRegionProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: region.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const doc = region.type === REGION_TYPES.richText ? ensureRichDoc(region.props) : emptyDoc();
  const editorPlaceholder =
    region.type === REGION_TYPES.richText
      ? String((region.props as { editorPlaceholder?: string } | undefined)?.editorPlaceholder ?? 'Write section content…')
      : 'Write section content…';
  const sectionTitle =
    region.type === REGION_TYPES.richText
      ? String((region.props as { sectionTitle?: string } | undefined)?.sectionTitle ?? '').trim()
      : '';
  const fieldKey =
    region.type === REGION_TYPES.field
      ? String((region.props as { fieldKey?: string } | undefined)?.fieldKey ?? 'field_name')
      : '';
  const fieldLabel =
    region.type === REGION_TYPES.field
      ? String((region.props as { label?: string } | undefined)?.label ?? '')
      : '';
  const fieldHelp =
    region.type === REGION_TYPES.field
      ? String((region.props as { helpText?: string } | undefined)?.helpText ?? '')
      : '';
  const fieldRequired =
    region.type === REGION_TYPES.field
      ? Boolean((region.props as { required?: boolean } | undefined)?.required)
      : false;
  const mediaRole =
    region.type === REGION_TYPES.media
      ? String((region.props as { role?: string } | undefined)?.role ?? 'inline')
      : '';
  const mediaAlt =
    region.type === REGION_TYPES.media
      ? String((region.props as { alt?: string } | undefined)?.alt ?? '')
      : '';
  const mediaCaption =
    region.type === REGION_TYPES.media
      ? String((region.props as { caption?: string } | undefined)?.caption ?? '')
      : '';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-app-md border border-app-border bg-app-bg-subtle ${
        isDragging ? 'opacity-80 ring-1 ring-app-accent/40' : 'hover:border-app-accent/25'
      }`}
    >
      <div className="flex items-center gap-2 border-b border-white/[0.06] bg-black/15 px-3 py-2.5">
        <button
          type="button"
          className="cursor-grab touch-none rounded p-1 text-app-faint hover:bg-app-surface-hover hover:text-app-muted"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={16} />
        </button>
        <span className="min-w-0 text-[11px] font-semibold uppercase tracking-[0.06em] text-app-muted">
          {region.type === REGION_TYPES.richText && (sectionTitle || 'Rich text')}
          {region.type === REGION_TYPES.media && `Media · ${mediaRole}`}
          {region.type === REGION_TYPES.field && (fieldLabel || fieldKey || 'Field')}
        </span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => onConfigure(region.id)}
          className="rounded p-1 text-app-faint hover:bg-app-surface-hover hover:text-app-muted"
          title="Configure block"
          aria-label="Configure block"
        >
          <Settings2 size={14} />
        </button>
        <button
          type="button"
          onClick={() => onRemove(region.id)}
          className="rounded p-1 text-app-faint hover:bg-red-500/15 hover:text-red-200"
          aria-label="Remove section"
        >
          <Trash2 size={14} />
        </button>
      </div>
      <div className="p-4">
        {region.type === REGION_TYPES.richText && (
          <RichTextEditor
            key={`${region.id}-${editorPlaceholder}`}
            initialDoc={doc}
            placeholder={editorPlaceholder}
            onDocChange={(d) => onUpdateDoc(region.id, d)}
          />
        )}
        {region.type === REGION_TYPES.media && (
          <div className="space-y-2">
            <div className="flex min-h-[96px] flex-col items-center justify-center gap-1.5 rounded-app-md border border-dashed border-app-border/70 bg-app-bg-subtle/50 px-4 py-4 text-center">
              <ImageIcon size={22} className="text-app-faint" />
              <span className="text-[11px] text-app-muted">{mediaCaption || 'Media placeholder'}</span>
              <span className="text-[10px] text-app-faint">Alt: {mediaAlt || '—'}</span>
            </div>
          </div>
        )}
        {region.type === REGION_TYPES.field && (
          <div className="rounded-app-md border border-app-border/60 bg-app-bg-subtle/50 px-3.5 py-3">
            <div className="font-mono text-sm text-amber-200/90">{`{{${fieldKey}}}`}</div>
            {fieldLabel ? <div className="mt-1 text-xs text-app-muted">{fieldLabel}</div> : null}
            {fieldHelp ? <p className="mt-1 mb-0 text-[11px] text-app-faint">{fieldHelp}</p> : null}
            {fieldRequired ? (
              <span className="mt-1 inline-block text-[10px] text-amber-200/80">Required</span>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

type ResizeHandleProps = {
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
};

function ColumnResizeHandle({ onPointerDown }: ResizeHandleProps) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      className="group relative w-3 shrink-0 cursor-col-resize select-none touch-none"
      onPointerDown={onPointerDown}
    >
      <div className="absolute inset-y-3 left-1/2 w-px -translate-x-1/2 bg-app-border/90 group-hover:bg-app-accent/60 group-active:bg-app-accent" />
    </div>
  );
}

type SortableLayoutRowProps = {
  row: LayoutRow;
  onResizePointerDown: (e: React.PointerEvent<HTMLDivElement>, rowId: string, leftCellIndex: number) => void;
  onRequestAddColumn: (rowId: string) => void;
  /** Stack another block in this column (same grid track, rows stack vertically). */
  onRequestAddToCell: (rowId: string, cellId: string) => void;
  onEqualizeColumns: (rowId: string) => void;
  onUpdateDoc: (id: string, doc: JSONContent) => void;
  onConfigure: (id: string) => void;
  onRemove: (id: string) => void;
};

function SortableLayoutRow({
  row,
  onResizePointerDown,
  onRequestAddColumn,
  onRequestAddToCell,
  onEqualizeColumns,
  onUpdateDoc,
  onConfigure,
  onRemove,
}: SortableLayoutRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const gridCols = rowGridTemplateColumns(row.cells);

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-layout-row
      className={`rounded-app-lg border border-app-border bg-app-bg-subtle ${
        isDragging ? 'opacity-80 ring-1 ring-app-accent/40' : 'hover:border-app-accent/25'
      }`}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] bg-black/15 px-2 py-2 sm:px-3">
        <button
          type="button"
          className="cursor-grab touch-none rounded p-1 text-app-faint hover:bg-app-surface-hover hover:text-app-muted"
          aria-label="Drag to reorder row"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={16} />
        </button>
        <span className="text-[10px] font-medium tabular-nums text-app-faint">
          Row · {row.cells.length}
        </span>
        <div className="flex-1" />
        {row.cells.length > 1 ? (
          <button
            type="button"
            onClick={() => onEqualizeColumns(row.id)}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.1] bg-black/20 px-2.5 py-1 text-[10px] font-medium text-app-muted hover:border-app-accent/25 hover:text-app-text"
            title="Equal column widths"
          >
            <Columns3 size={12} aria-hidden />
            Equal
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => onRequestAddColumn(row.id)}
          className="inline-flex items-center gap-1.5 rounded-md border border-app-accent/35 bg-app-accent-muted/40 px-2.5 py-1 text-[10px] font-medium text-app-accent hover:bg-app-accent-muted"
          title="Add a column to this row, then pick a block type"
        >
          <Columns2 size={12} aria-hidden />
          + Column
        </button>
      </div>
      <div
        className="grid min-w-0 items-stretch overflow-x-auto p-2 sm:p-3"
        style={{ gridTemplateColumns: gridCols }}
      >
        {row.cells.flatMap((cell, i) => {
          const chunk: React.ReactElement[] = [
            <div key={cell.id} className="flex min-w-0 flex-col gap-3">
              {cell.regions.map((region) => (
                <SortableRegionCard
                  key={region.id}
                  region={region}
                  onUpdateDoc={onUpdateDoc}
                  onConfigure={onConfigure}
                  onRemove={onRemove}
                />
              ))}
              <button
                type="button"
                onClick={() => onRequestAddToCell(row.id, cell.id)}
                className="flex w-full items-center justify-center gap-1 rounded-app-md border border-dashed border-white/[0.1] bg-black/15 py-1.5 text-[10px] font-medium text-app-faint hover:border-app-accent/35 hover:bg-app-accent-muted/20 hover:text-app-accent"
              >
                <Plus size={11} aria-hidden />
                + Block
              </button>
            </div>,
          ];
          if (i < row.cells.length - 1) {
            chunk.push(
              <div key={`${row.id}-gutter-${i}`} className="flex min-w-0 items-stretch justify-center">
                <ColumnResizeHandle
                  onPointerDown={(e) => onResizePointerDown(e, row.id, i)}
                />
              </div>,
            );
          }
          return chunk;
        })}
      </div>
    </div>
  );
}

type PreviewProps = {
  rows: LayoutRow[];
  breakpoint: 'desktop' | 'mobile';
};

function ReadOnlyRich({ doc }: { doc: JSONContent }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: true,
        HTMLAttributes: {
          rel: 'noopener noreferrer nofollow',
          target: '_blank',
        },
      }),
    ],
    content: doc,
    editable: false,
    editorProps: {
      attributes: {
        class:
          'text-sm text-app-text leading-relaxed opacity-95 prose prose-invert max-w-none px-0.5 py-0.5',
      },
    },
  });
  return <EditorContent editor={editor} />;
}

function PreviewRegionCard({ region }: { region: TemplateLayoutRegion }) {
  return (
    <div className="h-full rounded-app-md border border-app-border bg-app-bg-subtle p-4">
      {region.type === REGION_TYPES.richText && <ReadOnlyRich doc={ensureRichDoc(region.props)} />}
      {region.type === REGION_TYPES.media && (
        <div className="space-y-1.5 rounded-app-md border border-dashed border-app-border/70 bg-app-bg-subtle/40 p-4 text-xs text-app-muted">
          <div className="text-[10px] uppercase tracking-wide text-app-faint">
            {String((region.props as { role?: string })?.role ?? 'inline')}
          </div>
          {(region.props as { caption?: string })?.caption ? (
            <div>{String((region.props as { caption?: string }).caption)}</div>
          ) : (
            <div>Media placeholder</div>
          )}
          <div className="text-[10px] text-app-faint">
            Alt: {String((region.props as { alt?: string })?.alt ?? '—')}
          </div>
        </div>
      )}
      {region.type === REGION_TYPES.field && (
        <div className="text-sm">
          <div className="font-mono text-amber-200/90">
            {`{{${String((region.props as { fieldKey?: string })?.fieldKey ?? 'field')}}}`}
          </div>
          {(region.props as { label?: string })?.label ? (
            <div className="mt-1 text-xs text-app-muted">{String((region.props as { label?: string }).label)}</div>
          ) : null}
          {(region.props as { helpText?: string })?.helpText ? (
            <p className="mt-1 mb-0 text-[11px] text-app-faint">
              {String((region.props as { helpText?: string }).helpText)}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function TemplateLayoutLivePreview({ rows, breakpoint }: PreviewProps) {
  const frame =
    breakpoint === 'mobile' ? 'max-w-[375px] mx-auto border-x border-app-border/60' : 'w-full';

  const blockCount = layoutRegionCount({ version: LAYOUT_VERSION, rows });

  return (
    <div className={`space-y-4 ${frame}`}>
      {blockCount === 0 ? (
        <p className="px-2 py-8 text-center text-sm leading-relaxed text-app-muted">
          Nothing to preview yet — add blocks in the editor.
        </p>
      ) : (
        rows.map((row) => (
          <div
            key={row.id}
            className={`grid min-w-0 gap-2 ${breakpoint === 'mobile' ? 'grid-cols-1' : ''}`}
            data-layout-row
            style={
              breakpoint === 'mobile'
                ? undefined
                : { gridTemplateColumns: previewRowGridTemplateColumns(row.cells) }
            }
          >
            {row.cells.map((cell) => (
              <div key={cell.id} className="flex min-w-0 flex-col gap-2">
                {cell.regions.map((region) => (
                  <PreviewRegionCard key={region.id} region={region} />
                ))}
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}

export type TemplateLayoutEditorHandle = {
  saveDraft: () => Promise<void>;
  activate: () => Promise<void>;
};

type TemplateLayoutEditorProps = {
  templateId: string;
  draftLayout: unknown;
  bindingCount: number;
  onLayoutSaved: (record: TemplateRecord) => void;
  /** Hide internal header and save/activate bar so the parent can host them in a topbar */
  compact?: boolean;
  /** Mutable ref that receives the saveDraft function – caller can invoke it from a topbar button */
  saveRef?: React.MutableRefObject<(() => Promise<void>) | null>;
  /** Mutable ref that receives the activate function */
  activateRef?: React.MutableRefObject<(() => Promise<void>) | null>;
  /** Called whenever saving state changes */
  onSavingChange?: (saving: boolean) => void;
  /** Called whenever activating state changes */
  onActivatingChange?: (activating: boolean) => void;
};

type BlockModalState =
  | null
  | { flow: 'add'; kind: 'text' | 'media' | 'field' }
  | { flow: 'edit'; kind: 'text' | 'media' | 'field'; regionId: string };

/** Small chooser when adding a column or stacking in a column (not for palette → new row). */
type BlockKindPickContext =
  | null
  | { mode: 'column'; rowId: string }
  | { mode: 'stack'; rowId: string; cellId: string };

export default function TemplateLayoutEditor({
  templateId,
  draftLayout,
  bindingCount,
  onLayoutSaved,
  compact,
  saveRef,
  activateRef,
  onSavingChange,
  onActivatingChange,
}: TemplateLayoutEditorProps) {
  const [rows, setRows] = useState<LayoutRow[]>([]);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const [appendToRowId, setAppendToRowId] = useState<string | null>(null);
  /** Next palette add stacks inside this column (same grid track) */
  const [appendToCell, setAppendToCell] = useState<{ rowId: string; cellId: string } | null>(null);
  const [blockKindPick, setBlockKindPick] = useState<BlockKindPickContext>(null);
  const [blockModal, setBlockModal] = useState<BlockModalState>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [activateError, setActivateError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState(false);
  const [previewBp, setPreviewBp] = useState<'desktop' | 'mobile'>('desktop');
  /** Full-width editor vs full-width preview — avoids splitting horizontal space */
  const [workspaceTab, setWorkspaceTab] = useState<'editor' | 'preview'>('editor');

  useEffect(() => {
    const parsed = parseTemplateLayout(draftLayout);
    setRows(parsed?.rows?.length ? parsed.rows : []);
  }, [templateId, draftLayout]);

  const flatRegions = useMemo(
    () => flattenRegions({ version: LAYOUT_VERSION, rows }),
    [rows],
  );

  const layoutConfig = useMemo(
    (): TemplateLayoutConfig => ({
      version: LAYOUT_VERSION,
      rows,
    }),
    [rows],
  );

  const regionCount = layoutRegionCount({ version: LAYOUT_VERSION, rows });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setRows((items) => {
      const oldIndex = items.findIndex((r) => r.id === active.id);
      const newIndex = items.findIndex((r) => r.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return items;
      return arrayMove(items, oldIndex, newIndex);
    });
  };

  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, rowId: string, leftIdx: number) => {
      e.preventDefault();
      const row = rowsRef.current.find((r) => r.id === rowId);
      if (!row || leftIdx >= row.cells.length - 1) return;
      const startLeft = row.cells[leftIdx].flexGrow;
      const startRight = row.cells[leftIdx + 1].flexGrow;
      const pool = startLeft + startRight;
      const host = (e.currentTarget as HTMLElement).closest('[data-layout-row]') as HTMLElement | null;
      const width = Math.max(120, host?.getBoundingClientRect().width ?? 400);
      const startX = e.clientX;
      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - startX;
        const deltaRatio = dx / width;
        let nextLeft = startLeft + deltaRatio * pool;
        nextLeft = Math.max(MIN_CELL_FLEX, Math.min(pool - MIN_CELL_FLEX, nextLeft));
        const nextRight = pool - nextLeft;
        setRows((prev) =>
          prev.map((r) => {
            if (r.id !== rowId) return r;
            const cells = r.cells.map((c, i) => {
              if (i === leftIdx) return { ...c, flexGrow: nextLeft };
              if (i === leftIdx + 1) return { ...c, flexGrow: nextRight };
              return c;
            });
            return { ...r, cells };
          }),
        );
      };
      const onUp = () => {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
      };
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    },
    [],
  );

  const mergeRegionProps = useCallback((id: string, updates: Record<string, unknown>) => {
    setRows((prev) => mapRegion(prev, id, (r) => ({ ...r, props: { ...r.props, ...updates } })));
  }, []);

  const removeRegion = (id: string) => {
    setRows((prev) => removeRegionFromRows(prev, id));
  };

  const updateDoc = useCallback((id: string, doc: JSONContent) => {
    setRows((prev) => mapRegion(prev, id, (r) => ({ ...r, props: { ...r.props, doc } })));
  }, []);

  function openConfigure(regionId: string) {
    const r = flatRegions.find((x) => x.id === regionId);
    if (!r) return;
    if (r.type === REGION_TYPES.richText) setBlockModal({ flow: 'edit', kind: 'text', regionId });
    else if (r.type === REGION_TYPES.media) setBlockModal({ flow: 'edit', kind: 'media', regionId });
    else if (r.type === REGION_TYPES.field) setBlockModal({ flow: 'edit', kind: 'field', regionId });
  }

  function closeBlockModal() {
    setBlockModal(null);
    setAppendToRowId(null);
    setAppendToCell(null);
    setBlockKindPick(null);
  }

  const textModalInitial = useMemo((): Partial<TextBlockFormValues> | undefined => {
    if (!blockModal || blockModal.kind !== 'text' || blockModal.flow !== 'edit') return undefined;
    const r = flatRegions.find((x) => x.id === blockModal.regionId);
    if (!r?.props) return undefined;
    const p = r.props as Record<string, unknown>;
    return {
      sectionTitle: String(p.sectionTitle ?? ''),
      editorPlaceholder: String(p.editorPlaceholder ?? ''),
    };
  }, [blockModal, flatRegions]);

  const mediaModalInitial = useMemo((): Partial<MediaBlockFormValues> | undefined => {
    if (!blockModal || blockModal.kind !== 'media' || blockModal.flow !== 'edit') return undefined;
    const r = flatRegions.find((x) => x.id === blockModal.regionId);
    if (!r?.props) return undefined;
    const p = r.props as Record<string, unknown>;
    return {
      role: (p.role as MediaBlockFormValues['role']) ?? 'inline',
      alt: String(p.alt ?? ''),
      caption: String(p.caption ?? ''),
    };
  }, [blockModal, flatRegions]);

  const fieldModalInitial = useMemo((): Partial<FieldBlockFormValues> | undefined => {
    if (!blockModal || blockModal.kind !== 'field' || blockModal.flow !== 'edit') return undefined;
    const r = flatRegions.find((x) => x.id === blockModal.regionId);
    if (!r?.props) return undefined;
    const p = r.props as Record<string, unknown>;
    return {
      fieldKey: String(p.fieldKey ?? ''),
      label: String(p.label ?? ''),
      helpText: String(p.helpText ?? ''),
      required: Boolean(p.required),
    };
  }, [blockModal, flatRegions]);

  function handleTextModalSubmit(values: TextBlockFormValues) {
    if (!blockModal || blockModal.kind !== 'text') return;
    if (blockModal.flow === 'add') {
      const id = crypto.randomUUID();
      const doc = docFromSectionTitle(values.sectionTitle);
      const region: TemplateLayoutRegion = {
        id,
        type: REGION_TYPES.richText,
        props: {
          sectionTitle: values.sectionTitle,
          editorPlaceholder: values.editorPlaceholder,
          doc,
        },
      };
      if (appendToCell) {
        setRows((prev) => addRegionToCell(prev, appendToCell.rowId, appendToCell.cellId, region));
      } else if (appendToRowId) {
        setRows((prev) => addColumnToRow(prev, appendToRowId, region));
      } else {
        setRows((prev) => addRowWithRegion(prev, region));
      }
    } else {
      mergeRegionProps(blockModal.regionId, {
        sectionTitle: values.sectionTitle,
        editorPlaceholder: values.editorPlaceholder,
      });
    }
    closeBlockModal();
  }

  function handleMediaModalSubmit(values: MediaBlockFormValues) {
    if (!blockModal || blockModal.kind !== 'media') return;
    const payload = {
      role: values.role,
      alt: values.alt,
      caption: values.caption,
      variant: 'placeholder' as const,
    };
    if (blockModal.flow === 'add') {
      const id = crypto.randomUUID();
      const region: TemplateLayoutRegion = { id, type: REGION_TYPES.media, props: payload };
      if (appendToCell) {
        setRows((prev) => addRegionToCell(prev, appendToCell.rowId, appendToCell.cellId, region));
      } else if (appendToRowId) {
        setRows((prev) => addColumnToRow(prev, appendToRowId, region));
      } else {
        setRows((prev) => addRowWithRegion(prev, region));
      }
    } else {
      mergeRegionProps(blockModal.regionId, payload);
    }
    closeBlockModal();
  }

  function handleFieldModalSubmit(values: FieldBlockFormValues) {
    if (!blockModal || blockModal.kind !== 'field') return;
    const payload = {
      fieldKey: values.fieldKey,
      label: values.label,
      helpText: values.helpText,
      required: values.required,
    };
    if (blockModal.flow === 'add') {
      const id = crypto.randomUUID();
      const region: TemplateLayoutRegion = { id, type: REGION_TYPES.field, props: payload };
      if (appendToCell) {
        setRows((prev) => addRegionToCell(prev, appendToCell.rowId, appendToCell.cellId, region));
      } else if (appendToRowId) {
        setRows((prev) => addColumnToRow(prev, appendToRowId, region));
      } else {
        setRows((prev) => addRowWithRegion(prev, region));
      }
    } else {
      mergeRegionProps(blockModal.regionId, payload);
    }
    closeBlockModal();
  }

  function onPalettePick(kind: 'text' | 'media' | 'field') {
    setBlockKindPick(null);
    setBlockModal({ flow: 'add', kind });
  }

  function onRequestAddColumn(rowId: string) {
    setBlockKindPick({ mode: 'column', rowId });
  }

  function onRequestAddToCell(rowId: string, cellId: string) {
    setBlockKindPick({ mode: 'stack', rowId, cellId });
  }

  const onEqualizeColumns = useCallback((rowId: string) => {
    setRows((prev) => equalizeRowColumns(prev, rowId));
  }, []);

  const handleSaveDraft = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    onSavingChange?.(true);
    try {
      const updated = await templateCrudService.saveDraftLayout(templateId, layoutConfig);
      onLayoutSaved(updated);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save draft layout');
    } finally {
      setSaving(false);
      onSavingChange?.(false);
    }
  }, [templateId, layoutConfig, onLayoutSaved, onSavingChange]);

  const handleActivate = useCallback(async () => {
    setActivating(true);
    setActivateError(null);
    onActivatingChange?.(true);
    try {
      const updated = await templateCrudService.activateTemplate(templateId);
      onLayoutSaved(updated);
    } catch (e) {
      setActivateError(e instanceof Error ? e.message : 'Activation failed');
    } finally {
      setActivating(false);
      onActivatingChange?.(false);
    }
  }, [templateId, onLayoutSaved, onActivatingChange]);

  // Expose imperative handles via refs for parent topbar
  const saveDraftStable = useRef(handleSaveDraft);
  const activateStable = useRef(handleActivate);
  saveDraftStable.current = handleSaveDraft;
  activateStable.current = handleActivate;

  useEffect(() => {
    if (saveRef) saveRef.current = () => saveDraftStable.current();
    if (activateRef) activateRef.current = () => activateStable.current();
  }, [saveRef, activateRef]);

  useEffect(() => {
    if (!blockKindPick) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setBlockKindPick(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [blockKindPick]);

  function confirmBlockKindFromPicker(kind: 'text' | 'media' | 'field') {
    const ctx = blockKindPick;
    setBlockKindPick(null);
    if (!ctx) return;
    if (ctx.mode === 'column') {
      setAppendToCell(null);
      setAppendToRowId(ctx.rowId);
    } else {
      setAppendToRowId(null);
      setAppendToCell({ rowId: ctx.rowId, cellId: ctx.cellId });
    }
    setBlockModal({ flow: 'add', kind });
  }

  return (
    <div className={compact ? 'space-y-6' : 'space-y-8'}>
      {!compact && (
        <header className="border-b border-app-border/40 pb-4">
          <h3 className="m-0 text-base font-semibold tracking-tight text-app-text">Layout</h3>
        </header>
      )}

      {saveError && (
        <div className="rounded-app-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {saveError}
        </div>
      )}
      {activateError && (
        <div className="rounded-app-lg border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {activateError}
        </div>
      )}

      <div className={`flex flex-col ${compact ? 'gap-4' : 'gap-5'}`}>
        <TemplateComponentPalette onPick={onPalettePick} disabled={saving || activating} />

        <div
          className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
          role="toolbar"
          aria-label="Editor workspace"
        >
          <div className="flex w-full min-w-0 flex-col gap-1 sm:w-auto">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-app-faint">Workspace</span>
            <div className="flex gap-1 rounded-app-md border border-app-border bg-app-bg-subtle p-1">
              <button
                type="button"
                onClick={() => setWorkspaceTab('editor')}
                aria-pressed={workspaceTab === 'editor'}
                className={`flex flex-1 items-center justify-center gap-2 rounded-app-md px-4 py-2 text-xs font-medium sm:flex-initial sm:px-5 ${
                  workspaceTab === 'editor'
                    ? 'border border-app-accent/30 bg-app-accent-muted text-app-accent'
                    : 'border border-transparent text-app-muted hover:bg-app-surface-hover hover:text-app-text'
                }`}
              >
                <Text size={14} strokeWidth={1.75} aria-hidden />
                Editor
              </button>
              <button
                type="button"
                onClick={() => setWorkspaceTab('preview')}
                aria-pressed={workspaceTab === 'preview'}
                className={`flex flex-1 items-center justify-center gap-2 rounded-app-md px-4 py-2 text-xs font-medium sm:flex-initial sm:px-5 ${
                  workspaceTab === 'preview'
                    ? 'border border-app-accent/30 bg-app-accent-muted text-app-accent'
                    : 'border border-transparent text-app-muted hover:bg-app-surface-hover hover:text-app-text'
                }`}
              >
                <Eye size={14} strokeWidth={1.75} aria-hidden />
                Preview
              </button>
            </div>
          </div>

          {workspaceTab === 'preview' ? (
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
              <span className="text-[10px] text-app-faint sm:mr-1">Width</span>
              <div className="flex flex-1 gap-1 rounded-app-md border border-app-border bg-app-bg-subtle p-1 sm:flex-initial">
                <button
                  type="button"
                  onClick={() => setPreviewBp('desktop')}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-app-md px-3 py-1.5 text-xs font-medium sm:flex-initial ${
                    previewBp === 'desktop'
                      ? 'border border-app-accent/30 bg-app-accent-muted text-app-accent'
                      : 'border border-transparent text-app-muted hover:text-app-text'
                  }`}
                >
                  <Monitor size={14} aria-hidden /> Desktop
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewBp('mobile')}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-app-md px-3 py-1.5 text-xs font-medium sm:flex-initial ${
                    previewBp === 'mobile'
                      ? 'border border-app-accent/30 bg-app-accent-muted text-app-accent'
                      : 'border border-transparent text-app-muted hover:text-app-text'
                  }`}
                >
                  <Smartphone size={14} aria-hidden /> Mobile
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {workspaceTab === 'editor' ? (
          <div className="min-w-0 flex flex-col gap-0">
            <div className={`flex items-center gap-2 ${compact ? 'mb-2' : 'mb-3'}`}>
              <span className="flex h-7 w-7 items-center justify-center rounded-md border border-app-accent/25 bg-app-accent-muted/40 text-app-accent">
                <Text size={14} strokeWidth={1.75} aria-hidden />
              </span>
              <span className="text-[11px] text-app-faint">
                Drag rows · resize gutters · <span className="text-app-muted">+ Column</span> splits · dashed + stacks
              </span>
            </div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-4">
                  {rows.length === 0 ? (
                    <div className="rounded-app-lg border border-dashed border-app-accent/25 bg-app-accent-muted/10 px-4 py-10 text-center">
                      <p className="m-0 text-[13px] text-app-faint">Empty — add a block from the bar above.</p>
                    </div>
                  ) : (
                    rows.map((row) => (
                      <SortableLayoutRow
                        key={row.id}
                        row={row}
                        onResizePointerDown={handleResizePointerDown}
                        onRequestAddColumn={onRequestAddColumn}
                        onRequestAddToCell={onRequestAddToCell}
                        onEqualizeColumns={onEqualizeColumns}
                        onUpdateDoc={updateDoc}
                        onConfigure={openConfigure}
                        onRemove={removeRegion}
                      />
                    ))
                  )}
                </div>
              </SortableContext>
            </DndContext>

            {!compact && (
              <div className="mt-8 flex flex-col gap-4 border-t border-app-border/50 pt-8 sm:flex-row sm:flex-wrap sm:items-center">
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSaveDraft}
                  className="inline-flex items-center justify-center gap-2 rounded-app-md border border-app-accent/45 bg-app-accent-muted px-4 py-2.5 text-sm font-medium hover:bg-app-accent/20 disabled:opacity-50"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Save draft layout
                </button>
                <button
                  type="button"
                  disabled={activating || bindingCount < 1 || regionCount < 1}
                  onClick={handleActivate}
                  title={
                    bindingCount < 1
                      ? 'Add at least one channel binding before activating'
                      : regionCount < 1
                        ? 'Add at least one section before activating'
                        : 'Promote draft layout to active'
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-app-md border border-emerald-400/40 bg-emerald-500/12 px-4 py-2.5 text-sm font-medium text-emerald-100 hover:bg-emerald-500/18 disabled:opacity-40"
                >
                  {activating ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                  Activate template
                </button>
                {bindingCount < 1 ? (
                  <span className="text-xs leading-snug text-app-faint sm:max-w-56">
                    Activation needs at least one channel binding on this template.
                  </span>
                ) : null}
              </div>
            )}
          </div>
        ) : (
          <div className="min-w-0">
            <div className={`flex flex-wrap items-center gap-3 ${compact ? 'mb-3' : 'mb-4'}`}>
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-app-md border border-app-border bg-app-bg-subtle text-app-accent-2">
                  <Eye size={16} strokeWidth={1.75} />
                </span>
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-app-accent-2/95">Live preview</div>
                  <p className="m-0 text-xs text-app-muted">Read-only. Use Width to compare desktop and mobile.</p>
                </div>
              </div>
            </div>
            <div
              className={`rounded-app-xl border border-app-border bg-app-bg-subtle p-5 ${
                previewBp === 'mobile' ? 'flex justify-center' : ''
              }`}
            >
              <TemplateLayoutLivePreview rows={rows} breakpoint={previewBp} />
            </div>
          </div>
        )}
      </div>

      {blockKindPick ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="block-kind-picker-title"
          onClick={() => setBlockKindPick(null)}
        >
          <div
            className="relative w-full max-w-[320px] rounded-app-xl border border-app-border bg-app-bg-subtle p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setBlockKindPick(null)}
              className="absolute right-2.5 top-2.5 rounded-app-md p-1.5 text-app-faint hover:bg-white/[0.06] hover:text-app-text"
              aria-label="Close"
            >
              <X size={16} />
            </button>
            <h4 id="block-kind-picker-title" className="m-0 pr-8 text-sm font-semibold tracking-tight text-app-text">
              {blockKindPick.mode === 'column' ? 'Add column' : 'Add block in column'}
            </h4>
            <p className="mt-1 mb-4 text-[12px] leading-snug text-app-muted">
              {blockKindPick.mode === 'column'
                ? 'Pick a block type for the new column.'
                : 'Pick a block to stack in this column (same grid track).'}
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => confirmBlockKindFromPicker('text')}
                className="flex flex-col items-center gap-1.5 rounded-app-md border border-white/[0.08] bg-white/[0.03] px-2 py-3 text-[11px] font-medium text-app-text hover:border-app-accent/40 hover:bg-app-accent-muted/30"
              >
                <Text size={18} strokeWidth={1.75} className="text-app-accent" aria-hidden />
                Text
              </button>
              <button
                type="button"
                onClick={() => confirmBlockKindFromPicker('media')}
                className="flex flex-col items-center gap-1.5 rounded-app-md border border-white/[0.08] bg-white/[0.03] px-2 py-3 text-[11px] font-medium text-app-text hover:border-cyan-400/35 hover:bg-cyan-500/10"
              >
                <ImageIcon size={18} strokeWidth={1.75} className="text-cyan-300/90" aria-hidden />
                Media
              </button>
              <button
                type="button"
                onClick={() => confirmBlockKindFromPicker('field')}
                className="flex flex-col items-center gap-1.5 rounded-app-md border border-white/[0.08] bg-white/[0.03] px-2 py-3 text-[11px] font-medium text-app-text hover:border-amber-400/35 hover:bg-amber-500/10"
              >
                <Braces size={18} strokeWidth={1.75} className="text-amber-300/90" aria-hidden />
                Field
              </button>
            </div>
            <button
              type="button"
              onClick={() => setBlockKindPick(null)}
              className="mt-3 w-full rounded-app-md border border-white/[0.1] py-2 text-[12px] font-medium text-app-muted hover:bg-white/[0.05]"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <TextBlockModal
        open={Boolean(blockModal && blockModal.kind === 'text')}
        mode={blockModal?.flow === 'edit' ? 'edit' : 'add'}
        initial={textModalInitial}
        onClose={closeBlockModal}
        onSubmit={handleTextModalSubmit}
      />
      <MediaBlockModal
        open={Boolean(blockModal && blockModal.kind === 'media')}
        mode={blockModal?.flow === 'edit' ? 'edit' : 'add'}
        initial={mediaModalInitial}
        onClose={closeBlockModal}
        onSubmit={handleMediaModalSubmit}
      />
      <FieldBlockModal
        open={Boolean(blockModal && blockModal.kind === 'field')}
        mode={blockModal?.flow === 'edit' ? 'edit' : 'add'}
        initial={fieldModalInitial}
        onClose={closeBlockModal}
        onSubmit={handleFieldModalSubmit}
      />
    </div>
  );
}
