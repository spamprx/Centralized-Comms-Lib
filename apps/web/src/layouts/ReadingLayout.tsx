import { useState } from 'react';
import { Bookmark, Share2, MessageSquare, ThumbsUp, ChevronLeft, ChevronRight, Type } from 'lucide-react';

const mockContent = {
  title: 'Getting Started with Our Platform',
  author: 'Alice Johnson',
  publishedAt: 'March 5, 2025',
  readTime: '5 min read',
  sections: [
    { id: '1', type: 'heading', content: 'Welcome to the Platform' },
    { id: '2', type: 'paragraph', content: 'This comprehensive guide will help you get started with our content management platform. Whether you\'re creating your first article or managing a team of content creators, you\'ll find everything you need here.' },
    { id: '3', type: 'subheading', content: 'Step 1: Create Your First Content' },
    { id: '4', type: 'paragraph', content: 'Start by clicking the "Create Content" button in the top navigation. You\'ll be presented with our intuitive editor where you can write, format, and enhance your content with various media types.' },
    { id: '5', type: 'list', items: ['Choose a content type (Article, Video, Podcast, Document)', 'Add your title and start writing', 'Use the insert panel to add images, links, and other elements', 'Preview your content before publishing'] },
    { id: '6', type: 'subheading', content: 'Step 2: Collaborate with Your Team' },
    { id: '7', type: 'paragraph', content: 'Invite team members to collaborate on your content. You can assign roles, track changes, and manage permissions all from one place.' },
    { id: '8', type: 'paragraph', content: 'The review workflow ensures quality control before content goes live. Assign reviewers, address feedback, and publish with confidence.' },
  ],
  tags: ['tutorial', 'beginner', 'guide'],
};

const relatedContent = [
  { id: '1', title: 'Advanced Features Deep Dive', type: 'Article', readTime: '8 min' },
  { id: '2', title: 'Video: Platform Overview', type: 'Video', readTime: '12 min' },
  { id: '3', title: 'Best Practices Guide', type: 'Document', readTime: '6 min' },
];

