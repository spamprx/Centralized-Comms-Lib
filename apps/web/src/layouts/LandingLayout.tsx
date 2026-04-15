import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Layers,
  Users,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap,
  BarChart3,
} from 'lucide-react';
import { Button } from '../components/ui';

const highlights = [
  {
    icon: Layers,
    title: 'Unified library',
    body: 'Browse, filter, and share content with a consistent experience across teams.',
    span: 'md:col-span-1',
  },
  {
    icon: Users,
    title: 'Built for collaboration',
    body: 'Reviews, version history, and roles keep everyone aligned without noise.',
    span: 'md:col-span-1',
  },
  {
    icon: ShieldCheck,
    title: 'Governance-ready',
    body: 'Structured workflows and audit-friendly patterns as you scale.',
    span: 'md:col-span-2 lg:col-span-1',
  },
];

const stats = [
  { value: '99.9%', label: 'Uptime mindset', icon: Zap },
  { value: '50+', label: 'Content types', icon: Layers },
  { value: '24/7', label: 'Async workflows', icon: BarChart3 },
];

export default function LandingLayout() {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-app-bg text-app-text">
      <div
        className="pointer-events-none absolute inset-0 app-main-canvas opacity-[0.75]"
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 app-hero-grid opacity-50" aria-hidden />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_100%_60%_at_50%_-15%,rgba(147,124,248,0.22),transparent_58%)]"
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 opacity-90" aria-hidden>
        <div className="absolute -left-48 top-[12%] h-[36rem] w-[36rem] rounded-full bg-app-accent/18 blur-[120px]" />
        <div className="absolute right-[-20%] top-[22%] h-[28rem] w-[28rem] rounded-full bg-violet-600/12 blur-[100px]" />
        <div className="absolute -right-32 bottom-[8%] h-[26rem] w-[26rem] rounded-full bg-app-accent-2/14 blur-[110px]" />
      </div>
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(8,10,15,0.35)_65%,rgba(8,10,15,0.88)_100%)]"
        aria-hidden
      />

      <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-app-bg/50 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] backdrop-blur-2xl supports-[backdrop-filter]:bg-app-bg/35">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-app-page py-4 md:px-app-page-lg md:py-5">
          <div className="flex min-w-0 items-center gap-3.5">
            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-app-accent via-violet-500 to-app-accent-2 shadow-[0_10px_40px_-10px_rgba(147,124,248,0.55),inset_0_1px_0_rgba(255,255,255,0.2)] ring-1 ring-white/12">
              <span
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_32%_18%,rgba(255,255,255,0.45),transparent_55%)]"
                aria-hidden
              />
              <BookOpen size={22} className="relative text-white drop-shadow" aria-hidden />
            </div>
            <div className="min-w-0">
              <span className="block truncate text-lg font-bold tracking-tight text-app-text">
                CommsLib
              </span>
              <p className="m-0 truncate text-[11px] font-medium uppercase tracking-[0.14em] text-app-faint">
                Centralized communications library
              </p>
            </div>
          </div>
          <Button
            variant="primary"
            className="shrink-0 shadow-[0_0_28px_-8px_rgba(147,124,248,0.45)]"
            onClick={() => navigate('/login')}
          >
            Sign in
          </Button>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-app-page pb-28 pt-14 md:px-app-page-lg md:pb-32 md:pt-20">
        <section className="group relative mx-auto max-w-4xl text-center">
          <div
            className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[min(42rem,120%)] -translate-x-1/2 rounded-full bg-app-accent/10 blur-[80px]"
            aria-hidden
          />
          <p className="relative mb-6 inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-medium text-app-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md transition-[border-color,box-shadow,background-color] duration-[var(--duration-app-slow)] ease-[var(--ease-app-out)] hover:border-app-accent/25 hover:bg-app-accent-muted/15">
            <span className="flex h-1.5 w-1.5 shrink-0 rounded-full bg-app-accent shadow-[0_0_12px_rgba(147,124,248,0.85)]" />
            <Sparkles size={14} className="shrink-0 text-app-accent" aria-hidden />
            <span>Modern content operations</span>
            <span
              className="hidden h-1 w-1 shrink-0 rounded-full bg-app-faint sm:inline"
              aria-hidden
            />
            <span className="hidden text-app-faint sm:inline">Built for distributed teams</span>
          </p>
          <h1 className="relative m-0 text-[2.65rem] font-bold leading-[1.05] tracking-[-0.03em] text-app-text sm:text-5xl md:text-6xl lg:text-[3.5rem] lg:leading-[1.02]">
            Create. Share. <span className="app-text-gradient">Inspire.</span>
          </h1>
          <p className="relative mx-auto mt-7 max-w-2xl text-pretty text-base leading-relaxed text-app-muted sm:text-lg sm:leading-relaxed md:text-xl md:leading-relaxed">
            The all-in-one surface for creating, managing, and distributing content — with clarity
            for authors and confidence for admins.
          </p>
          <div className="relative mt-12 flex flex-col items-stretch justify-center gap-3 sm:mt-14 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-4">
            <Button
              variant="primary"
              className="px-10 py-3.5 text-base shadow-[0_0_48px_-12px_rgba(147,124,248,0.5)] sm:min-w-[12rem]"
              rightIcon={<ArrowRight size={18} aria-hidden />}
              onClick={() => navigate('/login')}
            >
              Get started
            </Button>
            <Button
              variant="outline"
              className="border-white/12 bg-white/[0.03] px-10 py-3.5 text-base shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-sm transition-[transform,box-shadow,border-color] duration-[var(--duration-app-slow)] ease-[var(--ease-app-out)] hover:-translate-y-0.5 hover:border-app-accent/35 hover:bg-app-accent-muted/10 hover:shadow-[0_12px_40px_-16px_rgba(147,124,248,0.2)] motion-reduce:hover:translate-y-0 sm:min-w-[12rem]"
              onClick={() => navigate('/login')}
            >
              Sign in
            </Button>
          </div>
        </section>

        <section className="relative mx-auto mt-20 max-w-5xl md:mt-28">
          <div className="grid gap-4 sm:grid-cols-3">
            {stats.map(({ value, label, icon: Icon }) => (
              <div
                key={label}
                className="group/card relative overflow-hidden rounded-2xl border border-white/10 bg-app-surface/35 p-6 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_20px_60px_-28px_rgba(0,0,0,0.55)] backdrop-blur-xl transition-[transform,border-color,box-shadow,background-color] duration-[var(--duration-app-slow)] ease-[var(--ease-app-out)] motion-reduce:transition-shadow hover:-translate-y-1 hover:border-app-accent/25 hover:bg-app-surface/50 hover:shadow-[0_24px_70px_-24px_rgba(147,124,248,0.18)] motion-reduce:hover:translate-y-0 md:p-7 md:text-left"
              >
                <div
                  className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-app-accent/20 blur-3xl opacity-60 transition-opacity duration-500 group-hover/card:opacity-100"
                  aria-hidden
                />
                <div className="relative flex flex-col items-center gap-3 md:flex-row md:items-center md:gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-app-accent-muted to-white/[0.04] text-app-accent ring-1 ring-app-accent/25 transition-transform duration-[var(--duration-app-slow)] ease-[var(--ease-app-out)] group-hover/card:scale-105">
                    <Icon className="h-7 w-7" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <p className="m-0 text-2xl font-bold tracking-tight text-app-text md:text-3xl">
                      {value}
                    </p>
                    <p className="m-0 mt-1 text-[11px] font-medium uppercase tracking-[0.12em] text-app-faint md:text-xs">
                      {label}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="relative mx-auto mt-24 max-w-6xl md:mt-32">
          <div className="mb-10 flex flex-col items-center gap-4 text-center md:mb-14 md:flex-row md:items-end md:justify-between md:text-left">
            <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.22em] text-app-faint">
              Why teams choose CommsLib
            </p>
            <div className="hidden h-px w-32 bg-gradient-to-r from-transparent via-white/15 to-transparent md:block" />
          </div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
            {highlights.map(({ icon: Icon, title, body, span }) => (
              <article
                key={title}
                className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-app-bg-subtle/30 p-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_24px_70px_-32px_rgba(0,0,0,0.55)] backdrop-blur-xl transition-[transform,border-color,box-shadow] duration-[var(--duration-app-slow)] ease-[var(--ease-app-out)] motion-reduce:transition-shadow hover:-translate-y-1.5 hover:border-app-accent/30 hover:shadow-[0_28px_80px_-28px_rgba(147,124,248,0.22)] motion-reduce:hover:translate-y-0 ${span}`}
              >
                <div
                  className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-app-accent-2/15 blur-3xl opacity-70 transition-opacity duration-500 group-hover:opacity-100"
                  aria-hidden
                />
                <div
                  className="pointer-events-none absolute -bottom-16 left-1/2 h-32 w-[120%] -translate-x-1/2 bg-gradient-to-t from-app-accent/10 to-transparent opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
                  aria-hidden
                />
                <div className="relative mb-5 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-app-bg/50 text-app-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-white/10 transition-[transform,box-shadow,color] duration-[var(--duration-app-slow)] ease-[var(--ease-app-out)] group-hover:scale-110 group-hover:text-app-accent-hover group-hover:shadow-[0_0_28px_-10px_rgba(147,124,248,0.45)]">
                  <Icon size={24} aria-hidden />
                </div>
                <h2 className="relative m-0 text-xl font-semibold tracking-tight text-app-text md:text-[1.35rem]">
                  {title}
                </h2>
                <p className="relative mt-3 text-sm leading-relaxed text-app-muted md:text-[15px] md:leading-relaxed">
                  {body}
                </p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="relative border-t border-white/[0.08] bg-app-bg/45 py-12 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-md">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-px max-w-md bg-gradient-to-r from-transparent via-app-accent/30 to-transparent"
          aria-hidden
        />
        <p className="relative m-0 text-xs font-medium tracking-wide text-app-faint">
          © {new Date().getFullYear()} CommsLib — Crafted for clarity at scale.
        </p>
      </footer>
    </div>
  );
}
