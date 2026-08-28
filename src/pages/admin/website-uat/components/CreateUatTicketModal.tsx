import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import Modal from '@/components/base/Modal';
import type { UatDefectItem } from '../types';

interface Site {
  id: string;
  site_name: string;
}

interface Props {
  open: boolean;
  defect: UatDefectItem | null;
  onClose: () => void;
  onCreated: () => void;
}

const CATEGORIES = ['general', 'technical', 'account', 'billing', 'access', 'bug', 'complaint', 'feature_request', 'security', 'other'] as const;
const PRIORITIES = ['low', 'normal', 'high', 'urgent', 'critical'] as const;

function buildSubject(d: UatDefectItem): string {
  return `UAT defect: ${d.testCaseTitle}`;
}

function buildDescription(d: UatDefectItem): string {
  const lines: string[] = [];
  lines.push('Source: UAT');
  lines.push(`UAT Project: ${d.projectName || 'Unknown'}`);
  lines.push(`UAT Job: ${d.jobTitle || 'Unknown'}`);
  lines.push(`Test Case: ${d.testCaseTitle}`);
  lines.push(`Result: ${d.status.toUpperCase()}`);
  if (d.testerNotes) lines.push(`Tester Notes: ${d.testerNotes}`);
  if (d.actualResult) lines.push(`Actual Result: ${d.actualResult}`);
  if (d.blockerReason) lines.push(`Blocker: ${d.blockerReason}`);
  if (d.expectedResult) lines.push(`Expected: ${d.expectedResult}`);
  if (d.device) lines.push(`Device: ${d.device}`);
  if (d.browser) lines.push(`Browser: ${d.browser}`);
  return lines.join('\n');
}

export default function CreateUatTicketModal({ open, defect, onClose, onCreated }: Props) {
  const [sites, setSites] = useState<Site[]>([]);
  const [siteId, setSiteId] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('bug');
  const [priority, setPriority] = useState<string>('normal');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !defect) return;
    setSubject(buildSubject(defect));
    setDescription(buildDescription(defect));
    setCategory('bug');
    setPriority('normal');
    setError('');

    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('internal_support_sites')
        .select('id,site_name')
        .eq('is_active', true)
        .order('site_name');
      if (cancelled) return;
      const list = (data || []) as Site[];
      setSites(list);
      if (list.length > 0 && !siteId) setSiteId(list[0].id);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defect]);

  const create = async () => {
    if (!defect || !siteId) {
      setError('Please select a support site.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { data, error: err } = await supabase.rpc('create_uat_support_ticket', {
        p_site_id: siteId,
        p_subject: subject.trim(),
        p_description: description.trim(),
        p_category: category,
        p_priority: priority,
        p_uat_project_id: defect.projectId,
        p_uat_job_id: defect.jobId,
        p_uat_test_case_id: defect.testCaseId,
        p_uat_result_id: defect.resultId,
        p_uat_feedback_id: defect.defect?.id ?? null,
      });
      if (err) throw err;
      const ticketId = (data as { ticket_id?: string } | null)?.ticket_id;
      if (ticketId && defect.defect?.id) {
        const { error: linkErr } = await supabase.rpc('link_uat_defect_ticket', {
          p_feedback_id: defect.defect.id,
          p_ticket_id: ticketId,
        });
        if (linkErr) throw linkErr;
      }
      onCreated();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create support ticket.');
    } finally {
      setBusy(false);
    }
  };

  if (!defect) return null;

  return (
    <Modal open={open} onClose={() => { if (!busy) onClose(); }} title="Create Support Ticket" variant="default" lockScroll={true}>
      <div className="p-5 space-y-4">
        <p className="text-xs text-foreground-500">
          Create a ticket in the existing DFP support system for this validated UAT defect. The original FAIL/BLOCKED result is preserved.
        </p>

        <div>
          <label className="block text-[10px] font-label text-foreground-400 uppercase tracking-wide mb-1.5">Support site</label>
          <select
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            className="w-full bg-background-50 border border-background-300/60 rounded-lg px-3 py-2.5 text-sm text-foreground-100 outline-none"
          >
            {sites.map((s) => (
              <option key={s.id} value={s.id}>{s.site_name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-label text-foreground-400 uppercase tracking-wide mb-1.5">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-background-50 border border-background-300/60 rounded-lg px-3 py-2.5 text-sm text-foreground-100 outline-none"
            >
              {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-label text-foreground-400 uppercase tracking-wide mb-1.5">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full bg-background-50 border border-background-300/60 rounded-lg px-3 py-2.5 text-sm text-foreground-100 outline-none"
            >
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-label text-foreground-400 uppercase tracking-wide mb-1.5">Subject</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full bg-background-50 border border-background-300/60 rounded-lg px-3 py-2.5 text-sm text-foreground-100 outline-none"
          />
        </div>

        <div>
          <label className="block text-[10px] font-label text-foreground-400 uppercase tracking-wide mb-1.5">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={9}
            className="w-full bg-background-50 border border-background-300/60 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none resize-none"
          />
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2 text-sm text-foreground-400 hover:text-foreground-200 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={create}
            disabled={busy}
            className="bg-accent-500 hover:bg-accent-400 text-background-950 px-4 py-2 rounded-full text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40"
          >
            {busy ? 'Creating...' : 'Create Ticket'}
          </button>
        </div>
      </div>
    </Modal>
  );
}