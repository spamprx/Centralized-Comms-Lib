import Slot from "../components/ui/Slot";

export default function AnalyticsLayout() {
  return (
    <div className="flex min-h-screen flex-col p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <Slot name="AnalyticsHeader" className="h-10 w-48" />
        <Slot name="DateRangePicker" className="h-10 w-56" />
      </div>
      <div className="mb-6 flex gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Slot key={i} name="KPICard" className="h-24 min-w-[12rem] flex-1" />
        ))}
      </div>
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Slot name="ViewsLineChart" className="min-h-[16rem]" />
        <Slot name="EngagementBarChart" className="min-h-[16rem]" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Slot name="ReadingTimeHistogram" className="min-h-[14rem]" />
        <Slot name="ContentTypeBreakdownPie" className="min-h-[14rem]" />
        <Slot name="AIAnalysisSummaryCard" className="min-h-[14rem]" />
      </div>
      <Slot name="TopContentTable" className="mt-6 min-h-[12rem]" />
    </div>
  );
}
