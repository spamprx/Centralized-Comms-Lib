import { useState } from "react";
import { Mail, MapPin, Edit2, Save, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  PageHeader,
  PageShell,
  Surface,
  Button,
  formInputClass,
  formLabelClass,
  formTextareaClass,
} from "../components/ui";

export default function ProfileLayout() {
  const [editing, setEditing] = useState(false);
  const [activeTab, setActiveTab] = useState("personal");
  const { user } = useAuth();
  const [formData, setFormData] = useState(() => ({
    name: "John Doe",
    email: "john.doe@example.com",
    phone: "+1 (555) 123-4567",
    location: "San Francisco, CA",
    role: "Content Manager",
    bio: "Passionate about creating engaging content and building communities.",
    ...(user
      ? {
          name: user.displayName || user.email,
          email: user.email,
        }
      : {}),
  }));

  const bookmarks = [
    { id: "1", title: "Getting Started Guide", type: "Article" },
    { id: "2", title: "Product Demo Video", type: "Video" },
    { id: "3", title: "Best Practices", type: "Document" },
  ];

  const activity = [
    { id: "1", action: "Published", target: "Q1 Marketing Plan", time: "2 hours ago" },
    { id: "2", action: "Commented on", target: "Team Updates", time: "5 hours ago" },
    { id: "3", action: "Created", target: "New Campaign", time: "1 day ago" },
  ];

  const inputClass = `${formInputClass} ${editing ? "" : "cursor-default opacity-90"}`;

  const tabs = [
    { id: "personal", label: "Personal" },
    { id: "activity", label: "Activity" },
    { id: "bookmarks", label: "Bookmarks" },
  ] as const;

  return (
    <PageShell>
      <PageHeader
        title="Profile"
        description="Your account and activity in one place."
      />

      <Surface
        padding="lg"
        className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-center animate-fade-in"
      >
        <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-app-accent to-cyan-500 text-3xl font-bold text-white shadow-app-soft">
          {formData.name
            .split(" ")
            .map((n) => n[0])
            .join("")}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="m-0 text-xl font-bold text-app-text">{formData.name}</h2>
          <p className="mt-1 text-sm text-app-muted">{formData.role}</p>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs text-app-faint">
            <span className="inline-flex items-center gap-1.5">
              <Mail size={12} aria-hidden /> {formData.email}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin size={12} aria-hidden /> {formData.location}
            </span>
          </div>
        </div>
        <Button
          type="button"
          variant={editing ? "danger" : "secondary"}
          onClick={() => setEditing(!editing)}
          leftIcon={editing ? <X size={16} aria-hidden /> : <Edit2 size={16} aria-hidden />}
          className="shrink-0 self-start sm:self-center"
        >
          {editing ? "Cancel" : "Edit profile"}
        </Button>
      </Surface>

      <div
        className="mb-6 flex gap-1 overflow-x-auto rounded-app-lg border border-app-border bg-app-surface/50 p-1 sm:inline-flex"
        role="tablist"
        aria-label="Profile sections"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`whitespace-nowrap rounded-app-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-app-accent-muted text-app-accent-hover shadow-app-soft"
                : "text-app-muted hover:bg-app-surface-hover hover:text-app-text"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-6 lg:flex-row animate-fade-in">
        <div className="min-w-0 flex-1 lg:max-w-3xl">
          {activeTab === "personal" && (
            <Surface>
              <h2 className="mb-5 text-base font-semibold text-app-text">
                Personal information
              </h2>
              <div className="grid gap-4">
                <div>
                  <label htmlFor="profile-name" className={formLabelClass}>
                    Full name
                  </label>
                  <input
                    id="profile-name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    disabled={!editing}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="profile-email" className={formLabelClass}>
                    Email
                  </label>
                  <input
                    id="profile-email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    disabled={!editing}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="profile-bio" className={formLabelClass}>
                    Bio
                  </label>
                  <textarea
                    id="profile-bio"
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    disabled={!editing}
                    rows={4}
                    className={`${formTextareaClass} ${!editing ? "cursor-default opacity-90" : ""}`}
                  />
                </div>
                {editing ? (
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => {
                      setEditing(false);
                      alert("Profile updated! (Mock - backend integration required)");
                    }}
                    leftIcon={<Save size={16} aria-hidden />}
                    className="self-start"
                  >
                    Save changes
                  </Button>
                ) : null}
              </div>
            </Surface>
          )}

          {activeTab === "activity" && (
            <Surface>
              <h2 className="mb-5 text-base font-semibold text-app-text">Recent activity</h2>
              <div className="flex flex-col gap-3">
                {activity.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-app-md border border-app-border/60 bg-app-bg/40 p-3"
                  >
                    <div className="min-w-0">
                      <p className="m-0 text-[13px] text-app-text">
                        <span className="font-medium">{item.action}</span>{" "}
                        <span className="text-app-accent">{item.target}</span>
                      </p>
                      <span className="text-[11px] text-app-faint">{item.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Surface>
          )}

          {activeTab === "bookmarks" && (
            <Surface>
              <h2 className="mb-5 text-base font-semibold text-app-text">
                Bookmarked content
              </h2>
              <div className="flex flex-col gap-3">
                {bookmarks.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="flex w-full items-center justify-between gap-3 rounded-app-md border border-app-border/60 bg-app-bg/40 p-3 text-left transition-colors hover:border-app-border hover:bg-app-surface-hover"
                  >
                    <div className="min-w-0">
                      <p className="m-0 text-[13px] font-medium text-app-text">{item.title}</p>
                      <span className="text-[11px] text-app-faint">{item.type}</span>
                    </div>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="shrink-0 text-app-accent"
                      aria-hidden
                    >
                      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                    </svg>
                  </button>
                ))}
              </div>
            </Surface>
          )}
        </div>

        <aside className="w-full shrink-0 lg:w-72">
          <Surface padding="md">
            <h3 className="mb-4 text-sm font-semibold text-app-text">Quick stats</h3>
            <div className="flex flex-col gap-3 text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-app-muted">Content created</span>
                <span className="font-semibold text-app-text">47</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-app-muted">Total views</span>
                <span className="font-semibold text-app-text">128K</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-app-muted">Following</span>
                <span className="font-semibold text-app-text">234</span>
              </div>
            </div>
          </Surface>
        </aside>
      </div>
    </PageShell>
  );
}
