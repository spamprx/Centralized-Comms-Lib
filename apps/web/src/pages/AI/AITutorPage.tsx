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

    // Simulate AI response
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
    <div style={{ display: 'flex', height: '100vh', background: '#0b0d14' }}>
      {/* Main Chat Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{
          padding: '20px 32px',
          background: 'rgba(255,255,255,0.03)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Sparkles size={24} color="#fff" />
            </div>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 700, color: '#e2e4f0', margin: '0 0 4px' }}>AI Learning Assistant</h1>
              <p style={{ fontSize: 12, color: '#10b981', margin: 0 }}>● Ready to help you learn</p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: 32,
        }}>
          <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
            {messages.map((message) => (
              <div
                key={message.id}
                style={{
                  display: 'flex',
                  justifyContent: message.type === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                {message.type === 'ai' && (
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                    flexShrink: 0,
                  }}>
                    <Sparkles size={18} color="#fff" />
                  </div>
                )}
                <div style={{
                  maxWidth: '75%',
                  padding: '16px 20px',
                  background: message.type === 'user'
                    ? 'linear-gradient(135deg, rgba(139,92,246,0.3), rgba(6,182,212,0.3))'
                    : 'rgba(255,255,255,0.05)',
                  borderRadius: message.type === 'user' ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                  color: '#e2e4f0',
                  fontSize: 14,
                  lineHeight: 1.7,
                  whiteSpace: 'pre-wrap',
                }}>
                  {message.content}
                </div>
              </div>
            ))}
            {isTyping && (
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}>
                  <Sparkles size={18} color="#fff" />
                </div>
                <div style={{ padding: '16px 20px', background: 'rgba(255,255,255,0.05)', borderRadius: '20px 20px 20px 4px' }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <div style={{ width: 8, height: 8, background: '#8b5cf6', borderRadius: '50%', animation: 'bounce 1.4s infinite' }} />
                    <div style={{ width: 8, height: 8, background: '#8b5cf6', borderRadius: '50%', animation: 'bounce 1.4s infinite 0.2s' }} />
                    <div style={{ width: 8, height: 8, background: '#8b5cf6', borderRadius: '50%', animation: 'bounce 1.4s infinite 0.4s' }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div style={{
          padding: '16px 32px',
          borderTop: '1px solid rgba(255,255,255,0.05)',
        }}>
          <p style={{ fontSize: 11, color: '#555870', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Quick Actions
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {quickActions.map((action) => (
              <button
                key={action.label}
                onClick={() => handleQuickAction(action.prompt)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 14px',
                  background: 'rgba(139, 92, 246, 0.1)',
                  border: '1px solid rgba(139, 92, 246, 0.2)',
                  borderRadius: 20,
                  color: '#a78bfa',
                  fontSize: 12,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                <action.icon size={14} />
                {action.label}
              </button>
            ))}
          </div>
        </div>

        {/* Input Bar */}
        <div style={{
          padding: '20px 32px',
          background: 'rgba(255,255,255,0.03)',
        }}>
          <div style={{
            maxWidth: 800,
            margin: '0 auto',
            display: 'flex',
            gap: 12,
          }}>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask anything about your learning materials..."
              style={{
                flex: 1,
                padding: '14px 20px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 12,
                color: '#e2e4f0',
                fontSize: 14,
                outline: 'none',
              }}
            />
            <button
              onClick={handleSend}
              disabled={!inputValue.trim()}
              style={{
                padding: '14px 24px',
                background: inputValue.trim() ? 'linear-gradient(135deg, #8b5cf6, #06b6d4)' : 'rgba(255,255,255,0.1)',
                border: 'none',
                borderRadius: 12,
                color: inputValue.trim() ? '#fff' : '#555870',
                fontSize: 14,
                fontWeight: 600,
                cursor: inputValue.trim() ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Send size={18} />
              Send
            </button>
          </div>
        </div>
      </div>

      {/* Sidebar - Suggested Topics */}
      <div style={{
        width: 300,
        background: 'rgba(255,255,255,0.02)',
        borderLeft: '1px solid rgba(255,255,255,0.05)',
        padding: 24,
        overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <Zap size={18} color="#fbbf24" />
          <h2 style={{ fontSize: 14, fontWeight: 600, color: '#e2e4f0', margin: 0 }}>Suggested Topics</h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {suggestedTopics.map((topic, i) => (
            <button
              key={i}
              onClick={() => handleQuickAction(`Tell me about ${topic}`)}
              style={{
                padding: '12px 16px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: 8,
                color: '#8b8fa8',
                fontSize: 12,
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)';
                e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.3)';
                e.currentTarget.style.color = '#a78bfa';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
                e.currentTarget.style.color = '#8b8fa8';
              }}
            >
              {topic}
            </button>
          ))}
        </div>

        {/* Learning Progress */}
        <div style={{ marginTop: 32 }}>
          <h3 style={{ fontSize: 12, fontWeight: 600, color: '#555870', textTransform: 'uppercase', marginBottom: 16 }}>
            Your Learning Stats
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: '#8b8fa8' }}>Topics Mastered</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#e2e4f0' }}>12/50</span>
              </div>
              <div style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: '24%', height: '100%', background: 'linear-gradient(90deg, #8b5cf6, #06b6d4)', borderRadius: 3 }} />
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: '#8b8fa8' }}>Learning Streak</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#e2e4f0' }}>5 days</span>
              </div>
              <div style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: '71%', height: '100%', background: 'linear-gradient(90deg, #f59e0b, #fbbf24)', borderRadius: 3 }} />
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: '#8b8fa8' }}>Questions Asked</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#e2e4f0' }}>47</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  );
}
