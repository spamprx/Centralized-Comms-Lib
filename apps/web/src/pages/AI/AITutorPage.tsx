import { useState } from 'react';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  HelpCircle,
  Lightbulb,
  Send,
  Settings,
  Sparkles,
  Target,
  Zap,
} from 'lucide-react';

type ChatMessage = {
  id: string;
  type: 'ai' | 'user';
  content: string;
  timestamp: string;
};

const initialMessages: ChatMessage[] = [
  {
    id: '1',
    type: 'ai',
    content:
      "Hi! I'm your AI learning assistant. I can help you with:\n\n• Understanding content concepts\n• Creating study guides\n• Answering questions about materials\n• Providing learning recommendations\n\nWhat would you like to learn today?",
    timestamp: new Date().toISOString(),
  },
];

const quickActions = [
  { icon: BookOpen, label: 'Explain a topic', prompt: 'Can you explain' },
  { icon: HelpCircle, label: 'Ask a question', prompt: 'I have a question about' },
  { icon: Lightbulb, label: 'Get tips', prompt: 'Give me tips for' },
  { icon: Target, label: 'Set learning goal', prompt: 'Help me create a learning plan for' },
];

const suggestedTopics = [
  { name: 'Content marketing strategies', category: 'Marketing' },
  { name: 'Video production basics', category: 'Production' },
  { name: 'Writing effective copy', category: 'Writing' },
  { name: 'SEO best practices', category: 'SEO' },
  { name: 'Social media engagement', category: 'Marketing' },
];

const recentSessionsSeed = [
  { id: 'a', title: 'SEO fundamentals review', at: '2026-04-14T10:00:00.000Z' },
  { id: 'b', title: 'Study plan: Q2 launch', at: '2026-04-13T16:30:00.000Z' },
  { id: 'c', title: 'Copywriting deep dive', at: '2026-04-12T09:15:00.000Z' },
  { id: 'd', title: 'Analytics basics', at: '2026-04-10T14:00:00.000Z' },
  { id: 'e', title: 'Brand voice workshop', at: '2026-04-08T11:45:00.000Z' },
];

const ease = 'duration-[var(--duration-app-slow)] ease-[var(--ease-app-out)]';

function formatSessionTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffH = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffH < 24) return `${Math.max(1, diffH)}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatMessageTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

const glassPanel =
  'border border-white/[0.08] bg-gradient-to-b from-white/[0.08] to-white/[0.02] shadow-app-lift backdrop-blur-xl supports-backdrop-filter:bg-app-bg/40';
const iconBtn =
  'flex size-8 shrink-0 items-center justify-center rounded-app-md border border-white/[0.08] text-app-muted transition-[border-color,background-color,color,transform] motion-reduce:transition-none hover:border-white/[0.14] hover:bg-white/[0.05] hover:text-app-text active:scale-[0.97] motion-reduce:active:transform-none';

export default function AITutorPage() {
  const [messages, setMessages] = useState(initialMessages);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sessions, setSessions] = useState(recentSessionsSeed);
  const [activeSessionId, setActiveSessionId] = useState(recentSessionsSeed[0]?.id ?? '');
  const [sessionsSidebarOpen, setSessionsSidebarOpen] = useState(true);

  const generateAIResponse = (input: string) => {
    const responses = [
      `Great question about "${input}"! Let me break this down for you:\n\nKey points:\n• This is an important concept in content creation\n• Understanding this will improve your workflow\n• Practice is essential for mastery\n\nResources I recommend:\n• Check out the "Getting Started" guide in your library\n• Watch the video tutorial on this topic\n• Try the interactive exercise\n\nWould you like me to elaborate on any of these points?`,
      `I'd be happy to help you with "${input}"!\n\nHere's what you need to know:\n\nThis topic covers several important aspects:\n• Foundation concepts\n• Practical applications\n• Common pitfalls to avoid\n\nNext steps:\n• Review the related content in your library\n• Complete the practice exercises\n• Apply what you've learned to a real project\n\nShall we dive deeper into any specific area?`,
      `Excellent topic choice! "${input}" is fundamental to success.\n\nLearning path:\n• Start here — basic concepts and terminology\n• Practice — hands-on exercises\n• Apply — real-world examples\n• Review — key takeaways\n\nPro tip: many learners find it helpful to create notes as they go through the material.\n\nWhat aspect would you like to explore first?`,
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  };

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    const userMessage: ChatMessage = {
      id: String(Date.now()),
      type: 'user',
      content: inputValue,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    setTimeout(() => {
      const aiResponse: ChatMessage = {
        id: String(Date.now() + 1),
        type: 'ai',
        content: generateAIResponse(userMessage.content),
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, aiResponse]);
      setIsTyping(false);
    }, 1500);
  };

  const handleQuickAction = (prompt: string) => {
    setInputValue(`${prompt} `);
  };

  const clearSession = () => {
    setMessages(initialMessages);
    setIsTyping(false);
    setInputValue('');
  };

  const newSession = () => {
    const id = `s-${Date.now()}`;
    setSessions((prev) => [
      { id, title: 'New learning session', at: new Date().toISOString() },
      ...prev.slice(0, 4),
    ]);
    setActiveSessionId(id);
    clearSession();
  };

  const topicsMastered = 12;
  const topicsTotal = 50;
  const streakDays = 5;
  const streakGoal = 14;
  const questionsCount = 47;

  const topicsPct = Math.min(100, (topicsMastered / topicsTotal) * 100);
  const streakPct = Math.min(100, (streakDays / streakGoal) * 100);

  return (
    <div className="relative isolate flex h-screen min-h-0 w-full overflow-hidden bg-app-bg font-sans font-normal text-app-text antialiased app-main-canvas">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -left-24 top-20 h-96 w-96 rounded-full bg-app-accent/12 blur-[110px]" />
        <div className="absolute right-0 top-1/4 h-80 w-80 rounded-full bg-app-accent-2/10 blur-[100px]" />
      </div>

      {/* Left sidebar (sessions + nav) */}
      <aside
        className={`relative z-[1] flex shrink-0 flex-col overflow-hidden border-r border-white/[0.07] bg-app-bg/55 py-4 shadow-[1px_0_0_rgba(255,255,255,0.03)_inset] backdrop-blur-2xl transition-[width] duration-300 ease-[var(--ease-app-out)] motion-reduce:transition-none ${
          sessionsSidebarOpen ? 'w-[220px]' : 'w-11'
        }`}
      >
        {sessionsSidebarOpen ? (
          <>
            <div className="flex items-start justify-between gap-2 px-3 pb-5 pl-4">
              <div className="flex min-w-0 items-center gap-2.5">
                <div
                  className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-app-lg bg-gradient-to-br from-app-accent to-app-accent-deep shadow-app-glow ring-1 ring-white/10"
                  aria-hidden
                >
                  <span className="absolute inset-0 bg-gradient-to-t from-transparent to-white/20" />
                  <GraduationCap size={18} className="relative text-white" strokeWidth={2} />
                </div>
                <span className="truncate text-[15px] font-semibold tracking-tight text-app-text">
                  LearnAI
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSessionsSidebarOpen(false)}
                className={iconBtn}
                aria-label="Collapse sessions sidebar"
                title="Collapse sidebar"
              >
                <ChevronLeft size={18} strokeWidth={2} aria-hidden />
              </button>
            </div>

            <div className="px-3">
              <button
                type="button"
                onClick={newSession}
                className={`h-9 w-full rounded-app-lg text-[13px] font-semibold text-white shadow-app-soft transition-[filter,transform,box-shadow] motion-reduce:transition-none ${ease} bg-gradient-to-br from-app-accent to-app-accent-deep hover:brightness-110 active:scale-[0.99] motion-reduce:active:transform-none`}
              >
                New session
              </button>
            </div>

            <div className="chat-premium-scroll mt-5 min-h-0 flex-1 overflow-y-auto px-3">
              <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-app-faint">
                Recent sessions
              </p>
              <ul className="m-0 list-none space-y-1 p-0">
                {sessions.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => setActiveSessionId(s.id)}
                      className={`w-full rounded-app-md border px-2.5 py-2.5 text-left transition-[border-color,background-color,box-shadow] motion-reduce:transition-none ${ease} ${
                        activeSessionId === s.id
                          ? 'border-app-accent/35 bg-app-accent-muted/40 shadow-[0_0_24px_-10px_rgba(147,124,248,0.5)]'
                          : 'border-transparent bg-transparent hover:border-white/[0.08] hover:bg-white/[0.04]'
                      }`}
                    >
                      <span className="block text-[13px] font-medium text-app-text">{s.title}</span>
                      <span className="mt-0.5 block text-[11px] text-app-muted">
                        {formatSessionTime(s.at)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-auto flex items-center gap-2 border-t border-white/[0.07] px-3 pt-3">
              <div
                className={`flex size-8 shrink-0 items-center justify-center rounded-app-md text-[11px] font-semibold text-app-text ${glassPanel}`}
                aria-hidden
              >
                AC
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-app-text">Alex Chen</p>
              </div>
              <button type="button" className={iconBtn} aria-label="Settings">
                <Settings size={16} strokeWidth={2} />
              </button>
            </div>
          </>
        ) : (
          <div className="flex h-full min-h-0 flex-col items-center gap-3 px-1 pt-1">
            <button
              type="button"
              onClick={() => setSessionsSidebarOpen(true)}
              className={iconBtn}
              aria-label="Open sessions sidebar"
              title="Open sidebar"
            >
              <ChevronRight size={18} strokeWidth={2} aria-hidden />
            </button>
            <div
              className="relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-app-lg bg-gradient-to-br from-app-accent to-app-accent-deep shadow-app-glow ring-1 ring-white/10"
              aria-hidden
            >
              <GraduationCap size={16} className="relative text-white" strokeWidth={2} />
            </div>
          </div>
        )}
      </aside>

      {/* Center chat */}
      <main className="relative z-[1] flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex h-[52px] shrink-0 items-center justify-between border-b border-white/[0.08] bg-app-bg/45 px-5 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] backdrop-blur-2xl supports-backdrop-filter:bg-app-bg/25">
          <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3">
            <h1 className="m-0 text-base font-semibold tracking-tight text-app-text">
              AI learning assistant
            </h1>
            <div className="flex items-center gap-1.5 text-[12px] font-medium text-emerald-300/95">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/35 opacity-75 motion-reduce:animate-none" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.55)]" />
              </span>
              <span>Ready to help you learn</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={clearSession}
              className={`h-8 rounded-app-md border border-white/[0.1] bg-white/[0.03] px-3 text-[13px] font-medium text-app-muted shadow-sm backdrop-blur-md transition-[border-color,background-color,color] motion-reduce:transition-none ${ease} hover:border-white/[0.16] hover:bg-white/[0.06] hover:text-app-text`}
            >
              Clear session
            </button>
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium text-app-muted ${glassPanel}`}
            >
              GPT-4o
            </span>
          </div>
        </header>

        <div className="chat-premium-scroll min-h-0 flex-1 overflow-y-auto px-5 py-5 [scrollbar-gutter:stable]">
          <div className="mx-auto flex max-w-[720px] flex-col gap-5">
            {messages.map((message) =>
              message.type === 'ai' ? (
                <div key={message.id} className="flex justify-start gap-3">
                  <div
                    className="relative mt-1 flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-app-lg bg-gradient-to-br from-app-accent to-app-accent-deep shadow-app-glow ring-1 ring-white/10"
                    aria-hidden
                  >
                    <Sparkles size={14} className="relative text-white" strokeWidth={2} />
                  </div>
                  <div className="min-w-0 max-w-[600px]">
                    <div
                      className={`relative overflow-hidden rounded-2xl rounded-tl-md px-4 py-3.5 text-[13px] leading-[1.7] text-app-text shadow-app-lift transition-[border-color,box-shadow] motion-reduce:transition-none ${ease} border border-white/[0.1] bg-gradient-to-br from-white/[0.1] to-white/[0.02] backdrop-blur-xl supports-backdrop-filter:bg-app-bg/35 hover:border-white/[0.14]`}
                    >
                      <div
                        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"
                        aria-hidden
                      />
                      <p className="relative m-0 whitespace-pre-wrap">{message.content}</p>
                    </div>
                    <p className="mt-1.5 text-left text-[11px] font-medium tabular-nums text-app-faint">
                      {formatMessageTime(message.timestamp)}
                    </p>
                  </div>
                </div>
              ) : (
                <div key={message.id} className="flex justify-end">
                  <div className="flex min-w-0 max-w-[500px] flex-col items-end">
                    <div
                      className={`relative overflow-hidden rounded-2xl rounded-br-md border border-app-accent/28 bg-gradient-to-br from-app-accent/35 via-app-accent/18 to-app-accent-deep/28 px-4 py-3.5 text-[13px] leading-[1.7] text-app-text shadow-app-lift transition-[border-color,box-shadow,transform] motion-reduce:transition-none ${ease} hover:border-app-accent/45 hover:shadow-[0_14px_44px_-16px_rgba(147,124,248,0.38)]`}
                    >
                      <div
                        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-app-accent/50 to-transparent"
                        aria-hidden
                      />
                      <p className="relative m-0 whitespace-pre-wrap">{message.content}</p>
                    </div>
                    <p className="mt-1.5 text-right text-[11px] font-medium tabular-nums text-app-faint">
                      {formatMessageTime(message.timestamp)}
                    </p>
                  </div>
                </div>
              ),
            )}
            {isTyping && (
              <div className="flex gap-3">
                <div
                  className="relative mt-1 flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-app-lg bg-gradient-to-br from-app-accent to-app-accent-deep shadow-app-glow ring-1 ring-white/10"
                  aria-hidden
                >
                  <Sparkles size={14} className="relative text-white" strokeWidth={2} />
                </div>
                <div
                  className={`flex items-center gap-3 rounded-2xl rounded-tl-md border border-white/[0.1] px-4 py-3.5 shadow-app-lift backdrop-blur-xl ${glassPanel}`}
                >
                  <div className="flex items-center gap-1.5 py-0.5">
                    <span className="ai-tutor-typing-dot size-2 rounded-full bg-app-accent shadow-[0_0_10px_rgba(147,124,248,0.55)]" />
                    <span className="ai-tutor-typing-dot size-2 rounded-full bg-app-accent shadow-[0_0_10px_rgba(147,124,248,0.55)]" />
                    <span className="ai-tutor-typing-dot size-2 rounded-full bg-app-accent shadow-[0_0_10px_rgba(147,124,248,0.55)]" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t border-white/[0.07] bg-gradient-to-t from-app-bg/85 to-transparent px-5 py-3 backdrop-blur-xl">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-app-faint">
            Quick actions
          </p>
          <div className="flex flex-wrap gap-2">
            {quickActions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={() => handleQuickAction(action.prompt)}
                className={`flex items-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-[13px] font-medium text-app-text shadow-sm backdrop-blur-md transition-[border-color,background-color,box-shadow,transform] motion-reduce:transition-none ${ease} hover:border-app-accent/35 hover:bg-app-accent-muted/30 hover:shadow-[0_0_24px_-10px_rgba(147,124,248,0.35)] active:scale-[0.98] motion-reduce:active:transform-none`}
              >
                <action.icon size={14} className="shrink-0 text-app-muted" strokeWidth={2} />
                {action.label}
              </button>
            ))}
          </div>
        </div>

        <div className="shrink-0 border-t border-white/[0.08] bg-app-bg/50 px-5 pb-5 pt-4 backdrop-blur-2xl supports-backdrop-filter:bg-app-bg/30">
          <div
            className={`mx-auto flex max-w-[720px] items-center gap-2 rounded-app-xl border border-white/[0.1] bg-gradient-to-b from-white/[0.08] to-white/[0.02] p-1.5 pl-4 shadow-app-lift backdrop-blur-xl transition-[box-shadow,border-color] motion-reduce:transition-none ${ease} focus-within:border-app-accent/38 focus-within:shadow-[0_0_0_1px_rgba(147,124,248,0.2),0_18px_56px_-24px_rgba(147,124,248,0.28)]`}
          >
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              placeholder="Ask anything about your learning materials..."
              className="h-11 min-w-0 flex-1 border-none bg-transparent text-[13px] text-app-text outline-none placeholder:text-app-faint"
            />
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={!inputValue.trim()}
              className={`flex size-10 shrink-0 items-center justify-center rounded-app-lg border border-app-accent/25 bg-gradient-to-br from-app-accent to-app-accent-deep text-white shadow-app-glow transition-[opacity,transform,filter] motion-reduce:transition-none ${ease} hover:brightness-110 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:active:transform-none`}
              aria-label="Send"
            >
              <Send size={16} strokeWidth={2.25} className="translate-x-px text-white" />
            </button>
          </div>
          <p className="mx-auto mt-2.5 max-w-[720px] text-center text-[11px] font-medium text-app-muted">
            {topicsMastered} / {topicsTotal} topics mastered · {streakDays} day streak ·{' '}
            {questionsCount} questions
          </p>
        </div>
      </main>

      {/* Right panel */}
      <aside className="relative z-[1] flex w-[280px] shrink-0 flex-col border-l border-white/[0.07] bg-app-bg/50 py-4 shadow-[-1px_0_0_rgba(255,255,255,0.03)_inset] backdrop-blur-2xl supports-backdrop-filter:bg-app-bg/35">
        <div className="chat-premium-scroll min-h-0 flex-1 overflow-y-auto px-4">
          <div className="mb-1 flex items-center gap-2">
            <div
              className="relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-app-lg bg-gradient-to-br from-amber-400 to-amber-600 shadow-[0_8px_28px_-8px_rgba(251,191,36,0.45)] ring-1 ring-white/15"
              aria-hidden
            >
              <Zap size={16} className="relative text-app-bg" strokeWidth={2.5} />
            </div>
            <h2 className="m-0 text-base font-semibold tracking-tight text-app-text">
              Suggested topics
            </h2>
          </div>

          <ul className="mt-4 m-0 list-none space-y-2 p-0">
            {suggestedTopics.map((topic) => (
              <li key={topic.name}>
                <button
                  type="button"
                  onClick={() => handleQuickAction(`Tell me about ${topic.name}`)}
                  className={`group flex w-full items-start gap-2 rounded-app-lg border border-white/[0.08] p-3 text-left shadow-sm transition-[border-color,background-color,box-shadow,transform] motion-reduce:transition-none ${ease} bg-gradient-to-br from-white/[0.07] to-white/[0.02] backdrop-blur-md hover:border-white/[0.14] hover:shadow-app-lift active:scale-[0.99] motion-reduce:active:transform-none`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="m-0 text-[13px] font-medium text-app-text transition-colors group-hover:text-app-text">
                      {topic.name}
                    </p>
                    <span className="mt-1.5 inline-block rounded-full border border-white/[0.08] bg-white/[0.05] px-2 py-0.5 text-[10px] font-medium text-app-muted backdrop-blur-sm">
                      {topic.category}
                    </span>
                  </div>
                  <ChevronRight
                    size={16}
                    className="mt-0.5 shrink-0 text-app-faint transition-transform duration-300 ease-out group-hover:translate-x-0.5 group-hover:text-app-muted motion-reduce:transition-none"
                    aria-hidden
                  />
                </button>
              </li>
            ))}
          </ul>

          <div
            className="my-5 h-px w-full bg-gradient-to-r from-transparent via-white/[0.12] to-transparent"
            role="separator"
          />

          <h2 className="m-0 text-base font-semibold tracking-tight text-app-text">
            Your progress
          </h2>

          <div className="mt-4 space-y-5">
            <div>
              <div className="mb-1.5 flex items-center justify-between text-[13px]">
                <span className="text-app-muted">Topics mastered</span>
                <span className="font-semibold tabular-nums text-app-text">
                  {topicsMastered} of {topicsTotal}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07] ring-1 ring-white/[0.05]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-app-accent-2 to-cyan-300 shadow-[0_0_16px_rgba(45,212,191,0.35)] transition-[width] duration-700 ease-out motion-reduce:transition-none"
                  style={{ width: `${topicsPct}%` }}
                />
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between text-[13px]">
                <span className="text-app-muted">Learning streak</span>
                <span className="font-semibold tabular-nums text-app-text">{streakDays} days</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07] ring-1 ring-white/[0.05]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500 shadow-[0_0_16px_rgba(251,191,36,0.3)] transition-[width] duration-700 ease-out motion-reduce:transition-none"
                  style={{ width: `${streakPct}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-app-muted">Questions asked</span>
                <span className="font-semibold tabular-nums text-app-text">{questionsCount}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 px-4 pt-3">
          <button
            type="button"
            className={`h-9 w-full rounded-app-md border border-white/[0.1] bg-white/[0.03] text-[13px] font-medium text-app-muted shadow-sm backdrop-blur-md transition-[border-color,background-color,color] motion-reduce:transition-none ${ease} hover:border-white/[0.16] hover:bg-white/[0.06] hover:text-app-text`}
          >
            View full report
          </button>
        </div>
      </aside>
    </div>
  );
}
