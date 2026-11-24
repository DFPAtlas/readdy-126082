import { ImapFlow } from 'imapflow';
import mailparser from 'mailparser';
import { createClient } from '@supabase/supabase-js';
import { pollMailbox } from './ingest.mjs';

const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'EMAIL_ADDRESS', 'IMAP_HOST', 'IMAP_USER', 'IMAP_PASSWORD'];
for (const key of required) if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`);
const address = process.env.EMAIL_ADDRESS.trim().toLowerCase();
const imapPort = Number(process.env.IMAP_PORT || 993);
const pollInterval = Math.max(30000, Number(process.env.POLL_INTERVAL_MS || 60000));
const initialLimit = Math.max(1, Math.min(1000, Number(process.env.INITIAL_IMPORT_LIMIT || 100)));
const maxSourceBytes = Math.max(1024, Math.min(10485760, Number(process.env.MAX_SOURCE_BYTES || 2097152)));
if (![pollInterval, initialLimit, maxSourceBytes].every(Number.isFinite)) throw new Error('Invalid numeric configuration');
if (!Number.isInteger(imapPort) || imapPort < 1 || imapPort > 65535) throw new Error('Invalid IMAP port');

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function loadAccount() {
  const { data, error } = await db.from('email_accounts')
    .select('id,email_address,provider').eq('email_address', address).single();
  if (error || !data || data.provider !== 'fasthosts') throw new Error('Matching Fasthosts mailbox must be registered in DFP Comms');
  return data;
}

const store = {
  async getCursor(accountId) {
    const { data, error } = await db.from('email_sync_state').select('uid_validity,last_uid')
      .eq('account_id', accountId).eq('folder', 'INBOX').maybeSingle();
    if (error) throw error;
    return data;
  },
  async ingest(accountId, payload) {
    const { data, error } = await db.rpc('email_ingest_imap', { p_account_id: accountId, ...payload });
    if (error) throw error;
    return data === true;
  },
  async setConnection(accountId, connected) {
    const { error } = await db.from('email_accounts').update({
      connection_status: connected ? 'connected' : 'attention', receive_enabled: connected,
    }).eq('id', accountId);
    if (error) throw error;
  },
};

let running = true;
process.on('SIGTERM', () => { running = false; });
process.on('SIGINT', () => { running = false; });

while (running) {
  let client;
  let account;
  try {
    account = await loadAccount();
    client = new ImapFlow({
      host: process.env.IMAP_HOST,
      port: imapPort,
      secure: true,
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 60000,
      auth: { user: process.env.IMAP_USER, pass: process.env.IMAP_PASSWORD },
      logger: false,
    });
    await client.connect();
    const count = await pollMailbox({
      client, accountId: account.id, store, parseRaw: mailparser.simpleParser,
      initialLimit, maxSourceBytes,
    });
    await store.setConnection(account.id, true);
    console.log(JSON.stringify({ event: 'poll_complete', mailbox: address, ingested: count, at: new Date().toISOString() }));
  } catch (error) {
    console.error(JSON.stringify({ event: 'poll_failed', mailbox: address, error: error?.name || 'Error', at: new Date().toISOString() }));
    if (account) {
      try { await store.setConnection(account.id, false); } catch { /* Keep original failure visible in logs. */ }
    }
  } finally {
    if (client) { try { await client.logout(); } catch { /* Already disconnected. */ } }
  }
  if (running) await new Promise((resolve) => setTimeout(resolve, pollInterval));
}
