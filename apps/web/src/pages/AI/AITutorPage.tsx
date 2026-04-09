import { useState } from 'react';
import { Send, Sparkles, BookOpen, HelpCircle, Lightbulb, Target, Zap } from 'lucide-react';

const initialMessages = [
  {
    id: '1',
    type: 'ai',
    content: 'Hi! I\'m your AI learning assistant. I can help you with:\n\n• Understanding content concepts\n• Creating study guides\n• Answering questions about materials\n• Providing learning recommendations\n\nWhat would you like to learn today?',
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

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    setTimeout(() => {
      const aiResponse = {
        id: String(Date.now() + 1),
        type: 'ai',
        content: generateAIResponse(inputValue),
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, aiResponse]);
      setIsTyping(false);
    }, 1500);
  };

  const generateAIResponse = (input: string) => {
    const responses = [
      `Great question about "${input}"! Let me break this down for you:\n\n**Key Points**:\n1. This is an important concept in content creation\n2. Understanding this will improve your workflow\n3. Practice is essential for mastery\n\n**Resources I recommend**:\n• Check out the "Getting Started" guide in your library\n• Watch the video tutorial on this topic\n• Try the interactive exercise\n\nWould you like me to elaborate on any of these points?`,
      `I'd be happy to help you with "${input}"!\n\n**Here's what you need to know**:\n\nThis topic covers several important aspects:\n- Foundation concepts\n- Practical applications\n- Common pitfalls to avoid\n\n**Next Steps**:\n1. Review the related content in your library\n2. Complete the practice exercises\n3. Apply what you've learned to a real project\n\nShall we dive deeper into any specific area?`,
      `Excellent topic choice! "${input}" is fundamental to success.\n\n**Learning Path**:\n\n📚 **Start Here**: Basic concepts and terminology\n🎯 **Practice**: Hands-on exercises\n📊 **Apply**: Real-world examples\n✅ **Review**: Key takeaways\n\n**Pro Tip**: Many learners find it helpful to create notes as they go through the material.\n\nWhat aspect would you like to explore first?`,
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  };

  const handleQuickAction = (prompt: string) => {
    setInputValue(prompt + ' ');
  };

  return (
    <div className="flex h-screen bg-[#0b0d14]">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="px-8 py-5 bg-white/[0.03] border-b border-white/5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center">
              <Sparkles size={24} color="#fff" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[#e2e4f0] mb-1">AI Learning Assistant</h1>
              <p className="text-xs text-emerald-500 m-0">● Ready to help you learn</p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-[800px] mx-auto flex flex-col gap-6">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.type === 'ai' && (
                  <div className="w-9 h-9 rounded-[10px] bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center mr-3 shrink-0">
                    <Sparkles size={18} color="#fff" />
                  </div>
                )}
                <div className={`max-w-[75%] px-5 py-4 text-[#e2e4f0] text-sm leading-[1.7] whitespace-pre-wrap ${
                  message.type === 'user'
                    ? 'bg-gradient-to-br from-violet-500/30 to-cyan-500/30 rounded-[20px_20px_4px_20px]'
                    : 'bg-white/5 rounded-[20px_20px_20px_4px]'
                }`}>
                  {message.content}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex items-center">
                <div className="w-9 h-9 rounded-[10px] bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center mr-3">
                  <Sparkles size={18} color="#fff" />
                </div>
                <div className="px-5 py-4 bg-white/5 rounded-[20px_20px_20px_4px]">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-violet-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                    <div className="w-2 h-2 bg-violet-500 rounded-full animate-bounce [animation-delay:0.4s]" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="px-8 py-4 border-t border-white/5">
          <p className="text-[11px] text-[#555870] mb-3 uppercase tracking-wide">
            Quick Actions
          </p>
          <div className="flex gap-2 flex-wrap">
            {quickActions.map((action) => (
              <button
                key={action.label}
                onClick={() => handleQuickAction(action.prompt)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-violet-500/10 border border-violet-500/20 rounded-[20px] text-violet-400 text-xs cursor-pointer whitespace-nowrap"
              >
                <action.icon size={14} />
                {action.label}
              </button>
            ))}
          </div>
        </div>

        {/* Input Bar */}
        <div className="px-8 py-5 bg-white/[0.03]">
          <div className="max-w-[800px] mx-auto flex gap-3">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask anything about your learning materials..."
              className="flex-1 px-5 py-3.5 bg-white/5 border border-white/10 rounded-xl text-[#e2e4f0] text-sm outline-none"
            />
            <button
              onClick={handleSend}
              disabled={!inputValue.trim()}
              className={`px-6 py-3.5 border-none rounded-xl text-sm font-semibold flex items-center gap-2 ${
                inputValue.trim()
                  ? 'bg-gradient-to-br from-violet-500 to-cyan-500 text-white cursor-pointer'
                  : 'bg-white/10 text-[#555870] cursor-not-allowed'
              }`}
            >
              <Send size={18} />
              Send
            </button>
          </div>
        </div>
      </div>

      {/* Sidebar - Suggested Topics */}
      <div className="w-[300px] bg-white/[0.02] border-l border-white/5 p-6 overflow-y-auto">
        <div className="flex items-center gap-2 mb-5">
          <Zap size={18} color="#fbbf24" />
          <h2 className="text-sm font-semibold text-[#e2e4f0] m-0">Suggested Topics</h2>
        </div>
        <div className="flex flex-col gap-2">
          {suggestedTopics.map((topic, i) => (
            <button
              key={i}
              onClick={() => handleQuickAction(`Tell me about ${topic}`)}
              className="px-4 py-3 bg-white/[0.03] border border-white/5 rounded-lg text-[#8b8fa8] text-xs text-left cursor-pointer transition-all duration-150 hover:bg-violet-500/10 hover:border-violet-500/30 hover:text-violet-400"
            >
              {topic}
            </button>
          ))}
        </div>

        {/* Learning Progress */}
        <div className="mt-8">
          <h3 className="text-xs font-semibold text-[#555870] uppercase mb-4">
            Your Learning Stats
          </h3>
          <div className="flex flex-col gap-4">
            <div>
              <div className="flex justify-between mb-1.5">
                <span className="text-xs text-[#8b8fa8]">Topics Mastered</span>
                <span className="text-xs font-semibold text-[#e2e4f0]">12/50</span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-sm overflow-hidden">
                <div className="w-[24%] h-full bg-gradient-to-r from-violet-500 to-cyan-500 rounded-sm" />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1.5">
                <span className="text-xs text-[#8b8fa8]">Learning Streak</span>
                <span className="text-xs font-semibold text-[#e2e4f0]">5 days</span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-sm overflow-hidden">
                <div className="w-[71%] h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-sm" />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1.5">
                <span className="text-xs text-[#8b8fa8]">Questions Asked</span>
                <span className="text-xs font-semibold text-[#e2e4f0]">47</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
