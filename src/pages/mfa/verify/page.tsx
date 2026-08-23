import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/feature/AuthGuard';
import CodeInput from '@/pages/mfa/components/CodeInput';

export default function MfaVerify() {
  const navigate = useNavigate();
  const { refreshMfa } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [factorId, setFactorId] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [code, setCode] = useState<string[]>(['', '', '', '', '', '']);
  const [verifying, setVerifying] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const startChallenge = async (id: string): Promise<string> => {
    const { data, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: id });
    if (challengeError) throw challengeError;
    return data.id;
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setCode(['', '', '', '', '', '']);

    const init = async () => {
      try {
        const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
        if (listError) throw listError;

        const verifiedTotp = (factors?.totp ?? []).find((f) => f.status === 'verified');
        if (!verifiedTotp) {
          // No verified factor — shouldn't happen here, but send them to setup.
          navigate('/mfa/setup', { replace: true });
          return;
        }

        const challenge = await startChallenge(verifiedTotp.id);
        if (!cancelled) {
          setFactorId(verifiedTotp.id);
          setChallengeId(challenge);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Something went wrong.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    init();
    return () => { cancelled = true; };
  }, [retryKey, navigate]);

  const handleCodeChange = (next: string[]) => {
    setCode(next);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId || !challengeId || verifying) return;

    const fullCode = code.join('');
    if (fullCode.length !== 6) {
      setError('Enter the 6-digit code from your authenticator app.');
      return;
    }

    setError('');
    setVerifying(true);

    try {
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId,
        code: fullCode,
      });
      if (verifyError) throw verifyError;

      await refreshMfa();
      navigate('/dashboard', { replace: true });
    } catch {
      setVerifying(false);
      setCode(['', '', '', '', '', '']);
      // Challenges expire quickly — start a fresh one for the next attempt.
      try {
        const challenge = await startChallenge(factorId);
        setChallengeId(challenge);
        setError('That code was incorrect or expired. Please try again with a new code.');
      } catch {
        setError('Verification failed. Please try again.');
      }
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-background-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[440px]">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-accent-500/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <i className="ri-shield-keyhole-line text-accent-400 text-3xl w-8 h-8 flex items-center justify-center"></i>
          </div>
          <h1 className="font-heading text-3xl font-bold text-foreground-50 mb-3">
            Two-factor check
          </h1>
          <p className="text-sm text-foreground-400 leading-relaxed">
            Enter the 6-digit code from your authenticator app to continue.
          </p>
        </div>

        {loading ? (
          <div className="bg-background-100 border border-background-200/60 rounded-2xl p-8 flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-2 border-accent-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm text-foreground-400">Preparing verification...</span>
          </div>
        ) : error && !challengeId ? (
          <div className="bg-background-100 border border-background-200/60 rounded-2xl p-8 text-center">
            <div className="w-14 h-14 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <i className="ri-error-warning-line text-red-400 text-2xl w-6 h-6 flex items-center justify-center"></i>
            </div>
            <p className="text-sm text-foreground-200 mb-2 font-medium">Unable to start verification</p>
            <p className="text-sm text-foreground-400 mb-6 leading-relaxed break-words">{error}</p>
            <button
              onClick={() => setRetryKey((k) => k + 1)}
              className="w-full bg-accent-500 hover:bg-accent-400 text-background-950 font-semibold text-sm px-6 py-3 rounded-full transition-all duration-200 whitespace-nowrap cursor-pointer"
            >
              Try again
            </button>
          </div>
        ) : (
          <div className="bg-background-100 border border-background-200/60 rounded-2xl p-6">
            <form onSubmit={handleSubmit}>
              <label className="block text-sm font-medium text-foreground-200 mb-3">
                Enter the 6-digit code
              </label>
              <div className="mb-5">
                <CodeInput code={code} onChange={handleCodeChange} disabled={verifying} />
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-5">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={verifying || code.join('').length !== 6}
                className="w-full bg-accent-500 hover:bg-accent-400 disabled:opacity-50 text-background-950 font-semibold text-sm px-6 py-3 rounded-full transition-all duration-200 whitespace-nowrap cursor-pointer"
              >
                {verifying ? 'Verifying...' : 'Verify'}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-background-200/60 text-center">
              <button
                onClick={handleSignOut}
                className="text-sm text-foreground-500 hover:text-foreground-200 transition-colors cursor-pointer"
              >
                Not you? Sign out
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}