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
    <div className="relative min-h-screen overflow-hidden bg-app-bg text-app-text">
      <div className="pointer-events-none absolute inset-0 app-hero-grid opacity-60" aria-hidden />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(ellipse_90%_70%_at_50%_-20%,rgba(147,124,248,0.28),transparent_55%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-40 top-1/3 h-[420px] w-[420px] rounded-full bg-cyan-500/10 blur-3xl"
        aria-hidden
      />

      <header className="relative border-b border-app-border/60 bg-app-bg/55 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-app-page py-4 md:px-app-page-lg">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-app-lg bg-gradient-to-br from-app-accent to-cyan-500 shadow-[0_8px_32px_-8px_rgba(147,124,248,0.55)] ring-2 ring-white/10">
              <BookOpen size={22} className="text-white" aria-hidden />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-app-text">CommsLib</span>
              <p className="m-0 text-[11px] text-app-faint">Centralized communications library</p>
            </div>
          </div>
          <Button variant="primary" onClick={() => navigate('/login')}>
            Sign in
          </Button>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-app-page pb-24 pt-12 md:px-app-page-lg md:pt-16">
        <section className="mx-auto max-w-3xl text-center animate-fade-in">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-app-border/90 bg-app-surface/60 px-4 py-1.5 text-xs font-medium text-app-muted shadow-app-soft backdrop-blur-md">
            <Sparkles size={14} className="text-app-accent" aria-hidden />
            Modern content operations
            <span className="hidden h-1 w-1 rounded-full bg-app-faint sm:inline" aria-hidden />
            <span className="hidden text-app-faint sm:inline">Built for distributed teams</span>
          </p>
          <h1 className="m-0 text-4xl font-bold tracking-tight text-app-text sm:text-5xl md:text-6xl md:leading-[1.08]">
            Create. Share. <span className="app-text-gradient">Inspire.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-app-muted sm:text-lg">
            The all-in-one surface for creating, managing, and distributing content — with clarity
            for authors and confidence for admins.
          </p>
          <div className="mt-11 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <Button
              variant="primary"
              className="px-9 py-3.5 text-base shadow-app-glow"
              rightIcon={<ArrowRight size={18} aria-hidden />}
              onClick={() => navigate('/login')}
            >
              Get started
            </Button>
            <Button
              variant="outline"
              className="px-9 py-3.5 text-base"
              onClick={() => navigate('/login')}
            >
              Sign in
            </Button>
          </div>
        </section>

        <section className="mx-auto mt-14 grid max-w-4xl grid-cols-3 gap-px rounded-2xl border border-app-border/80 bg-app-border/50 p-px shadow-app-soft md:mt-20">
          {stats.map(({ value, label, icon: Icon }) => (
            <div
              key={label}
              className="flex flex-col items-center justify-center bg-app-bg/90 px-3 py-5 text-center backdrop-blur-md first:rounded-l-2xl last:rounded-r-2xl md:flex-row md:gap-3 md:px-6 md:py-6 md:text-left"
            >
              <Icon className="mb-2 h-8 w-8 text-app-accent/90 md:mb-0" aria-hidden />
              <div>
                <p className="m-0 text-xl font-bold tracking-tight text-app-text md:text-2xl">
                  {value}
                </p>
                <p className="m-0 mt-0.5 text-[11px] text-app-faint md:text-xs">{label}</p>
              </div>
            </div>
          ))}
        </section>

        <section className="mt-16 md:mt-24">
          <p className="mb-6 text-center text-xs font-semibold uppercase tracking-[0.2em] text-app-faint">
            Why teams choose CommsLib
          </p>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {highlights.map(({ icon: Icon, title, body, span }) => (
              <article
                key={title}
                className={`group relative overflow-hidden rounded-app-xl border border-app-border/90 bg-app-surface/45 p-6 shadow-app-soft backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-app-accent/30 hover:shadow-app-glow ${span}`}
              >
                <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-app-accent/15 blur-2xl transition-opacity group-hover:opacity-100" />
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-app-lg bg-app-accent-muted text-app-accent ring-1 ring-app-accent/20 transition-transform duration-300 group-hover:scale-110">
                  <Icon size={22} aria-hidden />
                </div>
                <h2 className="m-0 text-lg font-semibold text-app-text">{title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-app-muted">{body}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="relative border-t border-app-border/60 bg-app-bg/40 py-10 text-center backdrop-blur-sm">
        <p className="m-0 text-xs text-app-faint">
          © {new Date().getFullYear()} CommsLib — Crafted for clarity at scale.
        </p>
      </footer>
    </div>
  );
}
