import { useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { EvidenceItem } from '../lib';

interface Props {
  assignmentId: string;
  sessionId: string | null;
  atcId: string;
  evidence: EvidenceItem[];
  disabled: boolean;
  onChange: (evidence: EvidenceItem[]) => void;
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_DOC_BYTES = 15 * 1024 * 1024; // 15 MB

/**
 * Reuses the existing evidence pipeline: `prepare_uat_evidence_upload` (creates
 * the metadata row and returns a storage path) then uploads the file bytes to
 * the returned bucket/path. No second upload system.
 */
export default function EvidenceUpload({
  assignmentId,
  sessionId,
  atcId,
  evidence,
  disabled,
  onChange,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError('');
    setBusy(true);
    const added: EvidenceItem[] = [];
    try {
      for (const file of Array.from(files)) {
        const isImage = file.type.startsWith('image/');
        const evidenceType = isImage ? 'screenshot' : 'document';
        const maxBytes = isImage ? MAX_IMAGE_BYTES : MAX_DOC_BYTES;
        if (file.size > maxBytes) {
          throw new Error(`${file.name} is too large (max ${Math.round(maxBytes / 1024 / 1024)} MB).`);
        }

        const { data, error: prepErr } = await supabase.rpc('prepare_uat_evidence_upload', {
          p_assignment_id: assignmentId,
          p_original_filename: file.name,
          p_mime_type: file.type,
          p_file_size_bytes: file.size,
          p_evidence_type: evidenceType,
          p_assignment_test_case_id: atcId,
          p_session_id: sessionId,
          p_caption: null,
          p_width: null,
          p_height: null,
          p_browser_name: null,
          p_browser_version: null,
          p_operating_system: null,
          p_viewport_width: null,
          p_viewport_height: null,
        });
        if (prepErr) throw prepErr;
        if (!data?.success) throw new Error(data?.message || 'Could not prepare evidence upload.');

        const { error: upErr } = await supabase.storage
          .from(data.storage_bucket)
          .upload(data.storage_path, file, { contentType: file.type, upsert: false });
        if (upErr) throw upErr;

        added.push({
          id: data.evidence_id,
          evidence_type: evidenceType,
          file_name: file.name,
          mime_type: file.type,
          file_size_bytes: file.size,
        });
      }
      onChange([...evidence, ...added]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleRemove = async (item: EvidenceItem) => {
    setError('');
    try {
      const { data, error: delErr } = await supabase.rpc('soft_delete_uat_evidence', {
        p_evidence_id: item.id,
      });
      if (delErr) throw delErr;
      if (!data?.success) throw new Error(data?.message || 'Could not remove evidence.');
      onChange(evidence.filter((e) => e.id !== item.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">
          Evidence
        </span>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || busy}
          className="inline-flex items-center gap-1.5 text-sm text-accent-400 hover:text-accent-300 font-medium disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
        >
          <i className="ri-image-add-line w-4 h-4 flex items-center justify-center"></i>
          {busy ? 'Uploading…' : 'Add screenshot / file'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,application/pdf,text/plain,text/csv"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {error && <p className="text-sm text-red-400 mb-2">{error}</p>}

      {evidence.length === 0 ? (
        <p className="text-sm text-foreground-500">No evidence attached yet.</p>
      ) : (
        <ul className="space-y-2">
          {evidence.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 bg-background-50 border border-background-200/60 rounded-md px-3 py-2"
            >
              <div className="w-8 h-8 bg-background-200/60 rounded-md flex items-center justify-center shrink-0">
                <i
                  className={`${
                    item.evidence_type === 'screenshot' ? 'ri-image-line' : 'ri-file-text-line'
                  } text-foreground-400 text-base w-5 h-5 flex items-center justify-center`}
                ></i>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground-200 truncate">{item.file_name}</p>
                {item.file_size_bytes != null && (
                  <p className="text-xs text-foreground-500">
                    {Math.round(item.file_size_bytes / 1024)} KB · {item.evidence_type}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleRemove(item)}
                disabled={disabled}
                className="text-foreground-500 hover:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
                aria-label={`Remove ${item.file_name}`}
              >
                <i className="ri-delete-bin-line text-lg w-5 h-5 flex items-center justify-center"></i>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}