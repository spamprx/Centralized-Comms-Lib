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
    <div className="flex flex-col h-screen bg-[#0b0d14]" onScroll={handleScroll}>
      {/* Progress Bar */}
      <div className="h-[3px] bg-white/5 relative">
        <div
          className="absolute left-0 top-0 h-full bg-gradient-to-r from-violet-500 to-cyan-500 transition-[width] duration-100"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>

      {/* Topbar */}
      <div className="px-6 py-3 bg-white/[0.03] border-b border-white/5 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <button className="bg-transparent border-none text-[#555870] cursor-pointer p-2">
            <ChevronLeft size={20} />
          </button>
          <span className="text-[13px] text-[#8b8fa8]">Back to Library</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setBookmarked(!bookmarked)}
            className={`px-3 py-2 border-none rounded-md cursor-pointer flex items-center gap-1.5 text-xs ${
              bookmarked ? 'bg-violet-500/15 text-violet-400' : 'bg-white/5 text-[#8b8fa8]'
            }`}
          >
            <Bookmark size={16} fill={bookmarked ? '#a78bfa' : 'none'} />
            {bookmarked ? 'Saved' : 'Save'}
          </button>
          <button className="px-3 py-2 bg-white/5 border-none rounded-md text-[#8b8fa8] cursor-pointer flex items-center gap-1.5 text-xs">
            <Share2 size={16} /> Share
          </button>
          <div className="flex items-center gap-1 px-2">
            <button
              onClick={() => setFontSize(Math.max(12, fontSize - 2))}
              className="p-1 bg-transparent border-none text-[#555870] cursor-pointer text-xs"
            >A-</button>
            <Type size={16} color="#555870" />
            <button
              onClick={() => setFontSize(Math.min(24, fontSize + 2))}
              className="p-1 bg-transparent border-none text-[#555870] cursor-pointer text-sm"
            >A+</button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main Content */}
        <main className="flex-1 overflow-y-auto px-6 py-10">
          <article className="max-w-3xl mx-auto">
            {/* Article Header */}
            <header className="mb-8">
              <h1 className="text-[32px] font-extrabold text-[#e2e4f0] mb-4 leading-tight">
                {mockContent.title}
              </h1>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-sm font-bold text-white">
                    {mockContent.author.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <div className="text-[13px] font-medium text-[#e2e4f0]">{mockContent.author}</div>
                    <div className="text-[11px] text-[#555870]">{mockContent.publishedAt} • {mockContent.readTime}</div>
                  </div>
                </div>
              </div>
            </header>

            {/* Article Body */}
            <div className="text-[#c4c7d9] leading-relaxed" style={{ fontSize }}>
              {mockContent.sections.map((section) => {
                if (section.type === 'heading') {
                  return <h2 key={section.id} className="font-bold text-[#e2e4f0] mt-8 mb-4" style={{ fontSize: fontSize + 8 }}>{section.content}</h2>;
                }
                if (section.type === 'subheading') {
                  return <h3 key={section.id} className="font-semibold text-[#e2e4f0] mt-6 mb-3" style={{ fontSize: fontSize + 2 }}>{section.content}</h3>;
                }
                if (section.type === 'paragraph') {
                  return <p key={section.id} className="mb-4">{section.content}</p>;
                }
                if (section.type === 'list') {
                  return (
                    <ul key={section.id} className="mb-4 ml-6 p-0">
                      {section.items?.map((item, i) => (
                        <li key={i} className="mb-2">{item}</li>
                      ))}
                    </ul>
                  );
                }
                return null;
              })}
            </div>

            {/* Tags */}
            <div className="mt-8 pt-6 border-t border-white/5">
              <div className="flex gap-2 flex-wrap">
                {mockContent.tags.map(tag => (
                  <span key={tag} className="px-3 py-1 bg-violet-500/15 rounded-2xl text-xs text-violet-400">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Engagement Bar */}
            <div className="mt-8 px-6 py-5 bg-white/[0.03] rounded-xl flex justify-between items-center">
              <div className="flex gap-3">
                <button className="flex items-center gap-1.5 px-4 py-2 bg-violet-500/15 border-none rounded-[20px] text-violet-400 text-[13px] cursor-pointer">
                  <ThumbsUp size={16} /> Helpful (24)
                </button>
                <button className="flex items-center gap-1.5 px-4 py-2 bg-white/5 border-none rounded-[20px] text-[#8b8fa8] text-[13px] cursor-pointer">
                  <MessageSquare size={16} /> Comments (8)
                </button>
              </div>
            </div>

            {/* Related Content */}
            <div className="mt-12">
              <h2 className="text-lg font-bold text-[#e2e4f0] mb-5">Related Content</h2>
              <div className="flex flex-col gap-3">
                {relatedContent.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 bg-white/[0.03] border border-white/[0.07] rounded-[10px] cursor-pointer transition-all duration-200 hover:border-violet-500/30 hover:bg-violet-500/5"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="text-sm font-semibold text-[#e2e4f0] mb-1">{item.title}</h3>
                        <span className="text-xs text-[#555870]">{item.type} • {item.readTime}</span>
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
        <aside className="w-[280px] bg-white/[0.02] border-l border-white/5 p-5 overflow-y-auto">
          <h3 className="text-xs font-semibold text-[#555870] uppercase mb-4">
            Annotations
          </h3>
          <div className="flex flex-col gap-3">
            {[
              { id: '1', text: 'Great introduction!', author: 'Bob S.', time: '2d ago' },
              { id: '2', text: 'Consider adding a screenshot here', author: 'Carol W.', time: '3d ago' },
              { id: '3', text: 'This section needs updating', author: 'David B.', time: '1w ago' },
            ].map((note) => (
              <div
                key={note.id}
                className="p-3 bg-white/[0.03] rounded-lg border-l-[3px] border-l-violet-500"
              >
                <p className="text-xs text-[#c4c7d9] mb-2">{note.text}</p>
                <div className="text-[10px] text-[#555870]">
                  {note.author} • {note.time}
                </div>
              </div>
            ))}
          </div>
          <button className="mt-4 w-full px-4 py-2.5 bg-violet-500/15 border border-violet-500/30 rounded-md text-violet-400 text-xs font-medium cursor-pointer">
            Add Annotation
          </button>
        </aside>
      </div>
    </div>
  );
}
