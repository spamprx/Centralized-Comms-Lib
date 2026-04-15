import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/authService';
import { Button, Surface, formInputClass, formLabelClass } from '../components/ui';

export default function AuthLayout() {
  const [searchParams] = useSearchParams();
  const initialIsSignup = useMemo(() => searchParams.get('signup') === '1', [searchParams]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isSignup, setIsSignup] = useState(initialIsSignup);
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
    <div className="min-h-screen bg-app-bg text-app-text">
      <main className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6 py-16">
        <Surface
          padding="lg"
          variant="default"
          className="w-full max-w-[420px] border border-white/10 bg-app-bg"
        >
          <div className="mb-8">
            <p className="m-0 text-xs font-medium tracking-wide text-app-faint">CommsLib</p>
            <h1 className="mt-2 text-xl font-semibold tracking-tight text-app-text">
              {isSignup ? 'Create account' : 'Sign in'}
            </h1>
            <p className="mt-2 text-sm text-app-muted">
              {isSignup ? 'Create an account to continue.' : 'Sign in to continue.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                {error ? (
                  <div
                    role="alert"
                    className="rounded-lg border border-red-400/30 bg-red-500/10 px-3.5 py-3 text-xs leading-relaxed text-red-100"
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
                      className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl border border-white/10 bg-app-bg text-app-muted transition-colors hover:bg-white/5 hover:text-app-text"
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
                  </div>
                ) : null}

                <Button
                  type="submit"
                  variant="primary"
                  disabled={loading}
                  className="mt-1 w-full py-3"
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
      </main>
    </div>
  );
}
