import { ProfileLayout } from '../../layouts';

export default function ProfilePage() {
  return (
    <div className="profile-page-root relative isolate flex min-h-screen w-full flex-1 flex-col bg-app-bg app-main-canvas">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -left-24 top-16 h-80 w-80 rounded-full bg-app-accent/14 blur-[100px]" />
        <div className="absolute right-0 top-1/3 h-72 w-72 rounded-full bg-app-accent-2/10 blur-[90px]" />
        <div className="absolute bottom-1/4 left-1/3 h-64 w-64 rounded-full bg-app-accent/8 blur-[80px]" />
      </div>
      <div className="relative z-1 min-h-screen flex-1">
        <ProfileLayout />
      </div>
    </div>
  );
}
