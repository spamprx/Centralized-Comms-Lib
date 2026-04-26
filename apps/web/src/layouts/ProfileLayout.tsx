import { useEffect, useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  Bell,
  Bookmark,
  Check,
  Camera,
  FileText,
  Folder,
  FolderPlus,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Play,
  Plus,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  profileService,
  type ProfileActivityItem,
  type ProfileBookmarkFolder,
  type ProfileBookmarkItem,
  type ProfileBookmarkNotification,
} from '../services/profileService';

type TabId = 'personal' | 'activity' | 'bookmarks';
type ProfileForm = {
  displayName: string;
  email: string;
  location: string;
  role: string;
  bio: string;
};

const tabs: Array<{ id: TabId; label: string }> = [
  { id: 'personal', label: 'Personal' },
  { id: 'activity', label: 'Activity' },
  { id: 'bookmarks', label: 'Bookmarks' },
];

const glassCard =
  'relative overflow-hidden rounded-app-xl border border-white/[0.08] bg-gradient-to-b from-white/[0.08] to-white/[0.02] shadow-app-lift backdrop-blur-xl supports-backdrop-filter:bg-app-bg/45';
const ease =
  'duration-[var(--duration-app-slow)] ease-[var(--ease-app-out)] motion-reduce:transition-none';

