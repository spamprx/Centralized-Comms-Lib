import { useState } from 'react';
import { Send, Sparkles, BookOpen, HelpCircle, Lightbulb, Target, Zap } from 'lucide-react';
import { Surface } from '../../components/ui/Surface';

const initialMessages = [
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
  'Content marketing strategies',
  'Video production basics',
  'Writing effective copy',
  'SEO best practices',
  'Social media engagement',
];

export default function AITutorPage() {
  const [messages, setMessages] = useState(initialMessages);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    const userMessage = {
      id: String(Date.now()),
      type: 'user',
      content: inputValue,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    setTimeout(() => {
      const aiResponse = {
        id: String(Date.now() + 1),
        type: 'ai',
        content: generateAIResponse(inputValue),
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, aiResponse]);
      setIsTyping(false);
    }, 1500);
  };

  const generateAIResponse = (input: string) => {
    const responses = [
      `Great question about "${input}"! Let me break this down for you:\n\n**Key Points**:\n1. This is an important concept in content creation\n2. Understanding this will improve your workflow\n3. Practice is essential for mastery\n\n**Resources I recommend**:\n• Check out the "Getting Started" guide in your library\n• Watch the video tutorial on this topic\n• Try the interactive exercise\n\nWould you like me to elaborate on any of these points?`,
      `I'd be happy to help you with "${input}"!\n\n**Here's what you need to know**:\n\nThis topic covers several important aspects:\n- Foundation concepts\n- Practical applications\n- Common pitfalls to avoid\n\n**Next Steps**:\n1. Review the related content in your library\n2. Complete the practice exercises\n3. Apply what you've learned to a real project\n\nShall we dive deeper into any specific area?`,
      `Excellent topic choice! "${input}" is fundamental to success.\n\n**Learning path**:\n\n• **Start here** — basic concepts and terminology\n• **Practice** — hands-on exercises\n• **Apply** — real-world examples\n• **Review** — key takeaways\n\n**Pro tip**: Many learners find it helpful to create notes as they go through the material.\n\nWhat aspect would you like to explore first?`,
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  };

  const handleQuickAction = (prompt: string) => {
    setInputValue(`${prompt} `);
  };

  return (
    <div className="flex h-screen min-h-0 flex-col bg-app-bg lg:flex-row">
      {/* Main chat */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 shrink-0 border-b border-app-border/80 bg-app-surface/70 px-4 py-4 shadow-app-soft backdrop-blur-xl supports-[backdrop-filter]:bg-app-surface/50 sm:px-8 sm:py-5">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-app-xl bg-gradient-to-br from-app-accent to-app-accent-deep shadow-app-glow">
              <Sparkles size={24} className="text-white" aria-hidden />
            </div>
            <div className="min-w-0">
              <h1 className="mb-1 text-lg font-bold tracking-tight text-app-text">AI learning assistant</h1>
              <p className="m-0 flex items-center gap-2 text-xs text-emerald-300/95">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                Ready to help you learn
              </p>
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-8">
          <div className="mx-auto flex max-w-[800px] flex-col gap-6">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.type === 'ai' && (
                  <div className="mr-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-app-lg bg-gradient-to-br from-app-accent to-app-accent-deep">
                    <Sparkles size={18} className="text-white" aria-hidden />
                  </div>
                )}
                <div
                  className={`max-w-[85%] whitespace-pre-wrap px-5 py-4 text-sm leading-[1.7] text-app-text sm:max-w-[75%] ${
                    message.type === 'user'
                      ? 'rounded-[20px_20px_4px_20px] border border-app-accent/20 bg-gradient-to-br from-app-accent/20 to-app-accent-deep/25 shadow-app-soft'
                      : 'rounded-[20px_20px_20px_4px] border border-app-border/60 bg-app-surface/80 shadow-app-soft backdrop-blur-sm'
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex items-center">
                <div className="mr-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-app-lg bg-gradient-to-br from-app-accent to-app-accent-deep">
                  <Sparkles size={18} className="text-white" aria-hidden />
                </div>
                <div className="rounded-[20px_20px_20px_4px] border border-app-border/60 bg-app-surface/80 px-5 py-4 backdrop-blur-sm">
                  <div className="flex gap-1">
                    <div className="h-2 w-2 animate-bounce rounded-full bg-app-accent" />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-app-accent [animation-delay:0.2s]" />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-app-accent [animation-delay:0.4s]" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t border-app-border/80 bg-app-bg/80 px-4 py-3 backdrop-blur-md sm:px-8">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-app-faint">Quick actions</p>
          <div className="flex flex-wrap gap-2">
            {quickActions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={() => handleQuickAction(action.prompt)}
                className="flex items-center gap-1.5 rounded-full border border-app-accent/25 bg-app-accent-muted px-3.5 py-2 text-xs text-app-accent transition-colors hover:border-app-accent/40 hover:bg-app-accent/20"
              >
                <action.icon size={14} className="shrink-0 opacity-90" />
                {action.label}
              </button>
            ))}
          </div>
        </div>

        <div className="shrink-0 border-t border-app-border/80 bg-app-surface/70 px-4 py-4 backdrop-blur-xl sm:px-8 sm:py-5">
          <div className="mx-auto flex max-w-[800px] gap-3">
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
              placeholder="Ask anything about your learning materials…"
              className="min-w-0 flex-1 rounded-app-xl border border-app-border/90 bg-app-bg-subtle/80 px-5 py-3.5 text-sm text-app-text outline-none placeholder:text-app-faint focus:border-app-accent/40"
            />
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={!inputValue.trim()}
              className={`flex shrink-0 items-center gap-2 rounded-app-xl px-5 py-3.5 text-sm font-semibold transition-all ${
                inputValue.trim()
                  ? 'bg-gradient-to-br from-app-accent to-app-accent-deep text-white shadow-app-glow'
                  : 'cursor-not-allowed bg-app-elevated text-app-faint'
              }`}
            >
              <Send size={18} />
              <span className="hidden sm:inline">Send</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <aside className="hidden max-h-screen w-[300px] shrink-0 flex-col overflow-y-auto border-l border-app-border/80 bg-app-bg/50 p-6 backdrop-blur-sm xl:flex">
        <div className="mb-5 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-app-lg bg-amber-500/15 text-amber-300">
            <Zap size={18} aria-hidden />
          </div>
          <h2 className="m-0 text-sm font-semibold text-app-text">Suggested topics</h2>
        </div>
        <div className="flex flex-col gap-2">
          {suggestedTopics.map((topic, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleQuickAction(`Tell me about ${topic}`)}
              className="rounded-app-lg border border-app-border/80 bg-app-surface/60 px-4 py-3 text-left text-xs text-app-muted transition-all hover:border-app-accent/30 hover:bg-app-accent-muted hover:text-app-accent"
            >
              {topic}
            </button>
          ))}
        </div>

        <Surface variant="glass" padding="md" className="mt-8">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-wide text-app-faint">Your learning stats</h3>
          <div className="flex flex-col gap-4">
            <div>
              <div className="mb-1.5 flex justify-between">
                <span className="text-xs text-app-muted">Topics mastered</span>
                <span className="text-xs font-semibold text-app-text">12/50</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-sm bg-app-elevated">
                <div className="h-full w-[24%] rounded-sm bg-gradient-to-r from-app-accent to-app-accent-2" />
              </div>
            </div>
            <div>
              <div className="mb-1.5 flex justify-between">
                <span className="text-xs text-app-muted">Learning streak</span>
                <span className="text-xs font-semibold text-app-text">5 days</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-sm bg-app-elevated">
                <div className="h-full w-[71%] rounded-sm bg-gradient-to-r from-amber-500 to-amber-400" />
              </div>
            </div>
            <div>
              <div className="mb-1.5 flex justify-between">
                <span className="text-xs text-app-muted">Questions asked</span>
                <span className="text-xs font-semibold text-app-text">47</span>
              </div>
            </div>
          </div>
        </Surface>
      </aside>
    </div>
  );
}
