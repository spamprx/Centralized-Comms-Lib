import { AlertTriangle } from 'lucide-react';
import type { LibraryFilterIssue } from '../../lib/libraryUrlState';
import { Button } from '../ui/Button';

export type LibraryFilterInvalidBannerProps = {
  issues: LibraryFilterIssue[];
  onRemoveInvalid: () => void;
};

export function LibraryFilterInvalidBanner({
  issues,
  onRemoveInvalid,
}: LibraryFilterInvalidBannerProps) {
  if (issues.length === 0) return null;

  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-app-lg border border-amber-500/35 bg-amber-500/10 px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
    >
      <div className="flex gap-3 min-w-0">
        <AlertTriangle
          size={20}
          className="shrink-0 text-amber-400 mt-0.5"
          aria-hidden
        />
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-app-text">
            Some filters could not be applied
          </div>
          <ul className="mt-1.5 list-disc pl-4 text-[12px] text-app-muted space-y-1">
            {issues.map((issue, index) => (
              <li key={`${issue.code}-${index}`}>{issue.message}</li>
            ))}
          </ul>
        </div>
      </div>
      <Button
        type="button"
        variant="secondary"
        className="shrink-0 self-start border-amber-500/30 bg-app-surface/80 text-[13px] py-2"
        onClick={onRemoveInvalid}
      >
        Remove invalid filters
      </Button>
    </div>
  );
}