export default function ReadingLayout() {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [fontSize, setFontSize] = useState(16);
  const [bookmarked, setBookmarked] = useState(false);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const progress = (scrollTop / (scrollHeight - clientHeight)) * 100;
    setScrollProgress(progress);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0b0d14' }} onScroll={handleScroll}>
      {/* Progress Bar */}
      <div style={{
        height: 3,
        background: 'rgba(255,255,255,0.05)',
        position: 'relative',
      }}>
        <div style={{
          position: 'absolute',
          left: 0,
          top: 0,
          height: '100%',
          width: `${scrollProgress}%`,
          background: 'linear-gradient(90deg, #8b5cf6, #06b6d4)',
          transition: 'width 0.1s',
        }} />
      </div>

      {/* Topbar */}
      <div style={{
        padding: '12px 24px',
        background: 'rgba(255,255,255,0.03)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button style={{
            background: 'none',
            border: 'none',
            color: '#555870',
            cursor: 'pointer',
            padding: 8,
          }}>
            <ChevronLeft size={20} />
          </button>
          <span style={{ fontSize: 13, color: '#8b8fa8' }}>Back to Library</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setBookmarked(!bookmarked)}
            style={{
              padding: '8px 12px',
              background: bookmarked ? 'rgba(139, 92, 246, 0.15)' : 'rgba(255,255,255,0.05)',
              border: 'none',
              borderRadius: 6,
              color: bookmarked ? '#a78bfa' : '#8b8fa8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
            }}
          >
            <Bookmark size={16} fill={bookmarked ? '#a78bfa' : 'none'} />
            {bookmarked ? 'Saved' : 'Save'}
          </button>
          <button style={{
            padding: '8px 12px',
            background: 'rgba(255,255,255,0.05)',
            border: 'none',
            borderRadius: 6,
            color: '#8b8fa8',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
          }}>
            <Share2 size={16} /> Share
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 8px' }}>
            <button
              onClick={() => setFontSize(Math.max(12, fontSize - 2))}
              style={{
                padding: 4,
                background: 'none',
                border: 'none',
                color: '#555870',
                cursor: 'pointer',
                fontSize: 12,
              }}
            >A-</button>
            <Type size={16} color="#555870" />
            <button
              onClick={() => setFontSize(Math.min(24, fontSize + 2))}
              style={{
                padding: 4,
                background: 'none',
                border: 'none',
                color: '#555870',
                cursor: 'pointer',
                fontSize: 14,
              }}
            >A+</button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Main Content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '40px 24px' }}>
          <article style={{ maxWidth: 768, margin: '0 auto' }}>
            {/* Article Header */}
            <header style={{ marginBottom: 32 }}>
              <h1 style={{ fontSize: 32, fontWeight: 800, color: '#e2e4f0', margin: '0 0 16px', lineHeight: 1.3 }}>
                {mockContent.title}
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    fontWeight: 700,
                    color: '#fff',
                  }}>
                    {mockContent.author.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#e2e4f0' }}>{mockContent.author}</div>
                    <div style={{ fontSize: 11, color: '#555870' }}>{mockContent.publishedAt} • {mockContent.readTime}</div>
                  </div>
                </div>
              </div>
            </header>

            {/* Article Body */}
            <div style={{ fontSize, color: '#c4c7d9', lineHeight: 1.8 }}>
              {mockContent.sections.map((section) => {
                if (section.type === 'heading') {
                  return <h2 key={section.id} style={{ fontSize: fontSize + 8, fontWeight: 700, color: '#e2e4f0', margin: '32px 0 16px' }}>{section.content}</h2>;
                }
                if (section.type === 'subheading') {
                  return <h3 key={section.id} style={{ fontSize: fontSize + 2, fontWeight: 600, color: '#e2e4f0', margin: '24px 0 12px' }}>{section.content}</h3>;
                }
                if (section.type === 'paragraph') {
                  return <p key={section.id} style={{ margin: '0 0 16px' }}>{section.content}</p>;
                }
                if (section.type === 'list') {
                  return (
                    <ul key={section.id} style={{ margin: '0 0 16px 24px', padding: 0 }}>
                      {section.items?.map((item, i) => (
                        <li key={i} style={{ marginBottom: 8 }}>{item}</li>
                      ))}
                    </ul>
                  );
                }
                return null;
              })}
            </div>

            {/* Tags */}
            <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {mockContent.tags.map(tag => (
                  <span key={tag} style={{
                    padding: '4px 12px',
                    background: 'rgba(139, 92, 246, 0.15)',
                    borderRadius: 16,
                    fontSize: 12,
                    color: '#a78bfa',
                  }}>{tag}</span>
                ))}
              </div>
            </div>

            {/* Engagement Bar */}
            <div style={{
              marginTop: 32,
              padding: '20px 24px',
              background: 'rgba(255,255,255,0.03)',
              borderRadius: 12,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <button style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 16px',
                  background: 'rgba(139, 92, 246, 0.15)',
                  border: 'none',
                  borderRadius: 20,
                  color: '#a78bfa',
                  fontSize: 13,
                  cursor: 'pointer',
                }}>
                  <ThumbsUp size={16} /> Helpful (24)
                </button>
                <button style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 16px',
                  background: 'rgba(255,255,255,0.05)',
                  border: 'none',
                  borderRadius: 20,
                  color: '#8b8fa8',
                  fontSize: 13,
                  cursor: 'pointer',
                }}>
                  <MessageSquare size={16} /> Comments (8)
                </button>
              </div>
            </div>

            {/* Related Content */}
            <div style={{ marginTop: 48 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#e2e4f0', margin: '0 0 20px' }}>Related Content</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {relatedContent.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      padding: 16,
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.07)',
                      borderRadius: 10,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.3)';
                      e.currentTarget.style.background = 'rgba(139, 92, 246, 0.05)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)';
                      e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h3 style={{ fontSize: 14, fontWeight: 600, color: '#e2e4f0', margin: '0 0 4px' }}>{item.title}</h3>
                        <span style={{ fontSize: 12, color: '#555870' }}>{item.type} • {item.readTime}</span>
                      </div>
                      <ChevronRight size={20} color="#555870" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </article>
        </main>

        {/* Side Annotations Panel */}
        <aside style={{
          width: 280,
          background: 'rgba(255,255,255,0.02)',
          borderLeft: '1px solid rgba(255,255,255,0.05)',
          padding: 20,
          overflowY: 'auto',
        }}>
          <h3 style={{ fontSize: 12, fontWeight: 600, color: '#555870', textTransform: 'uppercase', marginBottom: 16 }}>
            Annotations
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { id: '1', text: 'Great introduction!', author: 'Bob S.', time: '2d ago' },
              { id: '2', text: 'Consider adding a screenshot here', author: 'Carol W.', time: '3d ago' },
              { id: '3', text: 'This section needs updating', author: 'David B.', time: '1w ago' },
            ].map((note) => (
              <div
                key={note.id}
                style={{
                  padding: 12,
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: 8,
                  borderLeft: '3px solid #8b5cf6',
                }}
              >
                <p style={{ fontSize: 12, color: '#c4c7d9', margin: '0 0 8px' }}>{note.text}</p>
                <div style={{ fontSize: 10, color: '#555870' }}>
                  {note.author} • {note.time}
                </div>
              </div>
            ))}
          </div>
          <button style={{
            marginTop: 16,
            width: '100%',
            padding: '10px 16px',
            background: 'rgba(139, 92, 246, 0.15)',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            borderRadius: 6,
            color: '#a78bfa',
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
          }}>
            Add Annotation
          </button>
        </aside>
      </div>
    </div>
  );
}
