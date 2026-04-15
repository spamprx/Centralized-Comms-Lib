import { useState, useCallback, type ReactNode } from 'react';

type Pending = {
  step: 1 | 2;
  title: string;
  body1: string;
  body2: string;
  confirm1: string;
  confirm2: string;
  resolve: (ok: boolean) => void;
};

/**
 * Two-step confirmation for sensitive admin CRUD (user & group flows).
 * Returns a promise that resolves true only after the user confirms twice.
 */
export function useTwoStepAdminConfirm(): {
  promptTwoStep: (opts: {
    title: string;
    body1: string;
    body2: string;
    confirm1?: string;
    confirm2?: string;
  }) => Promise<boolean>;
  dialog: ReactNode;
} {
  const [pending, setPending] = useState<Pending | null>(null);

  const promptTwoStep = useCallback(
    (opts: {
      title: string;
      body1: string;
      body2: string;
      confirm1?: string;
      confirm2?: string;
    }) => {
      return new Promise<boolean>((resolve) => {
        setPending({
          step: 1,
          title: opts.title,
          body1: opts.body1,
          body2: opts.body2,
          confirm1: opts.confirm1 ?? 'Continue',
          confirm2: opts.confirm2 ?? 'Confirm',
          resolve,
        });
      });
    },
    [],
  );

  const cancel = useCallback(() => {
    setPending((p) => {
      if (p) p.resolve(false);
      return null;
    });
  }, []);

  const goStep2 = useCallback(() => {
    setPending((p) => (p ? { ...p, step: 2 } : null));
  }, []);

  const backToStep1 = useCallback(() => {
    setPending((p) => (p ? { ...p, step: 1 } : null));
  }, []);

  const finish = useCallback(() => {
    setPending((p) => {
      if (p) p.resolve(true);
      return null;
    });
  }, []);

  const dialog = pending ? (
    <div
      className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="two-step-admin-title"
    >
      <div
        className="admin-glass w-full max-w-[440px] rounded-2xl p-6 shadow-app-soft"
        style={{ background: 'rgba(15, 20, 32, 0.94)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="two-step-admin-title" className="m-0 mb-2 text-base font-semibold text-app-text">
          {pending.title}
          <span className="ml-2 text-xs font-normal text-app-faint">Step {pending.step} of 2</span>
        </h3>
        <p className="m-0 mb-5 text-[13px] leading-relaxed text-app-muted">
          {pending.step === 1 ? pending.body1 : pending.body2}
        </p>
        <div className="flex flex-wrap justify-end gap-2.5">
          {pending.step === 2 ? (
            <button
              type="button"
              className="px-4 py-2.5 admin-glass-button rounded-xl text-app-muted text-[13px]"
              onClick={backToStep1}
            >
              Back
            </button>
          ) : null}
          <button
            type="button"
            className="px-4 py-2.5 admin-glass-button rounded-xl text-app-muted text-[13px]"
            onClick={cancel}
          >
            Cancel
          </button>
          {pending.step === 1 ? (
            <button
              type="button"
              className="px-4 py-2.5 rounded-xl border border-app-accent/35 bg-app-accent-muted text-[13px] font-medium text-app-accent admin-btn-lift"
              onClick={goStep2}
            >
              {pending.confirm1}
            </button>
          ) : (
            <button
              type="button"
              className="px-4 py-2.5 rounded-xl border border-amber-400/30 bg-amber-400/10 text-[13px] font-medium text-amber-200 admin-btn-lift"
              onClick={finish}
            >
              {pending.confirm2}
            </button>
          )}
        </div>
      </div>
    </div>
  ) : null;

  return { promptTwoStep, dialog };
}
