import Slot from "../ui/Slot";

export function PageHeader() {
  return <Slot className="h-12 w-full" />;
}
export function SearchAndFilterBar() {
  return <Slot className="h-10 max-w-md flex-1" />;
}
export function ContentGrid() {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
        <Slot key={i} className="min-h-[14rem]" />
      ))}
    </div>
  );
}
export function Pagination() {
  return <Slot className="h-12 w-full" />;
}
