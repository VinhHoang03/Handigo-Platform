import { AsyncState } from '@/components/common/AsyncState';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DashboardShell } from '@/components/common/DashboardShell';
import { BankAccountFormModal } from '../components/BankAccountFormModal';
import { BankAccountStatCard } from '../components/BankAccountStatCard';
import { BankAccountTable } from '../components/BankAccountTable';
import { maskAccountNumber } from '../components/bankAccountConstants';
import { useBankAccountManager } from '../components/useBankAccountManager';
import { CircleCheckBig, CreditCard, Landmark, RefreshCw, Star } from "lucide-react";
export default function ProviderBankAccountsPage({ role = 'PROVIDER' }: { role?: 'CUSTOMER' | 'PROVIDER' }) {
  const {
    items,
    loading,
    error,
    notice,
    busy,
    modalMode,
    form,
    defaultTarget,
    deleteTarget,
    stats,
    load,
    openCreate,
    openEdit,
    save,
    confirmSetDefault,
    confirmDelete,
    setForm,
    setModalMode,
    setDefaultTarget,
    setDeleteTarget,
  } = useBankAccountManager();

  return (
    <DashboardShell role={role}>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className="text-headline-lg font-bold text-on-background">Tài khoản ngân hàng</h1>
            <p className="text-on-surface-variant">Quản lý tài khoản nhận tiền khi gửi yêu cầu rút ví Handigo.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-outline-variant px-5 py-3 font-semibold text-on-surface hover:bg-surface-container-low"
            >
              <RefreshCw aria-hidden="true" size={20} />
              Tải lại
            </button>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-on-primary shadow-sm"
            >
              <CreditCard aria-hidden="true" size={20} />
              Thêm tài khoản
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <BankAccountStatCard icon={Landmark} label="Tổng tài khoản" value={String(stats.total)} />
          <BankAccountStatCard icon={CircleCheckBig} label="Đang hoạt động" value={String(stats.active)} />
          <BankAccountStatCard icon={Star} label="Mặc định" value={stats.defaultAccount?.bankCode || '-'} />
        </div>

        {(notice || error) && (
          <div className={`rounded-xl px-4 py-3 ${error ? 'bg-error/10 text-error' : 'bg-success-container text-on-success-container'}`}>
            {error || notice}
          </div>
        )}

        <section className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-5 shadow-sm">
          <div className="mb-5 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-title-lg font-bold text-on-surface">Danh sách tài khoản</h2>
              <p className="text-sm text-on-surface-variant">Tài khoản mặc định sẽ được dùng khi rút tiền nếu không chọn tài khoản cụ thể.</p>
            </div>
            {stats.inactive > 0 && (
              <span className="inline-flex w-fit rounded-full bg-warning-container px-3 py-1 text-xs font-semibold text-on-warning-container">
                {stats.inactive} tài khoản tạm ngưng
              </span>
            )}
          </div>

          <AsyncState
            loading={loading}
            error={error && !items.length ? error : ''}
            empty={!items.length}
            emptyMessage="Chưa có tài khoản ngân hàng."
            onRetry={load}
          >
            <BankAccountTable
              items={items}
              onEdit={openEdit}
              onSetDefault={setDefaultTarget}
              onDelete={setDeleteTarget}
            />
          </AsyncState>
        </section>
      </div>

      <BankAccountFormModal
        open={Boolean(modalMode)}
        mode={modalMode || 'create'}
        form={form}
        busy={busy}
        onChange={setForm}
        onClose={() => setModalMode(null)}
        onSubmit={save}
      />
      <ConfirmDialog
        open={Boolean(defaultTarget)}
        title="Đặt tài khoản mặc định"
        message={`Bạn có chắc chắn muốn đặt ${defaultTarget?.bankName || ''} - ${defaultTarget ? maskAccountNumber(defaultTarget.accountNumber) : ''} làm tài khoản mặc định?`}
        busy={busy}
        onCancel={() => setDefaultTarget(null)}
        onConfirm={confirmSetDefault}
      />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xóa tài khoản ngân hàng"
        message={`Bạn có chắc chắn muốn xóa tài khoản ${deleteTarget?.bankName || ''} - ${deleteTarget ? maskAccountNumber(deleteTarget.accountNumber) : ''}?`}
        busy={busy}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </DashboardShell>
  );
}
