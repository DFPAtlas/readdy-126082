import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    navigate('/dashboard', { replace: true });
  };

  return (
    <div className="min-h-screen bg-background-50 flex">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <img
          src="https://readdy.ai/api/search-image?query=Dark%20futuristic%20command%20center%20with%20holographic%20amber%20and%20teal%20data%20streams%2C%20abstract%20geometric%20patterns%20with%20circuit%20board%20aesthetic%2C%20glowing%20network%20nodes%20on%20deep%20charcoal%20background%2C%20cybersecurity%20mission%20control%20theme%2C%20sleek%20minimalist%20sci-fi%20visualization%2C%20soft%20light%20rays%2C%20cinematic%20composition%2C%20no%20text&width=1200&height=1600&seq=cmd-login-side-001&orientation=landscape"
          alt=""
          className="w-full h-full object-cover object-top"
        />
        <div className="absolute inset-0 bg-background-50/45"></div>
        <div className="absolute inset-0 flex flex-col justify-end p-12">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-accent-500 rounded-lg flex items-center justify-center">
              <i className="ri-radar-line text-background-950 text-xl w-6 h-6 flex items-center justify-center"></i>
            </div>
            <span className="font-heading font-semibold text-xl text-foreground-50 whitespace-nowrap">
              Footprint<span className="text-accent-400">CC</span>
            </span>
          </div>
          <p className="text-foreground-100/80 text-base leading-relaxed max-w-[400px]">
            Internal command centre. Authorized personnel only.
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 md:px-10">
        <div className="w-full max-w-[420px]">
          <div className="lg:hidden flex items-center gap-2.5 mb-10">
            <div className="w-8 h-8 bg-accent-500 rounded-lg flex items-center justify-center">
              <i className="ri-radar-line text-background-950 text-lg w-5 h-5 flex items-center justify-center"></i>
            </div>
            <span className="font-heading font-semibold text-lg text-foreground-50 whitespace-nowrap">
              Footprint<span className="text-accent-400">CC</span>
            </span>
          </div>

          <h1 className="font-heading text-3xl md:text-4xl font-bold text-foreground-50 mb-2">
            Sign in
          </h1>
          <p className="text-sm text-foreground-400 mb-8">
            Access the Digital Footprint Command Centre.
          </p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-5">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-foreground-200 mb-2">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                required
                className="w-full bg-background-100 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-4 py-3 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors duration-200"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground-200 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="w-full bg-background-100 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-4 py-3 pr-11 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-500 hover:text-foreground-300 transition-colors cursor-pointer"
                >
                  <i className={`text-base ${showPassword ? 'ri-eye-off-line' : 'ri-eye-line'} w-4 h-4 flex items-center justify-center`}></i>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-accent-500 hover:bg-accent-400 disabled:opacity-50 text-background-950 font-semibold text-sm px-6 py-3 rounded-full transition-all duration-200 whitespace-nowrap cursor-pointer"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="mt-8 text-sm text-foreground-500 text-center">
            Need access?{' '}
            <Link to="/signup" className="text-accent-400 hover:text-accent-300 font-medium transition-colors whitespace-nowrap">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}