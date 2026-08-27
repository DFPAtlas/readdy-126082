import { useState } from 'react';
import type { ToolAccessMode, RiskLevel } from '@/pages/ai-operations/types';
import type { AgentAccessInput, ToolAgentOption } from '@/pages/ai-operations/tools/ToolsContext';
import Modal from '@/components/base/Modal';
import { ACCESS_MODE_LABELS } from '@/pages/ai-operations/constants';

const fieldCls =
  'w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-md px-3 py-2 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors';
const labelCls = 'block text-xs font-label text-foreground-400 mb-1.5';

const ACCESS_MODES: ToolAccessMode[] = ['read', 'write', 'execute', 'read_write', 'restricted'];
const RISKS: RiskLevel[] = ['low', 'medium', 'high', 'critical'];

interface AgentAccessFormModalProps {
  open: boolean;
  onClose: () => void;
  agents: ToolAgentOption[];
  onSave: (agentKey: string, input: AgentAccessInput) => void;
}

// Split a free-text field (newline/comma separated) into an operation list.
function parseOperations(text: string): string[] {
  return text
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function AgentAccessFormModal({ open, onClose, agents, onSave }: AgentAccessFormModalProps) {
  const [agentKey, setAgentKey] = useState('');
  const [accessMode, setAccessMode] = useState<ToolAccessMode>('read');
  const [allowedText, setAllowedText] = useState('');
  const [restrictedText, setRestrictedText] = useState('');
  const [risk, setRisk] = useState<RiskLevel>('medium');
  const [approvalRequired, setApprovalRequired] = useState(false);

  const handleSave = () => {
    if (!agentKey) return;
    onSave(agentKey, {
      accessMode,
      allowedOperations: parseOperations(allowedText),
      restrictedOperations: parseOperations(restrictedText),
      risk,
      approvalRequired,
    });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Grant / Update Agent Access">
      <div className="p-5 space-y-4">
        <div>
          <label className={labelCls}>Agent</label>
          <select value={agentKey} onChange={(e) => setAgentKey(e.target.value)} className={`${fieldCls} cursor-pointer`}>
            <option value="">Select agent…</option>
            {agents.map((a) => (
              <option key={a.key} value={a.key}>{a.name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Access level</label>
            <select value={accessMode} onChange={(e) => setAccessMode(e.target.value as ToolAccessMode)} className={`${fieldCls} cursor-pointer`}>
              {ACCESS_MODES.map((m) => (
                <option key={m} value={m}>{ACCESS_MODE_LABELS[m]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Risk limit</label>
            <select value={risk} onChange={(e) => setRisk(e.target.value as RiskLevel)} className={`${fieldCls} cursor-pointer`}>
              {RISKS.map((r) => (
                <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={labelCls}>Allowed operations (comma or newline separated)</label>
          <textarea
            value={allowedText}
            onChange={(e) => setAllowedText(e.target.value)}
            rows={3}
            placeholder="Read tables, Query metadata"
            className={`${fieldCls} resize-none`}
          />
        </div>

        <div>
          <label className={labelCls}>Restricted operations (comma or newline separated)</label>
          <textarea
            value={restrictedText}
            onChange={(e) => setRestrictedText(e.target.value)}
            rows={3}
            placeholder="Delete records, Modify schema"
            className={`${fieldCls} resize-none`}
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-foreground-200 cursor-pointer">
          <input type="checkbox" checked={approvalRequired} onChange={(e) => setApprovalRequired(e.target.checked)} className="w-4 h-4 accent-accent-500" />
          Approval required for this access
        </label>

        <div className="bg-background-50 border border-background-200/60 rounded-md p-3 text-[11px] font-label text-foreground-500 leading-relaxed">
          Registry permission only — runtime enforcement is not connected. Revoking access sets it inactive rather than deleting it.
        </div>
      </div>

      <div className="flex items-center justify-end gap-2.5 px-5 py-4 border-t border-background-400/60">
        <button
          onClick={onClose}
          className="inline-flex items-center gap-2 text-xs font-label text-foreground-300 hover:text-foreground-100 bg-background-50 border border-background-300/60 rounded-md px-3 py-2 transition-colors cursor-pointer whitespace-nowrap"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!agentKey}
          className="inline-flex items-center gap-2 text-xs font-label bg-accent-500 hover:bg-accent-400 disabled:opacity-50 disabled:cursor-not-allowed text-background-950 rounded-md px-3 py-2 transition-colors cursor-pointer whitespace-nowrap"
        >
          <i className="ri-save-line text-sm w-4 h-4 flex items-center justify-center"></i>
          Save Access
        </button>
      </div>
    </Modal>
  );
}