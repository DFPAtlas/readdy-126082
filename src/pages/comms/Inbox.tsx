import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Account = { id: string; email_address: string; domain: string; connection_status: string };
type Thread = {
  id: string; account_id: string; subject: string; preview: string;
  last_message_at: string; status: string; priority: string;
  unread_count: number; needs_reply: boolean;
};
type Message = {
  id: string; direction: string; from_address: string; to_addresses: string[];
  cc_addresses: string[]; subject: string; body_text: string; received_at: string;
};

const dateLabel = (value: string) => new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

export default function Inbox({ accounts }: { accounts: Account[] }) {
  const [accountId, setAccountId] = useState('');
  const [query, setQuery] = useState('');
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');
  const [detailError, setDetailError] = useState('');
  const detailRequest = useRef(0);
  const listRequest = useRef(0);

  const refresh = useCallback(async () => {
    const requestNumber = ++listRequest.current;
    setLoading(true); setError('');
    let request = supabase.from('email_threads')
      .select('id,account_id,subject,preview,last_message_at,status,priority,unread_count,needs_reply')
      .order('last_message_at', { ascending: false }).limit(50);
    if (accountId) request = request.eq('account_id', accountId);
    const { data, error: queryError } = await request;
    if (requestNumber !== listRequest.current) return;
    if (queryError) { setError(queryError.message); setThreads([]); }
    else setThreads((data ?? []) as Thread[]);
    setLoading(false);
  }, [accountId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const openThread = async (id: string) => {
    const requestNumber = ++detailRequest.current;
    setSelectedId(id); setMessages([]); setDetailError(''); setDetailLoading(true);
    const { data, error: queryError } = await supabase.from('email_messages')
      .select('id,direction,from_address,to_addresses,cc_addresses,subject,body_text,received_at')
      .eq('thread_id', id).order('received_at', { ascending: true }).limit(100);
    if (requestNumber !== detailRequest.current) return;
    if (queryError) setDetailError(queryError.message);
    else setMessages((data ?? []) as Message[]);
    setDetailLoading(false);
  };

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return term ? threads.filter((thread) =>
      `${thread.subject} ${thread.preview} ${accounts.find((account) => account.id === thread.account_id)?.email_address ?? ''}`.toLowerCase().includes(term)
    ) : threads;
  }, [threads, accounts, query]);
  const selected = threads.find((thread) => thread.id === selectedId);
  const connected = accounts.some((account) => account.connection_status === 'connected');

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="font-heading text-lg font-semibold text-foreground-50">Unified Inbox</h2><p className="text-xs text-foreground-500">Showing the 50 most recent threads{accountId ? ' for this mailbox' : ''}. Search filters this set.</p></div>
      <button type="button" onClick={() => void refresh()} disabled={loading} className="rounded-md border border-background-300/60 px-3 py-2 text-sm text-foreground-200 disabled:opacity-50">Refresh messages</button>
    </div>
    {!loading && !error && <div className="grid gap-2 sm:grid-cols-3" aria-label="Recent thread counts">
      {[
        ['Unread threads', threads.filter((thread) => thread.unread_count > 0).length],
        ['Needs reply', threads.filter((thread) => thread.needs_reply).length],
        ['Urgent', threads.filter((thread) => thread.priority === 'urgent').length],
      ].map(([label, count]) => <div key={label} className="rounded-md border border-background-200/60 bg-background-100 p-3"><strong className="text-lg text-foreground-100">{count}</strong><span className="ml-2 text-xs text-foreground-500">{label} in recent 50</span></div>)}
    </div>}
    <div className="flex flex-wrap gap-3">
      <label className="text-xs text-foreground-400">Mailbox
        <select value={accountId} onChange={(event) => { ++detailRequest.current; setAccountId(event.target.value); setSelectedId(null); setMessages([]); setDetailLoading(false); }} className="block mt-1 rounded-md bg-background-100 border border-background-300/60 px-3 py-2 text-sm text-foreground-100">
          <option value="">All mailboxes</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.email_address}</option>)}
        </select>
      </label>
      <label className="text-xs text-foreground-400 flex-1 min-w-[200px]">Search recent threads
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Subject, preview or mailbox" className="block w-full mt-1 rounded-md bg-background-100 border border-background-300/60 px-3 py-2 text-sm text-foreground-100" />
      </label>
    </div>
    {error && <div role="alert" className="rounded-md border border-red-500/30 p-4 text-sm text-red-300">Messages could not be loaded: {error}</div>}
    {loading ? <p className="text-sm text-foreground-500">Loading recent threads…</p> : <div className="grid gap-4 lg:grid-cols-[minmax(280px,380px)_minmax(0,1fr)]">
      <div className="rounded-lg border border-background-200/60 bg-background-100 overflow-hidden max-h-[720px] overflow-y-auto">
        {visible.length === 0 ? <div className="p-6 text-sm text-foreground-500">{query ? 'No matching threads in the recent set.' : connected ? 'No messages have been ingested yet.' : 'No provider is connected yet. Registered mailboxes will show messages here once ingestion is active.'}</div> : visible.map((thread) => <button
          key={thread.id} type="button" onClick={() => void openThread(thread.id)}
          className={`w-full text-left p-4 border-b border-background-200/60 hover:bg-background-200/40 ${selectedId === thread.id ? 'bg-accent-500/10' : ''}`}>
          <div className="flex justify-between gap-2"><span className="truncate text-sm font-medium text-foreground-100">{thread.subject || '(No subject)'}</span>{thread.unread_count > 0 && <span className="shrink-0 rounded-full bg-accent-500 px-2 text-xs text-background-950">{thread.unread_count}</span>}</div>
          <p className="mt-1 text-xs text-foreground-500 truncate">{accounts.find((account) => account.id === thread.account_id)?.email_address ?? 'Unknown mailbox'} · {dateLabel(thread.last_message_at)}</p>
          <p className="mt-2 text-sm text-foreground-400 line-clamp-2">{thread.preview || 'No preview available'}</p>
          <div className="mt-2 flex gap-2 text-xs text-foreground-500"><span className="capitalize">{thread.status.replace('_', ' ')}</span>{thread.priority === 'urgent' && <span className="text-red-300">Urgent</span>}{thread.needs_reply && <span className="text-accent-400">Needs reply</span>}</div>
        </button>)}
      </div>
      <div className="rounded-lg border border-background-200/60 bg-background-100 p-5 min-h-[280px] min-w-0">
        {!selected ? <p className="text-sm text-foreground-500">Select a thread to read its messages.</p> : <div className="space-y-5">
          <div><h3 className="text-lg font-heading font-semibold text-foreground-50 break-words">{selected.subject || '(No subject)'}</h3><p className="text-xs text-foreground-500 mt-1">{messages.length} messages loaded (maximum 100)</p></div>
          {detailLoading && <p className="text-sm text-foreground-500">Loading conversation…</p>}
          {detailError && <p role="alert" className="text-sm text-red-300">Could not load conversation: {detailError}</p>}
          {!detailLoading && !detailError && messages.length === 0 && <p className="text-sm text-foreground-500">No messages stored for this thread.</p>}
          {messages.map((message) => <article key={message.id} className="rounded-md border border-background-300/60 bg-background-50 p-4 min-w-0">
            <div className="flex flex-wrap justify-between gap-2"><span className="text-sm text-foreground-100 break-all">{message.from_address}</span><span className="text-xs text-foreground-500">{dateLabel(message.received_at)}</span></div>
            <p className="mt-1 text-xs text-foreground-500 break-all">To: {message.to_addresses.join(', ') || '—'}{message.cc_addresses.length ? ` · Cc: ${message.cc_addresses.join(', ')}` : ''}</p>
            <p className="mt-3 text-sm text-foreground-200 whitespace-pre-wrap break-words">{message.body_text || '(No text body stored)'}</p>
          </article>)}
        </div>}
      </div>
    </div>}
  </div>;
}
