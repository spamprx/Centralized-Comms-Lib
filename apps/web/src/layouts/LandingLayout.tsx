import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui';
import { useAuth } from '../context/AuthContext';

export default function LandingLayout() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-app-bg text-app-text">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-5">
          <div className="min-w-0">
            <p className="m-0 text-xs font-medium tracking-wide text-app-faint">CommsLib</p>
          </div>
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <Button variant="primary" onClick={() => navigate('/dashboard')}>
                Dashboard
              </Button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => navigate('/login?signup=1')}
                  className="rounded-app-lg border border-white/10 bg-transparent px-3 py-2 text-[13px] font-semibold text-app-text transition-colors hover:bg-white/5"
                >
                  Create account
                </button>
                <Button variant="primary" onClick={() => navigate('/login')}>
                  Sign in
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-16">
        <section className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start">
          <div className="min-w-0">
            <h1 className="m-0 text-4xl font-semibold tracking-tight text-app-text md:text-5xl">
              A calm workspace for content.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-app-muted">
              Drafts, reviews, and version history — with guardrails that stay out of your way.
            </p>

            <div className="mt-8 rounded-app-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-app-muted">
              {isAuthenticated ? (
                <>
                  You’re signed in. Use the header to open{' '}
                  <span className="font-semibold text-app-text">Dashboard</span>.
                </>
              ) : (
                <>
                  Use the header to <span className="font-semibold text-app-text">Sign in</span> or{' '}
                  <span className="font-semibold text-app-text">Create account</span>.
                </>
              )}
            </div>

            <p className="mt-4 text-xs leading-relaxed text-app-faint">
              Tip: start with templates and tighten rules later.
            </p>
          </div>

          <div className="rounded-app-xl border border-white/10 bg-white/5 p-5">
            <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.16em] text-app-faint">
              What you get
            </p>
            <ul className="mt-4 space-y-3 text-sm text-app-muted">
              <li className="flex gap-2">
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-white/25" />
                Co-authoring, reviewer assignment, and guarded restores.
              </li>
              <li className="flex gap-2">
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-white/25" />
                Templates with channel restrictions and validation.
              </li>
              <li className="flex gap-2">
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-white/25" />A library
                to find and reuse approved content.
              </li>
            </ul>
          </div>
        </section>

        <section className="mt-16 border-t border-white/10 pt-12">
          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <p className="m-0 text-sm font-semibold text-app-text">Create</p>
              <p className="mt-2 text-sm leading-relaxed text-app-muted">
                Start from a template and compose content with a structured editor.
              </p>
            </div>
            <div>
              <p className="m-0 text-sm font-semibold text-app-text">Collaborate</p>
              <p className="mt-2 text-sm leading-relaxed text-app-muted">
                Invite co-authors, assign reviewers, and keep sessions safe during restores.
              </p>
            </div>
            <div>
              <p className="m-0 text-sm font-semibold text-app-text">Govern</p>
              <p className="mt-2 text-sm leading-relaxed text-app-muted">
                Add channel restrictions and validate layouts before publishing.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-16 rounded-app-xl border border-white/10 bg-white/5 p-6">
          <p className="m-0 text-sm font-semibold text-app-text">How it fits together</p>
          <ol className="mt-4 grid gap-4 text-sm text-app-muted md:grid-cols-3">
            <li className="rounded-app-lg border border-white/10 bg-transparent p-4">
              <p className="m-0 font-semibold text-app-text">1) Draft</p>
              <p className="mt-1 leading-relaxed">
                Start with templates so structure is consistent from day one.
              </p>
            </li>
            <li className="rounded-app-lg border border-white/10 bg-transparent p-4">
              <p className="m-0 font-semibold text-app-text">2) Review</p>
              <p className="mt-1 leading-relaxed">
                Assign reviewers, track feedback, and keep changes aligned.
              </p>
            </li>
            <li className="rounded-app-lg border border-white/10 bg-transparent p-4">
              <p className="m-0 font-semibold text-app-text">3) Publish</p>
              <p className="mt-1 leading-relaxed">Validate channel rules before content ships.</p>
            </li>
          </ol>
        </section>

        <footer className="mt-14 border-t border-white/10 pt-8">
          <p className="m-0 text-xs text-app-faint">© {new Date().getFullYear()} CommsLib</p>
        </footer>
      </main>
    </div>
  );
}
