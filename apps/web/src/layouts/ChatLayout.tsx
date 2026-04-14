import { useState } from 'react';
import { Send, Paperclip, Smile, MoreVertical } from 'lucide-react';

const mockMessages = [
  { id: '1', text: "Hey! How's the content review going?", sender: 'them', time: '10:30 AM' },
  { id: '2', text: 'Pretty good! Just finished reviewing the Q1 marketing plan.', sender: 'me', time: '10:32 AM' },
  { id: '3', text: 'Great! Any feedback?', sender: 'them', time: '10:33 AM' },
  { id: '4', text: 'Just a few minor suggestions. Overall it looks fantastic!', sender: 'me', time: '10:35 AM' },
  { id: '5', text: 'Awesome! When can we schedule a follow-up?', sender: 'them', time: '10:36 AM' },
];

const suggestedQuestions = [
  "What's the status of my content?",
  'How do I publish an article?',
  'Can you help me with formatting?',
  'Where are my drafts?',
];

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
    <div className="flex h-screen min-h-0 flex-col bg-app-bg">
      <header className="flex shrink-0 items-center justify-between border-b border-app-border/80 bg-app-surface/70 px-4 py-4 backdrop-blur-xl supports-[backdrop-filter]:bg-app-surface/50 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-app-accent to-app-accent-deep text-sm font-bold text-white shadow-app-soft">
            AI
          </div>
          <div>
            <h2 className="m-0 text-sm font-semibold text-app-text">AI assistant</h2>
            <span className="flex items-center gap-1.5 text-[11px] text-emerald-300/95">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Online
            </span>
          </div>
        </div>
        <button
          type="button"
          className="rounded-app-md p-2 text-app-faint transition-colors hover:bg-app-elevated hover:text-app-text"
          aria-label="More"
        >
          <MoreVertical size={20} />
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] px-4 py-3 text-sm leading-normal text-app-text sm:max-w-[70%] ${
                msg.sender === 'me'
                  ? 'rounded-2xl rounded-br-sm border border-app-accent/25 bg-gradient-to-br from-app-accent/18 to-app-accent-2/15 shadow-app-soft'
                  : 'rounded-2xl rounded-bl-sm border border-app-border/70 bg-app-surface/80 backdrop-blur-sm'
              }`}
            >
              {msg.text}
              <div className="mt-1 text-right text-[10px] text-app-faint">{msg.time}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="shrink-0 border-t border-app-border/80 bg-app-bg/60 px-4 py-3 backdrop-blur-md sm:px-6">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-app-faint">Suggested</p>
        <div className="flex flex-wrap gap-2">
          {suggestedQuestions.map((q, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setInputValue(q)}
              className="rounded-full border border-app-accent/25 bg-app-accent-muted px-3 py-1.5 text-[11px] text-app-accent transition-colors hover:border-app-accent/40 hover:bg-app-accent/20"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      <div className="shrink-0 border-t border-app-border/80 bg-app-surface/70 px-4 py-4 backdrop-blur-xl sm:px-6">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            className="rounded-app-md p-2 text-app-faint hover:bg-app-elevated hover:text-app-muted"
            aria-label="Attach"
          >
            <Paperclip size={20} />
          </button>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSend();
            }}
            placeholder="Ask anything…"
            className="min-w-0 flex-1 rounded-full border border-app-border/90 bg-app-bg-subtle/80 px-4 py-3 text-sm text-app-text outline-none placeholder:text-app-faint focus:border-app-accent/35"
          />
          <button
            type="button"
            className="rounded-full p-2 text-app-faint hover:bg-app-elevated hover:text-app-muted"
            aria-label="Emoji"
          >
            <Smile size={20} />
          </button>
          <button
            type="button"
            onClick={handleSend}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-none bg-gradient-to-br from-app-accent to-app-accent-deep text-white shadow-app-glow"
            aria-label="Send"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
