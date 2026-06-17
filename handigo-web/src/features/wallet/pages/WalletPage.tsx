import { DashboardShell } from "@/components/common/DashboardShell";

export function WalletPage({ role }: { role: "CUSTOMER" | "PROVIDER" }) {
  return (
    <DashboardShell role={role}>
      <header>
        <h1 className="text-headline-lg font-bold">Ví</h1>
        <p className="text-on-surface-variant">
          Theo dõi số dư và các giao dịch trong tài khoản của bạn.
        </p>
      </header>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <div className="rounded-2xl border border-outline-variant/30 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-on-surface-variant">
            Số dư khả dụng
          </p>
          <p className="mt-3 text-4xl font-bold text-primary">0 VND</p>
          <p className="mt-3 text-sm text-on-surface-variant">
            Dữ liệu ví sẽ được đồng bộ từ hệ thống thanh toán.
          </p>
        </div>

        <div className="rounded-2xl border border-outline-variant/30 bg-white p-6 shadow-sm">
          <h2 className="font-bold text-on-surface">Thao tác nhanh</h2>
          <div className="mt-4 grid gap-3">
            <button type="button" className="btn-primary w-full">
              Nạp tiền
            </button>
            {role === "PROVIDER" && (
              <button type="button" className="btn-secondary w-full">
                Yêu cầu rút tiền
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-outline-variant/30 bg-white p-6 shadow-sm">
        <h2 className="font-bold text-on-surface">Lịch sử giao dịch</h2>
        <p className="mt-3 text-sm text-on-surface-variant">
          Chưa có giao dịch nào để hiển thị.
        </p>
      </section>
    </DashboardShell>
  );
}
