import Slot from "../components/ui/Slot";

export default function ReadingLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Slot name="ReadingProgressBar" className="h-1 w-full shrink-0" />
      <Slot name="ReadingTopbar" className="h-14 w-full shrink-0" />
      <div className="flex flex-1">
        <main className="min-w-0 flex-1 px-6 py-8">
          <Slot name="ContentBody" className="mx-auto max-w-3xl min-h-[40rem]" />
          <Slot name="RelatedContentRow" className="mx-auto mt-12 max-w-3xl min-h-[12rem]" />
        </main>
        <Slot name="SideAnnotationsPanel" className="w-64 shrink-0" />
      </div>
      <Slot name="FooterEngagementBar" className="mt-auto h-16 w-full shrink-0" />
    </div>
  );
}
