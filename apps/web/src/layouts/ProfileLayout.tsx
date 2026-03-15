import { useState } from 'react';
import { Mail, MapPin, Edit2, Save, X } from 'lucide-react';

export default function ProfileLayout() {
  const [editing, setEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('personal');
  const [formData, setFormData] = useState({
    name: 'John Doe',
    email: 'john.doe@example.com',
    phone: '+1 (555) 123-4567',
    location: 'San Francisco, CA',
    role: 'Content Manager',
    bio: 'Passionate about creating engaging content and building communities.',
  });

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

  return (
    <div style={{ padding: 24, minHeight: '100vh' }}>
      {/* Profile Header */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(6,182,212,0.2))',
        borderRadius: 16,
        padding: 32,
        marginBottom: 24,
        display: 'flex',
        alignItems: 'center',
        gap: 24,
      }}>
        <div style={{
          width: 96,
          height: 96,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 36,
          fontWeight: 700,
          color: '#fff',
          flexShrink: 0,
        }}>
          {formData.name.split(' ').map(n => n[0]).join('')}
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#e2e4f0', margin: '0 0 4px' }}>{formData.name}</h1>
          <p style={{ fontSize: 14, color: '#8b8fa8', margin: '0 0 12px' }}>{formData.role}</p>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#555870' }}>
              <Mail size={12} /> {formData.email}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#555870' }}>
              <MapPin size={12} /> {formData.location}
            </span>
          </div>
        </div>
        <button
          onClick={() => setEditing(!editing)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 20px',
            background: editing ? 'rgba(239, 68, 68, 0.15)' : 'rgba(139, 92, 246, 0.15)',
            border: 'none',
            borderRadius: 8,
            color: editing ? '#f87171' : '#a78bfa',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          {editing ? <><X size={16} /> Cancel</> : <><Edit2 size={16} /> Edit Profile</>}
        </button>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: 8,
        marginBottom: 24,
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        paddingBottom: 12,
      }}>
        {['personal', 'activity', 'bookmarks'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 16px',
              background: activeTab === tab ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
              border: 'none',
              borderRadius: 6,
              color: activeTab === tab ? '#a78bfa' : '#8b8fa8',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 24 }}>
        {/* Main Content */}
        <div style={{ flex: 1, maxWidth: 700 }}>
          {activeTab === 'personal' && (
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 12,
              padding: 24,
            }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: '#e2e4f0', margin: '0 0 20px' }}>Personal Information</h2>
              <div style={{ display: 'grid', gap: 16 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#8b8fa8', marginBottom: 6, display: 'block' }}>Full Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    disabled={!editing}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: editing ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 6,
                      color: '#e2e4f0',
                      fontSize: 14,
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#8b8fa8', marginBottom: 6, display: 'block' }}>Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    disabled={!editing}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: editing ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 6,
                      color: '#e2e4f0',
                      fontSize: 14,
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#8b8fa8', marginBottom: 6, display: 'block' }}>Bio</label>
                  <textarea
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    disabled={!editing}
                    rows={4}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: editing ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 6,
                      color: '#e2e4f0',
                      fontSize: 14,
                      outline: 'none',
                      resize: 'vertical',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                {editing && (
                  <button
                    onClick={() => {
                      setEditing(false);
                      alert('Profile updated! (Mock - backend integration required)');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '10px 20px',
                      background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
                      border: 'none',
                      borderRadius: 6,
                      color: '#fff',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      alignSelf: 'flex-start',
                    }}
                  >
                    <Save size={16} /> Save Changes
                  </button>
                )}
              </div>
            </div>
          )}

          {activeTab === 'activity' && (
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 12,
              padding: 24,
            }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: '#e2e4f0', margin: '0 0 20px' }}>Recent Activity</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {activity.map(item => (
                  <div key={item.id} style={{
                    padding: 12,
                    background: 'rgba(255,255,255,0.02)',
                    borderRadius: 6,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <div>
                      <p style={{ fontSize: 13, color: '#e2e4f0', margin: '0 0 2px' }}>
                        <span style={{ fontWeight: 500 }}>{item.action}</span>{' '}
                        <span style={{ color: '#a78bfa' }}>{item.target}</span>
                      </p>
                      <span style={{ fontSize: 11, color: '#555870' }}>{item.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'bookmarks' && (
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 12,
              padding: 24,
            }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: '#e2e4f0', margin: '0 0 20px' }}>Bookmarked Content</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {bookmarks.map(item => (
                  <div key={item.id} style={{
                    padding: 12,
                    background: 'rgba(255,255,255,0.02)',
                    borderRadius: 6,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                  }}>
                    <div>
                      <p style={{ fontSize: 13, color: '#e2e4f0', margin: '0 0 2px' }}>{item.title}</p>
                      <span style={{ fontSize: 11, color: '#555870' }}>{item.type}</span>
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
        <aside style={{ width: 280, flexShrink: 0 }}>
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 12,
            padding: 20,
          }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: '#e2e4f0', margin: '0 0 16px' }}>Quick Stats</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: '#8b8fa8' }}>Content Created</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#e2e4f0' }}>47</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: '#8b8fa8' }}>Total Views</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#e2e4f0' }}>128K</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: '#8b8fa8' }}>Following</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#e2e4f0' }}>234</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
