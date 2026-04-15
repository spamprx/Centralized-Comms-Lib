import { useState } from 'react';
import { Send, Paperclip, Smile, MoreVertical } from 'lucide-react';

const mockMessages = [
  { id: '1', text: "Hey! How's the content review going?", sender: 'them', time: '10:30 AM' },
  {
    id: '2',
    text: 'Pretty good! Just finished reviewing the Q1 marketing plan.',
    sender: 'me',
    time: '10:32 AM',
  },
  { id: '3', text: 'Great! Any feedback?', sender: 'them', time: '10:33 AM' },
  {
    id: '4',
    text: 'Just a few minor suggestions. Overall it looks fantastic!',
    sender: 'me',
    time: '10:35 AM',
  },
  { id: '5', text: 'Awesome! When can we schedule a follow-up?', sender: 'them', time: '10:36 AM' },
];

const suggestedQuestions = [
  "What's the status of my content?",
  'How do I publish an article?',
  'Can you help me with formatting?',
  'Where are my drafts?',
];

const bubbleEase = 'duration-[var(--duration-app-slow)] ease-[var(--ease-app-out)]';

export default function ChatLayout() {
  const [messages, setMessages] = useState(mockMessages);
  const [inputValue, setInputValue] = useState('');

  const handleSend = () => {
    if (!inputValue.trim()) return;
    setMessages([
      ...messages,
      {
        id: String(Date.now()),
        text: inputValue,
        sender: 'me',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setInputValue('');
  };

  return (
    <div className="relative isolate flex h-screen min-h-0 flex-col overflow-hidden bg-app-bg app-main-canvas">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -left-20 top-0 h-80 w-80 rounded-full bg-app-accent/14 blur-[100px]" />
        <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-app-accent-2/12 blur-[90px]" />
      </div>

      <header className="relative z-[1] flex shrink-0 items-center justify-between border-b border-white/[0.08] bg-app-bg/55 px-4 py-3.5 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] backdrop-blur-2xl supports-backdrop-filter:bg-app-bg/35 sm:px-6">
        <div className="flex items-center gap-3.5">
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-app-accent to-app-accent-deep text-sm font-bold tracking-tight text-white shadow-app-glow ring-1 ring-white/10">
            <span
              className="absolute inset-0 rounded-2xl bg-gradient-to-t from-transparent to-white/15"
              aria-hidden
            />
            <span className="relative">AI</span>
          </div>
          <div>
            <h2 className="m-0 text-[15px] font-semibold tracking-tight text-app-text">
              AI assistant
            </h2>
            <span className="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium text-emerald-300/95">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/40 opacity-75 motion-reduce:animate-none" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.55)]" />
              </span>
              Online
            </span>
          </div>
        </div>
        <button
          type="button"
          className={`rounded-app-md p-2.5 text-app-muted transition-[color,background-color,transform] ${bubbleEase} hover:bg-white/[0.06] hover:text-app-text active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:transform-none`}
          aria-label="More"
        >
          <MoreVertical size={20} strokeWidth={2} />
        </button>
      </header>

      <div className="chat-premium-scroll relative z-[1] min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] sm:max-w-[70%] ${msg.sender === 'me' ? 'origin-bottom-right' : 'origin-bottom-left'}`}
            >
              <div
                className={`relative overflow-hidden px-4 py-3.5 text-sm leading-relaxed text-app-text transition-[box-shadow,transform,border-color] motion-reduce:transition-none ${bubbleEase} ${
                  msg.sender === 'me'
                    ? 'rounded-2xl rounded-br-md border border-app-accent/30 bg-gradient-to-br from-app-accent/32 via-app-accent/18 to-app-accent-deep/28 shadow-app-lift hover:border-app-accent/45 hover:shadow-[0_12px_40px_-12px_rgba(147,124,248,0.35)] motion-reduce:hover:transform-none'
                    : 'rounded-2xl rounded-bl-md border border-white/[0.09] bg-gradient-to-br from-white/[0.1] to-white/[0.02] shadow-app-lift backdrop-blur-xl supports-backdrop-filter:bg-app-bg/35 hover:border-white/[0.14]'
                }`}
              >
                {msg.sender !== 'me' && (
                  <div
                    className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
                    aria-hidden
                  />
                )}
                {msg.sender === 'me' && (
                  <div
                    className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-app-accent/45 to-transparent"
                    aria-hidden
                  />
                )}
                <span className="relative">{msg.text}</span>
                <div
                  className={`relative mt-2 text-[10px] font-medium tabular-nums text-app-faint ${
                    msg.sender === 'me' ? 'text-right' : 'text-left'
                  }`}
                >
                  {msg.time}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="relative z-[1] shrink-0 border-t border-white/[0.07] bg-gradient-to-t from-app-bg/90 to-app-bg/40 px-4 py-3 backdrop-blur-xl sm:px-6">
        <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-app-faint">
          Suggested
        </p>
        <div className="flex flex-wrap gap-2">
          {suggestedQuestions.map((q, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setInputValue(q)}
              className={`rounded-full border border-white/[0.1] bg-white/[0.04] px-3.5 py-2 text-[11px] font-medium text-app-text shadow-sm backdrop-blur-md transition-[border-color,background-color,box-shadow,transform] motion-reduce:transition-none ${bubbleEase} hover:border-app-accent/35 hover:bg-app-accent-muted/35 hover:shadow-[0_0_20px_-8px_rgba(147,124,248,0.45)] active:scale-[0.98] motion-reduce:active:transform-none`}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      <div className="relative z-[1] shrink-0 border-t border-white/[0.08] bg-app-bg/50 px-4 py-4 backdrop-blur-2xl supports-backdrop-filter:bg-app-bg/30 sm:px-6 sm:py-5">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center gap-1.5 rounded-app-xl border border-white/[0.1] bg-gradient-to-b from-white/[0.08] to-white/[0.02] p-1.5 pl-2 shadow-app-lift backdrop-blur-xl transition-[box-shadow,border-color] duration-[var(--duration-app-slow)] ease-[var(--ease-app-out)] focus-within:border-app-accent/40 focus-within:shadow-[0_0_0_1px_rgba(147,124,248,0.22),0_16px_48px_-20px_rgba(147,124,248,0.25)] motion-reduce:transition-none sm:gap-2 sm:pl-3">
            <button
              type="button"
              className={`rounded-app-md p-2.5 text-app-muted transition-[color,background-color] ${bubbleEase} hover:bg-white/[0.06] hover:text-app-text`}
              aria-label="Attach"
            >
              <Paperclip size={20} strokeWidth={2} />
            </button>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSend();
              }}
              placeholder="Ask anything…"
              className="min-w-0 flex-1 border-none bg-transparent py-3 text-sm text-app-text outline-none transition-[opacity] placeholder:text-app-faint"
            />
            <button
              type="button"
              className={`rounded-app-md p-2.5 text-app-muted transition-[color,background-color] ${bubbleEase} hover:bg-white/[0.06] hover:text-app-text`}
              aria-label="Emoji"
            >
              <Smile size={20} strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={handleSend}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-app-lg border border-app-accent/25 bg-gradient-to-br from-app-accent to-app-accent-deep text-white shadow-app-glow transition-[transform,box-shadow,filter] motion-reduce:transition-none ${bubbleEase} hover:brightness-110 active:scale-[0.96] motion-reduce:active:transform-none`}
              aria-label="Send"
            >
              <Send size={18} strokeWidth={2.25} className="translate-x-px" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
