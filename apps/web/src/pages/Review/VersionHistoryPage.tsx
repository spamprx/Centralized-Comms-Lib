import { VersionHistoryLayout } from '../../layouts';

export default function VersionHistoryPage() {
  return (
    <div className="version-history-page-root relative isolate min-h-screen w-full bg-app-bg">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -left-32 top-12 h-[24rem] w-[24rem] rounded-full bg-app-accent/16 blur-3xl" />
        <div className="absolute -right-24 top-[22%] h-80 w-80 rounded-full bg-app-accent-2/14 blur-3xl" />
        <div className="absolute bottom-[-10%] left-1/3 h-72 w-[32rem] -translate-x-1/2 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="absolute right-1/4 top-2/3 h-56 w-56 rounded-full bg-cyan-500/5 blur-3xl" />
      </div>
      <div className="relative z-[1] min-h-screen">
        <VersionHistoryLayout />
      </div>
    </div>
  );
}
