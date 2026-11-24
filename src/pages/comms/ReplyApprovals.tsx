import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Draft = {
  id: string; thread_id: string; account_id: string; recipient_address: string;
  subject: string; body_text: string; status: string; created_by: string;
  reviewed_by: string | null; created_at: string; reviewed_at: string | null;
};

export default function ReplyApprovals({ accounts }: { accounts: { id: string; email_address: string }[] }) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    const [userResult, draftResult] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from('email_reply_drafts')
        .select('id,thread_id,account_id,recipient_address,subject,body_text,status,created_by,reviewed_by,created_at,reviewed_at')
        .order('created_at', { ascending: false }).limit(100),
    ]);
    if (userResult.error || !userResult.data.user) setError('Sign in again to manage replies.');
    else setUserId(userResult.data.user.id);
    if (draftResult.error) setError(draftResult.error.message);
    else setDrafts((draftResult.data ?? []) as Draft[]);
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const changeStatus = async (draft: Draft, status: 'pending' | 'approved' | 'rejected') => {
    if (!userId) return;
    setBusyId(draft.id); setError(''); setNotice('');
    const patch = status === 'pending' ? { status } : { status, reviewed_by: userId };
    const { data, error: updateError } = await supabase.from('email_reply_drafts')
      .update(patch).eq('id', draft.id).eq('status', draft.status).select('id');
    setBusyId('');
    if (updateError) { setError(updateError.message); return; }
    if (!data?.length) { setError('This draft changed. Refresh and try again.'); return; }
    setNotice(status === 'approved' ? 'Approved and saved. No email has been sent.' : status === 'rejected' ? 'Draft rejected.' : 'Draft submitted for review.');
    await refresh();
  };

  const pending = drafts.filter((draft) => draft.status === 'pending');
  const own = drafts.filter((draft) => draft.status === 'draft');
  const reviewed = drafts.filter((draft) => draft.status === 'approved' || draft.status === 'rejected');
  const renderGroup = (title: string, items: Draft[]) => <section className="space-y-3">
    <h3 className="font-heading font-semibold text-foreground-100">{title} <span className="text-foreground-500 text-sm">({items.length})</span></h3>
    {items.length === 0 && <p className="text-sm text-foreground-500">None in the recent 100.</p>}
    {items.map((draft) => <article key={draft.id} className="rounded-lg border border-background-200/60 bg-background-100 p-4 space-y-3">
      <div className="flex flex-wrap justify-between gap-2"><div><strong className="text-sm text-foreground-100">{draft.subject || '(No subject)'}</strong><p className="text-xs text-foreground-500 break-all">{accounts.find((account) => account.id === draft.account_id)?.email_address ?? 'Unknown mailbox'} → {draft.recipient_address}</p></div><span className="text-xs capitalize text-foreground-400">{draft.status}</span></div>
      <p className="text-sm text-foreground-200 whitespace-pre-wrap break-words max-h-48 overflow-y-auto">{draft.body_text}</p>
      <p className="text-xs text-foreground-500">Created {new Date(draft.created_at).toLocaleString('en-GB')}{draft.reviewed_at ? ` · Reviewed ${new Date(draft.reviewed_at).toLocaleString('en-GB')}` : ''}</p>
      {draft.status === 'draft' && draft.created_by === userId && <button type="button" disabled={Boolean(busyId)} onClick={() => void changeStatus(draft, 'pending')} className="rounded-md border border-accent-500/70 px-3 py-2 text-xs text-accent-400 disabled:opacity-50">Submit for review</button>}
      {draft.status === 'pending' && <div className="flex gap-2"><button type="button" disabled={Boolean(busyId)} onClick={() => void changeStatus(draft, 'approved')} className="rounded-md bg-accent-500 px-3 py-2 text-xs text-background-950 disabled:opacity-50">Approve</button><button type="button" disabled={Boolean(busyId)} onClick={() => void changeStatus(draft, 'rejected')} className="rounded-md border border-background-300/60 px-3 py-2 text-xs text-foreground-200 disabled:opacity-50">Reject</button></div>}
    </article>)}
  </section>;

  return <div className="space-y-6">
    <div className="flex items-center justify-between gap-3"><div><h2 className="font-heading text-lg font-semibold text-foreground-50">Reply approvals</h2><p className="text-xs text-foreground-500">Approval records a decision. Sending is not connected.</p></div><button type="button" onClick={() => void refresh()} disabled={loading} className="rounded-md border border-background-300/60 px-3 py-2 text-sm text-foreground-200 disabled:opacity-50">Refresh</button></div>
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    {notice && <p role="status" className="text-sm text-accent-400">{notice}</p>}
    {loading ? <p className="text-sm text-foreground-500">Loading drafts…</p> : <>{renderGroup('Awaiting approval', pending)}{renderGroup('Drafts', own)}{renderGroup('Reviewed', reviewed)}</>}
  </div>;
}
