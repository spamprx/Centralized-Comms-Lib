import { useNavigate } from 'react-router-dom';
import { BookOpen } from 'lucide-react';

export default function LandingLayout() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0b0d14]">
      {/* Navbar */}
      <nav className="px-12 py-4 flex justify-between items-center border-b border-white/5">
        <div className="flex items-center gap-2 text-violet-400">
          <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-cyan-500 rounded-lg flex items-center justify-center">
            <BookOpen size={20} color="#fff" />
          </div>
          <span className="text-lg font-bold text-[#e2e4f0]">CommsLib</span>
        </div>
        <button
          onClick={() => navigate('/login')}
          className="px-5 py-2.5 bg-gradient-to-br from-violet-500 to-cyan-500 border-none rounded-lg text-white text-sm font-semibold cursor-pointer"
        >
          Login
        </button>
      </nav>

      {/* Hero Section */}
      <section className="px-12 py-20 text-center bg-gradient-to-b from-violet-500/10 to-transparent">
        <h1 className="text-5xl font-extrabold text-[#e2e4f0] mb-4 leading-tight">
          Create. Share. <span className="text-violet-400">Inspire.</span>
        </h1>
        <p className="text-lg text-[#8b8fa8] max-w-[600px] mx-auto mb-8">
          The all-in-one platform for creating, managing, and sharing content with your team and audience.
        </p>

        {/* Login CTA Button */}
        <button
          onClick={() => navigate('/login')}
          className="px-8 py-4 bg-gradient-to-br from-violet-500 to-cyan-500 border-none rounded-xl text-white text-base font-semibold cursor-pointer inline-flex items-center gap-2"
        >
          Sign In to Get Started
        </button>
      </section>
    </div>
  );
}
