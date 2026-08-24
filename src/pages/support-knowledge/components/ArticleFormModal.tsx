import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Modal from '@/components/base/Modal';
import type { KnowledgeArticle, KnowledgeVisibility, SupportSite } from '@/types/support-tickets';
import { categoryLabels, CATEGORY_OPTIONS } from '@/pages/support-tickets/constants';
import { friendlyRpcError } from '../hooks';

interface ArticleFormModalProps {
  open: boolean;
  onClose: () => void;
  article: KnowledgeArticle | null;
  sites: SupportSite[];
  onSaved: () => void;
}

interface FormState {
  title: string;
  site_id: string;
  category: string;
  subcategory: string;
  content: string;
  internal_notes: string;
  summary: string;
  visibility: KnowledgeVisibility;
}

const empty: FormState = {
  title: '',
  site_id: '',
  category: '',
  subcategory: '',
  content: '',
  internal_notes: '',
  summary: '',
  visibility: 'customer_safe',
};

const inputCls =
  'w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors';

export default function ArticleFormModal({ open, onClose, article, sites, onSaved }: ArticleFormModalProps) {
  const [form, setForm] = useState<FormState>(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm(
        article
          ? {
              title: article.title,
              site_id: article.site_id ?? '',
              category: article.category ?? '',
              subcategory: article.subcategory ?? '',
              content: article.content,
              internal_notes: article.internal_notes ?? '',
              summary: article.summary ?? '',
              visibility: article.visibility,
            }
          : empty,
      );
      setError('');
    }
  }, [open, article]);

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const submit = async () => {
    if (!form.title.trim()) {
      setError('A title is required.');
      return;
    }
    if (!form.content.trim()) {
      setError('Article content is required.');
      return;
    }
    setSaving(true);
    setError('');
    const { error: e } = await supabase.rpc('support_upsert_knowledge_article', {
      p_id: article?.id ?? null,
      p_title: form.title.trim(),
      p_site_id: form.site_id || null,
      p_category: form.category || null,
      p_subcategory: form.subcategory || null,
      p_content: form.content,
      p_internal_notes: form.internal_notes || null,
      p_summary: form.summary || null,
      p_visibility: form.visibility,
    });
    setSaving(false);
    if (e) {
      setError(friendlyRpcError(e));
      return;
    }
    onSaved();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={article ? 'Edit Article' : 'New Article'} className="max-w-2xl">
      <div className="p-5 space-y-4">
        <div>
          <label className="block text-xs font-label text-foreground-500 mb-1">Title *</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => set({ title: e.target.value })}
            placeholder="e.g. Password Reset Troubleshooting"
            className={inputCls}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-label text-foreground-500 mb-1">Site</label>
            <select
              value={form.site_id}
              onChange={(e) => set({ site_id: e.target.value })}
              className={`${inputCls} cursor-pointer`}
            >
              <option value="">Global (all sites)</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>{s.site_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-label text-foreground-500 mb-1">Category</label>
            <select
              value={form.category}
              onChange={(e) => set({ category: e.target.value })}
              className={`${inputCls} cursor-pointer`}
            >
              <option value="">— Select —</option>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>{categoryLabels[c]}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-label text-foreground-500 mb-1">Subcategory</label>
            <input
              type="text"
              value={form.subcategory}
              onChange={(e) => set({ subcategory: e.target.value })}
              placeholder="e.g. Password Reset"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-label text-foreground-500 mb-1">Visibility</label>
            <select
              value={form.visibility}
              onChange={(e) => set({ visibility: e.target.value as KnowledgeVisibility })}
              className={`${inputCls} cursor-pointer`}
            >
              <option value="customer_safe">Customer-safe (usable in replies)</option>
              <option value="internal_only">Internal only (staff reasoning)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-label text-foreground-500 mb-1">Summary</label>
          <input
            type="text"
            value={form.summary}
            onChange={(e) => set({ summary: e.target.value })}
            placeholder="One-line summary shown in search results"
            className={inputCls}
          />
        </div>

        <div>
          <label className="block text-xs font-label text-foreground-500 mb-1">Content *</label>
          <textarea
            value={form.content}
            onChange={(e) => set({ content: e.target.value })}
            rows={6}
            maxLength={20000}
            placeholder="The customer-safe article body…"
            className={`${inputCls} resize-y`}
          />
        </div>

        <div>
          <label className="block text-xs font-label text-foreground-500 mb-1">Internal notes</label>
          <textarea
            value={form.internal_notes}
            onChange={(e) => set({ internal_notes: e.target.value })}
            rows={2}
            maxLength={2000}
            placeholder="Internal-only guidance. Never exposed to customers or AI replies."
            className={`${inputCls} resize-y`}
          />
        </div>

        {form.visibility === 'internal_only' && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
            <p className="text-xs text-amber-300">
              Internal-only articles are never used for AI-generated customer replies.
            </p>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-foreground-400 hover:text-foreground-200 transition-colors cursor-pointer whitespace-nowrap"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="bg-accent-500 hover:bg-accent-400 text-background-950 px-5 py-2 rounded-full text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
          >
            {saving ? 'Saving…' : article ? 'Save changes' : 'Create article'}
          </button>
        </div>
      </div>
    </Modal>
  );
}