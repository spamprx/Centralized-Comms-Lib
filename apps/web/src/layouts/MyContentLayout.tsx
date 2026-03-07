import Slot from "../components/ui/Slot";

export default function MyContentLayout() {
  return (
    <div className="flex min-h-screen flex-col p-6">
      <Slot name="PageHeader" className="mb-6 h-12 w-full" />
      <div className="mb-6 flex gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Slot key={i} name="StatCard" className="h-20 min-w-[10rem] flex-1" />
        ))}
      </div>
      <div className="mb-4 flex flex-wrap gap-4">
        <Slot name="SearchBar" className="h-10 max-w-sm flex-1" />
        <Slot name="StatusFilterTabs" className="h-10 w-full max-w-xs" />
      </div>
      <Slot name="ContentTable" className="min-h-[24rem] flex-1" />
    </div>
  );
}
