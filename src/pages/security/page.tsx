import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/feature/AuthGuard';
import ConfirmDialog from '@/components/base/ConfirmDialog';

interface TotpFactor {
  id: string;
  factor_type: string;
  friendly_name: string | null;
  status: string;
  created_at: string;
}

const formatEnrolled = (dateStr: string) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export default function Security() {
  const navigate = useNavigate();
  const { refreshMfa } = useAuth();
  const [factor, setFactor] = useState<TotpFactor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  const loadFactors = useCallback(async () => {
    try {
      setError('');
      const { data, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) throw listError;
      const verified = (data?.totp ?? []).find((f) => f.status === 'verified');
      setFactor(verified ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load security settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadFactors(); }, [loadFactors]);

  const confirmSwitch = async () => {
    if (!factor) return;
    setSwitching(true);
    try {
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
      if (unenrollError) throw unenrollError;
      setConfirmOpen(false);
      // 2FA is mandatory — refresh the guard's view, then head straight to re-enroll.
      await refreshMfa();
      navigate('/mfa/setup', { replace: true });
    } catch (err) {
      setConfirmOpen(false);
      setError(err instanceof Error ? err.message : 'Failed to switch device. Please try again.');
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground-50">Security</h1>
        <p className="text-sm text-foreground-500 mt-1">Manage two-factor authentication for your account.</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
          <p className="text-sm text-red-400">{error}</p>
          <button onClick={loadFactors} className="text-sm text-red-300 underline mt-1 cursor-pointer">Retry</button>
        </div>
      )}

      <section className="bg-background-100 border border-background-200/60 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-background-200/60">
          <h2 className="text-base font-heading font-semibold text-foreground-50">Two-factor authentication</h2>
          <p className="text-xs text-foreground-500 mt-0.5">Protect your account with an authenticator app.</p>
        </div>

        {loading ? (
          <div className="p-6 animate-pulse space-y-3">
            <div className="h-14 bg-background-200/50 rounded-lg"></div>
          </div>
        ) : factor ? (
          <div className="p-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-accent-500/10 flex items-center justify-center shrink-0">
                <i className="ri-smartphone-line text-accent-400 text-xl w-6 h-6 flex items-center justify-center"></i>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-foreground-100">Authenticator app</p>
                  <span className="text-[10px] font-label px-2 py-0.5 rounded uppercase bg-emerald-500/15 text-emerald-400 whitespace-nowrap">
                    Active
                  </span>
                </div>
                {factor.friendly_name && (
                  <p className="text-xs text-foreground-500 mt-1">Device: {factor.friendly_name}</p>
                )}
                <p className="text-xs text-foreground-500 mt-1">Enrolled {formatEnrolled(factor.created_at)}</p>
              </div>
            </div>

            <div className="mt-5 pt-5 border-t border-background-200/60">
              <button
                onClick={() => setConfirmOpen(true)}
                className="flex items-center gap-2 text-sm text-foreground-300 hover:text-foreground-100 border border-background-300/60 hover:border-background-400/60 rounded-full px-5 py-2.5 transition-all duration-200 whitespace-nowrap cursor-pointer"
              >
                <i className="ri-refresh-line text-base w-4 h-4 flex items-center justify-center"></i>
                Switch authenticator device
              </button>
              <p className="text-xs text-foreground-600 mt-3 leading-relaxed">
                Switching removes your current authenticator and prompts you to set up a new one.
              </p>
            </div>
          </div>
        ) : (
          <div className="px-6 py-12 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-background-200/60 flex items-center justify-center">
              <i className="ri-shield-keyhole-line text-foreground-500 text-xl w-6 h-6 flex items-center justify-center"></i>
            </div>
            <p className="text-sm text-foreground-500">No authenticator configured.</p>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Switch authenticator device"
        message="This removes your current authenticator and requires you to set up a new one. You'll be redirected to re-enroll right away."
        confirmLabel="Continue"
        confirmVariant="danger"
        onConfirm={confirmSwitch}
        loading={switching}
      />
    </div>
  );
}