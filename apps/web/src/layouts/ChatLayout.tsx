import { useState } from 'react';
import { Send, Paperclip, Smile, MoreVertical } from 'lucide-react';

const mockMessages = [
  { id: '1', text: 'Hey! How\'s the content review going?', sender: 'them', time: '10:30 AM' },
  { id: '2', text: 'Pretty good! Just finished reviewing the Q1 marketing plan.', sender: 'me', time: '10:32 AM' },
  { id: '3', text: 'Great! Any feedback?', sender: 'them', time: '10:33 AM' },
  { id: '4', text: 'Just a few minor suggestions. Overall it looks fantastic! 🎉', sender: 'me', time: '10:35 AM' },
  { id: '5', text: 'Awesome! When can we schedule a follow-up?', sender: 'them', time: '10:36 AM' },
];

const suggestedQuestions = [
  'What\'s the status of my content?',
  'How do I publish an article?',
  'Can you help me with formatting?',
  'Where are my drafts?',
];

export default function ChatLayout() {
  const [messages, setMessages] = useState(mockMessages);
  const [inputValue, setInputValue] = useState('');

  const handleSend = () => {
    if (!inputValue.trim()) return;
    setMessages([...messages, {
      id: String(Date.now()),
      text: inputValue,
      sender: 'me',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }]);
    setInputValue('');
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Chat Header */}
      <div className="px-6 py-4 bg-white/[0.03] border-b border-white/5 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-sm font-bold text-white">
            AI
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#e2e4f0] m-0">AI Assistant</h2>
            <span className="text-[11px] text-emerald-500">● Online</span>
          </div>
        </div>
        <button className="bg-transparent border-none text-[#555870] cursor-pointer p-2">
          <MoreVertical size={20} />
        </button>
      </div>

      {/* Message Thread */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[70%] px-4 py-3 text-[#e2e4f0] text-sm leading-normal ${
              msg.sender === 'me'
                ? 'bg-gradient-to-br from-violet-500/20 to-cyan-500/20 rounded-2xl rounded-br-sm'
                : 'bg-white/5 rounded-2xl rounded-bl-sm'
            }`}>
              {msg.text}
              <div className="text-[10px] text-[#555870] mt-1 text-right">{msg.time}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Suggested Questions */}
      <div className="px-6 py-3 border-t border-white/5">
        <p className="text-[11px] text-[#555870] mb-2">Suggested questions:</p>
        <div className="flex gap-2 flex-wrap">
          {suggestedQuestions.map((q, i) => (
            <button
              key={i}
              onClick={() => setInputValue(q)}
              className="px-3 py-1.5 bg-violet-500/10 border border-violet-500/20 rounded-2xl text-violet-400 text-[11px] cursor-pointer whitespace-nowrap"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Input Bar */}
      <div className="px-6 py-4 bg-white/[0.03] border-t border-white/5">
        <div className="flex gap-3 items-center">
          <button className="bg-transparent border-none text-[#555870] cursor-pointer p-2">
            <Paperclip size={20} />
          </button>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask anything..."
            className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-3xl text-[#e2e4f0] text-sm outline-none"
          />
          <button className="bg-transparent border-none text-[#555870] cursor-pointer p-2">
            <Smile size={20} />
          </button>
          <button
            onClick={handleSend}
            className="w-11 h-11 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 border-none text-white cursor-pointer flex items-center justify-center"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
