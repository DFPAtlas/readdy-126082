import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/feature/AuthGuard';
import Inbox from './Inbox';

type Domain = { domain: string; project_name: string; active: boolean };
type Account = {
  id: string; domain: string; email_address: string; display_name: string;
  provider: string; purpose: string; connection_status: string;
  receive_enabled: boolean; send_enabled: boolean;
};
type Tab = 'overview' | 'accounts' | 'domains' | 'inbox';

const tabs: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' }, { key: 'accounts', label: 'Accounts' },
  { key: 'domains', label: 'Domains' }, { key: 'inbox', label: 'Unified Inbox' },
];
const inputClass = 'w-full rounded-md border border-background-300/60 bg-background-50 px-3 py-2 text-sm text-foreground-100 outline-none focus:border-accent-500';

export default function CommsPage() {
  const { role } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');
  const [domains, setDomains] = useState<Domain[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [domain, setDomain] = useState('');
  const [project, setProject] = useState('');
  const [address, setAddress] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [accountDomain, setAccountDomain] = useState('');
  const [provider, setProvider] = useState('fasthosts');
  const [purpose, setPurpose] = useState('shared');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    const [domainResult, accountResult] = await Promise.all([
      supabase.from('email_domains').select('domain,project_name,active').order('domain'),
      supabase.from('email_accounts').select('id,domain,email_address,display_name,provider,purpose,connection_status,receive_enabled,send_enabled').order('email_address'),
    ]);
    if (domainResult.error || accountResult.error) {
      setError(domainResult.error?.message ?? accountResult.error?.message ?? 'Unable to load email registry.');
    } else {
      setDomains((domainResult.data ?? []) as Domain[]);
      setAccounts((accountResult.data ?? []) as Account[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { if (role === 'owner' || role === 'admin') void refresh(); }, [role, refresh]);

  const addDomain = async (event: FormEvent) => {
    event.preventDefault();
    const normalized = domain.trim().toLowerCase();
    if (normalized.length > 253 || normalized.includes('..') || !/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/.test(normalized)) {
      setError('Enter a valid domain, such as quickguard.uk.'); return;
    }
    setSaving(true); setError('');
    const { error: insertError } = await supabase.from('email_domains').insert({ domain: normalized, project_name: project.trim() });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    setDomain(''); setProject(''); await refresh();
  };

  const addAccount = async (event: FormEvent) => {
    event.preventDefault();
    const normalized = address.trim().toLowerCase();
    if (!accountDomain || !/^[^\s@]+@[^\s@]+$/.test(normalized) || normalized.split('@')[1] !== accountDomain) {
      setError('Use an address on the selected registered domain.'); return;
    }
    setSaving(true); setError('');
    const { error: insertError } = await supabase.from('email_accounts').insert({
      domain: accountDomain, email_address: normalized, display_name: displayName.trim(), provider, purpose,
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    setAddress(''); setDisplayName(''); await refresh();
  };

  if (role !== 'owner' && role !== 'admin') return <div className="p-8 text-foreground-300">Email administration is restricted to owners and admins.</div>;

  return <div className="space-y-6 max-w-6xl mx-auto">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-xs uppercase tracking-widest text-accent-400 font-label">DFP Comms</p>
        <h1 className="text-2xl font-heading font-bold text-foreground-50 mt-1">Email Control Centre</h1>
        <p className="text-sm text-foreground-500 mt-1">Register your domains and mailboxes before connecting providers.</p>
      </div>
      <button type="button" onClick={() => void refresh()} disabled={loading} className="rounded-md border border-background-300/60 px-3 py-2 text-sm text-foreground-200 disabled:opacity-50">Refresh</button>
    </header>
    <nav aria-label="Email sections" className="flex gap-2 overflow-x-auto border-b border-background-300/60">
      {tabs.map((item) => <button key={item.key} type="button" onClick={() => { setTab(item.key); setError(''); }} className={`whitespace-nowrap px-3 py-2 text-sm border-b-2 ${tab === item.key ? 'border-accent-500 text-accent-400' : 'border-transparent text-foreground-500'}`}>{item.label}</button>)}
    </nav>
    {error && <div role="alert" className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
    {loading ? <p className="text-sm text-foreground-500">Loading email registry…</p> : <>
      {tab === 'overview' && <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          {[["Registered domains", domains.length], ["Registered accounts", accounts.length], ["Connected accounts", accounts.filter((a) => a.connection_status === 'connected').length]].map(([label, value]) =>
            <div key={label} className="rounded-lg border border-background-200/60 bg-background-100 p-5"><div className="text-3xl font-heading font-bold text-foreground-50">{value}</div><div className="text-sm text-foreground-500 mt-1">{label}</div></div>)}
        </div>
        <div className="rounded-lg border border-background-200/60 bg-background-100 p-6">
          <h2 className="font-heading font-semibold text-foreground-50">Getting started</h2>
          <p className="text-sm text-foreground-400 mt-2">Add a domain, then register its mailboxes. Accounts remain disconnected until the cloud connector verifies the provider. Email counts and summaries will appear after message ingestion is connected.</p>
        </div>
      </div>}
      {tab === 'domains' && <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-lg border border-background-200/60 bg-background-100 overflow-hidden">
          <h2 className="p-4 font-heading font-semibold text-foreground-50">Domains</h2>
          {domains.length ? <ul className="divide-y divide-background-200/60">{domains.map((d) => <li key={d.domain} className="p-4 flex justify-between gap-4"><div><div className="text-foreground-100 font-medium">{d.domain}</div><div className="text-sm text-foreground-500">{d.project_name}</div></div><span className="text-xs text-foreground-400">{d.active ? 'Active' : 'Inactive'}</span></li>)}</ul> : <p className="p-4 text-sm text-foreground-500">No domains registered yet.</p>}
        </div>
        <form onSubmit={addDomain} className="rounded-lg border border-background-200/60 bg-background-100 p-4 space-y-3 self-start">
          <h2 className="font-heading font-semibold text-foreground-50">Add domain</h2>
          <label className="block text-sm text-foreground-300">Domain<input required value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="quickguard.uk" className={`${inputClass} mt-1`} /></label>
          <label className="block text-sm text-foreground-300">Project name<input required maxLength={100} value={project} onChange={(e) => setProject(e.target.value)} placeholder="QuickGuard" className={`${inputClass} mt-1`} /></label>
          <button disabled={saving} className="rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-background-950 disabled:opacity-50">{saving ? 'Saving…' : 'Add domain'}</button>
        </form>
      </div>}
      {tab === 'accounts' && <div className="space-y-5">
        <form onSubmit={addAccount} className="rounded-lg border border-background-200/60 bg-background-100 p-4 space-y-4">
          <h2 className="font-heading font-semibold text-foreground-50">Register mailbox</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-sm text-foreground-300">Domain<select required value={accountDomain} onChange={(e) => setAccountDomain(e.target.value)} className={`${inputClass} mt-1`}><option value="">Select domain</option>{domains.filter((d) => d.active).map((d) => <option key={d.domain} value={d.domain}>{d.domain}</option>)}</select></label>
            <label className="text-sm text-foreground-300">Email address<input required type="email" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="support@quickguard.uk" className={`${inputClass} mt-1`} /></label>
            <label className="text-sm text-foreground-300">Display name<input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="QuickGuard Support" className={`${inputClass} mt-1`} /></label>
            <label className="text-sm text-foreground-300">Provider<select value={provider} onChange={(e) => setProvider(e.target.value)} className={`${inputClass} mt-1`}><option value="fasthosts">Fasthosts</option><option value="gmail">Gmail</option><option value="microsoft">Microsoft 365</option><option value="resend">Resend</option></select></label>
            <label className="text-sm text-foreground-300">Purpose<select value={purpose} onChange={(e) => setPurpose(e.target.value)} className={`${inputClass} mt-1`}><option value="shared">Shared</option><option value="personal">Personal</option><option value="transactional">Transactional</option></select></label>
          </div>
          <p className="text-xs text-foreground-500">No provider password or API key is entered or stored here.</p>
          <button disabled={saving || domains.length === 0} className="rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-background-950 disabled:opacity-50">{saving ? 'Saving…' : 'Register mailbox'}</button>
        </form>
        <div className="rounded-lg border border-background-200/60 bg-background-100 overflow-x-auto">
          {accounts.length ? <table className="w-full min-w-[650px] text-sm"><thead className="text-left text-foreground-500"><tr>{['Mailbox','Project','Provider','Purpose','Connection'].map((x) => <th key={x} className="p-4 font-medium">{x}</th>)}</tr></thead><tbody>{accounts.map((a) => <tr key={a.id} className="border-t border-background-200/60 text-foreground-200"><td className="p-4"><div className="font-medium">{a.email_address}</div><div className="text-xs text-foreground-500">{a.display_name}</div></td><td className="p-4">{domains.find((d) => d.domain === a.domain)?.project_name ?? a.domain}</td><td className="p-4 capitalize">{a.provider}</td><td className="p-4 capitalize">{a.purpose}</td><td className="p-4">{a.connection_status === 'connected' ? 'Connected' : a.connection_status === 'attention' ? 'Needs attention' : 'Not connected'}</td></tr>)}</tbody></table> : <p className="p-5 text-sm text-foreground-500">No mailboxes registered yet. Add a domain first, then register a mailbox.</p>}
        </div>
      </div>}
      {tab === 'inbox' && <Inbox accounts={accounts} />}
    </>}
  </div>;
}
