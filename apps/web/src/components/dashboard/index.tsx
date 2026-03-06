import Slot from "../ui/Slot";

export function DashboardSidebar() {
  return <Slot className="h-full w-64 shrink-0" />;
}
export function DashboardHeader() {
  return <Slot className="h-16 w-full" />;
}
export function StatsRow() {
  return (
    <div className="flex gap-4">
      {[1, 2, 3, 4].map((i) => (
        <Slot key={i} className="h-24 min-w-[12rem] flex-1" />
      ))}
    </div>
  );
}
export function QuickActionsPanel() {
  return <Slot className="min-h-[12rem] flex-1" />;
}
export function RecentActivityFeed() {
  return <Slot className="min-h-[12rem] w-80 shrink-0" />;
}
export function NotificationsSummary() {
  return <Slot className="min-h-[16rem]" />;
}
