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

const BG = '#0d0f18';
const SURFACE = '#13151f';
const BORDER = 'rgba(255,255,255,0.07)';
const PURPLE = '#7C6FF7';
const AMBER = '#EF9F27';
const TEAL = '#1D9E75';
const USER_BUBBLE = '#1e1b3a';
const MUTED = '#8b90a4';
const MUTED_GREEN = 'rgba(74, 184, 120, 0.85)';

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
    <div
      className="flex h-screen min-h-0 w-full font-[ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,sans-serif] font-normal antialiased"
      style={{ backgroundColor: BG, color: '#eceef4' }}
    >
      {/* Left sidebar (sessions + nav) */}
      <aside
        className={`flex shrink-0 flex-col overflow-hidden border-r py-4 transition-[width] duration-200 ease-out ${
          sessionsSidebarOpen ? 'w-[220px]' : 'w-11'
        }`}
        style={{ borderColor: BORDER, backgroundColor: BG }}
      >
        {sessionsSidebarOpen ? (
          <>
            <div className="flex items-start justify-between gap-2 px-3 pb-5 pl-4">
              <div className="flex min-w-0 items-center gap-2.5">
                <div
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: PURPLE }}
                  aria-hidden
                >
                  <GraduationCap size={18} className="text-white" strokeWidth={2} />
                </div>
                <span className="truncate text-[15px] font-medium tracking-tight text-white">LearnAI</span>
              </div>
              <button
                type="button"
                onClick={() => setSessionsSidebarOpen(false)}
                className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-[rgba(255,255,255,0.07)] transition-colors hover:border-[rgba(255,255,255,0.14)]"
                style={{ color: MUTED }}
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
                className="h-9 w-full rounded-lg text-[13px] font-medium text-white transition-colors"
                style={{ backgroundColor: PURPLE }}
              >
                New session
              </button>
            </div>

            {/* <nav className="mt-5 flex items-center gap-4 px-4 text-[13px]" aria-label="App">
              <span className="font-medium text-white">Assistant</span>
              <button type="button" className="font-medium transition-colors hover:text-white" style={{ color: MUTED }}>
                Library
              </button>
            </nav> */}

            <div className="mt-5 min-h-0 flex-1 overflow-y-auto px-3 [scrollbar-color:rgba(255,255,255,0.12)_transparent] [scrollbar-width:thin]">
              <p className="mb-2 px-1 text-[10px] font-medium uppercase tracking-wide" style={{ color: MUTED }}>
                Recent sessions
              </p>
              <ul className="m-0 list-none p-0">
                {sessions.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => setActiveSessionId(s.id)}
                      className="w-full border-b py-3 text-left transition-colors hover:text-white"
                      style={{
                        borderColor: BORDER,
                        color: activeSessionId === s.id ? '#fff' : MUTED,
                      }}
                    >
                      <span className="block text-[13px] font-medium text-white">{s.title}</span>
                      <span className="mt-0.5 block text-[11px]" style={{ color: MUTED }}>
                        {formatSessionTime(s.at)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-auto flex items-center gap-2 border-t px-3 pt-3" style={{ borderColor: BORDER }}>
              <div
                className="flex size-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-medium text-white"
                style={{ backgroundColor: SURFACE, border: `1px solid ${BORDER}` }}
                aria-hidden
              >
                AC
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-white">Alex Chen</p>
              </div>
              <button
                type="button"
                className="flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors"
                style={{ border: `1px solid ${BORDER}`, color: MUTED }}
                aria-label="Settings"
              >
                <Settings size={16} strokeWidth={2} />
              </button>
            </div>
          </>
        ) : (
          <div className="flex h-full min-h-0 flex-col items-center gap-3 px-1 pt-1">
            <button
              type="button"
              onClick={() => setSessionsSidebarOpen(true)}
              className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-[rgba(255,255,255,0.07)] transition-colors hover:border-[rgba(255,255,255,0.14)]"
              style={{ color: MUTED }}
              aria-label="Open sessions sidebar"
              title="Open sidebar"
            >
              <ChevronRight size={18} strokeWidth={2} aria-hidden />
            </button>
            <div
              className="flex size-8 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: PURPLE }}
              aria-hidden
            >
              <GraduationCap size={16} className="text-white" strokeWidth={2} />
            </div>
          </div>
        )}
      </aside>

      {/* Center chat */}
      <main className="flex min-h-0 min-w-0 flex-1 flex-col" style={{ backgroundColor: BG }}>
        <header
          className="flex h-12 shrink-0 items-center justify-between border-b px-5"
          style={{ borderColor: BORDER, backgroundColor: BG }}
        >
          <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3">
            <h1 className="m-0 text-base font-medium text-white">AI learning assistant</h1>
            <div className="flex items-center gap-1.5 text-[12px]" style={{ color: MUTED_GREEN }}>
              <span className="size-1.5 shrink-0 rounded-full bg-[#4ab878]" aria-hidden />
              <span>Ready to help you learn</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={clearSession}
              className="h-8 rounded-lg border border-[rgba(255,255,255,0.07)] bg-transparent px-3 text-[13px] font-medium transition-colors hover:border-[rgba(255,255,255,0.14)]"
              style={{ color: MUTED }}
            >
              Clear session
            </button>
            <span
              className="rounded-full px-2.5 py-1 text-[11px] font-medium"
              style={{
                backgroundColor: SURFACE,
                border: `1px solid ${BORDER}`,
                color: MUTED,
              }}
            >
              GPT-4o
            </span>
          </div>
        </header>

        <div
          className="min-h-0 flex-1 overflow-y-auto px-5 py-5 [scrollbar-color:rgba(255,255,255,0.12)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-0.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[rgba(255,255,255,0.12)]"
          style={{
            scrollbarGutter: 'stable',
          }}
        >
          <div className="mx-auto flex max-w-[720px] flex-col gap-5">
            {messages.map((message) =>
              message.type === 'ai' ? (
                <div key={message.id} className="flex gap-3 justify-start">
                  <div
                    className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded"
                    style={{ backgroundColor: PURPLE }}
                    aria-hidden
                  >
                    <Sparkles size={12} className="text-white" strokeWidth={2} />
                  </div>
                  <div className="min-w-0 max-w-[600px]">
                    <div
                      className="rounded-xl border px-4 py-3 text-[13px] leading-[1.7] text-white"
                      style={{ borderColor: BORDER, backgroundColor: SURFACE }}
                    >
                      <p className="m-0 whitespace-pre-wrap">{message.content}</p>
                    </div>
                    <p className="mt-1.5 text-left text-[11px]" style={{ color: MUTED }}>
                      {formatMessageTime(message.timestamp)}
                    </p>
                  </div>
                </div>
              ) : (
                <div key={message.id} className="flex justify-end">
                  <div className="flex min-w-0 max-w-[500px] flex-col items-end">
                    <div
                      className="rounded-xl border px-4 py-3 text-[13px] leading-[1.7] text-white"
                      style={{ borderColor: BORDER, backgroundColor: USER_BUBBLE }}
                    >
                      <p className="m-0 whitespace-pre-wrap">{message.content}</p>
                    </div>
                    <p className="mt-1.5 text-right text-[11px]" style={{ color: MUTED }}>
                      {formatMessageTime(message.timestamp)}
                    </p>
                  </div>
                </div>
              ),
            )}
            {isTyping && (
              <div className="flex gap-3">
                <div
                  className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded"
                  style={{ backgroundColor: PURPLE }}
                  aria-hidden
                >
                  <Sparkles size={12} className="text-white" strokeWidth={2} />
                </div>
                <div
                  className="rounded-xl border px-4 py-3"
                  style={{ borderColor: BORDER, backgroundColor: SURFACE }}
                >
                  <div className="flex gap-1">
                    <span className="size-1.5 rounded-full" style={{ backgroundColor: PURPLE }} />
                    <span className="size-1.5 rounded-full" style={{ backgroundColor: PURPLE }} />
                    <span className="size-1.5 rounded-full" style={{ backgroundColor: PURPLE }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t px-5 py-3" style={{ borderColor: BORDER, backgroundColor: BG }}>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide" style={{ color: MUTED }}>
            Quick actions
          </p>
          <div className="flex flex-wrap gap-2">
            {quickActions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={() => handleQuickAction(action.prompt)}
                className="flex items-center gap-1.5 rounded-full border border-[rgba(255,255,255,0.1)] bg-transparent px-3 py-2 text-[13px] font-medium text-[#eceef4] transition-colors hover:border-[#7C6FF7] hover:bg-[rgba(124,111,247,0.15)]"
              >
                <action.icon size={14} className="shrink-0" strokeWidth={2} style={{ color: MUTED }} />
                {action.label}
              </button>
            ))}
          </div>
        </div>

        <div className="shrink-0 border-t px-5 pb-4 pt-3" style={{ borderColor: BORDER, backgroundColor: BG }}>
          <div
            className="mx-auto flex h-11 max-w-[720px] items-center gap-2 rounded-full border pl-4 pr-1"
            style={{ borderColor: BORDER, backgroundColor: SURFACE }}
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
              className="h-11 min-w-0 flex-1 border-none bg-transparent text-[13px] text-white outline-none placeholder:font-normal"
              style={{ color: '#eceef4' }}
            />
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={!inputValue.trim()}
              className="flex size-9 shrink-0 items-center justify-center gap-0 rounded-full text-[13px] font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
              style={{ backgroundColor: PURPLE }}
              aria-label="Send"
            >
              <Send size={16} strokeWidth={2} className="text-white" />
            </button>
          </div>
          <p className="mx-auto mt-2 max-w-[720px] text-center text-[11px] font-normal" style={{ color: MUTED }}>
            {topicsMastered} / {topicsTotal} topics mastered · {streakDays} day streak · {questionsCount} questions
          </p>
        </div>
      </main>

      {/* Right panel */}
      <aside
        className="flex w-[280px] shrink-0 flex-col border-l py-4"
        style={{ borderColor: BORDER, backgroundColor: BG }}
      >
        <div className="min-h-0 flex-1 overflow-y-auto px-4 [scrollbar-color:rgba(255,255,255,0.12)_transparent] [scrollbar-width:thin]">
          <div className="mb-1 flex items-center gap-2">
            <div
              className="flex size-7 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: AMBER }}
              aria-hidden
            >
              <Zap size={16} className="text-[#0d0f18]" strokeWidth={2.5} />
            </div>
            <h2 className="m-0 text-base font-medium text-white">Suggested topics</h2>
          </div>

          <ul className="mt-4 m-0 list-none space-y-2 p-0">
            {suggestedTopics.map((topic) => (
              <li key={topic.name}>
                <button
                  type="button"
                  onClick={() => handleQuickAction(`Tell me about ${topic.name}`)}
                  className="flex w-full items-start gap-2 rounded-xl border border-[rgba(255,255,255,0.07)] bg-[#13151f] p-3 text-left transition-colors hover:border-[rgba(255,255,255,0.14)] hover:bg-[rgba(255,255,255,0.04)]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="m-0 text-[13px] font-medium text-white">{topic.name}</p>
                    <span
                      className="mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium"
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.06)',
                        border: `1px solid ${BORDER}`,
                        color: MUTED,
                      }}
                    >
                      {topic.category}
                    </span>
                  </div>
                  <ChevronRight size={16} className="mt-0.5 shrink-0" style={{ color: MUTED }} aria-hidden />
                </button>
              </li>
            ))}
          </ul>

          <div className="my-5 h-px w-full" style={{ backgroundColor: BORDER }} role="separator" />

          <h2 className="m-0 text-base font-medium text-white">Your progress</h2>

          <div className="mt-4 space-y-4">
            <div>
              <div className="mb-1.5 flex items-center justify-between text-[13px]">
                <span style={{ color: MUTED }}>Topics mastered</span>
                <span className="font-medium text-white">
                  {topicsMastered} of {topicsTotal}
                </span>
              </div>
              <div className="h-[3px] w-full overflow-hidden rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
                <div className="h-full rounded-full" style={{ width: `${topicsPct}%`, backgroundColor: TEAL }} />
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between text-[13px]">
                <span style={{ color: MUTED }}>Learning streak</span>
                <span className="font-medium text-white">{streakDays} days</span>
              </div>
              <div className="h-[3px] w-full overflow-hidden rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
                <div className="h-full rounded-full" style={{ width: `${streakPct}%`, backgroundColor: AMBER }} />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-[13px]">
                <span style={{ color: MUTED }}>Questions asked</span>
                <span className="font-medium text-white">{questionsCount}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 px-4 pt-3">
          <button
            type="button"
            className="h-[34px] w-full rounded-lg border border-[rgba(255,255,255,0.07)] bg-transparent text-[13px] font-medium transition-colors hover:border-[rgba(255,255,255,0.14)]"
            style={{ color: MUTED }}
          >
            View full report
          </button>
        </div>
      </aside>
    </div>
  );
}
