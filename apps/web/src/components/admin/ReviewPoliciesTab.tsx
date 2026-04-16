import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Pencil, Trash2, ClipboardCheck, X, Save } from 'lucide-react';
import { useTwoStepAdminConfirm } from './useTwoStepAdminConfirm';
import { AdminActionCancelled } from './adminActionCancelled';
import { useAdminReviewPolicies, type ReviewPolicyRow } from '../../hooks/useAdmin';
import { templateCrudService, type ChannelRecord } from '../../services/templateCrudService';
import { adminGroupService } from '../../services/adminService';

type GroupSummary = { id: string; name: string };

type FormState = {
  contentType: ReviewPolicyRow['contentType'];
  channelId: string | null;
  userGroupId: string | null;
  quorumRequired: string;
  isActive: boolean;
};

const CONTENT_TYPES: Array<FormState['contentType']> = ['ARTICLE', 'VIDEO', 'PODCAST', 'DOCUMENT'];

const EMPTY_FORM: FormState = {
  contentType: 'ARTICLE',
  channelId: null,
  userGroupId: null,
  quorumRequired: '1',
  isActive: true,
};

function labelOrAny(label: string | undefined | null): string {
  return label?.trim() ? label : 'Any';
}

export default function ReviewPoliciesTab() {
  const { policies, loading, saving, error, createPolicy, updatePolicy, deletePolicy, refetch } =
    useAdminReviewPolicies();
  const { promptTwoStep, dialog: twoStepDialog } = useTwoStepAdminConfirm();

  const [channels, setChannels] = useState<ChannelRecord[]>([]);
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [metaLoading, setMetaLoading] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);

  const [editing, setEditing] = useState<ReviewPolicyRow | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const channelById = useMemo(
    () => new Map(channels.map((c) => [c.id, c])),
    [channels],
  );
  const groupById = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);

  async function loadMeta() {
    setMetaLoading(true);
    setMetaError(null);
    try {
      const [chs, gs] = await Promise.all([
        templateCrudService.listChannels(),
        adminGroupService.getGroups(),
      ]);
      setChannels(chs);
      setGroups(gs.data.map((g) => ({ id: g.id, name: g.name })));
    } catch (e) {
      setMetaError(e instanceof Error ? e.message : 'Failed to load channels/groups');
    } finally {
      setMetaLoading(false);
    }
  }

  useEffect(() => {
    void loadMeta();
  }, []);

  function openNew() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(p: ReviewPolicyRow) {
    setEditing(p);
    setForm({
      contentType: p.contentType,
      channelId: p.channelId,
      userGroupId: p.userGroupId,
      quorumRequired: String(p.quorumRequired),
      isActive: p.isActive,
    });
    setFormError(null);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
  }

  async function saveExisting(policy: ReviewPolicyRow, quorum: number) {
    const ok = await promptTwoStep({
      title: 'Update review policy',
      body1: `Save changes to the policy for ${policy.contentType}?`,
      body2: 'Final confirmation: the policy will be updated on the server.',
      confirm2: 'Save policy',
    });
    if (!ok) throw new AdminActionCancelled();
    await updatePolicy(policy.id, {
      contentType: form.contentType,
      channelId: form.channelId,
      userGroupId: form.userGroupId,
      quorumRequired: quorum,
      isActive: form.isActive,
    });
  }

  async function saveNew(quorum: number) {
    const ok = await promptTwoStep({
      title: 'Create review policy',
      body1: `Create a policy requiring ${quorum} approval(s) for ${form.contentType}?`,
      body2: 'Final confirmation: the policy will be saved and start enforcing immediately.',
      confirm2: 'Create policy',
    });
    if (!ok) throw new AdminActionCancelled();
    await createPolicy({
      contentType: form.contentType,
      channelId: form.channelId,
      userGroupId: form.userGroupId,
      quorumRequired: quorum,
      isActive: form.isActive,
    });
  }

  async function save() {
    setFormError(null);
    const quorum = Number(form.quorumRequired);
    if (!Number.isInteger(quorum) || quorum < 1) {
      setFormError('Quorum required must be an integer ≥ 1.');
      return;
    }

    try {
      if (editing) await saveExisting(editing, quorum);
      else await saveNew(quorum);
      closeForm();
    } catch (e) {
      if (e instanceof AdminActionCancelled) return;
      setFormError(e instanceof Error ? e.message : 'Failed to save policy');
    }
  }

  async function confirmDelete(p: ReviewPolicyRow) {
    const scope = [
      `type=${p.contentType}`,
      `channel=${labelOrAny(channelById.get(p.channelId ?? '')?.name ?? null)}`,
      `group=${labelOrAny(groupById.get(p.userGroupId ?? '')?.name ?? null)}`,
    ].join(' · ');

    const ok = await promptTwoStep({
      title: 'Delete review policy',
      body1: `Delete this policy (${scope})?`,
      body2: 'Final confirmation: this cannot be undone.',
      confirm2: 'Delete policy',
    });
    if (!ok) return;
    await deletePolicy(p.id);
  }

  const fieldInput =
    'rounded-app-lg border border-white/[0.1] bg-white/[0.04] px-3 py-2.5 text-sm text-app-text shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none backdrop-blur-sm transition-[border-color,box-shadow] duration-200 placeholder:text-app-faint focus:border-app-accent/45 focus:ring-2 focus:ring-app-accent/12';

  const modal =
    showForm && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="admin-modal-backdrop fixed inset-0 z-[1100] flex items-center justify-center bg-black/75 p-4 pt-24 backdrop-blur-md"
            onClick={closeForm}
            role="presentation"
          >
            <div
              className="admin-modal-enter admin-modal-panel w-full max-w-[560px] rounded-app-xl p-5 sm:p-6 shadow-app-soft"
              role="dialog"
              aria-modal="true"
              aria-label={editing ? 'Edit review policy' : 'Create review policy'}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between border-b border-white/[0.08] pb-4">
                <h3 className="m-0 text-base font-semibold tracking-tight text-app-text">
                  {editing ? 'Edit review policy' : 'Create review policy'}
                </h3>
                <button
                  type="button"
                  onClick={closeForm}
                  aria-label="Close"
                  title="Close"
                  className="rounded-app-md p-2 text-app-faint transition-colors hover:bg-white/[0.08] hover:text-app-text"
                >
                  <X size={18} strokeWidth={2} />
                </button>
              </div>

              {formError ? (
                <div className="mb-4 rounded-app-xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-[13px] text-red-200">
                  {formError}
                </div>
              ) : null}

              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-[11px] text-app-faint">
                  Content type
                  <select
                    value={form.contentType}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        contentType: e.target.value as FormState['contentType'],
                      }))
                    }
                    className={`mt-1 block w-full ${fieldInput}`}
                  >
                    {CONTENT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-[11px] text-app-faint">
                  Quorum required
                  <input
                    type="number"
                    min={1}
                    value={form.quorumRequired}
                    onChange={(e) => setForm((p) => ({ ...p, quorumRequired: e.target.value }))}
                    className={`mt-1 block w-full ${fieldInput}`}
                    placeholder="1"
                  />
                </label>

                <label className="text-[11px] text-app-faint">
                  Channel
                  <select
                    value={form.channelId ?? ''}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        channelId: e.target.value ? e.target.value : null,
                      }))
                    }
                    className={`mt-1 block w-full ${fieldInput}`}
                  >
                    <option value="">Any</option>
                    {channels.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-[11px] text-app-faint">
                  User group
                  <select
                    value={form.userGroupId ?? ''}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        userGroupId: e.target.value ? e.target.value : null,
                      }))
                    }
                    className={`mt-1 block w-full ${fieldInput}`}
                  >
                    <option value="">Any</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="mt-4 flex items-center gap-2 text-[12px] text-app-muted">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                  className="rounded border-app-border"
                />
                Active (enforced on publish)
              </label>

              <div className="mt-6 flex justify-end gap-3 border-t border-white/[0.08] pt-5">
                <button
                  type="button"
                  onClick={closeForm}
                  className="admin-glass-button rounded-app-lg px-4 py-2.5 text-[13px] font-semibold text-app-muted"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void save()}
                  disabled={saving}
                  className="admin-btn-lift inline-flex items-center gap-2 rounded-app-lg border border-app-accent/35 bg-gradient-to-br from-app-accent-muted to-app-accent-muted/50 px-4 py-2.5 text-[13px] font-semibold text-app-accent shadow-[0_0_24px_-8px_rgba(147,124,248,0.4)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Save size={14} strokeWidth={2} /> {saving ? 'Saving…' : 'Save policy'}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="flex flex-col gap-6">
      {twoStepDialog}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="mb-1 text-lg font-semibold tracking-tight text-app-text">Review policies</h2>
          <p className="m-0 text-[13px] text-app-muted">
            Require approvals before publishing based on content type, channel, and user group
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="admin-glass-button inline-flex items-center gap-2 self-start rounded-app-lg border border-app-accent/25 bg-app-accent-muted/40 px-4 py-2.5 text-[13px] font-semibold text-app-accent shadow-[0_0_24px_-10px_rgba(147,124,248,0.4)] sm:self-auto"
        >
          <Plus size={15} strokeWidth={2} /> New policy
        </button>
      </div>

      {error || metaError ? (
        <div className="relative overflow-hidden rounded-app-xl border border-red-400/25 bg-gradient-to-r from-red-500/12 to-red-500/5 px-4 py-3 text-[13px] font-medium text-red-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-md">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-400/35 to-transparent" />
          <div className="flex items-center justify-between gap-3">
            <span className="relative">{error ?? metaError}</span>
            <button
              type="button"
              onClick={() => {
                void loadMeta();
                void refetch();
              }}
              className="shrink-0 rounded-app-md border border-white/[0.1] bg-white/[0.06] px-3 py-1.5 text-[12px] font-semibold text-app-muted transition-colors hover:bg-white/[0.1] hover:text-app-text"
            >
              Retry
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3">
        {loading || metaLoading ? (
          <div className="app-skeleton-shimmer rounded-app-xl border border-white/[0.08] px-4 py-12 text-center text-sm font-medium text-app-muted">
            Loading policies…
          </div>
        ) : policies.length < 1 ? (
          <div className="rounded-app-xl border border-dashed border-white/[0.12] bg-white/[0.02] px-4 py-12 text-center text-sm text-app-muted backdrop-blur-sm">
            No review policies yet. Create one to enforce mandatory review before publishing.
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-3">
            {policies.map((p, idx) => {
              const channel = p.channelId ? channelById.get(p.channelId)?.name : null;
              const group = p.userGroupId ? groupById.get(p.userGroupId)?.name : null;
              return (
                <div
                  key={p.id}
                  className="admin-glass admin-card-hover group relative flex flex-col gap-3 overflow-hidden rounded-app-xl p-4 shadow-app-lift admin-row-enter ring-1 ring-white/[0.04]"
                  style={
                    {
                      '--row-index': idx,
                      borderTop: `3px solid ${p.isActive ? '#a78bfa' : '#6b7280'}`,
                    } as React.CSSProperties
                  }
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                      style={{
                        background: p.isActive ? '#a78bfa15' : '#6b728015',
                        color: p.isActive ? '#a78bfa' : '#9ca3af',
                      }}
                    >
                      <ClipboardCheck size={14} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[13px] font-semibold text-app-text">
                          {p.contentType}
                        </span>
                        <span className="rounded-md bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] text-app-muted">
                          channel:{labelOrAny(channel)}
                        </span>
                        <span className="rounded-md bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] text-app-muted">
                          group:{labelOrAny(group)}
                        </span>
                      </div>
                      <p className="m-0 mt-1 text-[12px] leading-relaxed text-app-faint">
                        Requires <span className="text-app-text">{p.quorumRequired}</span>{' '}
                        approval(s) ·{' '}
                        <span className={p.isActive ? 'text-emerald-300/90' : 'text-app-faint'}>
                          {p.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </p>
                    </div>
                    <div className="relative z-10 flex shrink-0 gap-0.5">
                      <button
                        type="button"
                        aria-label="Edit policy"
                        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-white/[0.06] bg-app-surface/80 text-app-muted hover:bg-app-surface-hover hover:text-app-text md:opacity-90"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(p);
                        }}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        aria-label="Delete policy"
                        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-white/[0.06] bg-app-surface/80 text-app-muted hover:bg-red-400/15 hover:text-red-400 md:opacity-90"
                        onClick={(e) => {
                          e.stopPropagation();
                          void confirmDelete(p);
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modal}
    </div>
  );
}

