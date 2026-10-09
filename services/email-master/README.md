# DFP Email Master — first mailbox reader

This worker reads one registered Fasthosts mailbox over TLS IMAP and writes
normalised, plain-text inbound messages to DFP Command Supabase. It opens INBOX
read-only. It does not send, archive, delete, mark messages read, process
attachments, or call TRON. No public network port is exposed.

## Configure

1. Apply the `email_imap_ingest` migration and verify its service-only RPC grant.
2. In DFP Comms, register `digital-footprint.uk` and the exact mailbox address.
3. On the cloud VPS, copy `.env.example` to `.env` and set the Supabase service
   role key and the mailbox's IMAP host, username and password. Keep `.env`
   readable only by the deployment account. Never add it to Git or Readdy.
4. Run `docker compose up -d --build` from this directory. Run one replica per
   mailbox. Use `docker compose logs -f` to check `poll_complete`.

The worker imports the newest 100 existing messages on first run by default,
then polls newer UIDs every 60 seconds. `INITIAL_IMPORT_LIMIT` controls that
first batch. The cursor and message insert commit together, so a failed poll
retries from the last committed message. UIDVALIDITY changes start a new import.
Raw messages over `MAX_SOURCE_BYTES` stop the poll and set the account to
“Needs attention”; the worker does not silently skip them. Increase the limit
only after reviewing mailbox volume and memory. The 512 MB container limit is
intended for the default 2 MB raw message cap.

The worker intentionally ignores HTML and attachment content. Plain text is
limited to 1 MiB in Supabase. Poller errors log only the error class; provider
credentials and message bodies never go into logs.

## Before a real mailbox test

- Verify the registered mailbox uses provider `fasthosts` and the address in
  `EMAIL_ADDRESS` matches it exactly.
- Verify Fasthosts' actual IMAP host and login details from that mailbox's
  account settings. No host has been assumed in the template.
- Run `npm ci && npm test` locally.
- Send one controlled test message and check it appears once in DFP Comms.
- Send a reply with References and check it remains in the same conversation.

Stop the worker with `docker compose stop email-master`. It never changes IMAP
flags or messages, so rollback is stopping it and leaving imported rows in
place for audit. Database cleanup needs a separate reviewed retention process.
