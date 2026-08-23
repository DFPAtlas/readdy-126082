import { useCallback, useEffect, useRef, useState } from 'react';
import type { TicketCategory } from '@/types/support-tickets';

// ---------------------------------------------------------------------------
// Public-form types & constants
// ---------------------------------------------------------------------------

export type PublicTicketPriority = 'low' | 'normal' | 'high';

export interface SupportTicketSubmitResult {
  ticketNumber: string | null;
}

export interface SupportTicketFormProps {
  /** Registered site slug — required. */
  siteSlug: string;
  /** Override the ingestion endpoint (defaults to the Supabase edge function). */
  endpointUrl?: string;
  /** Optional default category. */
  defaultCategory?: TicketCategory;
  /** Optional default priority (public: low/normal/high only). */
  defaultPriority?: PublicTicketPriority;
  /** Optional source page URL (metadata only). */
  sourcePageUrl?: string;
  /** Optional authenticated customer UUID. */
  customerUserId?: string;
  /** Optional account reference (metadata). */
  accountReference?: string;
  /** Optional order reference (metadata). */
  orderReference?: string;
  /** Optional external reference (idempotent source-generated id). */
  externalReference?: string;
  /** Additional context merged into the request `context`. */
  context?: Record<string, unknown>;
  /** Cloudflare Turnstile site key — when set, a CAPTCHA widget is rendered. */
  turnstileSiteKey?: string;
  /** Whether the server expects a CAPTCHA token (should match the credential). */
  captchaRequired?: boolean;
  /** Compact spacing for narrow embedded panels. */
  compact?: boolean;
  /** Optional async gate run before a real submission (e.g. confirmation). */
  confirmBeforeSubmit?: () => Promise<boolean>;
  onSuccess?: (result: SupportTicketSubmitResult) => void;
  onError?: (message: string) => void;
}

const PUBLIC_CATEGORIES: TicketCategory[] = [
  'general', 'technical', 'account', 'billing', 'access',
  'bug', 'complaint', 'feature_request', 'security', 'other',
];

const PUBLIC_PRIORITIES: PublicTicketPriority[] = ['low', 'normal', 'high'];

const CATEGORY_LABELS: Record<TicketCategory, string> = {
  general: 'General',
  technical: 'Technical',
  account: 'Account',
  billing: 'Billing',
  access: 'Access',
  bug: 'Bug',
  complaint: 'Complaint',
  feature_request: 'Feature request',
  security: 'Security',
  other: 'Other',
};

const PRIORITY_LABELS: Record<PublicTicketPriority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
};

const LIMITS = {
  name: 150,
  email: 320,
  phone: 50,
  subject: 250,
  description: 20000,
} as const;

const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

type SubmitStatus = 'idle' | 'submitting' | 'success' | 'error';

// ---------------------------------------------------------------------------
// Cloudflare Turnstile loader
// ---------------------------------------------------------------------------

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

function loadTurnstileScript(): Promise<void> {
  return new Promise((resolve) => {
    if (window.turnstile) {
      resolve();
      return;
    }
    const existing = document.getElementById('cf-turnstile-script') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve());
      return;
    }
    const s = document.createElement('script');
    s.id = 'cf-turnstile-script';
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = () => resolve();
    document.head.appendChild(s);
  });
}

function TurnstileCaptcha({ siteKey, onToken, onReset }: {
  siteKey: string;
  onToken: (token: string) => void;
  onReset: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadTurnstileScript().then(() => {
      if (cancelled || !ref.current || !window.turnstile) return;
      widgetId.current = window.turnstile.render(ref.current, {
        sitekey: siteKey,
        theme: 'dark',
        callback: (token: string) => onToken(token),
        'expired-callback': () => {
          onReset();
          onToken('');
        },
        'error-callback': () => {
          onReset();
          onToken('');
        },
      });
    });
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetId.current);
        } catch {
          /* ignore */
        }
        widgetId.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey]);

  return (
    <div ref={ref} className="min-h-[65px]" aria-label="Security verification" role="group" />
  );
}

// ---------------------------------------------------------------------------
// Reusable public support form
// ---------------------------------------------------------------------------

