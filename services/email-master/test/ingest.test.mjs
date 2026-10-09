import test from 'node:test';
import assert from 'node:assert/strict';
import mailparser from 'mailparser';
import { candidateUids, normaliseMessage, pollMailbox } from '../src/ingest.mjs';

test('UID selection sorts and removes duplicates, respecting a stored cursor', () => {
  assert.deepEqual(candidateUids([6, 3, 6, 2, 5], 3), [5, 6]);
  assert.deepEqual(candidateUids([6, 3, 6, 2, 5], 0, 2), [5, 6]);
});

test('normalisation uses the oldest reference for a reply thread and ignores HTML', () => {
  const item = normaliseMessage({
    messageId: '<reply@local>', references: ['<root@local>', '<second@local>'],
    from: { value: [{ address: 'person@example.test' }] },
    to: { value: [{ address: 'info@example.test' }] },
    subject: 'Re: hello', text: 'Plain text', html: '<script>untrusted</script>',
    date: new Date('2026-09-23T10:00:00Z'),
  }, { uid: 8, uidValidity: '123', flags: new Set(), receivedAt: new Date() });
  assert.equal(item.p_provider_thread_id, '<root@local>');
  assert.equal(item.p_provider_message_id, 'imap:123:8');
  assert.equal(item.p_body_text, 'Plain text');
  assert.equal(item.p_unread, true);
  assert.equal(Object.hasOwn(item, 'html'), false);
});

function fixture({ uids = [1, 2, 3], state = null, size = 100 } = {}) {
  const record = new Set();
  const cursors = [];
  let released = 0;
  const client = {
    mailbox: { uidValidity: 55n, uidNext: 4 },
    async getMailboxLock(_folder, options) {
      assert.equal(options.readOnly, true);
      return { release() { released++; } };
    },
    async search() { return uids; },
    async fetchOne(uid, opts) {
      return opts.source ? { source: Buffer.from(`mail-${uid}`) } : {
        size, flags: new Set(), internalDate: new Date('2026-09-23T10:00:00Z'),
      };
    },
  };
  const store = {
    async getCursor() { return state; },
    async ingest(_accountId, message) {
      cursors.push(message.p_uid);
      if (record.has(message.p_provider_message_id)) return false;
      record.add(message.p_provider_message_id);
      return true;
    },
  };
  return { client, store, cursors, get released() { return released; } };
}

test('first import limits history, then processes only UIDs after the checkpoint', async () => {
  const f = fixture();
  const parseRaw = async (source) => ({ text: source.toString(), messageId: '<root@local>' });
  assert.equal(await pollMailbox({ ...f, accountId: 'a', parseRaw, initialLimit: 2 }), 2);
  assert.deepEqual(f.cursors, [2, 3]);
  assert.equal(f.released, 1);
  f.store.getCursor = async () => ({ uid_validity: '55', last_uid: 2 });
  assert.equal(await pollMailbox({ ...f, accountId: 'a', parseRaw }), 0);
  assert.equal(f.released, 2);
});

test('oversize mail halts before ingestion and releases the mailbox lock', async () => {
  const f = fixture({ size: 5000 });
  await assert.rejects(
    pollMailbox({ ...f, accountId: 'a', parseRaw: async () => ({}), maxSourceBytes: 1000 }),
    /exceeds configured source limit/
  );
  assert.deepEqual(f.cursors, []);
  assert.equal(f.released, 1);
});

test('UIDVALIDITY change reimports mail under distinct provider identity', async () => {
  const f = fixture({ state: { uid_validity: '44', last_uid: 100 } });
  await pollMailbox({ ...f, accountId: 'a', initialLimit: 2, parseRaw: async () => ({ text: 'ok' }) });
  assert.deepEqual(f.cursors, [2, 3]);
});

test('real MIME parser keeps reply headers and only plain text enters the record', async () => {
  const raw = Buffer.from([
    'From: Sender <sender@example.test>', 'To: info@example.test',
    'Message-ID: <reply@example.test>', 'References: <root@example.test>',
    'Subject: Re: Sample', 'Content-Type: multipart/alternative; boundary="a"', '',
    '--a', 'Content-Type: text/plain; charset=utf-8', '', 'Safe plain text',
    '--a', 'Content-Type: text/html; charset=utf-8', '', '<script>unsafe()</script>', '--a--', '',
  ].join('\r\n'));
  const parsed = await mailparser.simpleParser(raw);
  const record = normaliseMessage(parsed, {
    uid: 7, uidValidity: '55', flags: new Set(), receivedAt: new Date('2026-09-23T12:00:00Z'),
  });
  assert.equal(record.p_provider_thread_id, '<root@example.test>');
  assert.match(record.p_body_text, /Safe plain text/);
  assert.doesNotMatch(record.p_body_text, /unsafe/);
});
