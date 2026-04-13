import { Braces, Image as ImageIcon, Type } from 'lucide-react';

type PalettePick = 'text' | 'media' | 'field';

type TemplateComponentPaletteProps = {
  onPick: (kind: PalettePick) => void;
  disabled?: boolean;
};

const BLOCKS: Array<{
  kind: PalettePick;
  label: string;
  description: string;
  icon: typeof Type;
  color: string;
}> = [
  {
    kind: 'text',
    label: 'Text',
    description: 'Rich text section with optional heading',
    icon: Type,
    color: '#8b5cf6',
  },
  {
    kind: 'media',
    label: 'Media',
    description: 'Image or asset placeholder slot',
    icon: ImageIcon,
    color: '#06b6d4',
  },
  {
    kind: 'field',
    label: 'Field',
    description: 'Dynamic merge field token',
    icon: Braces,
    color: '#f59e0b',
  },
];

export default function TemplateComponentPalette({ onPick, disabled }: TemplateComponentPaletteProps) {
  return (
    <div className="rounded-app-lg border border-white/[0.08] bg-app-surface/50 p-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] backdrop-blur-sm sm:p-3.5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch sm:gap-4">
        <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-start sm:justify-center sm:py-0.5">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-app-muted">Add blocks</h3>
          <p className="hidden text-[10px] leading-snug text-app-faint sm:block sm:max-w-[8rem]">
            Pick a type, then configure in the dialog.
          </p>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-stretch">
          {BLOCKS.map((block) => (
            <button
              key={block.kind}
              type="button"
              disabled={disabled}
              onClick={() => onPick(block.kind)}
              title={block.description}
              className="flex min-h-[3.25rem] flex-1 items-center gap-2.5 rounded-app-md border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-left text-xs text-app-text transition-colors hover:border-app-accent/35 hover:bg-app-accent-muted/35 disabled:cursor-not-allowed disabled:opacity-40 sm:min-w-[min(100%,11rem)] sm:flex-1 sm:py-2.5"
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-app-md border border-white/[0.08] bg-app-bg-subtle/80"
                style={{ color: block.color }}
              >
                <block.icon size={16} strokeWidth={1.75} className="opacity-95" />
              </span>
              <span className="min-w-0">
                <span className="block font-medium text-app-text">{block.label}</span>
                <span className="mt-0.5 block text-[10px] leading-snug text-app-muted sm:line-clamp-2">
                  {block.description}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