export default function SupportTicketForm({
  siteSlug,
  endpointUrl,
  defaultCategory = 'general',
  defaultPriority = 'normal',
  sourcePageUrl,
  customerUserId,
  accountReference,
  orderReference,
  externalReference,
  context,
  turnstileSiteKey,
  captchaRequired = false,
  compact = false,
  confirmBeforeSubmit,
  onSuccess,
  onError,
}: SupportTicketFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<TicketCategory>(defaultCategory);
  const [priority, setPriority] = useState<PublicTicketPriority>(defaultPriority);
  const [description, setDescription] = useState('');
  const [consent, setConsent] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [status, setStatus] = useState<SubmitStatus>('idle');
  const [ticketNumber, setTicketNumber] = useState<string | null>(null);

  const honeypotRef = useRef<HTMLInputElement>(null);
  const firstErrorRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);
  const fieldRefs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null>>({});

  const endpoint = endpointUrl ?? `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/receive-support-ticket`;

  const setFieldRef = (key: string) => (el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null) => {
    fieldRefs.current[key] = el;
  };

  const validate = useCallback((): Record<string, string> => {
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = 'Please enter your name.';
    else if (name.trim().length > LIMITS.name) errors.name = `Name must be ${LIMITS.name} characters or fewer.`;

    if (!email.trim()) errors.email = 'Please enter your email address.';
    else if (!isValidEmail(email)) errors.email = 'Please enter a valid email address.';
    else if (email.trim().length > LIMITS.email) errors.email = 'Email is too long.';

    if (phone.trim().length > LIMITS.phone) errors.phone = `Phone must be ${LIMITS.phone} characters or fewer.`;

    if (!subject.trim()) errors.subject = 'Please enter a subject.';
    else if (subject.trim().length > LIMITS.subject) errors.subject = `Subject must be ${LIMITS.subject} characters or fewer.`;

    if (!description.trim()) errors.description = 'Please describe your request.';
    else if (description.trim().length > LIMITS.description) errors.description = `Description must be ${LIMITS.description} characters or fewer.`;

    if (!consent) errors.consent = 'Please accept the privacy notice to continue.';

    return errors;
  }, [name, email, phone, subject, description, consent]);

  const safeMessage = (statusCode: number, serverError?: string): string => {
    if (statusCode === 429) return 'Too many submissions. Please try again later.';
    if (statusCode === 401 || statusCode === 403 || statusCode === 503) {
      if (serverError?.toLowerCase().includes('captcha')) return 'We could not verify this request. Please try again.';
      return 'This form is temporarily unavailable. Please try again later.';
    }
    if (statusCode === 409) return 'Your request was already received. Please wait a moment before retrying.';
    return 'Your request could not be submitted. Please try again.';
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Honeypot: if a bot filled it, pretend success and do nothing.
    const honeypot = honeypotRef.current?.value?.trim();
    if (honeypot) {
      setStatus('success');
      setTicketNumber(null);
      onSuccess?.({ ticketNumber: null });
      return;
    }

    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFormError('Please check the highlighted fields.');
      setStatus('error');
      const firstKey = Object.keys(errors)[0];
      const el = fieldRefs.current[firstKey];
      if (el) {
        el.focus();
        if (el instanceof HTMLInputElement && el.type !== 'checkbox') el.select();
      }
      return;
    }

    if (captchaRequired && !turnstileToken) {
      setFieldErrors({});
      setFormError('Please complete the security verification.');
      setStatus('error');
      return;
    }

    setFieldErrors({});
    setFormError('');

    if (confirmBeforeSubmit) {
      const ok = await confirmBeforeSubmit();
      if (!ok) return;
    }

    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = crypto.randomUUID();
    }

    const contextPayload: Record<string, unknown> = {};
    if (accountReference) contextPayload.accountReference = accountReference;
    if (orderReference) contextPayload.orderReference = orderReference;
    if (context) Object.assign(contextPayload, context);

    const body: Record<string, unknown> = {
      siteSlug,
      customer: {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        customerUserId: customerUserId || undefined,
      },
      ticket: {
        subject: subject.trim(),
        description: description.trim(),
        category,
        priority,
        sourcePageUrl: sourcePageUrl || undefined,
      },
      context: Object.keys(contextPayload).length > 0 ? contextPayload : undefined,
      consent: { privacyAccepted: true },
      timestamp: new Date().toISOString(),
      nonce: crypto.randomUUID(),
      idempotencyKey: idempotencyKeyRef.current,
      website_alt: '',
    };
    if (externalReference) body.externalReference = externalReference;
    if (turnstileToken) body.turnstileToken = turnstileToken;

    setStatus('submitting');

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      let data: Record<string, unknown> = {};
      try {
        data = await res.json();
      } catch {
        /* non-JSON response */
      }

      const success = res.ok && data.success === true;
      const number = typeof data.ticketNumber === 'string' ? data.ticketNumber : null;

      if (success) {
        setStatus('success');
        setTicketNumber(number);
        onSuccess?.({ ticketNumber: number });
        // Reset for a new submission; keep the idempotency key fresh next time.
        setName('');
        setEmail('');
        setPhone('');
        setSubject('');
        setDescription('');
        setConsent(false);
        setTurnstileToken('');
        idempotencyKeyRef.current = null;
        return;
      }

      const message = safeMessage(res.status, typeof data.error === 'string' ? data.error : undefined);
      setStatus('error');
      setFormError(message);
      onError?.(message);
    } catch {
      const message = 'Your request could not be submitted. Please try again.';
      setStatus('error');
      setFormError(message);
      onError?.(message);
    }
  };

  const inputClass = (hasError: boolean) =>
    `w-full text-sm bg-background-50 border rounded-md px-3 py-2.5 text-foreground-100 placeholder:text-foreground-600 focus:outline-none focus:ring-2 transition-colors ${
      hasError ? 'border-red-500/60 focus:ring-red-500/30' : 'border-background-300/60 focus:ring-accent-500/40'
    }`;

  const labelClass = 'block text-xs font-medium text-foreground-300 mb-1.5';
  const errText = (key: string) =>
    fieldErrors[key] ? <p id={`${key}-error`} className="text-xs text-red-400 mt-1.5">{fieldErrors[key]}</p> : null;

  const pad = compact ? 'p-4 space-y-3.5' : 'p-5 md:p-6 space-y-4';

  return (
    <form onSubmit={handleSubmit} noValidate className={pad} aria-describedby="support-form-summary">
      {/* Hidden honeypot — bots fill this; real users never see it */}
      <input
        ref={honeypotRef}
        type="text"
        name="website_alt"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        readOnly
        defaultValue=""
      />

      {/* Error summary (screen-reader friendly) */}
      <div id="support-form-summary" className="sr-only" aria-live="assertive">
        {formError}
      </div>

      {/* Status feedback */}
      {status === 'success' && (
        <div role="status" aria-live="polite" className="bg-emerald-500/10 border border-emerald-500/25 rounded-lg p-4">
          <div className="flex items-center gap-2.5">
            <i className="ri-checkbox-circle-line text-emerald-400 text-xl w-5 h-5 flex items-center justify-center"></i>
            <h3 className="text-sm font-semibold text-emerald-300">Your request has been received</h3>
          </div>
          {ticketNumber && (
            <p className="text-sm text-foreground-200 mt-2">
              Reference number: <span className="font-mono text-emerald-300">{ticketNumber}</span>
            </p>
          )}
          <p className="text-sm text-foreground-400 mt-1 leading-relaxed">
            Thank you for reaching out. Our support team will review your message and get back to you as soon as possible.
          </p>
        </div>
      )}

      {status === 'error' && formError && (
        <div role="alert" aria-live="assertive" className="bg-red-500/10 border border-red-500/25 rounded-lg p-3.5 flex items-start gap-2.5">
          <i className="ri-error-warning-line text-red-400 text-lg w-5 h-5 flex items-center justify-center mt-0.5"></i>
          <p className="text-sm text-red-300">{formError}</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor="stf-name">Name <span className="text-red-400">*</span></label>
          <input
            ref={setFieldRef('name')}
            id="stf-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={LIMITS.name}
            className={inputClass(!!fieldErrors.name)}
            aria-invalid={!!fieldErrors.name}
            aria-describedby={fieldErrors.name ? 'name-error' : undefined}
            autoComplete="name"
            placeholder="Your full name"
            disabled={status === 'submitting'}
          />
          {errText('name')}
        </div>
        <div>
          <label className={labelClass} htmlFor="stf-email">Email <span className="text-red-400">*</span></label>
          <input
            ref={setFieldRef('email')}
            id="stf-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={LIMITS.email}
            className={inputClass(!!fieldErrors.email)}
            aria-invalid={!!fieldErrors.email}
            aria-describedby={fieldErrors.email ? 'email-error' : undefined}
            autoComplete="email"
            placeholder="you@example.com"
            disabled={status === 'submitting'}
          />
          {errText('email')}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor="stf-phone">Phone <span className="text-foreground-600 font-normal">(optional)</span></label>
          <input
            ref={setFieldRef('phone')}
            id="stf-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={LIMITS.phone}
            className={inputClass(!!fieldErrors.phone)}
            aria-invalid={!!fieldErrors.phone}
            aria-describedby={fieldErrors.phone ? 'phone-error' : undefined}
            autoComplete="tel"
            placeholder="+44 …"
            disabled={status === 'submitting'}
          />
          {errText('phone')}
        </div>
        <div>
          <label className={labelClass} htmlFor="stf-category">Category <span className="text-red-400">*</span></label>
          <select
            ref={setFieldRef('category') as (el: HTMLSelectElement | null) => void}
            id="stf-category"
            value={category}
            onChange={(e) => setCategory(e.target.value as TicketCategory)}
            className={inputClass(false)}
            disabled={status === 'submitting'}
          >
            {PUBLIC_CATEGORIES.map((c) => (
              <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="stf-subject">Subject <span className="text-red-400">*</span></label>
        <input
          ref={setFieldRef('subject')}
          id="stf-subject"
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={LIMITS.subject}
          className={inputClass(!!fieldErrors.subject)}
          aria-invalid={!!fieldErrors.subject}
          aria-describedby={fieldErrors.subject ? 'subject-error' : undefined}
          placeholder="Brief summary of your request"
          disabled={status === 'submitting'}
        />
        {errText('subject')}
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className={labelClass + ' mb-0'} htmlFor="stf-description">Description <span className="text-red-400">*</span></label>
          <span className={`text-xs font-mono ${description.length > LIMITS.description ? 'text-red-400' : 'text-foreground-600'}`}>
            {description.length.toLocaleString()} / {LIMITS.description.toLocaleString()}
          </span>
        </div>
        <textarea
          ref={setFieldRef('description')}
          id="stf-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={LIMITS.description}
          rows={compact ? 4 : 5}
          className={`${inputClass(!!fieldErrors.description)} resize-y`}
          aria-invalid={!!fieldErrors.description}
          aria-describedby={fieldErrors.description ? 'description-error' : undefined}
          placeholder="Tell us what you need help with"
          disabled={status === 'submitting'}
        />
        {errText('description')}
      </div>

      <div>
        <label className={labelClass} htmlFor="stf-priority">Priority</label>
        <select
          id="stf-priority"
          value={priority}
          onChange={(e) => setPriority(e.target.value as PublicTicketPriority)}
          className={inputClass(false)}
          disabled={status === 'submitting'}
        >
          {PUBLIC_PRIORITIES.map((p) => (
            <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
          ))}
        </select>
      </div>

      {/* Attachment — not yet supported by the ingestion endpoint */}
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-3.5">
        <div className="flex items-center gap-2.5">
          <i className="ri-attachment-2 text-foreground-500 text-base w-4 h-4 flex items-center justify-center"></i>
          <span className="text-sm text-foreground-300">Attachments</span>
        </div>
        <div className="mt-1.5 opacity-60">
          <input type="file" disabled multiple className="block w-full text-sm text-foreground-600 file:mr-3 file:px-3 file:py-1.5 file:rounded-full file:border-0 file:bg-background-200 file:text-foreground-300 file:text-xs file:cursor-not-allowed disabled:cursor-not-allowed" />
        </div>
        <p className="text-xs text-foreground-600 mt-2 leading-relaxed">
          Attachments aren't available on this form yet. Once your ticket is created, we'll share a secure way to add files if needed.
        </p>
      </div>

      {turnstileSiteKey && captchaRequired && (
        <div>
          <TurnstileCaptcha
            siteKey={turnstileSiteKey}
            onToken={setTurnstileToken}
            onReset={() => setTurnstileToken('')}
          />
        </div>
      )}

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 w-4 h-4 rounded border-background-300/60 text-accent-500 focus:ring-accent-500/40 shrink-0"
          aria-invalid={!!fieldErrors.consent}
          aria-describedby={fieldErrors.consent ? 'consent-error' : undefined}
          disabled={status === 'submitting'}
        />
        <span className="text-xs text-foreground-400 leading-relaxed">
          I agree that my details will be used to respond to this request, in line with the privacy notice. <span className="text-red-400">*</span>
        </span>
      </label>
      {errText('consent')}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={status === 'submitting'}
          className="inline-flex items-center gap-2 bg-accent-500 hover:bg-accent-400 text-background-950 px-6 py-3 rounded-full text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === 'submitting' ? (
            <>
              <i className="ri-loader-4-line text-base w-4 h-4 flex items-center justify-center animate-spin"></i>
              Sending…
            </>
          ) : (
            <>
              <i className="ri-send-plane-line text-base w-4 h-4 flex items-center justify-center"></i>
              Submit request
            </>
          )}
        </button>
      </div>
    </form>
  );
}