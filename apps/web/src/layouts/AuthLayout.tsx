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

  return (
    <div className="relative min-h-screen overflow-hidden bg-app-bg">
      <div
        className="pointer-events-none absolute inset-0 app-main-canvas opacity-80"
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 opacity-90" aria-hidden>
        <div className="absolute -left-40 top-0 h-[28rem] w-[28rem] rounded-full bg-app-accent/18 blur-3xl" />
        <div className="absolute -right-32 bottom-0 h-96 w-96 rounded-full bg-cyan-500/12 blur-3xl" />
      </div>

      <div className="relative mx-auto grid min-h-screen max-w-6xl grid-cols-1 items-center gap-10 px-4 py-12 lg:grid-cols-[1fr_min(420px,100%)] lg:gap-16 lg:px-8">
        <div className="animate-fade-in order-2 max-w-xl lg:order-1">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-app-lg bg-gradient-to-br from-app-accent to-cyan-500 shadow-app-glow ring-2 ring-white/10">
              <BookOpen className="text-white" size={26} aria-hidden />
            </div>
            <div>
              <p className="m-0 text-xs font-semibold uppercase tracking-[0.2em] text-app-faint">
                CommsLib
              </p>
              <p className="m-0 text-lg font-bold text-app-text">Your content command center</p>
            </div>
          </div>
          <h2 className="m-0 text-3xl font-bold leading-tight tracking-tight text-app-text md:text-4xl md:leading-tight">
            Sign in to a workspace designed for <span className="app-text-gradient">clarity</span>{' '}
            at scale.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-app-muted">
            One library for drafts, reviews, and published work — with guardrails your org can
            trust.
          </p>
          <ul className="mt-8 flex flex-col gap-3">
            {perks.map((p) => (
              <li key={p} className="flex items-start gap-3 text-sm text-app-muted">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-app-accent-muted text-app-accent">
                  <Check size={12} strokeWidth={3} aria-hidden />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>

        <div className="order-1 w-full lg:order-2">
          <Surface
            padding="lg"
            variant="glass"
            className="animate-fade-in-delayed w-full shadow-app-glow"
          >
            <div className="mb-8 text-center lg:text-left">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-app-lg bg-gradient-to-br from-app-accent to-cyan-500 shadow-app-soft lg:mx-0">
                <Lock size={24} className="text-white" aria-hidden />
              </div>
              <h1 className="m-0 text-xl font-bold text-app-text">
                {isSignup ? 'Create your account' : 'Welcome back'}
              </h1>
              <p className="mt-2 text-sm text-app-muted">
                {isSignup
                  ? 'Set up your profile to start collaborating.'
                  : 'Sign in to continue to CommsLib.'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {error ? (
                <div
                  role="alert"
                  className="rounded-app-md border border-red-500/25 bg-red-500/10 px-3 py-2.5 text-xs text-red-200"
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
                    className={formInputClass}
                  />
                </div>
              ) : null}

              <div>
                <label htmlFor="auth-email" className={formLabelClass}>
                  Email
                </label>
                <div className="relative">
                  <Mail
                    size={16}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-app-faint"
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
                    className={`${formInputClass} pl-10`}
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
                    className={`${formInputClass} pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-app-md border border-app-border bg-app-bg/80 text-app-muted transition-colors hover:border-app-border-strong hover:text-app-text"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {!isSignup ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-app-muted">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-4 w-4 rounded border-app-border bg-app-surface text-app-accent focus:ring-app-accent"
                    />
                    Remember me
                  </label>
                  <a
                    href="#"
                    className="text-xs text-app-accent hover:text-app-accent-hover"
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
                className="w-full py-3"
                rightIcon={!loading ? <ArrowRight size={16} aria-hidden /> : undefined}
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

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-app-border" />
              <span className="text-xs text-app-faint">or continue with</span>
              <div className="h-px flex-1 bg-app-border" />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                className="flex flex-1 items-center justify-center gap-2 rounded-app-md border border-app-border bg-app-bg/50 px-4 py-2.5 text-[13px] font-medium text-app-text transition-colors hover:border-app-border-strong hover:bg-app-surface-hover"
              >
                <Chrome size={16} aria-hidden />
                Google
              </button>
              <button
                type="button"
                className="flex flex-1 items-center justify-center gap-2 rounded-app-md border border-app-border bg-app-bg/50 px-4 py-2.5 text-[13px] font-medium text-app-text transition-colors hover:border-app-border-strong hover:bg-app-surface-hover"
              >
                <Github size={16} aria-hidden />
                GitHub
              </button>
            </div>

            <p className="mt-6 text-center text-[13px] text-app-muted lg:text-left">
              {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
              <button
                type="button"
                onClick={() => {
                  setIsSignup((v) => !v);
                  setError(null);
                }}
                className="border-none bg-transparent p-0 font-semibold text-app-accent hover:text-app-accent-hover"
              >
                {isSignup ? 'Sign in' : 'Sign up'}
              </button>
            </p>
          </Surface>
        </div>
      </div>
    </div>
  );
}
