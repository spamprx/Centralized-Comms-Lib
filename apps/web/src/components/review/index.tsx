import Slot from '../ui/Slot';

export function ReviewTopbar() {
  return <Slot className="h-14 w-full shrink-0" />;
}
export function ContentViewPanel() {
  return <Slot className="min-h-0 flex-1 overflow-auto" />;
}
export function ReviewActionsPanel() {
  return (
    <div className="flex w-96 shrink-0 flex-col gap-4 border-l border-white/[0.08] bg-app-bg/30 p-4 backdrop-blur-md">
      <Slot className="h-14" />
      <Slot className="min-h-[8rem]" />
      <Slot className="min-h-[12rem]" />
      <Slot className="min-h-[8rem]" />
      <Slot className="min-h-[10rem]" />
    </div>
  );
}
