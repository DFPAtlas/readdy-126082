export default function EmptyState({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-4">
      <div className="w-14 h-14 bg-background-200/60 rounded-2xl flex items-center justify-center mb-4">
        <i className={`${icon} text-foreground-500 text-2xl w-7 h-7 flex items-center justify-center`}></i>
      </div>
      <h3 className="font-heading text-base font-semibold text-foreground-200 mb-1">{title}</h3>
      <p className="text-sm text-foreground-500 max-w-sm leading-relaxed">{description}</p>
    </div>
  );
}