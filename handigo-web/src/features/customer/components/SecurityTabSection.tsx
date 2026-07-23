import { AccountActionRow } from "./AccountActionRow";

interface SecurityTabSectionProps {
  onPasswordClick: () => void;
}

export function SecurityTabSection({ onPasswordClick }: SecurityTabSectionProps) {
  return (
    <section className="rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-sm md:p-8">
      <h3 className="mb-5 font-headline-md text-headline-md text-on-surface">
        Chức năng tài khoản
      </h3>
      <div className="space-y-3">
        <AccountActionRow
          icon="lock"
          title="Mật khẩu và bảo mật"
          description="Cập nhật mật khẩu để bảo vệ tài khoản."
          onClick={onPasswordClick}
        />
        <AccountActionRow
          icon="shield"
          title="Quyền riêng tư"
          description="Các tùy chọn quyền riêng tư sẽ được bổ sung."
        />
        <AccountActionRow
          icon="more_horiz"
          title="Các tùy chọn khác"
          description="Khu vực cho các thiết lập tài khoản khác."
        />
      </div>
    </section>
  );
}
