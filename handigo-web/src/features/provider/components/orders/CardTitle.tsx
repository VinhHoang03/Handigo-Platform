export function CardTitle({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="material-symbols-outlined text-primary">{icon}</span>
      <h2 className="font-headline-md text-on-surface">{title}</h2>
    </div>
  );
}
