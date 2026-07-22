import React from 'react';

export const BookingStepper: React.FC<{ currentStep: 1 | 2 | 3 }> = ({ currentStep }) => {
  const steps = [
    { id: 1, label: 'Dịch vụ' },
    { id: 2, label: 'Thời gian & địa điểm' },
    { id: 3, label: 'Thanh toán' },
  ] as const;

  return (
    <nav aria-label="Tiến trình đặt dịch vụ" className="mx-auto w-full max-w-[720px] py-2">
      <div className="relative">
        <div
          aria-hidden="true"
          className="absolute left-[16.6667%] right-[16.6667%] top-[15px] h-px bg-outline-variant/70"
        >
          <div
            className="h-full bg-primary transition-[width] duration-300 ease-out"
            style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
          />
        </div>

        <ol className="relative grid grid-cols-3">
          {steps.map((step) => {
            const isDone = step.id < currentStep;
            const isActive = step.id === currentStep;

            return (
              <li
                key={step.id}
                aria-current={isActive ? 'step' : undefined}
                className="relative z-10 flex min-w-0 flex-col items-center text-center"
              >
                <span
                  className={`grid h-[30px] w-[30px] place-items-center rounded-full border text-xs font-bold leading-none transition-colors ${
                    isDone
                      ? 'border-primary bg-primary text-on-primary'
                      : isActive
                        ? 'border-primary bg-surface-container-lowest text-primary ring-[3px] ring-primary-fixed'
                        : 'border-outline-variant bg-surface-container-lowest text-on-surface-variant'
                  }`}
                >
                  {isDone ? (
                    <span className="material-symbols-outlined text-[16px] leading-none">check</span>
                  ) : (
                    step.id
                  )}
                </span>
                <span
                  className={`mt-1 block min-h-8 px-1 font-label-sm text-label-sm sm:min-h-0 sm:whitespace-nowrap ${
                    isDone || isActive
                      ? 'font-semibold text-primary'
                      : 'font-semibold text-on-surface-variant'
                  }`}
                >
                  {step.label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
};
