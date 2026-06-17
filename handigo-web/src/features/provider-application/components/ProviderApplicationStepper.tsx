const labels = ['Lĩnh vực', 'Khu vực', 'Giới thiệu'];

export function ProviderApplicationStepper({ step }: { step: number }) {
  return (
    <ol className="mb-6 grid grid-cols-3 gap-2" aria-label="Tiến độ đăng ký">
      {labels.map((label, index) => {
        const value = index + 1;
        return (
          <li key={label}>
            <div className={`h-2 rounded-full ${value <= step ? 'bg-primary' : 'bg-surface-container-high'}`} />
            <p className={`mt-2 text-center text-xs ${value === step ? 'font-bold text-primary' : 'text-on-surface-variant'}`}>
              {label}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
