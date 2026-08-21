export default function Placeholder({ title, icon }: { title: string; icon: string }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground-50">{title}</h1>
        <p className="text-sm text-foreground-500 mt-1">Manage your {title.toLowerCase()}.</p>
      </div>
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-16 h-16 bg-background-100 rounded-2xl flex items-center justify-center mb-4">
          <i className={`${icon} text-2xl text-foreground-400 w-8 h-8 flex items-center justify-center`}></i>
        </div>
        <h2 className="text-lg font-heading font-semibold text-foreground-200 mb-2">Coming Soon</h2>
        <p className="text-sm text-foreground-500">Full CRUD interface for this module is under development.</p>
      </div>
    </div>
  );
}