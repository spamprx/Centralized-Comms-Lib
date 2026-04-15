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
    <div className="flex flex-wrap items-center justify-end gap-2 border-b border-white/[0.08] bg-black/15 pb-3 pt-0.5 backdrop-blur-sm">
      <button
        type="button"
        disabled={disabled}
        onClick={onAdd}
        title="Add a new layout block row"
        className="inline-flex items-center gap-1.5 rounded-app-md border border-white/[0.12] bg-gradient-to-r from-white/[0.07] to-white/[0.03] px-3 py-1.5 text-[11px] font-semibold text-app-text shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-[transform,border-color,box-shadow,background-color,color] duration-(--duration-app-slow) ease-(--ease-app-out) hover:border-app-accent/40 hover:from-app-accent/15 hover:to-app-accent-2/10 hover:text-app-accent hover:shadow-[0_0_20px_-8px_rgba(147,124,248,0.35)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:shadow-none"
      >
        <PlusSquare size={14} strokeWidth={1.75} className="text-app-accent" aria-hidden />
        Add block
      </button>
    </div>
  );
}
