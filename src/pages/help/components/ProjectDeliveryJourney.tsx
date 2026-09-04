import { PROJECT_DELIVERY_JOURNEY } from '../helpContent';

interface Props {
  onSelect: (articleId: string) => void;
}

export default function ProjectDeliveryJourney({ onSelect }: Props) {
  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg p-5">
      <div className="flex items-start gap-3 mb-4">
        <span className="w-8 h-8 rounded-lg bg-accent-500/10 text-accent-400 flex items-center justify-center shrink-0">
          <i className="ri-route-line text-sm w-4 h-4 flex items-center justify-center"></i>
        </span>
        <div>
          <h2 className="text-base font-heading font-semibold text-foreground-50">Project Delivery Journey</h2>
          <p className="text-xs text-foreground-500 mt-0.5">Select a stage to open its guide.</p>
        </div>
      </div>

      <ol className="flex flex-col gap-1" aria-label="Project Delivery Journey">
        {PROJECT_DELIVERY_JOURNEY.map((stage, i) => (
          <li key={stage.id} className="flex items-start gap-3">
            <div className="flex flex-col items-center shrink-0 pt-1">
              <span className="w-6 h-6 rounded-full bg-background-200/70 text-foreground-300 text-[11px] font-label flex items-center justify-center">
                {i + 1}
              </span>
              {i < PROJECT_DELIVERY_JOURNEY.length - 1 && (
                <span className="w-px flex-1 min-h-[10px] bg-background-200/60 my-0.5"></span>
              )}
            </div>
            <button
              type="button"
              onClick={() => onSelect(stage.articleId)}
              className="flex-1 text-left flex items-center gap-2.5 px-3 py-2 rounded-lg border border-background-200/60 hover:border-accent-500/30 hover:bg-background-50 transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500/60"
            >
              <i className={`${stage.icon} text-accent-400 text-sm w-4 h-4 flex items-center justify-center shrink-0`}></i>
              <span className="text-sm text-foreground-200">{stage.label}</span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}