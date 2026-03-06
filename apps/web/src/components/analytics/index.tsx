import Slot from "../ui/Slot";

export function AnalyticsHeader() {
  return <Slot className="h-10 w-48" />;
}
export function DateRangePicker() {
  return <Slot className="h-10 w-56" />;
}
export function KPICardsRow() {
  return (
    <div className="flex gap-4">
      {[1, 2, 3, 4].map((i) => (
        <Slot key={i} className="h-24 min-w-[12rem] flex-1" />
      ))}
    </div>
  );
}
export function ChartsGrid() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Slot className="min-h-[16rem]" />
      <Slot className="min-h-[16rem]" />
    </div>
  );
}
export function TopContentTable() {
  return <Slot className="min-h-[12rem]" />;
}
