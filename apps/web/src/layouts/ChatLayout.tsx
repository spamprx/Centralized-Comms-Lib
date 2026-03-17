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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Chat Header */}
      <div style={{
        padding: '16px 24px',
        background: 'rgba(255,255,255,0.03)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
            fontWeight: 700,
            color: '#fff',
          }}>
            AI
          </div>
          <div>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: '#e2e4f0', margin: 0 }}>AI Assistant</h2>
            <span style={{ fontSize: 11, color: '#10b981' }}>● Online</span>
          </div>
        </div>
        <button style={{
          background: 'none',
          border: 'none',
          color: '#555870',
          cursor: 'pointer',
          padding: 8,
        }}>
          <MoreVertical size={20} />
        </button>
      </div>

      {/* Message Thread */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              justifyContent: msg.sender === 'me' ? 'flex-end' : 'flex-start',
            }}
          >
            <div style={{
              maxWidth: '70%',
              padding: '12px 16px',
              background: msg.sender === 'me'
                ? 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(6,182,212,0.2))'
                : 'rgba(255,255,255,0.05)',
              borderRadius: msg.sender === 'me' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              color: '#e2e4f0',
              fontSize: 14,
              lineHeight: 1.5,
            }}>
              {msg.text}
              <div style={{
                fontSize: 10,
                color: '#555870',
                marginTop: 4,
                textAlign: 'right',
              }}>{msg.time}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Suggested Questions */}
      <div style={{
        padding: '12px 24px',
        borderTop: '1px solid rgba(255,255,255,0.05)',
      }}>
        <p style={{ fontSize: 11, color: '#555870', marginBottom: 8 }}>Suggested questions:</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {suggestedQuestions.map((q, i) => (
            <button
              key={i}
              onClick={() => setInputValue(q)}
              style={{
                padding: '6px 12px',
                background: 'rgba(139, 92, 246, 0.1)',
                border: '1px solid rgba(139, 92, 246, 0.2)',
                borderRadius: 16,
                color: '#a78bfa',
                fontSize: 11,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Input Bar */}
      <div style={{
        padding: '16px 24px',
        background: 'rgba(255,255,255,0.03)',
        borderTop: '1px solid rgba(255,255,255,0.05)',
      }}>
        <div style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
        }}>
          <button style={{
            background: 'none',
            border: 'none',
            color: '#555870',
            cursor: 'pointer',
            padding: 8,
          }}>
            <Paperclip size={20} />
          </button>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask anything..."
            style={{
              flex: 1,
              padding: '12px 16px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 24,
              color: '#e2e4f0',
              fontSize: 14,
              outline: 'none',
            }}
          />
          <button style={{
            background: 'none',
            border: 'none',
            color: '#555870',
            cursor: 'pointer',
            padding: 8,
          }}>
            <Smile size={20} />
          </button>
          <button
            onClick={handleSend}
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
              border: 'none',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
