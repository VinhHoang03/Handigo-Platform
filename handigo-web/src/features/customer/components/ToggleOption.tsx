export function ToggleOption({
  label,
  desc,
  icon,
  checked,
  color = "bg-surface-container",
}: {
  label: string;
  desc: string;
  icon: string;
  checked?: boolean;
  color?: string;
}) {
  return (
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
          <span className="material-symbols-outlined">{icon}</span>
        </div>
        <div>
          <p className="font-label-md text-label-md font-bold">{label}</p>
          <p className="font-label-sm text-label-sm text-on-surface-variant">
            {desc}
          </p>
        </div>
      </div>
      <label className="relative inline-flex cursor-pointer items-center self-start sm:self-auto">
        <input
          type="checkbox"
          checked={checked}
          className="peer sr-only"
          onChange={() => {}}
        />
        <span className="h-6 w-11 rounded-full bg-outline-variant transition peer-checked:bg-primary peer-focus-visible:ring-4 peer-focus-visible:ring-primary/15" />
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full border border-gray-300 bg-white transition peer-checked:translate-x-full peer-checked:border-white" />
      </label>
    </div>
  );
}
