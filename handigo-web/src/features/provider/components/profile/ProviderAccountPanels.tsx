import React from "react";
import type { BankAccount } from "../../types/provider.types";

export const BankAccountPanel: React.FC<{ account: BankAccount }> = ({
  account,
}) => (
  <aside className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-6 shadow-sm">
    <div className="mb-4 flex items-center justify-between">
      <h3 className="font-bold">Tài khoản ngân hàng</h3>
      <button
        type="button"
        className="text-sm font-bold text-primary hover:underline"
      >
        Cập nhật
      </button>
    </div>
    <div className="flex items-center gap-4 rounded-xl border border-outline-variant/30 bg-surface-container-low p-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-outline-variant/20 bg-on-secondary font-black text-primary shadow-sm">
        {account.shortName}
      </div>
      <div>
        <p className="text-sm font-bold">{account.bankName}</p>
        <p className="text-sm text-on-surface-variant">
          {account.maskedNumber}
        </p>
      </div>
    </div>
  </aside>
);

export const AccountFunctionsPanel: React.FC<{
  onPasswordClick: () => void;
}> = ({ onPasswordClick }) => {
  const items = [
    {
      icon: "lock",
      label: "Mật khẩu và bảo mật",
      description: "Cập nhật mật khẩu đăng nhập.",
      onClick: onPasswordClick,
    },
    {
      icon: "shield",
      label: "Quyền riêng tư",
      description: "Tùy chọn quyền riêng tư sẽ được bổ sung.",
    },
    {
      icon: "more_horiz",
      label: "Các tùy chọn khác",
      description: "Khu vực cho thiết lập tài khoản.",
    },
  ];

  return (
    <aside className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-6 shadow-sm">
      <h3 className="mb-6 text-pretty font-headline-md text-headline-md text-on-surface">
        Chức năng tài khoản
      </h3>
      <div className="space-y-2">
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            className="group flex w-full items-center justify-between rounded-lg p-3 text-left transition-colors hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            onClick={item.onClick}
          >
            <span className="flex min-w-0 items-center gap-3">
              <span aria-hidden="true" className="material-symbols-outlined text-on-surface-variant transition-colors group-hover:text-primary">
                {item.icon}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{item.label}</span>
                <span className="mt-0.5 block text-xs text-on-surface-variant">
                  {item.description}
                </span>
              </span>
            </span>
            <span aria-hidden="true" className="material-symbols-outlined text-outline-variant">
              chevron_right
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
};
