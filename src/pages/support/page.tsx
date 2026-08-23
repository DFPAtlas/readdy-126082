import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export default function Support() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    // Honeypot — bots that fill this get a fake success and nothing is saved.
    const honeypot = (formData.get('website_alt') as string ?? '').trim();
    if (honeypot) {
      setError('');
      setSuccess(true);
      form.reset();
      return;
    }

    const name = (formData.get('submitted_by') as string ?? '').trim();
    const email = (formData.get('submitted_email') as string ?? '').trim();
    const subject = (formData.get('ticket_title') as string ?? '').trim();
    const description = (formData.get('ticket_description') as string ?? '').trim();

    if (name.length < 2) {
      setError('Please enter your name.');
      return;
    }
    if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!subject) {
      setError('Please enter a subject.');
      return;
    }
    if (description.length > 10000) {
      setError('Your message is too long (max 10,000 characters).');
      return;
    }

    setSubmitting(true);
    setError('');

    const { error: dbError } = await supabase.from('digital_footprint_support').insert({
      ticket_title: subject,
      ticket_description: description,
      submitted_by: name,
      submitted_email: email,
      status: 'Open',
      priority: 'Medium',
    });

    setSubmitting(false);

    if (dbError) {
      setError('Something went wrong submitting your request. Please try again.');
      return;
    }

    setSuccess(true);
    form.reset();
  };

  return (
    <div className="min-h-screen bg-background-50">
      {/* Header */}
      <header className="border-b border-background-200/60">
        <div className="max-w-5xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-accent-500 rounded-lg flex items-center justify-center">
              <i className="ri-radar-line text-background-950 text-lg w-5 h-5 flex items-center justify-center"></i>
            </div>
            <span className="font-heading font-semibold text-sm text-foreground-50 whitespace-nowrap">
              Footprint<span className="text-accent-400">CC</span>
            </span>
          </Link>
          <span className="text-sm text-foreground-500 whitespace-nowrap">Support</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 md:px-6 py-10 md:py-14">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start">
          {/* Left — intro */}
          <div>
            <h1 className="text-3xl md:text-4xl font-heading font-bold text-foreground-50 leading-tight">
              How can we help?
            </h1>
            <p className="text-foreground-400 mt-4 leading-relaxed text-sm md:text-base">
              Tell us what you need and our team will get back to you. Whether it's a question about
              your data, a feature request, or something that isn't working right, we're here to help.
            </p>

            <div className="space-y-4 mt-8">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-accent-500/10 text-accent-400 flex items-center justify-center shrink-0">
                  <i className="ri-time-line text-base w-5 h-5 flex items-center justify-center"></i>
                </div>
                <div>
                  <p className="text-sm font-heading font-semibold text-foreground-100">Quick response</p>
                  <p className="text-sm text-foreground-500 mt-0.5">Most requests get a reply within one business day.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary-500/10 text-primary-400 flex items-center justify-center shrink-0">
                  <i className="ri-mail-line text-base w-5 h-5 flex items-center justify-center"></i>
                </div>
                <div>
                  <p className="text-sm font-heading font-semibold text-foreground-100">Track your request</p>
                  <p className="text-sm text-foreground-500 mt-0.5">We'll keep your email so we can follow up directly.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-secondary-500/10 text-secondary-300 flex items-center justify-center shrink-0">
                  <i className="ri-shield-check-line text-base w-5 h-5 flex items-center justify-center"></i>
                </div>
                <div>
                  <p className="text-sm font-heading font-semibold text-foreground-100">Privacy first</p>
                  <p className="text-sm text-foreground-500 mt-0.5">Your details are only used to respond to your request.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right — form */}
          <div className="bg-background-100 border border-background-200/60 rounded-xl p-5 md:p-6">
            {success ? (
              <div className="py-12 text-center">
                <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <i className="ri-check-line text-2xl w-7 h-7 flex items-center justify-center"></i>
                </div>
                <h2 className="text-lg font-heading font-semibold text-foreground-50">Request received</h2>
                <p className="text-sm text-foreground-500 mt-2 max-w-xs mx-auto">
                  Thanks for reaching out — we'll get back to you shortly.
                </p>
                <button
                  onClick={() => setSuccess(false)}
                  className="mt-6 text-sm text-accent-400 hover:text-accent-300 transition-colors cursor-pointer"
                >
                  Send another request
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} data-readdy-form="support" noValidate>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="submitted_by" className="block text-xs font-label text-foreground-400 uppercase tracking-wider mb-1.5">
                      Name
                    </label>
                    <input
                      id="submitted_by"
                      name="submitted_by"
                      type="text"
                      required
                      placeholder="Your name"
                      className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label htmlFor="submitted_email" className="block text-xs font-label text-foreground-400 uppercase tracking-wider mb-1.5">
                      Email
                    </label>
                    <input
                      id="submitted_email"
                      name="submitted_email"
                      type="email"
                      required
                      placeholder="you@example.com"
                      className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label htmlFor="ticket_title" className="block text-xs font-label text-foreground-400 uppercase tracking-wider mb-1.5">
                      Subject
                    </label>
                    <input
                      id="ticket_title"
                      name="ticket_title"
                      type="text"
                      required
                      placeholder="What's this about?"
                      className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label htmlFor="ticket_description" className="block text-xs font-label text-foreground-400 uppercase tracking-wider mb-1.5">
                      Message
                    </label>
                    <textarea
                      id="ticket_description"
                      name="ticket_description"
                      rows={5}
                      maxLength={10000}
                      placeholder="Give us as much detail as you can..."
                      className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors resize-none"
                    />
                  </div>

                  {/* Honeypot — hidden from real users */}
                  <input
                    type="text"
                    name="website_alt"
                    tabIndex={-1}
                    autoComplete="off"
                    aria-hidden="true"
                    readOnly
                  />

                  {error && (
                    <p className="text-sm text-red-400">{error}</p>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-accent-500 hover:bg-accent-400 text-background-950 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Sending...' : 'Submit request'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}