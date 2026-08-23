import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/feature/AuthGuard';
import CodeInput from '@/pages/mfa/components/CodeInput';

interface Enrollment {
  factorId: string;
  qrCode: string;
  secret: string;
}

export default function MfaSetup() {
  const navigate = useNavigate();
  const { refreshMfa } = useAuth();
  const [deviceName, setDeviceName] = useState('');
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState<string[]>(['', '', '', '', '', '']);
  const [verifying, setVerifying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrFailed, setQrFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [qrUrl, setQrUrl] = useState('');

  // Convert the QR code (raw SVG or data URI) into a safe image URL.
  useEffect(() => {
    if (!enrollment?.qrCode) {
      setQrUrl('');
      return;
    }

    const raw = enrollment.qrCode.trim();

    // Supabase sometimes returns it as a data URI already — use it as-is.
    if (raw.startsWith('data:')) {
      setQrUrl(raw);
      return;
    }

    // Otherwise it's raw SVG: create a Blob URL (avoids all base64/encoding bugs).
    const blob = new Blob([raw], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    setQrUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [enrollment?.qrCode]);

  useEffect(() => {
    if (!started) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    setEnrollment(null);
    setQrFailed(false);

    const setup = async () => {
      try {
        // Clean up any stale unverified TOTP factor first, then enroll fresh.
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const stale = (factors?.totp ?? []).filter((f) => f.status === 'unverified');
        for (const factor of stale) {
          await supabase.auth.mfa.unenroll({ factorId: factor.id });
        }

        const friendlyName = deviceName.trim();
        const { data, error: enrollError } = await supabase.auth.mfa.enroll({
          factorType: 'totp',
          ...(friendlyName ? { friendlyName } : {}),
        });
        if (enrollError) throw enrollError;

        const qr = data?.totp?.qr_code;
        const secret = data?.totp?.secret;
        if (!qr || !secret) {
          throw new Error('Enrollment response missing QR code or secret. Please try again.');
        }

        if (!cancelled) {
          setEnrollment({ factorId: data.id, qrCode: qr, secret });
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Something went wrong.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    setup();
    return () => { cancelled = true; };
  }, [retryKey, started, deviceName]);

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    setStarted(true);
  };

  const handleCodeChange = (next: string[]) => {
    setCode(next);
    setError('');
  };

  const handleCopy = async () => {
    if (!enrollment) return;
    try {
      await navigator.clipboard.writeText(enrollment.secret);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard failure
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollment || verifying) return;

    const fullCode = code.join('');
    if (fullCode.length !== 6) {
      setError('Enter the 6-digit code from your authenticator app.');
      return;
    }

    setError('');
    setVerifying(true);

    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: enrollment.factorId,
      });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: enrollment.factorId,
        challengeId: challengeData.id,
        code: fullCode,
      });
      if (verifyError) throw verifyError;

      await refreshMfa();
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed. Please try again.');
      setVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-background-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[440px]">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-accent-500/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <i className="ri-smartphone-line text-accent-400 text-3xl w-8 h-8 flex items-center justify-center"></i>
          </div>
          <h1 className="font-heading text-3xl font-bold text-foreground-50 mb-3">
            Two-factor authentication
          </h1>
          <p className="text-sm text-foreground-400 leading-relaxed">
            Secure your account by connecting an authenticator app. This step is required
            before you can continue.
          </p>
        </div>

        {!started ? (
          <div className="bg-background-100 border border-background-200/60 rounded-2xl p-6">
            <form onSubmit={handleStart}>
              <label htmlFor="device-name" className="block text-sm font-medium text-foreground-200 mb-2">
                Device name <span className="text-foreground-500 font-normal">(optional)</span>
              </label>
              <input
                id="device-name"
                type="text"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                maxLength={64}
                placeholder="e.g. iPhone 15 Pro"
                autoComplete="off"
                className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-4 py-3 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors duration-200"
              />
              <p className="text-xs text-foreground-500 mt-2 leading-relaxed">
                Give this authenticator a label so it&apos;s easy to recognise later. You can
                leave it blank if you&apos;d prefer.
              </p>
              <button
                type="submit"
                className="w-full mt-5 bg-accent-500 hover:bg-accent-400 text-background-950 font-semibold text-sm px-6 py-3 rounded-full transition-all duration-200 whitespace-nowrap cursor-pointer"
              >
                Continue
              </button>
            </form>
          </div>
        ) : loading ? (
          <div className="bg-background-100 border border-background-200/60 rounded-2xl p-8 flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-2 border-accent-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm text-foreground-400">Preparing secure enrollment...</span>
          </div>
        ) : error && !enrollment ? (
          <div className="bg-background-100 border border-background-200/60 rounded-2xl p-8 text-center">
            <div className="w-14 h-14 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <i className="ri-error-warning-line text-red-400 text-2xl w-6 h-6 flex items-center justify-center"></i>
            </div>
            <p className="text-sm text-foreground-200 mb-2 font-medium">Unable to set up 2FA</p>
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
            {!qrFailed ? (
              <div className="bg-white rounded-xl p-4 flex items-center justify-center mb-6">
                {qrUrl && (
                  <img
                    src={qrUrl}
                    alt="TOTP authenticator QR code"
                    title="Two-factor authentication QR code"
                    onError={() => setQrFailed(true)}
                    className="w-52 h-52 object-contain"
                  />
                )}
              </div>
            ) : (
              <div className="bg-accent-500/10 border border-accent-500/20 rounded-xl p-5 mb-6 text-center">
                <div className="w-12 h-12 mx-auto mb-3 bg-accent-500/15 rounded-xl flex items-center justify-center">
                  <i className="ri-file-copy-line text-accent-400 text-xl w-6 h-6 flex items-center justify-center"></i>
                </div>
                <p className="text-sm font-medium text-foreground-100 mb-1">
                  Can&apos;t see the QR code?
                </p>
                <p className="text-xs text-foreground-400 mb-4 leading-relaxed">
                  No problem — copy the secret key below and add it to your authenticator
                  app manually.
                </p>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-2 bg-accent-500 hover:bg-accent-400 text-background-950 font-semibold text-sm px-5 py-2.5 rounded-full transition-all duration-200 whitespace-nowrap cursor-pointer"
                >
                  <i className={`text-base w-4 h-4 flex items-center justify-center ${copied ? 'ri-check-line' : 'ri-file-copy-line'}`}></i>
                  {copied ? 'Copied!' : 'Copy secret key'}
                </button>
              </div>
            )}

            <div className="mb-6">
              <p className="text-xs font-label text-foreground-500 uppercase tracking-widest mb-2 whitespace-nowrap">
                Or enter this key manually
              </p>
              <div className="flex items-center gap-2 bg-background-50 border border-background-300/60 rounded-lg px-4 py-3">
                <span className="flex-1 font-label text-sm text-foreground-100 tracking-wider break-all select-all">
                  {enrollment?.secret}
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="shrink-0 text-foreground-400 hover:text-foreground-200 transition-colors cursor-pointer"
                  aria-label="Copy secret key"
                >
                  <i className={`text-base w-5 h-5 flex items-center justify-center ${copied ? 'ri-check-line text-accent-400' : 'ri-file-copy-line'}`}></i>
                </button>
              </div>
            </div>

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
                {verifying ? 'Verifying...' : 'Verify & activate'}
              </button>
            </form>

            <p className="mt-6 text-xs text-foreground-500 text-center leading-relaxed">
              Two-factor authentication is mandatory. You cannot continue without completing
              this step.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}