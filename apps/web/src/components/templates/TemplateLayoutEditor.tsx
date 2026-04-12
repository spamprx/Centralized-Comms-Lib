import { useCallback, useEffect, useMemo, useState } from 'react';
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
  CheckCircle,
  Eye,
  GripVertical,
  Image as ImageIcon,
  Loader2,
  Monitor,
  Save,
  Settings2,
  Smartphone,
  Text,
  Trash2,
} from 'lucide-react';
import {
  templateCrudService,
  type TemplateLayoutConfig,
  type TemplateLayoutRegion,
  type TemplateRecord,
} from '../../services/templateCrudService';
import TemplateComponentPalette from './TemplateComponentPalette';
import {
  TextBlockModal,
  MediaBlockModal,
  FieldBlockModal,
  type TextBlockFormValues,
  type MediaBlockFormValues,
  type FieldBlockFormValues,
} from './TemplateBlockModals';

export const LAYOUT_VERSION = 1;

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

export function parseTemplateLayout(raw: unknown): TemplateLayoutConfig | null {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.version !== 'number' || !Number.isInteger(o.version) || o.version < 1) return null;
  if (!Array.isArray(o.regions)) return null;
  for (const r of o.regions) {
    if (!r || typeof r !== 'object' || Array.isArray(r)) return null;
    const reg = r as Record<string, unknown>;
    if (typeof reg.id !== 'string' || !reg.id.trim()) return null;
    if (typeof reg.type !== 'string' || !reg.type.trim()) return null;
    if (reg.props != null && (typeof reg.props !== 'object' || Array.isArray(reg.props))) return null;
  }
  return o as unknown as TemplateLayoutConfig;
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
          'min-h-[120px] px-3 py-2 text-sm text-app-text leading-relaxed outline-none prose prose-invert max-w-none',
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
      className={`rounded-lg border border-app-border bg-app-bg-subtle/80 ${
        isDragging ? 'opacity-70 ring-2 ring-app-accent/40' : ''
      }`}
    >
      <div className="flex items-center gap-2 border-b border-app-border/80 px-2 py-1.5">
        <button
          type="button"
          className="cursor-grab touch-none rounded p-1 text-app-faint hover:bg-app-surface-hover hover:text-app-muted"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={16} />
        </button>
        <span className="min-w-0 text-[11px] font-medium uppercase tracking-wide text-app-muted">
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
      <div className="p-2">
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
            <div className="flex min-h-[88px] flex-col items-center justify-center gap-1 rounded-md border border-dashed border-app-border/90 bg-black/20 px-3 py-3 text-center">
              <ImageIcon size={22} className="text-app-faint" />
              <span className="text-[11px] text-app-muted">{mediaCaption || 'Media placeholder'}</span>
              <span className="text-[10px] text-app-faint">Alt: {mediaAlt || '—'}</span>
            </div>
          </div>
        )}
        {region.type === REGION_TYPES.field && (
          <div className="rounded-md border border-app-border/60 bg-black/20 px-3 py-2">
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

type PreviewProps = {
  regions: TemplateLayoutRegion[];
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
        class: 'text-sm text-app-text leading-relaxed opacity-95 prose prose-invert max-w-none',
      },
    },
  });
  return <EditorContent editor={editor} />;
}

