import type { StatusTone } from '@/pages/ai-operations/constants';

const TONE_STYLES: Record<StatusTone, string> = {
  emerald: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  amber: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  red: 'bg-red-500/15 text-red-400 border-red-500/25',
  accent: 'bg-accent-500/15 text-accent-400 border-accent-500/25',
  secondary: 'bg-secondary-500/15 text-secondary-300 border-secondary-500/25',
};

const DOT_STYLES: Record<StatusTone, string> = {
  emerald: 'bg-emerald-400',
  amber: 'bg-amber-400',
  red: 'bg-red-400',
  accent: 'bg-accent-400',
  secondary: 'bg-secondary-400',
};

export default function StatusPill({ tone, label, pulse = false }: { tone: StatusTone; label: string; pulse?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-label whitespace-nowrap border ${TONE_STYLES[tone]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${DOT_STYLES[tone]} ${pulse ? 'animate-pulse' : ''}`}></span>
      {label}
    </span>
  );
}