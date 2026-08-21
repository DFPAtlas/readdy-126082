import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export default function Signup() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      const { count } = await supabase
        .from('internal_user_roles')
        .select('*', { count: 'exact', head: true });

      const role = (count ?? 0) === 0 ? 'owner' : 'viewer';

      await supabase.from('internal_user_roles').insert({
        user_id: data.user.id,
        role,
        full_name: name,
      });
    }

    if (data.session) {
      navigate('/dashboard', { replace: true });
    } else {
      setSuccess('Account created! Please check your email to confirm, then sign in.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background-50 flex">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <img
          src="https://readdy.ai/api/search-image?query=Dark%20futuristic%20internal%20command%20center%20dashboard%20with%20amber%20and%20teal%20accent%20lines%2C%20geometric%20circuit%20board%20patterns%2C%20deep%20charcoal%20background%20with%20subtle%20grid%2C%20cybersecurity%20theme%2C%20sleek%20sci-fi%20visualization%2C%20cinematic%20composition%2C%20no%20text&width=1200&height=1600&seq=cmd-signup-side-002&orientation=landscape"
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
            First user gets owner access. Additional users start as viewers and can be promoted.
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
            Create account
          </h1>
          <p className="text-sm text-foreground-400 mb-8">
            Request access to the Command Centre.
          </p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-5">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-accent-500/10 border border-accent-500/20 rounded-lg px-4 py-3 mb-5">
              <p className="text-sm text-accent-400">{success}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-foreground-200 mb-2">Full name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                required
                className="w-full bg-background-100 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-4 py-3 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors duration-200"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground-200 mb-2">Email address</label>
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
              <label className="block text-sm font-medium text-foreground-200 mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  required
                  minLength={8}
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
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p className="mt-8 text-sm text-foreground-500 text-center">
            Already have access?{' '}
            <Link to="/login" className="text-accent-400 hover:text-accent-300 font-medium transition-colors whitespace-nowrap">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}