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
    <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] pb-3">
      <span className="text-[10px] font-medium uppercase tracking-wider text-app-faint">New row</span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-1.5">
        {BLOCKS.map((block) => (
          <button
            key={block.kind}
            type="button"
            disabled={disabled}
            onClick={() => onPick(block.kind)}
            title={block.description}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[11px] font-medium text-app-text hover:border-app-accent/35 hover:bg-app-accent-muted/30 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <block.icon size={14} strokeWidth={1.75} style={{ color: block.color }} aria-hidden />
            {block.label}
          </button>
        ))}
      </div>
    </div>
  );
}
