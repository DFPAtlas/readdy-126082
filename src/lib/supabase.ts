import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY as string;

/**
 * Custom lock for Supabase auth.
 *
 * IMPORTANT: Supabase calls this as lock(name, acquireTimeout, fn). It expects
 * the lock to run `fn` WHILE holding the lock and RETURN fn's result. The work
 * `fn` does includes restoring/refreshing the auth session — so this function
 * MUST run and return fn(). A previous version ignored `fn` entirely, which made
 * session restore return undefined and signed users out on every page load.
 *
 * We keep the lock bounded with a timeout so cross-tab contention can never
 * freeze the page — if we can't get the lock in time, we run `fn` anyway.
 */
async function customLock<R>(
  name: string,
  acquireTimeout: number,
  fn: () => Promise<R>,
): Promise<R> {
  // Web Locks API not available (older browsers / non-secure contexts) — just run.
  if (typeof navigator === 'undefined' || !navigator.locks) {
    return await fn();
  }

  // Non-blocking attempt: try to grab it, but never wait.
  if (acquireTimeout <= 0) {
    try {
      return await navigator.locks.request(
        name,
        { mode: 'exclusive', ifAvailable: true },
        async () => {
          // Whether or not the lock was granted, run fn so auth never deadlocks.
          return await fn();
        },
      );
    } catch {
      return await fn();
    }
  }

  // Bounded wait via AbortController so we can never hang indefinitely.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), acquireTimeout);

  try {
    return await navigator.locks.request(
      name,
      { mode: 'exclusive', signal: controller.signal },
      async () => await fn(),
    );
  } catch {
    // Lock wait aborted or failed — fall back to running without the lock
    // rather than corrupting the auth flow.
    console.warn(`Auth lock "${name}" unavailable, proceeding without it.`);
    return await fn();
  } finally {
    clearTimeout(timer);
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    lock: customLock,
  },
});