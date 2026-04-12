import { LayoutGrid, Type, Image as ImageIcon, Braces } from 'lucide-react';

type PalettePick = 'text' | 'media' | 'field';

type TemplateComponentPaletteProps = {
  onPick: (kind: PalettePick) => void;
  disabled?: boolean;
};

/**
 * Visual palette: pick a block type to open its configuration modal before inserting on the canvas.
 */
export default function TemplateComponentPalette({ onPick, disabled }: TemplateComponentPaletteProps) {
  const items: Array<{
    kind: PalettePick;
    title: string;
    description: string;
    icon: typeof Type;
  }> = [
    {
      kind: 'text',
      title: 'Text',
      description: 'Rich text with optional section title and placeholder.',
      icon: Type,
    },
    {
      kind: 'media',
      title: 'Media',
      description: 'Image or asset slot with role, alt, and caption.',
      icon: ImageIcon,
    },
    {
      kind: 'field',
      title: 'Field',
      description: 'Merge field for dynamic values at send time.',
      icon: Braces,
    },
  ];

  return (
    <div className="rounded-xl border border-app-border/90 bg-app-bg-subtle/40 p-3">
      <div className="mb-3 flex items-center gap-2 border-b border-app-border/60 pb-2">
        <LayoutGrid size={16} className="text-app-accent/90" />
        <div>
          <div className="text-[13px] font-semibold text-app-text">Components</div>
          <p className="m-0 text-[11px] leading-snug text-app-faint">
            Choose a block — configure it, then add to the canvas.
          </p>
        </div>
      </div>
      <ul className="m-0 list-none space-y-2 p-0">
        {items.map(({ kind, title, description, icon: Icon }) => (
          <li key={kind}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPick(kind)}
              className="flex w-full gap-3 rounded-lg border border-app-border/80 bg-black/15 px-3 py-2.5 text-left transition-colors hover:border-app-accent/35 hover:bg-app-surface-hover disabled:cursor-not-allowed disabled:opacity-45"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-app-border/70 bg-app-bg-subtle/90 text-app-muted">
                <Icon size={18} strokeWidth={1.75} />
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-medium text-app-text">{title}</span>
                <span className="mt-0.5 block text-[11px] leading-snug text-app-faint">{description}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
