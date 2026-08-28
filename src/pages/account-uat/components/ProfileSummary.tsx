import type { UatTester } from '@/pages/admin/website-uat/types';
import { DEVICE_LABELS, BROWSER_LABELS, EXPERIENCE_LEVEL_LABELS } from '@/pages/admin/website-uat/marketplace';

interface Props {
  tester: UatTester;
  completedCount: number;
  rating: { reliability: number | null; quality: number | null };
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">{label}</p>
      <p className="text-sm text-foreground-200 mt-1 leading-relaxed">{value}</p>
    </div>
  );
}

function RatingStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">{label}</span>
      <span className="inline-flex items-center gap-1 text-sm font-semibold text-foreground-100">
        <i className="ri-star-fill text-accent-400 text-sm w-4 h-4 flex items-center justify-center"></i>
        {value.toFixed(1)}
      </span>
    </div>
  );
}

export default function ProfileSummary({ tester, completedCount, rating }: Props) {
  const devices = (tester.devices ?? []).map((d) => DEVICE_LABELS[d] ?? d).filter(Boolean);
  const browsers = (tester.browsers ?? []).map((b) => BROWSER_LABELS[b] ?? b).filter(Boolean);
  const experience = EXPERIENCE_LEVEL_LABELS[tester.experience_level] ?? tester.experience_level;
  const location = [tester.town_city, tester.country].filter(Boolean).join(', ');
  const hasRating = rating.reliability != null || rating.quality != null;

  return (
    <div className="bg-background-100 border border-background-200/60 rounded-lg p-5">
      <div className="flex items-center gap-4 mb-5">
        <div className="w-12 h-12 rounded-full bg-secondary-400 flex items-center justify-center shrink-0">
          <span className="text-lg font-semibold text-foreground-50">
            {(tester.display_name || tester.full_name || 'T').charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="min-w-0">
          <h2 className="font-heading text-lg font-semibold text-foreground-50 truncate">
            {tester.display_name || tester.full_name}
          </h2>
          <p className="text-sm text-foreground-500 truncate">{location || tester.email}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Stat label="Experience" value={experience} />
        <Stat label="Completed Tests" value={String(completedCount)} />
        <Stat label="Devices" value={devices.length > 0 ? devices.join(', ') : '—'} />
        <Stat label="Browsers" value={browsers.length > 0 ? browsers.join(', ') : '—'} />
      </div>

      {hasRating && (
        <div className="mt-5 pt-4 border-t border-background-200/60 flex flex-wrap items-center gap-6">
          {rating.reliability != null && <RatingStat label="Reliability" value={rating.reliability} />}
          {rating.quality != null && <RatingStat label="Quality" value={rating.quality} />}
        </div>
      )}
    </div>
  );
}