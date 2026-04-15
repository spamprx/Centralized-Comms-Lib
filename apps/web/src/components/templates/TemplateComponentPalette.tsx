import { PlusSquare } from 'lucide-react';

type TemplateComponentPaletteProps = {
  onAdd: () => void;
  disabled?: boolean;
};

export default function TemplateComponentPalette({
  onAdd,
  disabled,
}: TemplateComponentPaletteProps) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5 border-b border-white/[0.06] pb-3">
      <button
        type="button"
        disabled={disabled}
        onClick={onAdd}
        title="Add a new layout block row"
        className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[11px] font-medium text-app-text hover:border-app-accent/35 hover:bg-app-accent-muted/30 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <PlusSquare size={14} strokeWidth={1.75} className="text-app-accent" aria-hidden />
        Add block
      </button>
    </div>
  );
}