export function TemplateLayoutLivePreview({ regions, breakpoint }: PreviewProps) {
  const frame =
    breakpoint === 'mobile' ? 'max-w-[375px] mx-auto border-x border-app-border/60' : 'w-full';

  return (
    <div className={`space-y-3 ${frame}`}>
      {regions.length === 0 ? (
        <p className="text-center text-xs text-app-faint">No sections yet — add blocks on the left.</p>
      ) : (
        regions.map((region) => (
          <div key={region.id} className="rounded-lg border border-app-border/70 bg-black/15 p-3">
            {region.type === REGION_TYPES.richText && (
              <ReadOnlyRich doc={ensureRichDoc(region.props)} />
            )}
            {region.type === REGION_TYPES.media && (
              <div className="space-y-1 rounded border border-dashed border-app-border/80 bg-black/25 p-3 text-[11px] text-app-muted">
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
                  <div className="mt-1 text-xs text-app-muted">
                    {String((region.props as { label?: string }).label)}
                  </div>
                ) : null}
                {(region.props as { helpText?: string })?.helpText ? (
                  <p className="mt-1 mb-0 text-[11px] text-app-faint">
                    {String((region.props as { helpText?: string }).helpText)}
                  </p>
                ) : null}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

type TemplateLayoutEditorProps = {
  templateId: string;
  draftLayout: unknown;
  bindingCount: number;
  onLayoutSaved: (record: TemplateRecord) => void;
};

type BlockModalState =
  | null
  | { flow: 'add'; kind: 'text' | 'media' | 'field' }
  | { flow: 'edit'; kind: 'text' | 'media' | 'field'; regionId: string };

export default function TemplateLayoutEditor({
  templateId,
  draftLayout,
  bindingCount,
  onLayoutSaved,
}: TemplateLayoutEditorProps) {
  const [regions, setRegions] = useState<TemplateLayoutRegion[]>([]);
  const [blockModal, setBlockModal] = useState<BlockModalState>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [activateError, setActivateError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState(false);
  const [previewBp, setPreviewBp] = useState<'desktop' | 'mobile'>('desktop');

  useEffect(() => {
    const parsed = parseTemplateLayout(draftLayout);
    setRegions(parsed?.regions?.length ? parsed.regions : []);
  }, [templateId, draftLayout]);

  const layoutConfig = useMemo(
    (): TemplateLayoutConfig => ({
      version: LAYOUT_VERSION,
      regions,
    }),
    [regions],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setRegions((items) => {
      const oldIndex = items.findIndex((r) => r.id === active.id);
      const newIndex = items.findIndex((r) => r.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return items;
      return arrayMove(items, oldIndex, newIndex);
    });
  };

  const mergeRegionProps = useCallback((id: string, updates: Record<string, unknown>) => {
    setRegions((prev) =>
      prev.map((r) => (r.id === id ? { ...r, props: { ...r.props, ...updates } } : r)),
    );
  }, []);

  const removeRegion = (id: string) => {
    setRegions((prev) => prev.filter((r) => r.id !== id));
  };

  const updateDoc = useCallback((id: string, doc: JSONContent) => {
    setRegions((prev) =>
      prev.map((r) => (r.id === id ? { ...r, props: { ...r.props, doc } } : r)),
    );
  }, []);

  function openConfigure(regionId: string) {
    const r = regions.find((x) => x.id === regionId);
    if (!r) return;
    if (r.type === REGION_TYPES.richText) setBlockModal({ flow: 'edit', kind: 'text', regionId });
    else if (r.type === REGION_TYPES.media) setBlockModal({ flow: 'edit', kind: 'media', regionId });
    else if (r.type === REGION_TYPES.field) setBlockModal({ flow: 'edit', kind: 'field', regionId });
  }

  function closeBlockModal() {
    setBlockModal(null);
  }

  const textModalInitial = useMemo((): Partial<TextBlockFormValues> | undefined => {
    if (!blockModal || blockModal.kind !== 'text' || blockModal.flow !== 'edit') return undefined;
    const r = regions.find((x) => x.id === blockModal.regionId);
    if (!r?.props) return undefined;
    const p = r.props as Record<string, unknown>;
    return {
      sectionTitle: String(p.sectionTitle ?? ''),
      editorPlaceholder: String(p.editorPlaceholder ?? ''),
    };
  }, [blockModal, regions]);

  const mediaModalInitial = useMemo((): Partial<MediaBlockFormValues> | undefined => {
    if (!blockModal || blockModal.kind !== 'media' || blockModal.flow !== 'edit') return undefined;
    const r = regions.find((x) => x.id === blockModal.regionId);
    if (!r?.props) return undefined;
    const p = r.props as Record<string, unknown>;
    return {
      role: (p.role as MediaBlockFormValues['role']) ?? 'inline',
      alt: String(p.alt ?? ''),
      caption: String(p.caption ?? ''),
    };
  }, [blockModal, regions]);

  const fieldModalInitial = useMemo((): Partial<FieldBlockFormValues> | undefined => {
    if (!blockModal || blockModal.kind !== 'field' || blockModal.flow !== 'edit') return undefined;
    const r = regions.find((x) => x.id === blockModal.regionId);
    if (!r?.props) return undefined;
    const p = r.props as Record<string, unknown>;
    return {
      fieldKey: String(p.fieldKey ?? ''),
      label: String(p.label ?? ''),
      helpText: String(p.helpText ?? ''),
      required: Boolean(p.required),
    };
  }, [blockModal, regions]);

  function handleTextModalSubmit(values: TextBlockFormValues) {
    if (!blockModal || blockModal.kind !== 'text') return;
    if (blockModal.flow === 'add') {
      const id = crypto.randomUUID();
      const doc = docFromSectionTitle(values.sectionTitle);
      setRegions((prev) => [
        ...prev,
        {
          id,
          type: REGION_TYPES.richText,
          props: {
            sectionTitle: values.sectionTitle,
            editorPlaceholder: values.editorPlaceholder,
            doc,
          },
        },
      ]);
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
      setRegions((prev) => [...prev, { id, type: REGION_TYPES.media, props: payload }]);
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
      setRegions((prev) => [...prev, { id, type: REGION_TYPES.field, props: payload }]);
    } else {
      mergeRegionProps(blockModal.regionId, payload);
    }
    closeBlockModal();
  }

  function onPalettePick(kind: 'text' | 'media' | 'field') {
    setBlockModal({ flow: 'add', kind });
  }

  async function handleSaveDraft() {
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await templateCrudService.saveDraftLayout(templateId, layoutConfig);
      onLayoutSaved(updated);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save draft layout');
    } finally {
      setSaving(false);
    }
  }

  async function handleActivate() {
    setActivating(true);
    setActivateError(null);
    try {
      const updated = await templateCrudService.activateTemplate(templateId);
      onLayoutSaved(updated);
    } catch (e) {
      setActivateError(e instanceof Error ? e.message : 'Activation failed');
    } finally {
      setActivating(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="m-0 text-base font-semibold text-app-text">Layout canvas</h3>
        <p className="mt-1 mb-0 text-xs text-app-faint">
          Pick a component from the palette, configure it in the dialog, then drag sections to reorder. Save as
          draft, then activate when the template is bound to at least one channel.
        </p>
      </div>

      {saveError && (
        <div className="rounded-app-md border border-red-400/35 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {saveError}
        </div>
      )}
      {activateError && (
        <div className="rounded-app-md border border-amber-400/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          {activateError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(220px,260px)_1fr] xl:grid-cols-[minmax(220px,260px)_1fr_1fr]">
        <TemplateComponentPalette onPick={onPalettePick} disabled={saving || activating} />

        <div>
          <div className="mb-2 flex items-center gap-2 text-[12px] text-app-muted">
            <Text size={14} /> Editor
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={regions.map((r) => r.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-3">
                {regions.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-app-border/80 bg-black/15 px-4 py-10 text-center text-xs text-app-faint">
                    No sections yet. Choose Text, Media, or Field from the palette to configure and add a block.
                  </div>
                ) : (
                  regions.map((region) => (
                    <SortableRegionCard
                      key={region.id}
                      region={region}
                      onUpdateDoc={updateDoc}
                      onConfigure={openConfigure}
                      onRemove={removeRegion}
                    />
                  ))
                )}
              </div>
            </SortableContext>
          </DndContext>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={handleSaveDraft}
              className="inline-flex items-center gap-2 rounded-lg border border-app-accent/50 bg-app-accent-muted px-3 py-2 text-sm disabled:opacity-50"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save draft layout
            </button>
            <button
              type="button"
              disabled={activating || bindingCount < 1 || regions.length < 1}
              onClick={handleActivate}
              title={
                bindingCount < 1
                  ? 'Add at least one channel binding before activating'
                  : regions.length < 1
                    ? 'Add at least one section before activating'
                    : 'Promote draft layout to active'
              }
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3 py-2 text-sm text-emerald-100 disabled:opacity-40"
            >
              {activating ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
              Activate template
            </button>
            {bindingCount < 1 ? (
              <span className="text-[11px] text-app-faint">Activation requires a channel binding.</span>
            ) : null}
          </div>
        </div>

        <div className="min-w-0 lg:col-span-2 xl:col-span-1">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[12px] text-app-muted">
              <Eye size={14} />
              Live preview
            </div>
            <div className="flex rounded-lg border border-app-border p-0.5">
              <button
                type="button"
                onClick={() => setPreviewBp('desktop')}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] ${
                  previewBp === 'desktop' ? 'bg-app-accent-muted text-app-text' : 'text-app-muted'
                }`}
              >
                <Monitor size={12} /> Desktop
              </button>
              <button
                type="button"
                onClick={() => setPreviewBp('mobile')}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] ${
                  previewBp === 'mobile' ? 'bg-app-accent-muted text-app-text' : 'text-app-muted'
                }`}
              >
                <Smartphone size={12} /> Mobile
              </button>
            </div>
          </div>
          <div
            className={`rounded-lg border border-app-border bg-black/20 p-4 ${
              previewBp === 'mobile' ? 'flex justify-center' : ''
            }`}
          >
            <TemplateLayoutLivePreview regions={regions} breakpoint={previewBp} />
          </div>
        </div>
      </div>

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
