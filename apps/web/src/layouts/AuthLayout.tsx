import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, ArrowRight, Github, Chrome, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/authService';

export default function AuthLayout() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (isSignup) {
        await authService.register(email, displayName || email, password);
        await login(email, password);
      } else {
        await login(email, password);
      }
      navigate('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-violet-500/10 to-cyan-500/10">
      <div className="w-full max-w-[420px] bg-white/[0.03] border border-white/[0.07] rounded-2xl p-8">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-cyan-500 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Lock size={24} color="#fff" />
          </div>
          <h1 className="text-xl font-bold text-[#e2e4f0] mb-2">Welcome Back</h1>
          <p className="text-[13px] text-[#555870] m-0">Sign in to your account to continue</p>
        </div>

        {/* Login / Signup Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <div className="px-3 py-2.5 bg-red-500/[0.12] border border-red-500/25 rounded-lg text-red-300 text-xs">
              {error}
            </div>
          )}
          {/* Name Input (signup only) */}
          {isSignup && (
            <div>
              <label className="text-xs font-semibold text-[#8b8fa8] mb-1.5 block">
                Full Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="John Doe"
                required
                className="w-full px-3 py-3 bg-white/5 border border-white/10 rounded-lg text-[#e2e4f0] text-sm outline-none box-border"
              />
            </div>
          )}

          {/* Email Input */}
          <div>
            <label className="text-xs font-semibold text-[#8b8fa8] mb-1.5 block">
              Email Address
            </label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555870]" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full py-3 pr-3 pl-10 bg-white/5 border border-white/10 rounded-lg text-[#e2e4f0] text-sm outline-none box-border"
              />
            </div>
          </div>

          {/* Password Input */}
          <div>
            <label className="text-xs font-semibold text-[#8b8fa8] mb-1.5 block">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full py-3 pl-3 pr-11 bg-white/5 border border-white/10 rounded-lg text-[#e2e4f0] text-sm outline-none box-border"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 rounded-lg border border-white/[0.12] bg-gray-900/35 text-[#c7cbe0] cursor-pointer p-0"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Remember Me & Forgot Password (login only) */}
          {!isSignup && (
            <div className="flex justify-between items-center">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 accent-violet-500"
                />
                <span className="text-xs text-[#8b8fa8]">Remember me</span>
              </label>
              <a href="#" className="text-xs text-violet-400 no-underline">
                Forgot password?
              </a>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className={`flex items-center justify-center gap-2 px-5 py-3 border-none rounded-lg text-white text-sm font-semibold transition-all duration-200 ${
              loading
                ? 'bg-violet-500/50 cursor-not-allowed'
                : 'bg-gradient-to-br from-violet-500 to-cyan-500 cursor-pointer'
            }`}
          >
            {loading ? (isSignup ? 'Creating account...' : 'Signing in...') : isSignup ? 'Sign Up' : 'Sign In'}
            {!loading && <ArrowRight size={16} />}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-xs text-[#555870]">or continue with</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* SSO Options */}
        <div className="flex gap-3">
          <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#e2e4f0] text-[13px] cursor-pointer">
            <Chrome size={16} />
            Google
          </button>
          <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#e2e4f0] text-[13px] cursor-pointer">
            <Github size={16} />
            GitHub
          </button>
        </div>

        {/* Sign Up / Sign In Link */}
        <p className="text-center mt-6 text-[13px] text-[#555870]">
          {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            type="button"
            onClick={() => {
              setIsSignup((v) => !v);
              setError(null);
            }}
            className="bg-transparent border-none p-0 m-0 text-violet-400 no-underline font-medium cursor-pointer"
          >
            {isSignup ? 'Sign in' : 'Sign up'}
          </button>
        </p>
      </div>
    </div>
  );
}
