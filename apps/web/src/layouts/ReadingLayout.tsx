import { useState } from 'react';
import { Bookmark, Share2, MessageSquare, ThumbsUp, ChevronLeft, ChevronRight, Type } from 'lucide-react';
import { Surface } from '../components/ui/Surface';

const mockContent = {
  title: 'Getting Started with Our Platform',
  author: 'Alice Johnson',
  publishedAt: 'March 5, 2026',
  readTime: '5 min read',
  sections: [
    { id: '1', type: 'heading', content: 'Welcome to the Platform' },
    {
      id: '2',
      type: 'paragraph',
      content:
        "This comprehensive guide will help you get started with our content management platform. Whether you're creating your first article or managing a team of content creators, you'll find everything you need here.",
    },
    { id: '3', type: 'subheading', content: 'Step 1: Create Your First Content' },
    {
      id: '4',
      type: 'paragraph',
      content:
        'Start by clicking the "Create Content" button in the top navigation. You\'ll be presented with our intuitive editor where you can write, format, and enhance your content with various media types.',
    },
    {
      id: '5',
      type: 'list',
      items: [
        'Choose a content type (Article, Video, Podcast, Document)',
        'Add your title and start writing',
        'Use the insert panel to add images, links, and other elements',
        'Preview your content before publishing',
      ],
    },
    { id: '6', type: 'subheading', content: 'Step 2: Collaborate with Your Team' },
    {
      id: '7',
      type: 'paragraph',
      content:
        'Invite team members to collaborate on your content. You can assign roles, track changes, and manage permissions all from one place.',
    },
    {
      id: '8',
      type: 'paragraph',
      content:
        'The review workflow ensures quality control before content goes live. Assign reviewers, address feedback, and publish with confidence.',
    },
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
    const denom = scrollHeight - clientHeight;
    const progress = denom > 0 ? (scrollTop / denom) * 100 : 0;
    setScrollProgress(progress);
  };

  return (
    <div className="flex h-screen min-h-0 flex-col bg-app-bg">
      <div className="relative h-[3px] shrink-0 bg-app-elevated">
        <div
          className="absolute left-0 top-0 h-full bg-gradient-to-r from-app-accent to-app-accent-2 transition-[width] duration-100"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>

      <header className="sticky top-0 z-10 flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-app-border/80 bg-app-surface/70 px-4 py-3 backdrop-blur-xl supports-[backdrop-filter]:bg-app-surface/50 sm:px-6">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            className="rounded-app-md p-2 text-app-faint transition-colors hover:bg-app-elevated hover:text-app-text"
            aria-label="Back to library"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="text-[13px] text-app-muted">Back to library</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setBookmarked(!bookmarked)}
            className={`flex items-center gap-1.5 rounded-app-md px-3 py-2 text-xs transition-colors ${
              bookmarked
                ? 'border border-app-accent/35 bg-app-accent-muted text-app-accent'
                : 'border border-app-border/80 bg-app-bg/40 text-app-muted hover:border-app-accent/20'
            }`}
          >
            <Bookmark size={16} className={bookmarked ? 'fill-app-accent text-app-accent' : ''} />
            {bookmarked ? 'Saved' : 'Save'}
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-app-md border border-app-border/80 bg-app-bg/40 px-3 py-2 text-xs text-app-muted hover:border-app-accent/25 hover:text-app-text"
          >
            <Share2 size={16} /> Share
          </button>
          <div className="flex items-center gap-1 rounded-app-md border border-app-border/60 px-2 py-1">
            <button
              type="button"
              onClick={() => setFontSize(Math.max(12, fontSize - 2))}
              className="cursor-pointer border-none bg-transparent p-1 text-xs text-app-faint hover:text-app-text"
            >
              A−
            </button>
            <Type size={16} className="text-app-muted" aria-hidden />
            <button
              type="button"
              onClick={() => setFontSize(Math.min(24, fontSize + 2))}
              className="cursor-pointer border-none bg-transparent p-1 text-sm text-app-faint hover:text-app-text"
            >
              A+
            </button>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <main
          className="min-h-0 flex-1 overflow-y-auto px-4 py-8 sm:px-6 sm:py-10"
          onScroll={handleScroll}
        >
          <Surface variant="default" padding="lg" className="mx-auto max-w-3xl">
            <header className="mb-8">
              <h1 className="mb-4 text-[28px] font-extrabold leading-tight tracking-tight text-app-text sm:text-[32px]">
                {mockContent.title}
              </h1>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-app-accent to-app-accent-deep text-sm font-bold text-white">
                    {mockContent.author
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </div>
                  <div>
                    <div className="text-[13px] font-medium text-app-text">{mockContent.author}</div>
                    <div className="text-[11px] text-app-faint">
                      {mockContent.publishedAt} · {mockContent.readTime}
                    </div>
                  </div>
                </div>
              </div>
            </header>

            <div className="leading-relaxed text-app-muted" style={{ fontSize }}>
              {mockContent.sections.map((section) => {
                if (section.type === 'heading') {
                  return (
                    <h2
                      key={section.id}
                      className="mb-4 mt-8 font-bold text-app-text"
                      style={{ fontSize: fontSize + 8 }}
                    >
                      {section.content}
                    </h2>
                  );
                }
                if (section.type === 'subheading') {
                  return (
                    <h3
                      key={section.id}
                      className="mb-3 mt-6 font-semibold text-app-text"
                      style={{ fontSize: fontSize + 2 }}
                    >
                      {section.content}
                    </h3>
                  );
                }
                if (section.type === 'paragraph') {
                  return (
                    <p key={section.id} className="mb-4">
                      {section.content}
                    </p>
                  );
                }
                if (section.type === 'list') {
                  return (
                    <ul key={section.id} className="mb-4 ml-6 list-disc p-0 marker:text-app-accent">
                      {section.items?.map((item, i) => (
                        <li key={i} className="mb-2">
                          {item}
                        </li>
                      ))}
                    </ul>
                  );
                }
                return null;
              })}
            </div>

            <div className="mt-8 border-t border-app-border/80 pt-6">
              <div className="flex flex-wrap gap-2">
                {mockContent.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-app-accent-muted px-3 py-1 text-xs text-app-accent"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-8 flex justify-between rounded-app-xl border border-app-border/70 bg-app-bg/40 px-5 py-5">
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className="flex items-center gap-1.5 rounded-full border-none bg-app-accent-muted px-4 py-2 text-[13px] text-app-accent"
                >
                  <ThumbsUp size={16} /> Helpful (24)
                </button>
                <button
                  type="button"
                  className="flex items-center gap-1.5 rounded-full border border-app-border/80 bg-app-bg/50 px-4 py-2 text-[13px] text-app-muted"
                >
                  <MessageSquare size={16} /> Comments (8)
                </button>
              </div>
            </div>

            <div className="mt-12">
              <h2 className="mb-5 text-lg font-bold text-app-text">Related content</h2>
              <div className="flex flex-col gap-3">
                {relatedContent.map((item) => (
                  <div
                    key={item.id}
                    className="cursor-pointer rounded-app-lg border border-app-border/80 bg-app-bg/30 p-4 transition-all duration-200 hover:border-app-accent/30 hover:bg-app-accent-muted/50"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="mb-1 text-sm font-semibold text-app-text">{item.title}</h3>
                        <span className="text-xs text-app-faint">
                          {item.type} · {item.readTime}
                        </span>
                      </div>
                      <ChevronRight size={20} className="shrink-0 text-app-faint" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Surface>
        </main>

        <Surface
          variant="glass"
          padding="md"
          className="max-h-[42vh] w-full shrink-0 overflow-y-auto border-t border-app-border/80 lg:max-h-none lg:w-[280px] lg:border-l lg:border-t-0"
        >
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-wide text-app-faint">
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
                className="rounded-app-lg border border-app-border/60 border-l-[3px] border-l-app-accent bg-app-bg/35 p-3"
              >
                <p className="mb-2 text-xs text-app-muted">{note.text}</p>
                <div className="text-[10px] text-app-faint">
                  {note.author} · {note.time}
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="mt-4 w-full rounded-app-md border border-app-accent/35 bg-app-accent-muted px-4 py-2.5 text-xs font-medium text-app-accent transition-colors hover:bg-app-accent/20"
          >
            Add annotation
          </button>
        </Surface>
      </div>
    </div>
  );
}
