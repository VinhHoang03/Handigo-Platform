import React from "react";
import type { VerificationItem } from "../../types/provider.types";

type VerificationPanelItem = VerificationItem & {
  onClick?: () => void;
};

function VerificationRow({ item }: { item: VerificationPanelItem }) {
  const isRejected = item.statusTone === "rejected";
  const isPending = item.statusTone === "pending";
  const icon = isRejected ? "cancel" : isPending ? "pending" : "check_circle";
  const iconClass = isRejected
    ? "text-error"
    : isPending
      ? "text-primary"
      : "text-secondary";
  const content = (
    <>
      <span
        aria-hidden="true"
        className={`material-symbols-outlined ${iconClass}`}
        style={{ fontVariationSettings: "'FILL' 1" }}
      >
        {icon}
      </span>
      <span className="flex-1">
        <span className="block text-sm font-bold">{item.label}</span>
        <span
          className={`block text-[10px] uppercase ${
            isRejected
              ? "font-bold text-error"
              : isPending
                ? "font-bold text-primary"
                : "text-on-surface-variant"
          }`}
        >
          {item.status}
        </span>
      </span>
      {item.onClick && (
        <span aria-hidden="true" className="material-symbols-outlined text-outline-variant">
          chevron_right
        </span>
      )}
    </>
  );

  const className = `flex w-full items-center gap-3 rounded-xl bg-surface-container-low p-3 text-left transition ${
    isPending ? "border-2 border-primary/20" : "border border-transparent"
  } ${item.onClick ? "hover:border-primary/30 hover:bg-surface-container" : ""}`;

  if (item.onClick) {
    return (
      <button type="button" className={className} onClick={item.onClick}>
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}

export const VerificationPanel: React.FC<{
  items: VerificationPanelItem[];
}> = ({ items }) => (
  <aside className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-6 shadow-sm">
    <h3 className="mb-6 text-pretty font-headline-md text-headline-md text-on-surface">
      Xác thực tài khoản
    </h3>
    <div className="space-y-4">
      {items.map((item) => (
        <VerificationRow key={item.label} item={item} />
      ))}
    </div>
  </aside>
);
