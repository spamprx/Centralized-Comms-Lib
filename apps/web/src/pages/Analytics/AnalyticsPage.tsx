import { AnalyticsLayout } from '../../layouts';

/** Analytics route — data and charts live in `AnalyticsLayout`. */
export default function AnalyticsPage() {
  return (
    <div className="analytics-page-root relative isolate flex min-h-screen w-full flex-1 flex-col bg-app-bg">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -left-28 top-24 h-72 w-72 rounded-full bg-app-accent/12 blur-[100px]" />
        <div className="absolute right-0 top-1/3 h-64 w-64 rounded-full bg-app-accent-2/10 blur-[90px]" />
      </div>
      <div className="relative z-[1] min-h-screen flex-1">
        <AnalyticsLayout />
      </div>
    </div>
  );
}
