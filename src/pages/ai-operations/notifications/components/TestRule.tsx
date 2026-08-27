import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { NotificationTestResult } from '@/pages/ai-operations/types';
import { SEVERITY, NOTIFICATION_PRIORITY, NOTIFICATION_CHANNEL_LABELS } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';
import { simulateRuleMatch } from '@/pages/ai-operations/notifications/selectors';

const SOURCES = [
  'Alerts & Incidents',
  'Security & Policy',
  'Tasks & Runs',
  'Approvals',
  'Orchestrator',
  'Tools & Connections',
  'Models & Providers',
  'Cost & Budgets',
  'UAT',
  'Agents',
];

const SEVERITY_OPTIONS = ['info', 'low', 'medium', 'high', 'critical'] as const;

const selectCls =
  'bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-md px-2.5 py-2 text-sm text-foreground-100 outline-none transition-colors cursor-pointer';

export default function TestRule() {
  const [source, setSource] = useState('Alerts & Incidents');
  const [severity, setSeverity] = useState('high');
  const [result, setResult] = useState<NotificationTestResult | null>(null);

  const runTest = () => {
    setResult(simulateRuleMatch(source, severity));
  };

  return (
    <section aria-label="Test rule" className="bg-background-100 border border-background-200/60 rounded-lg p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-label font-semibold text-foreground-100">Test Rule</h3>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-label text-foreground-500 bg-background-50 border border-background-200/60 rounded-full px-2 py-0.5 whitespace-nowrap">
          <i className="ri-flask-line w-3 h-3 flex items-center justify-center"></i>
          Simulation
        </span>
      </div>

      <p className="text-xs text-foreground-500 mb-3">Simulate an event to preview which rule matches and how it would route. Nothing is sent.</p>

      <div className="flex flex-col sm:flex-row gap-2.5">
        <select value={source} onChange={(e) => setSource(e.target.value)} className={selectCls}>
          {SOURCES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={severity} onChange={(e) => setSeverity(e.target.value)} className={selectCls}>
          {SEVERITY_OPTIONS.map((s) => (
            <option key={s} value={s}>{SEVERITY[s].label}</option>
          ))}
        </select>
        <button
          onClick={runTest}
          className="inline-flex items-center gap-1.5 text-xs font-label bg-accent-500 hover:bg-accent-400 text-background-950 rounded-md px-4 py-2 transition-colors duration-150 cursor-pointer whitespace-nowrap"
        >
          <i className="ri-play-line text-sm w-4 h-4 flex items-center justify-center"></i>
          Test Rule
        </button>
      </div>

      {result && (
        <div className="mt-4 rounded-md bg-background-50 border border-background-200/50 p-4">
          {result.matched ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-label font-semibold text-foreground-100">Matched Rule</span>
                {result.priority && <StatusPill tone={NOTIFICATION_PRIORITY[result.priority].tone} label={NOTIFICATION_PRIORITY[result.priority].label} />}
              </div>
              {result.matchedRuleId && (
                <Link to={`/ai-operations/notifications/rules/${result.matchedRuleId}`} className="text-sm text-accent-400 hover:text-accent-300 transition-colors cursor-pointer">
                  {result.ruleName} <span className="font-mono text-xs">({result.matchedRuleId})</span>
                </Link>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Recipient Team</span>
                  <span className="text-foreground-100">{result.recipientTeam}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Acknowledgement</span>
                  <span className="text-foreground-100">{result.acknowledgementRequired ? 'Required' : 'Not required'}</span>
                </div>
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <span className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Channels</span>
                  <div className="flex flex-wrap gap-1.5">
                    {result.channels.map((c) => (
                      <span key={c} className="text-[11px] font-label text-foreground-300 bg-background-100 border border-background-200/60 rounded px-2 py-0.5 whitespace-nowrap">
                        {NOTIFICATION_CHANNEL_LABELS[c]}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <span className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Escalation Path</span>
                <div className="mt-1.5 space-y-1">
                  {result.escalationPath.map((step) => (
                    <div key={step.level} className="flex items-center gap-2 text-xs text-foreground-400 flex-wrap">
                      <span className="font-mono text-foreground-600">L{step.level}</span>
                      <span className="text-foreground-300">{step.team}</span>
                      <span className="text-foreground-600">·</span>
                      <span>{step.delay}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-foreground-400">No active rule matches this event source and severity.</p>
          )}
          <p className="text-[11px] font-label text-foreground-600 mt-3 pt-3 border-t border-background-200/50">
            Test mode does not send notifications.
          </p>
        </div>
      )}
    </section>
  );
}