import Slot from "../ui/Slot";

export function AdminSidebar() {
  return <Slot className="h-full w-56 shrink-0" />;
}
export function AdminTabs() {
  return (
    <div className="flex gap-2 border-b border-app-border pb-4">
      <Slot className="h-9 w-24" />
      <Slot className="h-9 w-24" />
      <Slot className="h-9 w-24" />
      <Slot className="h-9 w-24" />
    </div>
  );
}
export function AdminMain() {
  return <Slot className="min-h-[28rem] w-full" />;
}
