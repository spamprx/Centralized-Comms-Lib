import Slot from "../components/ui/Slot";

export default function LibraryLayout() {
  return (
    <div className="flex min-h-screen flex-col p-6">
      <Slot name="PageHeader" className="mb-6 h-12 w-full" />
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <Slot name="SearchAndFilterBar" className="h-10 max-w-md flex-1" />
        <Slot name="SortDropdown" className="h-10 w-40" />
        <Slot name="FilterPanel" className="h-8 w-32" />
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <Slot name="TagFilterPills" className="h-8 w-24" />
        <Slot name="ActiveFilterTags" className="h-8 w-24" />
        <Slot name="ActiveFilterTags" className="h-8 w-24" />
      </div>
      <div className="grid flex-1 grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
          <Slot key={i} name="ContentCard" className="min-h-[14rem]" />
        ))}
      </div>
      <Slot name="Pagination" className="mt-6 h-12 w-full" />
    </div>
  );
}
