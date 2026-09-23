export function candidateUids(found, cursor, initialLimit = 100) {
  const uids = [...new Set((found || []).filter((uid) => Number.isSafeInteger(uid) && uid > 0))].sort((a, b) => a - b);
  if (cursor > 0) return uids.filter((uid) => uid > cursor);
  return uids.slice(-initialLimit);
}

export function normaliseMessage(parsed, { uid, uidValidity, flags, receivedAt }) {
  const messageId = `imap:${uidValidity}:${uid}`;
  const references = Array.isArray(parsed.references) ? parsed.references : parsed.references ? [parsed.references] : [];
  const threadKey = references[0] || parsed.inReplyTo || parsed.messageId || messageId;
  const date = parsed.date instanceof Date && !Number.isNaN(parsed.date.getTime()) ? parsed.date : receivedAt;
  return {
    p_uid_validity: uidValidity,
    p_uid: uid,
    p_provider_thread_id: String(threadKey).slice(0, 512),
    p_provider_message_id: messageId,
    p_from_address: parsed.from?.value?.[0]?.address || '(unknown sender)',
    p_to_addresses: (parsed.to?.value || []).map((person) => person.address).filter(Boolean),
    p_cc_addresses: (parsed.cc?.value || []).map((person) => person.address).filter(Boolean),
    p_subject: String(parsed.subject || '').slice(0, 1000),
    p_body_text: String(parsed.text || '').slice(0, 1048576),
    p_received_at: date.toISOString(),
    p_unread: !flags?.has('\\Seen'),
  };
}

// client is already connected. Keep the mailbox lock for the whole pass and
// process in UID order. A failed ingestion leaves the cursor at the last
// committed message; the next pass safely retries the failed UID.
export async function pollMailbox({ client, accountId, store, parseRaw, initialLimit = 100, maxSourceBytes = 2097152 }) {
  const lock = await client.getMailboxLock('INBOX', { readOnly: true });
  try {
    const uidValidity = String(client.mailbox.uidValidity);
    if (!/^\d+$/.test(uidValidity)) throw new Error('Mailbox UIDVALIDITY is missing');
    const cursor = await store.getCursor(accountId);
    const lastUid = cursor?.uid_validity === uidValidity ? Number(cursor.last_uid) : 0;
    if (lastUid > 0 && client.mailbox.uidNext && lastUid >= client.mailbox.uidNext - 1) return 0;
    const found = await client.search({ uid: `${lastUid + 1}:*` }, { uid: true });
    const uids = candidateUids(found, lastUid, initialLimit);
    let ingested = 0;
    for (const uid of uids) {
      const metadata = await client.fetchOne(String(uid), { size: true, flags: true, internalDate: true }, { uid: true });
      if (!metadata) continue; // Expunged between SEARCH and FETCH.
      if (metadata.size > maxSourceBytes) throw new Error(`Message UID ${uid} exceeds configured source limit`);
      const message = await client.fetchOne(String(uid), { source: true }, { uid: true });
      if (!message?.source) continue;
      if (message.source.length > maxSourceBytes) throw new Error(`Message UID ${uid} exceeds configured source limit`);
      const parsed = await parseRaw(message.source);
      const payload = normaliseMessage(parsed, {
        uid, uidValidity, flags: metadata.flags,
        receivedAt: metadata.internalDate instanceof Date ? metadata.internalDate : new Date(),
      });
      if (await store.ingest(accountId, payload)) ingested++;
    }
    return ingested;
  } finally {
    lock.release();
  }
}
