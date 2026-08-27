import type { SiteOwnership } from '@/pages/ai-operations/types';

interface OwnershipSectionProps {
  ownership: SiteOwnership;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-label text-foreground-600 uppercase tracking-wide">{label}</p>
      <p className="text-sm text-foreground-200 mt-0.5">{value || '—'}</p>
    </div>
  );
}

export default function OwnershipSection({ ownership }: OwnershipSectionProps) {
  return (
    <section className="space-y-4">
      <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Ownership &amp; Escalation</h3>

      <div className="bg-background-100 border border-background-200/60 rounded-lg p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
          <Field label="Business Owner" value={ownership.businessOwner} />
          <Field label="Technical Owner" value={ownership.technicalOwner} />
          <Field label="Support Team" value={ownership.supportTeam} />
          <Field label="Escalation Team" value={ownership.escalationTeam} />
          <Field label="Default Severity" value={ownership.defaultSeverity} />
          <Field label="Support Queue" value={ownership.supportQueue} />
        </div>
      </div>
    </section>
  );
}