export default function ProfileLayout() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const tabFromUrl = (searchParams.get('tab') ?? '').toLowerCase();
  const initialTab: TabId =
    location.pathname === '/bookmarks' || tabFromUrl === 'bookmarks'
      ? 'bookmarks'
      : tabFromUrl === 'activity'
        ? 'activity'
        : 'personal';
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [bookmarks, setBookmarks] = useState<ProfileBookmarkItem[]>([]);
  const [folders, setFolders] = useState<ProfileBookmarkFolder[]>([]);
  const [activeFolder, setActiveFolder] = useState<string | 'default' | ''>('');
  const [newFolderName, setNewFolderName] = useState('');
  const [notifications, setNotifications] = useState<ProfileBookmarkNotification[]>([]);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [activity, setActivity] = useState<ProfileActivityItem[]>([]);
  const [stats, setStats] = useState({ contentCreated: 0, totalViews: 0, following: 0 });
  const [form, setForm] = useState<ProfileForm>({
    displayName: '',
    email: '',
    location: 'San Francisco, CA',
    role: 'Content Manager',
    bio: '',
  });
  const [initialForm, setInitialForm] = useState<ProfileForm>(form);
  const unreadNotificationCount = useMemo(
    () => notifications.filter((n) => !n.readAt).length,
    [notifications],
  );

  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(initialForm),
    [form, initialForm],
  );

  useEffect(() => {
    const tabValue = activeTab === 'personal' ? null : activeTab;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tabValue) next.set('tab', tabValue);
      else next.delete('tab');
      return next;
    }, { replace: true });
  }, [activeTab, setSearchParams]);

  useEffect(() => {
    if (location.pathname === '/bookmarks' && activeTab !== 'bookmarks') {
      setActiveTab('bookmarks');
    }
  }, [location.pathname, activeTab]);
  const initials = useMemo(
    () =>
      form.displayName
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((v) => v[0]?.toUpperCase() ?? '')
        .join('') || 'SA',
    [form.displayName],
  );

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const [me, activityItems, bookmarkItems, folderItems, bookmarkNotifications] =
          await Promise.all([
          profileService.me(),
          profileService.listActivity(),
          profileService.listBookmarks(),
          profileService.listBookmarkFolders(),
          profileService.listBookmarkNotifications(),
        ]);
        const nextForm: ProfileForm = {
          displayName: me.displayName,
          email: me.email,
          location: me.location ?? 'San Francisco, CA',
          role: me.role || 'Content Manager',
          bio: me.bio ?? '',
        };
        setForm(nextForm);
        setInitialForm(nextForm);
        setStats(me.stats);
        setActivity(activityItems);
        setBookmarks(bookmarkItems);
        setFolders(folderItems);
        setNotifications(bookmarkNotifications);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, []);

  useEffect(() => {
    if (activeTab !== 'bookmarks') return;
    const t = setTimeout(async () => {
      try {
        const [items, folderItems, bookmarkNotifications] = await Promise.all([
          profileService.listBookmarks(search, activeFolder || undefined),
          profileService.listBookmarkFolders(),
          profileService.listBookmarkNotifications(),
        ]);
        setBookmarks(items);
        setFolders(folderItems);
        setNotifications(bookmarkNotifications);
      } catch {
        setError('Failed to load bookmarks');
      }
    }, 220);
    return () => clearTimeout(t);
  }, [activeTab, search, activeFolder]);

  const save = async () => {
    try {
      setSaving(true);
      await profileService.updateMe({ displayName: form.displayName, email: form.email });
      setInitialForm(form);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const createFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    try {
      await profileService.createBookmarkFolder(name);
      setNewFolderName('');
      const folderItems = await profileService.listBookmarkFolders();
      setFolders(folderItems);
    } catch {
      setError('Failed to create folder');
    }
  };

  const removeFolder = async (folderId: string) => {
    try {
      await profileService.deleteBookmarkFolder(folderId);
      if (activeFolder === folderId) setActiveFolder('');
      const [folderItems, items] = await Promise.all([
        profileService.listBookmarkFolders(),
        profileService.listBookmarks(search),
      ]);
      setFolders(folderItems);
      setBookmarks(items);
    } catch {
      setError('Failed to delete folder');
    }
  };

  const moveBookmark = async (bookmarkId: string, folderId: string | null) => {
    try {
      await profileService.moveBookmarkToFolder(bookmarkId, folderId);
      const [items, folderItems] = await Promise.all([
        profileService.listBookmarks(search, activeFolder || undefined),
        profileService.listBookmarkFolders(),
      ]);
      setBookmarks(items);
      setFolders(folderItems);
    } catch {
      setError('Failed to move bookmark');
    }
  };

  const fmt = (v: number): string => (v >= 1000 ? `${Math.round(v / 100) / 10}K` : String(v));

  const fieldClass = (readOnly: boolean) =>
    `w-full rounded-app-md border px-3.5 py-2.5 text-[13px] text-app-text shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none transition-[border-color,box-shadow,background-color] ${ease} ${
      readOnly
        ? 'cursor-default border-white/[0.06] bg-white/[0.03] text-app-muted'
        : 'border-white/[0.1] bg-white/[0.04] placeholder:text-app-faint hover:border-white/[0.14] focus:border-app-accent/45 focus:ring-2 focus:ring-app-accent/15'
    }`;

  return (
    <div className="min-h-screen w-full font-sans text-app-text antialiased">
      {/* Cover */}
      <div className="relative h-[min(200px,28vw)] min-h-[120px] w-full overflow-hidden border-b border-white/[0.08]">
        <div
          className="absolute inset-0 bg-gradient-to-br from-app-accent/25 via-app-bg-subtle to-app-accent-2/15"
          aria-hidden
        />
        <div
          className="absolute inset-0 opacity-[0.35] [background-image:linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:32px_32px]"
          aria-hidden
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-app-bg via-transparent to-transparent"
          aria-hidden
        />
        <button
          type="button"
          className={`absolute right-5 top-4 z-[1] rounded-app-md border border-white/[0.12] bg-app-bg/40 px-3 py-1.5 text-[11px] font-medium text-app-muted shadow-sm backdrop-blur-md transition-[border-color,background-color,color] hover:border-white/[0.18] hover:bg-white/[0.06] hover:text-app-text ${ease}`}
        >
          Edit cover
        </button>
      </div>

      <div className="relative z-[1] mx-auto max-w-5xl px-4 pb-10 sm:px-6">
        {/* Profile hero card */}
        <div className={`${glassCard} -mt-14 overflow-hidden sm:-mt-16`}>
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
            aria-hidden
          />

          <div className="relative px-5 pb-2 pt-4 sm:px-8 sm:pt-5">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-6">
                <div className="group relative -mt-2 shrink-0 sm:-mt-3">
                  <div className="relative flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-2xl border-2 border-app-bg bg-gradient-to-br from-app-accent to-app-accent-deep text-xl font-semibold tracking-tight text-white shadow-app-glow ring-2 ring-white/10 sm:h-20 sm:w-20 sm:text-2xl">
                    <span
                      className="absolute inset-0 rounded-2xl bg-gradient-to-t from-black/20 to-transparent"
                      aria-hidden
                    />
                    <span className="relative">{initials}</span>
                    <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/55 opacity-0 backdrop-blur-[2px] transition-opacity duration-300 ease-out group-hover:opacity-100 motion-reduce:transition-none">
                      <Camera size={18} className="text-white" strokeWidth={2} />
                    </div>
                  </div>
                </div>

                <div className="min-w-0 flex-1 pb-1 pt-0 sm:pb-3 sm:pt-1">
                  <h1 className="text-xl font-semibold tracking-tight text-app-text sm:text-[1.35rem]">
                    {form.displayName || 'System Admin'}
                  </h1>
                  <p className="mt-1 text-[13px] font-medium text-app-muted">{form.role}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-app-muted">
                    <span className="inline-flex items-center gap-2">
                      <Mail size={14} className="shrink-0 text-app-faint" strokeWidth={2} />
                      <span className="truncate">{form.email}</span>
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <MapPin size={14} className="shrink-0 text-app-faint" strokeWidth={2} />
                      <span className="truncate">{form.location}</span>
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                className={`inline-flex h-10 shrink-0 items-center justify-center gap-2 self-start rounded-app-md border border-white/[0.12] bg-white/[0.04] px-4 text-[13px] font-semibold text-app-text shadow-sm backdrop-blur-sm transition-[border-color,background-color,transform,box-shadow] hover:border-white/[0.18] hover:bg-white/[0.08] active:scale-[0.98] motion-reduce:active:scale-100 sm:self-center ${ease}`}
              >
                <Pencil size={15} strokeWidth={2} className="text-app-muted" />
                Edit profile
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 divide-x divide-white/[0.08] border-t border-white/[0.07] [scrollbar-width:thin]">
            {[
              { label: 'Content created', value: fmt(stats.contentCreated) },
              { label: 'Total views', value: fmt(stats.totalViews) },
              { label: 'Following', value: fmt(stats.following) },
            ].map((s) => (
              <button
                key={s.label}
                type="button"
                className={`min-w-0 px-3 py-4 text-left transition-[color,background-color] sm:px-6 ${ease} hover:bg-white/[0.04]`}
              >
                <span className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
                  <span className="text-lg font-semibold tabular-nums tracking-tight text-app-text sm:text-xl">
                    {s.value}
                  </span>
                  <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-app-faint sm:normal-case sm:tracking-normal sm:text-[12px] sm:text-app-muted">
                    {s.label}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-6 sm:mt-8">
          <div
            className={`inline-flex w-full gap-1 rounded-app-xl border border-white/[0.08] bg-app-bg/50 p-1 shadow-inner backdrop-blur-md sm:w-auto sm:p-1.5`}
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`relative min-h-[44px] flex-1 overflow-hidden rounded-app-md px-4 py-2.5 text-[13px] font-semibold transition-[color,background-color,box-shadow] sm:flex-none sm:px-6 ${ease} ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-b from-white/[0.12] to-white/[0.05] text-app-text shadow-app-soft ring-1 ring-white/10'
                    : 'text-app-muted hover:bg-white/[0.05] hover:text-app-text'
                }`}
              >
                {activeTab === tab.id ? (
                  <span
                    className="absolute inset-x-3 bottom-1 h-0.5 rounded-full bg-gradient-to-r from-app-accent via-app-accent-2 to-app-accent opacity-90 sm:inset-x-4"
                    aria-hidden
                  />
                ) : null}
                <span className="relative">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 space-y-6 sm:mt-8">
          {error ? (
            <div
              className={`${glassCard} border-red-500/25 bg-gradient-to-b from-red-500/10 to-red-500/[0.03] p-4 text-[13px] text-red-300`}
              role="alert"
            >
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className={`${glassCard} flex items-center gap-3 p-8 text-[13px] text-app-muted`}>
              <Loader2
                className="size-5 shrink-0 animate-spin text-app-accent motion-reduce:animate-none"
                aria-hidden
              />
              Loading profile...
            </div>
          ) : null}

          {!loading && activeTab === 'personal' ? (
            <div className="space-y-6">
              <section className={glassCard}>
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
                <div className="p-6 sm:p-8">
                  <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="text-base font-semibold tracking-tight text-app-text sm:text-lg">
                      Personal information
                    </h2>
                    {isDirty ? (
                      <div className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1.5 text-[12px] font-medium text-amber-200/95 backdrop-blur-sm">
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400/50 opacity-75 motion-reduce:animate-none" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
                        </span>
                        Unsaved changes
                      </div>
                    ) : null}
                  </div>

                  <div className="grid gap-5 md:grid-cols-2">
                    {[
                      { label: 'FULL NAME', key: 'displayName', readOnly: false },
                      { label: 'LOCATION', key: 'location', readOnly: false },
                      { label: 'EMAIL', key: 'email', readOnly: false },
                      { label: 'ROLE', key: 'role', readOnly: true },
                    ].map((field) => (
                      <label key={field.key} className="block">
                        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-app-faint">
                          {field.label}
                        </div>
                        <input
                          value={form[field.key as keyof ProfileForm]}
                          readOnly={field.readOnly}
                          onChange={(e) =>
                            setForm((prev) => ({ ...prev, [field.key]: e.target.value }))
                          }
                          className={fieldClass(field.readOnly)}
                        />
                      </label>
                    ))}
                    <label className="block md:col-span-2">
                      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-app-faint">
                        BIO
                      </div>
                      <textarea
                        value={form.bio}
                        onChange={(e) => setForm((prev) => ({ ...prev, bio: e.target.value }))}
                        className={`h-[100px] min-h-[100px] resize-y ${fieldClass(false)} py-3 leading-relaxed`}
                      />
                    </label>
                  </div>

                  <div className="mt-8 flex flex-col-reverse gap-3 border-t border-white/[0.06] pt-6 sm:flex-row sm:justify-end sm:gap-3">
                    <button
                      type="button"
                      onClick={() => setForm(initialForm)}
                      className={`h-10 rounded-app-md border border-white/[0.12] bg-transparent px-4 text-[13px] font-semibold text-app-muted transition-[border-color,background-color,color] hover:border-white/[0.18] hover:bg-white/[0.05] hover:text-app-text ${ease}`}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void save()}
                      disabled={!isDirty || saving}
                      className={`h-10 rounded-app-md border border-app-accent/30 bg-gradient-to-br from-app-accent to-app-accent-deep px-5 text-[13px] font-semibold text-white shadow-app-glow transition-[opacity,filter,transform] hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:active:scale-100 ${ease}`}
                    >
                      {saving ? 'Saving...' : 'Save changes'}
                    </button>
                  </div>
                </div>
              </section>

              <section
                className={`${glassCard} border-red-500/20 bg-gradient-to-b from-red-500/[0.07] to-transparent`}
              >
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-400/25 to-transparent" />
                <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
                  <div className="min-w-0">
                    <h3 className="text-[13px] font-semibold text-app-text">Delete account</h3>
                    <p className="mt-1.5 max-w-xl text-[12px] leading-relaxed text-app-muted">
                      Permanently remove your account and all linked data.
                    </p>
                  </div>
                  <button
                    type="button"
                    className={`inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-app-md border border-red-400/40 bg-red-500/10 px-4 text-[13px] font-semibold text-red-300 transition-[background-color,border-color,transform] hover:border-red-400/55 hover:bg-red-500/15 active:scale-[0.98] motion-reduce:active:scale-100 ${ease}`}
                  >
                    <Trash2 size={15} strokeWidth={2} />
                    Delete
                  </button>
                </div>
              </section>
            </div>
          ) : null}

          {!loading && activeTab === 'activity' ? (
            <section className={glassCard}>
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
              <div className="p-6 sm:p-8">
                <div className="mb-6 flex items-center justify-between gap-4">
                  <h2 className="text-base font-semibold tracking-tight text-app-text sm:text-lg">
                    Recent activity
                  </h2>
                  <button
                    type="button"
                    className={`text-[12px] font-medium text-app-muted transition-colors hover:text-app-accent ${ease}`}
                  >
                    View all
                  </button>
                </div>
                <div className="divide-y divide-white/[0.06]">
                  {activity.map((item) => {
                    const icon =
                      item.type === 'PUBLISHED'
                        ? Upload
                        : item.type === 'COMMENTED'
                          ? MessageCircle
                          : Plus;
                    const iconBg =
                      item.type === 'PUBLISHED'
                        ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/20'
                        : item.type === 'COMMENTED'
                          ? 'bg-sky-500/15 text-sky-300 ring-1 ring-sky-400/20'
                          : 'bg-app-accent-muted text-app-accent ring-1 ring-app-accent/25';
                    const label =
                      item.type === 'PUBLISHED'
                        ? 'Published'
                        : item.type === 'COMMENTED'
                          ? 'Commented'
                          : 'Created';
                    const Icon = icon;
                    return (
                      <a
                        key={item.id}
                        href={`/library/${item.contentId}`}
                        className={`group -mx-1 flex items-center gap-4 rounded-app-md px-3 py-3.5 transition-[background-color,box-shadow] hover:bg-white/[0.04] sm:px-4 ${ease}`}
                      >
                        <span
                          className={`inline-flex size-10 shrink-0 items-center justify-center rounded-app-md ${iconBg}`}
                        >
                          <Icon size={15} strokeWidth={2} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="text-[13px] text-app-muted">{label} </span>
                          <span className="text-[13px] font-semibold text-app-accent">
                            {item.contentTitle}
                          </span>
                          <div className="mt-1 text-[11px] font-medium tabular-nums text-app-faint">
                            {new Date(item.timestamp).toLocaleString()}
                          </div>
                        </span>
                        <span className="shrink-0 text-app-faint opacity-0 transition-opacity group-hover:opacity-100 motion-reduce:opacity-100">
                          <ArrowRight size={18} strokeWidth={2} />
                        </span>
                      </a>
                    );
                  })}
                </div>
              </div>
            </section>
          ) : null}

          {!loading && activeTab === 'bookmarks' ? (
            <section className={glassCard}>
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
              <div className="p-6 sm:p-8">
                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="inline-flex items-center gap-3">
                    <h2 className="text-base font-semibold tracking-tight text-app-text sm:text-lg">
                      Bookmarked content
                    </h2>
                    <span className="rounded-full border border-white/[0.1] bg-white/[0.06] px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-app-muted backdrop-blur-sm">
                      {bookmarks.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="relative block w-full sm:w-[220px]">
                      <Search
                        size={15}
                        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-app-faint"
                        strokeWidth={2}
                      />
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search bookmarks"
                        className={`h-10 w-full rounded-app-md border border-white/[0.1] bg-white/[0.04] py-2 pl-10 pr-3 text-[13px] text-app-text shadow-inner outline-none transition-[border-color,box-shadow] placeholder:text-app-faint focus:border-app-accent/45 focus:ring-2 focus:ring-app-accent/15 ${ease}`}
                      />
                    </label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setNotificationOpen((v) => !v)}
                        className="relative inline-flex h-10 items-center justify-center rounded-app-md border border-white/[0.1] bg-white/[0.04] px-3 text-app-muted transition-colors hover:text-app-text"
                        title="Bookmark update notifications"
                      >
                        <Bell size={16} />
                        {unreadNotificationCount > 0 ? (
                          <span className="absolute -right-1.5 -top-1.5 rounded-full bg-app-accent px-1.5 py-0.5 text-[10px] font-bold text-app-bg">
                            {unreadNotificationCount}
                          </span>
                        ) : null}
                      </button>
                      {notificationOpen ? (
                        <div className="absolute right-0 z-20 mt-2 w-[300px] rounded-app-lg border border-white/[0.12] bg-app-bg/95 p-3 shadow-app-lift backdrop-blur-xl">
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-[12px] font-semibold text-app-text">Updates</span>
                            <button
                              type="button"
                              onClick={() =>
                                void (async () => {
                                  await profileService.markAllBookmarkNotificationsRead();
                                  const rows = await profileService.listBookmarkNotifications();
                                  setNotifications(rows);
                                })()
                              }
                              className="text-[11px] text-app-accent"
                            >
                              Mark all read
                            </button>
                          </div>
                          <div className="max-h-64 space-y-2 overflow-y-auto">
                            {notifications.length === 0 ? (
                              <div className="rounded-app-md border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] text-app-faint">
                                No notifications
                              </div>
                            ) : (
                              notifications.map((n) => (
                                <button
                                  key={n.id}
                                  type="button"
                                  onClick={() =>
                                    void (async () => {
                                      await profileService.markBookmarkNotificationRead(n.id);
                                      const rows = await profileService.listBookmarkNotifications();
                                      setNotifications(rows);
                                    })()
                                  }
                                  className={`w-full rounded-app-md border px-3 py-2 text-left transition-colors ${
                                    n.readAt
                                      ? 'border-white/[0.06] bg-white/[0.02] text-app-faint'
                                      : 'border-app-accent/25 bg-app-accent/10 text-app-text'
                                  }`}
                                >
                                  <div className="text-[12px] font-medium">{n.message}</div>
                                  <div className="mt-1 text-[10px] text-app-faint">
                                    {new Date(n.createdAt).toLocaleString()}
                                  </div>
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
                  <aside className="rounded-app-md border border-white/[0.08] bg-white/[0.03] p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[12px] font-semibold text-app-text">Folders</span>
                    </div>
                    <div className="space-y-1.5">
                      <button
                        type="button"
                        onClick={() => setActiveFolder('')}
                        className={`flex w-full items-center justify-between rounded-app-sm px-2.5 py-1.5 text-left text-[12px] ${
                          activeFolder === ''
                            ? 'bg-app-accent/15 text-app-accent'
                            : 'text-app-muted hover:bg-white/[0.05] hover:text-app-text'
                        }`}
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <Folder size={14} /> All bookmarks
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveFolder('default')}
                        className={`flex w-full items-center justify-between rounded-app-sm px-2.5 py-1.5 text-left text-[12px] ${
                          activeFolder === 'default'
                            ? 'bg-app-accent/15 text-app-accent'
                            : 'text-app-muted hover:bg-white/[0.05] hover:text-app-text'
                        }`}
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <Folder size={14} /> Default
                        </span>
                      </button>
                      {folders.map((folder) => (
                        <div key={folder.id} className="group/folder flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setActiveFolder(folder.id)}
                            className={`flex min-w-0 flex-1 items-center justify-between rounded-app-sm px-2.5 py-1.5 text-left text-[12px] ${
                              activeFolder === folder.id
                                ? 'bg-app-accent/15 text-app-accent'
                                : 'text-app-muted hover:bg-white/[0.05] hover:text-app-text'
                            }`}
                          >
                            <span className="truncate">{folder.name}</span>
                            <span className="ml-2 tabular-nums text-[10px] text-app-faint">
                              {folder.bookmarkCount}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => void removeFolder(folder.id)}
                            className="rounded-app-sm p-1 text-red-400/80 opacity-0 transition-opacity hover:bg-red-500/10 group-hover/folder:opacity-100"
                            title="Delete folder"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center gap-1.5">
                      <input
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        placeholder="New folder"
                        className="h-8 min-w-0 flex-1 rounded-app-sm border border-white/[0.1] bg-white/[0.04] px-2 text-[11px] text-app-text outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => void createFolder()}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-app-sm border border-white/[0.12] bg-white/[0.04] text-app-muted hover:text-app-text"
                        title="Create folder"
                      >
                        <FolderPlus size={14} />
                      </button>
                    </div>
                  </aside>

                  <div className="space-y-2.5">
                    {bookmarks.map((item) => {
                      const fileIcon = item.contentType === 'VIDEO' ? Play : FileText;
                      const leftTone =
                        item.contentType === 'VIDEO'
                          ? 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/25'
                          : item.contentType === 'DOCUMENT'
                            ? 'bg-sky-500/15 text-sky-300 ring-1 ring-sky-400/25'
                            : 'bg-app-accent-muted text-app-accent ring-1 ring-app-accent/25';
                      const Icon = fileIcon;
                      return (
                        <div
                          key={item.id}
                          className={`group flex items-center gap-4 rounded-app-md border border-white/[0.08] bg-white/[0.02] px-4 py-3.5 transition-[border-color,background-color,box-shadow] hover:border-white/[0.14] hover:bg-white/[0.05] hover:shadow-app-soft ${ease}`}
                        >
                          <a href={`/library/${item.contentId}`} className="inline-flex shrink-0">
                            <span
                              className={`inline-flex size-11 items-center justify-center rounded-app-md ${leftTone}`}
                            >
                              <Icon size={17} strokeWidth={2} />
                            </span>
                          </a>
                          <a href={`/library/${item.contentId}`} className="min-w-0 flex-1">
                            <div className="truncate text-[13px] font-semibold text-app-text">
                              {item.title}
                            </div>
                            <div className="mt-1.5 flex items-center gap-2">
                              <span className="inline-flex rounded-full border border-white/[0.08] bg-white/[0.05] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-app-muted">
                                {item.contentType.toLowerCase()}
                              </span>
                              <span className="text-[10px] text-app-faint">
                                {item.folderName ?? 'Default'}
                              </span>
                            </div>
                          </a>
                          <div className="flex items-center gap-2">
                            <select
                              value={item.folderId ?? 'default'}
                              onChange={(e) =>
                                void moveBookmark(
                                  item.id,
                                  e.target.value === 'default' ? null : e.target.value,
                                )
                              }
                              className="rounded-app-sm border border-white/[0.12] bg-white/[0.04] px-2 py-1 text-[11px] text-app-muted outline-none"
                              title="Move bookmark"
                            >
                              <option value="default">Default</option>
                              {folders.map((folder) => (
                                <option key={folder.id} value={folder.id}>
                                  {folder.name}
                                </option>
                              ))}
                            </select>
                            <span className="inline-flex shrink-0 items-center gap-2 text-app-accent">
                              <Bookmark size={16} className="fill-current" strokeWidth={2} />
                              {!item.folderId ? <Check size={12} className="text-app-faint" /> : null}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
