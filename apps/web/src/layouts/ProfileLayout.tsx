import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Bookmark,
  Camera,
  FileText,
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
  type ProfileBookmarkItem,
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

export default function ProfileLayout() {
  const [activeTab, setActiveTab] = useState<TabId>('personal');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [bookmarks, setBookmarks] = useState<ProfileBookmarkItem[]>([]);
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

  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(initialForm),
    [form, initialForm],
  );
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
        const [me, activityItems, bookmarkItems] = await Promise.all([
          profileService.me(),
          profileService.listActivity(),
          profileService.listBookmarks(),
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
        const items = await profileService.listBookmarks(search);
        setBookmarks(items);
      } catch {
        setError('Failed to load bookmarks');
      }
    }, 220);
    return () => clearTimeout(t);
  }, [activeTab, search]);

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

  const fmt = (v: number): string => (v >= 1000 ? `${Math.round(v / 100) / 10}K` : String(v));

  return (
    <div className="min-h-screen w-full bg-[#0d0f18] text-white [font-family:Inter,ui-sans-serif,system-ui,sans-serif]">
      <div className="h-[120px] w-full border-b border-[rgba(255,255,255,0.07)] bg-[#1a1d2e] relative">
        <div className="absolute inset-0 [background-image:radial-gradient(rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:24px_24px]" />
        <button className="absolute right-6 top-4 h-7 rounded-[8px] border border-[rgba(255,255,255,0.12)] px-3 text-[11px] text-[rgba(255,255,255,0.4)] transition-all duration-150 ease-in hover:bg-[rgba(255,255,255,0.05)]">
          Edit cover
        </button>
      </div>

      <div className="px-6">
        <div className="relative rounded-b-[12px] border-x border-b border-[rgba(255,255,255,0.07)] bg-[#12141e]">
          <div className="absolute left-6 -top-8 group">
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full border-[3px] border-[#0d0f18] bg-gradient-to-br from-[#534AB7] to-[#7C6FF7] text-[20px] font-medium">
              {initials}
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-[rgba(0,0,0,0.5)] opacity-0 transition-all duration-150 ease-in group-hover:opacity-100">
                <Camera size={14} />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-start gap-5 pl-6 pr-6 pt-10 pb-4">
            <div className="min-w-[240px] flex-1">
              <div className="text-[18px] font-medium">{form.displayName || 'System Admin'}</div>
              <div className="mt-0.5 text-[13px] text-[rgba(255,255,255,0.55)]">{form.role}</div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[rgba(255,255,255,0.5)]">
                <span className="inline-flex items-center gap-1.5">
                  <Mail size={12} /> {form.email}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MapPin size={12} /> {form.location}
                </span>
              </div>
            </div>
            <button className="h-[34px] rounded-[8px] border border-[rgba(255,255,255,0.12)] px-3 text-[13px] font-medium text-[rgba(255,255,255,0.9)] transition-all duration-150 ease-in hover:bg-[rgba(255,255,255,0.05)] inline-flex items-center gap-2">
              <Pencil size={14} /> Edit profile
            </button>
          </div>

          <div className="mt-1 flex items-center overflow-x-auto border-t border-[rgba(255,255,255,0.07)] py-4 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.08)_transparent]">
            {[
              { label: 'Content created', value: fmt(stats.contentCreated) },
              { label: 'Total views', value: fmt(stats.totalViews) },
              { label: 'Following', value: fmt(stats.following) },
            ].map((s, i) => (
              <button
                key={s.label}
                className="px-6 text-left transition-all duration-150 ease-in hover:text-white text-[rgba(255,255,255,0.85)]"
              >
                <span className="inline-flex items-center gap-2">
                  <span className="text-[16px] font-medium">{s.value}</span>
                  <span className="text-[12px] text-[rgba(255,255,255,0.55)]">{s.label}</span>
                </span>
                {i < 2 ? (
                  <span className="ml-6 inline-block h-4 w-px bg-[rgba(255,255,255,0.12)] align-middle" />
                ) : null}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 border-b border-[rgba(255,255,255,0.07)] bg-[#12141e]">
        <div className="px-6 flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-3 text-[13px] font-medium border-b-2 transition-all duration-150 ease-in ${
                activeTab === tab.id
                  ? 'text-white border-[#7C6FF7]'
                  : 'text-[rgba(255,255,255,0.5)] border-transparent hover:text-[rgba(255,255,255,0.82)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 py-6">
        {error ? (
          <div className="mb-4 rounded-[8px] border border-[rgba(226,75,74,0.2)] bg-[rgba(226,75,74,0.05)] p-3 text-[12px] text-[#E24B4A]">
            {error}
          </div>
        ) : null}
        {loading ? (
          <div className="rounded-[12px] border border-[rgba(255,255,255,0.07)] bg-[#12141e] p-6 text-[13px] text-[rgba(255,255,255,0.6)]">
            Loading profile...
          </div>
        ) : null}

        {!loading && activeTab === 'personal' ? (
          <div className="space-y-4">
            <div className="rounded-[12px] border border-[rgba(255,255,255,0.07)] bg-[#12141e] p-6">
              <div className="mb-5 flex items-center justify-between">
                <div className="text-[16px] font-medium">Personal information</div>
                {isDirty ? (
                  <div className="inline-flex items-center gap-2 rounded-[9999px] bg-[rgba(239,159,39,0.12)] px-2.5 py-1 text-[12px] text-[#EF9F27]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#EF9F27]" />
                    Unsaved changes
                  </div>
                ) : null}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {[
                  { label: 'FULL NAME', key: 'displayName', readOnly: false },
                  { label: 'LOCATION', key: 'location', readOnly: false },
                  { label: 'EMAIL', key: 'email', readOnly: false },
                  { label: 'ROLE', key: 'role', readOnly: true },
                ].map((field) => (
                  <label key={field.key} className="block">
                    <div className="mb-1.5 text-[11px] uppercase tracking-[0.06em] text-[rgba(255,255,255,0.5)]">
                      {field.label}
                    </div>
                    <input
                      value={form[field.key as keyof ProfileForm]}
                      readOnly={field.readOnly}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, [field.key]: e.target.value }))
                      }
                      className={`h-[38px] w-full rounded-[8px] border px-3 text-[13px] font-normal text-white transition-all duration-150 ease-in outline-none ${
                        field.readOnly
                          ? 'border-[rgba(255,255,255,0.09)] bg-[rgba(255,255,255,0.03)] text-[rgba(255,255,255,0.56)]'
                          : 'border-[rgba(255,255,255,0.09)] bg-[rgba(255,255,255,0.04)] focus:border-[#7C6FF7]'
                      }`}
                    />
                  </label>
                ))}
                <label className="block md:col-span-2">
                  <div className="mb-1.5 text-[11px] uppercase tracking-[0.06em] text-[rgba(255,255,255,0.5)]">
                    BIO
                  </div>
                  <textarea
                    value={form.bio}
                    onChange={(e) => setForm((prev) => ({ ...prev, bio: e.target.value }))}
                    className="h-[100px] w-full resize-y rounded-[8px] border border-[rgba(255,255,255,0.09)] bg-[rgba(255,255,255,0.04)] px-3 py-2 text-[13px] font-normal text-white outline-none transition-all duration-150 ease-in focus:border-[#7C6FF7]"
                  />
                </label>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  onClick={() => setForm(initialForm)}
                  className="h-[34px] rounded-[8px] border border-[rgba(255,255,255,0.12)] bg-transparent px-3 text-[13px] font-medium transition-all duration-150 ease-in hover:bg-[rgba(255,255,255,0.05)]"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void save()}
                  disabled={!isDirty || saving}
                  className="h-[34px] rounded-[8px] border border-[#7C6FF7] bg-[#7C6FF7] px-3 text-[13px] font-medium text-white transition-all duration-150 ease-in hover:brightness-110 disabled:opacity-60"
                >
                  {saving ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            </div>
            <div className="rounded-[12px] border border-[rgba(226,75,74,0.2)] bg-[rgba(226,75,74,0.05)] p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-[13px] font-medium text-white">Delete account</div>
                  <div className="mt-1 text-[12px] text-[rgba(255,255,255,0.55)]">
                    Permanently remove your account and all linked data.
                  </div>
                </div>
                <button className="h-[34px] rounded-[8px] border border-[rgba(226,75,74,0.55)] px-3 text-[13px] font-medium text-[#E24B4A] transition-all duration-150 ease-in hover:bg-[rgba(226,75,74,0.1)] inline-flex items-center gap-2">
                  <Trash2 size={14} />
                  Delete
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {!loading && activeTab === 'activity' ? (
          <div className="rounded-[12px] border border-[rgba(255,255,255,0.07)] bg-[#12141e] p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-[16px] font-medium">Recent activity</div>
              <button className="text-[12px] font-normal text-[rgba(255,255,255,0.56)] transition-all duration-150 ease-in hover:text-[rgba(255,255,255,0.85)]">
                View all
              </button>
            </div>
            <div className="divide-y divide-[rgba(255,255,255,0.05)]">
              {activity.map((item) => {
                const icon =
                  item.type === 'PUBLISHED'
                    ? Upload
                    : item.type === 'COMMENTED'
                      ? MessageCircle
                      : Plus;
                const iconBg =
                  item.type === 'PUBLISHED'
                    ? 'bg-[rgba(29,158,117,0.15)] text-[#1D9E75]'
                    : item.type === 'COMMENTED'
                      ? 'bg-[rgba(55,138,221,0.15)] text-[#378ADD]'
                      : 'bg-[rgba(124,111,247,0.15)] text-[#7C6FF7]';
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
                    className="group -mx-2 flex items-center gap-3 rounded-[8px] px-2 py-3 transition-all duration-150 ease-in hover:cursor-pointer hover:bg-[rgba(255,255,255,0.02)]"
                  >
                    <span
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${iconBg}`}
                    >
                      <Icon size={14} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="text-[13px] text-[rgba(255,255,255,0.58)]">{label} </span>
                      <span className="text-[13px] font-medium text-[#9d94f5]">
                        {item.contentTitle}
                      </span>
                      <div className="mt-1 text-[11px] text-[rgba(255,255,255,0.45)]">
                        {new Date(item.timestamp).toLocaleString()}
                      </div>
                    </span>
                    <span className="opacity-0 transition-all duration-150 ease-in group-hover:opacity-100 text-[rgba(255,255,255,0.45)]">
                      <ArrowRight size={16} />
                    </span>
                  </a>
                );
              })}
            </div>
          </div>
        ) : null}

        {!loading && activeTab === 'bookmarks' ? (
          <div className="rounded-[12px] border border-[rgba(255,255,255,0.07)] bg-[#12141e] p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2">
                <span className="text-[16px] font-medium">Bookmarked content</span>
                <span className="rounded-[9999px] bg-[rgba(255,255,255,0.08)] px-2 py-0.5 text-[11px] text-[rgba(255,255,255,0.62)]">
                  {bookmarks.length}
                </span>
              </div>
              <label className="relative block w-[200px]">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgba(255,255,255,0.45)]"
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search bookmarks"
                  className="h-[34px] w-full rounded-[8px] border border-[rgba(255,255,255,0.09)] bg-transparent pl-9 pr-3 text-[13px] outline-none transition-all duration-150 ease-in focus:border-[#7C6FF7]"
                />
              </label>
            </div>
            <div className="space-y-2">
              {bookmarks.map((item) => {
                const fileIcon = item.contentType === 'VIDEO' ? Play : FileText;
                const leftTone =
                  item.contentType === 'VIDEO'
                    ? 'bg-[rgba(239,159,39,0.15)] text-[#EF9F27]'
                    : item.contentType === 'DOCUMENT'
                      ? 'bg-[rgba(55,138,221,0.15)] text-[#378ADD]'
                      : 'bg-[rgba(124,111,247,0.15)] text-[#7C6FF7]';
                const Icon = fileIcon;
                return (
                  <a
                    key={item.id}
                    href={`/library/${item.contentId}`}
                    className="group flex items-center gap-3 rounded-[8px] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] px-4 py-3 transition-all duration-150 ease-in hover:border-[rgba(255,255,255,0.12)]"
                  >
                    <span
                      className={`inline-flex h-9 w-9 items-center justify-center rounded-[8px] ${leftTone}`}
                    >
                      <Icon size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium">{item.title}</div>
                      <span className="mt-1 inline-flex rounded-[9999px] bg-[rgba(255,255,255,0.06)] px-2 py-0.5 text-[11px] text-[rgba(255,255,255,0.56)]">
                        {item.contentType.toLowerCase()}
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-2 text-[#7C6FF7]">
                      <Bookmark size={15} fill="#7C6FF7" />
                      <span className="hidden text-[11px] text-[#E24B4A] group-hover:inline">
                        Remove
                      </span>
                    </span>
                  </a>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
