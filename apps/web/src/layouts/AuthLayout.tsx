import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, ArrowRight, Github, Chrome, Eye, EyeOff, BookOpen, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/authService';
import { Button, Surface, formInputClass, formLabelClass } from '../components/ui';

const perks = [
  'Role-aware library and templates',
  'Review flows without leaving context',
  'Analytics tuned for content teams',
];

export default function AuthLayout() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (isSignup) {
        await authService.register(email, displayName || email, password);
        await login(email, password);
      } else {
        await login(email, password);
      }
      navigate('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const authField = `${formInputClass} ring-1 ring-transparent transition-[box-shadow,ring-color,background-color,border-color] duration-[var(--duration-app-slow)] ease-[var(--ease-app-out)] focus:ring-2 focus:ring-app-accent/35 focus:ring-offset-2 focus:ring-offset-app-bg-subtle motion-reduce:transition-colors`;

  return (
    <div className="relative min-h-screen overflow-hidden bg-app-bg">
      <div
        className="pointer-events-none absolute inset-0 app-main-canvas opacity-[0.88]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(147,124,248,0.15),transparent_55%)]"
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 opacity-95" aria-hidden>
        <div className="absolute -left-48 top-[8%] h-[32rem] w-[32rem] rounded-full bg-app-accent/20 blur-[100px]" />
        <div className="absolute left-1/3 top-1/2 h-[22rem] w-[22rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-600/10 blur-[90px]" />
        <div className="absolute -right-40 bottom-[5%] h-[28rem] w-[28rem] rounded-full bg-app-accent-2/16 blur-[100px]" />
      </div>
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(8,10,15,0.4)_70%,rgba(8,10,15,0.85)_100%)]"
        aria-hidden
      />

      <div className="relative mx-auto grid min-h-screen max-w-6xl grid-cols-1 place-items-center gap-12 px-4 py-16 sm:gap-14 sm:py-20 lg:grid-cols-[minmax(0,1fr)_min(440px,100%)] lg:items-center lg:gap-20 lg:px-10 lg:py-12">
        <div className="group order-2 w-full max-w-xl animate-fade-in justify-self-start lg:order-1 lg:justify-self-stretch">
          <div className="mb-8 flex items-center gap-3.5">
            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-app-accent via-violet-500 to-app-accent-2 shadow-[0_12px_48px_-10px_rgba(147,124,248,0.55),inset_0_1px_0_rgba(255,255,255,0.22)] ring-1 ring-white/15">
              <span
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_18%,rgba(255,255,255,0.45),transparent_55%)]"
                aria-hidden
              />
              <BookOpen className="relative text-white" size={26} aria-hidden />
            </div>
            <div>
              <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.22em] text-app-faint">
                CommsLib
              </p>
              <p className="m-0 text-lg font-bold tracking-tight text-app-text">
                Your content command center
              </p>
            </div>
          </div>
          <h2 className="m-0 text-3xl font-bold leading-[1.12] tracking-tight text-app-text md:text-4xl md:leading-[1.1]">
            Sign in to a workspace designed for <span className="app-text-gradient">clarity</span>{' '}
            at scale.
          </h2>
          <p className="mt-5 text-base leading-relaxed text-app-muted md:text-[17px] md:leading-relaxed">
            One library for drafts, reviews, and published work — with guardrails your org can
            trust.
          </p>
          <ul className="mt-10 flex flex-col gap-3.5">
            {perks.map((p) => (
              <li
                key={p}
                className="flex items-start gap-3.5 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3.5 py-2.5 text-sm text-app-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-sm transition-[border-color,background-color,box-shadow] duration-[var(--duration-app-slow)] ease-[var(--ease-app-out)] hover:border-app-accent/20 hover:bg-app-accent-muted/25"
              >
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-app-accent/35 to-app-accent-2/25 text-app-accent shadow-[0_0_16px_-4px_rgba(147,124,248,0.5)] ring-1 ring-white/10">
                  <Check size={12} strokeWidth={3} aria-hidden />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>

        <div className="order-1 w-full max-w-[440px] justify-self-center lg:order-2 lg:max-w-none lg:justify-self-end">
          <div className="relative animate-fade-in-delayed">
            <div
              className="pointer-events-none absolute -inset-3 rounded-[1.5rem] bg-gradient-to-br from-app-accent/35 via-fuchsia-500/15 to-app-accent-2/25 opacity-70 blur-2xl"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute -inset-px rounded-app-xl bg-gradient-to-br from-white/12 via-transparent to-app-accent/20 opacity-80"
              aria-hidden
            />
            <Surface
              padding="lg"
              variant="glass"
              className="relative w-full overflow-hidden border border-white/[0.12] bg-app-bg/50 shadow-[0_32px_120px_-36px_rgba(0,0,0,0.72),0_0_0_1px_rgba(147,124,248,0.14),inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-2xl ring-1 ring-white/[0.06] supports-[backdrop-filter]:bg-app-bg/40"
            >
              <div
                className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"
                aria-hidden
              />
              <div className="relative mb-8 text-center lg:text-left">
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-app-accent via-violet-500 to-app-accent-2 shadow-[0_14px_40px_-12px_rgba(147,124,248,0.55),inset_0_1px_0_rgba(255,255,255,0.2)] ring-1 ring-white/15 lg:mx-0">
                  <span
                    className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_35%_20%,rgba(255,255,255,0.5),transparent_55%)]"
                    aria-hidden
                  />
                  <Lock size={26} className="relative text-white drop-shadow" aria-hidden />
                </div>
                <h1 className="m-0 text-2xl font-bold tracking-tight text-app-text">
                  {isSignup ? 'Create your account' : 'Welcome back'}
                </h1>
                <p className="mt-2.5 text-sm leading-relaxed text-app-muted">
                  {isSignup
                    ? 'Set up your profile to start collaborating.'
                    : 'Sign in to continue to CommsLib.'}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="relative flex flex-col gap-5">
                {error ? (
                  <div
                    role="alert"
                    className="rounded-xl border border-red-400/30 bg-red-500/[0.12] px-3.5 py-3 text-xs leading-relaxed text-red-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_24px_-8px_rgba(239,68,68,0.2)] backdrop-blur-sm"
                  >
                    {error}
                  </div>
                ) : null}

                {isSignup ? (
                  <div>
                    <label htmlFor="auth-display-name" className={formLabelClass}>
                      Full name
                    </label>
                    <input
                      id="auth-display-name"
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="John Doe"
                      required
                      autoComplete="name"
                      className={authField}
                    />
                  </div>
                ) : null}

                <div>
                  <label htmlFor="auth-email" className={formLabelClass}>
                    Email
                  </label>
                  <div className="group relative">
                    <Mail
                      size={16}
                      className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-app-muted transition-colors duration-200 group-focus-within:text-app-accent"
                      aria-hidden
                    />
                    <input
                      id="auth-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      autoComplete="email"
                      className={`${authField} pl-10`}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="auth-password" className={formLabelClass}>
                    Password
                  </label>
                  <div className="relative password-input-hide-reveal">
                    <input
                      id="auth-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      autoComplete={isSignup ? 'new-password' : 'current-password'}
                      className={`${authField} pr-12`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl border border-white/10 bg-app-bg/70 text-app-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md transition-[transform,background-color,border-color,color,box-shadow] duration-[var(--duration-app)] ease-[var(--ease-app-out)] hover:-translate-y-px hover:border-app-accent/25 hover:bg-app-surface-hover/90 hover:text-app-text hover:shadow-[0_0_20px_-8px_rgba(147,124,248,0.25)] active:translate-y-0 motion-reduce:hover:translate-y-0"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {!isSignup ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-0.5">
                    <label className="flex cursor-pointer items-center gap-2.5 text-xs text-app-muted transition-colors hover:text-app-text">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="h-4 w-4 rounded border-white/15 bg-app-bg/60 text-app-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-[border-color,box-shadow] duration-200 focus:ring-2 focus:ring-app-accent/40 focus:ring-offset-2 focus:ring-offset-app-bg-subtle"
                      />
                      Remember me
                    </label>
                    <a
                      href="#"
                      className="text-xs font-medium text-app-accent transition-[color,text-underline-offset] duration-200 hover:text-app-accent-hover hover:underline hover:underline-offset-4"
                      onClick={(e) => e.preventDefault()}
                    >
                      Forgot password?
                    </a>
                  </div>
                ) : null}

                <Button
                  type="submit"
                  variant="primary"
                  disabled={loading}
                  className="mt-1 w-full py-3.5 text-[15px] shadow-[0_0_40px_-12px_rgba(147,124,248,0.45)]"
                  rightIcon={!loading ? <ArrowRight size={17} aria-hidden /> : undefined}
                >
                  {loading
                    ? isSignup
                      ? 'Creating account…'
                      : 'Signing in…'
                    : isSignup
                      ? 'Sign up'
                      : 'Sign in'}
                </Button>
              </form>

              <div className="my-7 flex items-center gap-4">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/15 to-white/10" />
                <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.16em] text-app-faint">
                  or continue with
                </span>
                <div className="h-px flex-1 bg-gradient-to-l from-transparent via-white/15 to-white/10" />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[13px] font-semibold text-app-text shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md transition-[transform,background-color,border-color,box-shadow] duration-[var(--duration-app-slow)] ease-[var(--ease-app-out)] hover:-translate-y-0.5 hover:border-app-accent/25 hover:bg-app-accent-muted/20 hover:shadow-[0_12px_40px_-16px_rgba(147,124,248,0.2)] active:translate-y-0 motion-reduce:hover:translate-y-0"
                >
                  <Chrome size={16} aria-hidden />
                  Google
                </button>
                <button
                  type="button"
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[13px] font-semibold text-app-text shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md transition-[transform,background-color,border-color,box-shadow] duration-[var(--duration-app-slow)] ease-[var(--ease-app-out)] hover:-translate-y-0.5 hover:border-app-accent/25 hover:bg-app-accent-muted/20 hover:shadow-[0_12px_40px_-16px_rgba(147,124,248,0.2)] active:translate-y-0 motion-reduce:hover:translate-y-0"
                >
                  <Github size={16} aria-hidden />
                  GitHub
                </button>
              </div>

              <p className="mt-8 text-center text-[13px] text-app-muted lg:text-left">
                {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsSignup((v) => !v);
                    setError(null);
                  }}
                  className="border-none bg-transparent p-0 font-semibold text-app-accent underline decoration-app-accent/30 underline-offset-4 transition-[color,text-decoration-color] duration-200 hover:text-app-accent-hover hover:decoration-app-accent-hover/50"
                >
                  {isSignup ? 'Sign in' : 'Sign up'}
                </button>
              </p>
            </Surface>
          </div>
        </div>
      </div>
    </div>
  );
}
