import type { ProviderApplication } from "@/features/provider-application/types/providerApplication.types";
import type { ProviderBannerMode } from "@/features/customer/utils/providerBanner.utils";

interface ProviderRegistrationBannerProps {
  mode: ProviderBannerMode;
  application: ProviderApplication | null;
  onDismiss: () => void;
  onNavigateToApplication: () => void;
  onNavigateToRegister: () => void;
}

function DismissButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Đóng thông báo"
      title="Không hiển thị lại"
      onClick={onClick}
      className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full text-on-primary transition hover:bg-on-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-primary/50"
    >
      <span className="material-symbols-outlined text-xl">close</span>
    </button>
  );
}

export function ProviderRegistrationBanner({
  mode,
  application,
  onDismiss,
  onNavigateToApplication,
  onNavigateToRegister,
}: ProviderRegistrationBannerProps) {
  if (mode === "rejected" && application) {
    return (
      <section className="relative flex flex-col justify-between gap-4 overflow-hidden rounded-3xl border border-error/25 bg-error-container p-5 pr-14 text-on-error-container shadow-sm md:flex-row md:items-center md:p-6 md:pr-16">
        <button
          type="button"
          aria-label="Đóng thông báo"
          title="Không hiển thị lại"
          onClick={onDismiss}
          className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full text-on-error-container transition hover:bg-error/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/30"
        >
          <span className="material-symbols-outlined text-xl">close</span>
        </button>
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-error/10 text-error">
            <span className="material-symbols-outlined text-2xl">warning</span>
          </div>
          <p className="text-sm font-semibold leading-6">
            Hồ sơ đăng ký Provider của bạn đã bị từ chối. Vui lòng xem chi tiết
            hồ sơ để biết lý do và thực hiện chỉnh sửa trước khi gửi lại.
          </p>
        </div>
        <button
          type="button"
          onClick={onNavigateToApplication}
          className="rounded-lg bg-error px-5 py-2.5 font-bold text-on-error shadow-sm transition hover:bg-error/90"
        >
          Xem hồ sơ
        </button>
      </section>
    );
  }

  if (mode === "waiting") {
    return (
      <section className="relative flex items-start gap-4 overflow-hidden rounded-3xl border border-primary/20 bg-primary p-5 pr-14 text-on-primary shadow-sm sm:items-center sm:p-6 sm:pr-16">
        <DismissButton onClick={onDismiss} />
        <span className="material-symbols-outlined shrink-0 rounded-2xl bg-on-primary/15 p-3 text-2xl">
          pending_actions
        </span>
        <div className="min-w-0 flex-1" aria-live="polite">
          <p className="font-headline-sm text-lg font-bold">
            Hồ sơ đang được xem xét
          </p>
          <p className="mt-1 text-sm leading-5 text-on-primary/85">
            Đơn đăng ký trở thành thợ cung cấp dịch vụ của bạn đã được gửi
            thành công. Chúng tôi đang tiến hành xem xét hồ sơ và sẽ phản hồi
            trong thời gian sớm nhất.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="relative flex flex-col justify-between gap-5 overflow-hidden rounded-3xl border border-primary/15 bg-primary p-5 pr-14 text-on-primary shadow-sm md:flex-row md:items-center md:p-6 md:pr-16">
      <span
        aria-hidden="true"
        className="absolute -bottom-16 -right-10 h-40 w-40 rounded-full bg-on-primary/10"
      />
      <DismissButton onClick={onDismiss} />
      <div className="flex items-center gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-on-primary/15">
          <span className="material-symbols-outlined text-2xl">engineering</span>
        </div>
        <div>
          <p className="font-headline-sm font-bold">Trở thành thợ dịch vụ</p>
          <p className="mt-1 text-sm text-on-primary/80">
            Gửi hồ sơ để mở rộng vai trò provider trên cùng tài khoản.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onNavigateToRegister}
        className="relative z-10 rounded-lg bg-on-primary px-5 py-2.5 font-bold text-primary shadow-sm transition hover:bg-on-primary/90"
      >
        Đăng ký ngay
      </button>
    </section>
  );
}
