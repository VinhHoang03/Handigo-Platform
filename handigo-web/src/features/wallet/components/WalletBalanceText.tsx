import { useEffect, useState } from "react";
import { walletApi } from "../api/wallet.api";

const money = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

export function WalletBalanceText() {
  const [balance, setBalance] = useState<number | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isMounted = true;

    walletApi
      .getMine()
      .then((wallet) => {
        if (isMounted) setBalance(wallet.balance);
      })
      .catch(() => {
        if (isMounted) setHasError(true);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (hasError) {
    return <span className="block text-xs text-error">Không thể tải số dư ví.</span>;
  }

  return (
    <span className="block text-xs font-medium text-primary">
      {balance === null
        ? "Đang tải số dư..."
        : `Số dư hiện tại: ${money.format(balance)}`}
    </span>
  );
}
