import { useState } from 'react';
import { Mail, MapPin, Edit2, Save, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function ProfileLayout() {
  const [editing, setEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('personal');
  const { user } = useAuth();
  const [formData, setFormData] = useState(() => ({
    name: 'John Doe',
    email: 'john.doe@example.com',
    phone: '+1 (555) 123-4567',
    location: 'San Francisco, CA',
    role: 'Content Manager',
    bio: 'Passionate about creating engaging content and building communities.',
    ...(user
      ? {
          name: user.displayName || user.email,
          email: user.email,
        }
      : {}),
  }));

  const bookmarks = [
    { id: '1', title: 'Getting Started Guide', type: 'Article' },
    { id: '2', title: 'Product Demo Video', type: 'Video' },
    { id: '3', title: 'Best Practices', type: 'Document' },
  ];

  const activity = [
    { id: '1', action: 'Published', target: 'Q1 Marketing Plan', time: '2 hours ago' },
    { id: '2', action: 'Commented on', target: 'Team Updates', time: '5 hours ago' },
    { id: '3', action: 'Created', target: 'New Campaign', time: '1 day ago' },
  ];

  const inputClass = `w-full px-3 py-2.5 border border-white/10 rounded-md text-[#e2e4f0] text-sm outline-none box-border ${
    editing ? 'bg-white/5' : 'bg-white/[0.02]'
  }`;

  return (
    <div className="p-6 min-h-screen">
      <div className="bg-gradient-to-br from-violet-500/20 to-cyan-500/20 rounded-2xl p-8 mb-6 flex items-center gap-6">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-4xl font-bold text-white shrink-0">
          {formData.name.split(' ').map(n => n[0]).join('')}
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-[#e2e4f0] mb-1">{formData.name}</h1>
          <p className="text-sm text-[#8b8fa8] mb-3">{formData.role}</p>
          <div className="flex gap-4 flex-wrap">
            <span className="flex items-center gap-1.5 text-xs text-[#555870]">
              <Mail size={12} /> {formData.email}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-[#555870]">
              <MapPin size={12} /> {formData.location}
            </span>
          </div>
        </div>
        <button
          onClick={() => setEditing(!editing)}
          className={`flex items-center gap-2 px-5 py-2.5 border-none rounded-lg text-[13px] font-medium cursor-pointer ${
            editing ? 'bg-red-500/15 text-red-400' : 'bg-violet-500/15 text-violet-400'
          }`}
        >
          {editing ? <><X size={16} /> Cancel</> : <><Edit2 size={16} /> Edit Profile</>}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-white/[0.07] pb-3">
        {['personal', 'activity', 'bookmarks'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 border-none rounded-md text-[13px] font-medium cursor-pointer capitalize ${
              activeTab === tab ? 'bg-violet-500/15 text-violet-400' : 'bg-transparent text-[#8b8fa8]'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex gap-6">
        {/* Main Content */}
        <div className="flex-1 max-w-[700px]">
          {activeTab === 'personal' && (
            <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-6">
              <h2 className="text-base font-semibold text-[#e2e4f0] mb-5">Personal Information</h2>
              <div className="grid gap-4">
                <div>
                  <label className="text-xs font-semibold text-[#8b8fa8] mb-1.5 block">Full Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    disabled={!editing}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#8b8fa8] mb-1.5 block">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    disabled={!editing}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#8b8fa8] mb-1.5 block">Bio</label>
                  <textarea
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    disabled={!editing}
                    rows={4}
                    className={`${inputClass} resize-y`}
                  />
                </div>
                {editing && (
                  <button
                    onClick={() => {
                      setEditing(false);
                      alert('Profile updated! (Mock - backend integration required)');
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-br from-violet-500 to-cyan-500 border-none rounded-md text-white text-[13px] font-semibold cursor-pointer self-start"
                  >
                    <Save size={16} /> Save Changes
                  </button>
                )}
              </div>
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-6">
              <h2 className="text-base font-semibold text-[#e2e4f0] mb-5">Recent Activity</h2>
              <div className="flex flex-col gap-3">
                {activity.map(item => (
                  <div key={item.id} className="p-3 bg-white/[0.02] rounded-md flex justify-between items-center">
                    <div>
                      <p className="text-[13px] text-[#e2e4f0] mb-0.5">
                        <span className="font-medium">{item.action}</span>{' '}
                        <span className="text-violet-400">{item.target}</span>
                      </p>
                      <span className="text-[11px] text-[#555870]">{item.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'bookmarks' && (
            <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-6">
              <h2 className="text-base font-semibold text-[#e2e4f0] mb-5">Bookmarked Content</h2>
              <div className="flex flex-col gap-3">
                {bookmarks.map(item => (
                  <div key={item.id} className="p-3 bg-white/[0.02] rounded-md flex justify-between items-center cursor-pointer">
                    <div>
                      <p className="text-[13px] text-[#e2e4f0] mb-0.5">{item.title}</p>
                      <span className="text-[11px] text-[#555870]">{item.type}</span>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2">
                      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                    </svg>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="w-[280px] shrink-0">
          <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-5">
            <h3 className="text-sm font-semibold text-[#e2e4f0] mb-4">Quick Stats</h3>
            <div className="flex flex-col gap-3">
              <div className="flex justify-between">
                <span className="text-xs text-[#8b8fa8]">Content Created</span>
                <span className="text-xs font-semibold text-[#e2e4f0]">47</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-[#8b8fa8]">Total Views</span>
                <span className="text-xs font-semibold text-[#e2e4f0]">128K</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-[#8b8fa8]">Following</span>
                <span className="text-xs font-semibold text-[#e2e4f0]">234</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
