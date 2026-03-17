import { useNavigate } from 'react-router-dom';
import { BookOpen } from 'lucide-react';

export default function LandingLayout() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100vh', background: '#0b0d14' }}>
      {/* Navbar */}
      <nav style={{
        padding: '16px 48px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#a78bfa' }}>
          <div style={{
            width: 36,
            height: 36,
            background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <BookOpen size={20} color="#fff" />
          </div>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#e2e4f0' }}>CommsLib</span>
        </div>
        <button 
          onClick={() => navigate('/login')}
          style={{
            padding: '10px 20px',
            background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
            border: 'none',
            borderRadius: 8,
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Login
        </button>
      </nav>

      {/* Hero Section */}
      <section style={{
        padding: '80px 48px',
        textAlign: 'center',
        background: 'linear-gradient(180deg, rgba(139,92,246,0.1) 0%, transparent 100%)',
      }}>
        <h1 style={{
          fontSize: 48,
          fontWeight: 800,
          color: '#e2e4f0',
          margin: '0 0 16px',
          lineHeight: 1.2,
        }}>
          Create. Share. <span style={{ color: '#a78bfa' }}>Inspire.</span>
        </h1>
        <p style={{
          fontSize: 18,
          color: '#8b8fa8',
          maxWidth: 600,
          margin: '0 auto 32px',
        }}>
          The all-in-one platform for creating, managing, and sharing content with your team and audience.
        </p>

        {/* Login CTA Button */}
        <button 
          onClick={() => navigate('/login')}
          style={{
            padding: '16px 32px',
            background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
            border: 'none',
            borderRadius: 12,
            color: '#fff',
            fontSize: 16,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          Sign In to Get Started
        </button>
      </section>
    </div>
  );
}
