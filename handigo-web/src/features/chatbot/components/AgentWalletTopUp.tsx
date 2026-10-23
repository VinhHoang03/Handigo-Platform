import { useEffect, useState } from "react";
import { useToastFeedback } from "@/components/common/Toast";
import { walletApi } from "@/features/wallet/api/wallet.api";
import { WalletAmountModal } from "@/features/wallet/components/WalletAmountModal";
import { useWalletAmountForms } from "@/features/wallet/components/useWalletAmountForms";
import { getErrorMessage } from "@/utils/apiError";
import { saveAgentWalletResume } from "../utils/agentWalletResume";

export function AgentWalletTopUp({ userId, sessionId, orderId, orderCode, onClose }: {
  userId: string; sessionId: string; orderId?: string; orderCode?: string; onClose: () => void;
}) {
  const [balance, setBalance] = useState<number>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useToastFeedback<string>("", "error");
  const [, setNotice] = useToastFeedback<string>("", "success");
  const loadWallet = async () => {
    try { const wallet = await walletApi.getMine(); setBalance(wallet.balance); }
    catch (failure) { setError(getErrorMessage(failure, "Chưa cập nhật được số dư. Bạn có thể kiểm tra lại sau khi nạp ví.")); }
  };
  const forms = useWalletAmountForms({ isProvider: false, walletBalance: balance, refreshAll: loadWallet,
    setError, setNotice,
    onDepositCreated: (result) => {
      const depositOrderCode = result.transaction.gatewayOrderCode || result.transaction.transactionCode;
      if (!depositOrderCode) throw new Error("Chưa nhận được mã giao dịch nạp ví. Vui lòng kiểm tra trong Ví Handigo.");
      try { saveAgentWalletResume(userId, { sessionId, orderId, orderCode, depositOrderCode, createdAt: Date.now() }); }
      catch { throw new Error("Trình duyệt chưa cho lưu thông tin quay lại đơn. Vui lòng mở Ví Handigo để tiếp tục giao dịch nạp ví đã tạo."); }
    },
  });
  useEffect(() => {
    let active = true;
    walletApi.getMine().then((wallet) => { if (active) setBalance(wallet.balance); })
      .catch((failure: unknown) => { if (active) setError(getErrorMessage(failure, "Chưa tải được số dư. Đóng và mở lại để thử lại.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [setError]);

  return <WalletAmountModal open title={orderCode ? `Nạp ví cho đơn ${orderCode}` : "Nạp ví để tiếp tục đặt dịch vụ"}
    amount={forms.depositAmount} busy={forms.busy || loading} maxAmount={balance}
    submitLabel="Nạp tiền qua PayOS" helper={loading ? "Đang kiểm tra số dư ví…"
      : "Bạn sẽ chuyển sang PayOS để nạp ví. Khi quay lại, trợ lý mở đúng cuộc trò chuyện để bạn kiểm tra số dư và tiếp tục đơn; chưa tự thanh toán dịch vụ."}
    error={forms.depositError || error} onAmountChange={forms.changeDepositAmount}
    onClose={() => { if (!forms.busy) onClose(); }} onSubmit={(event) => void forms.submitDeposit(event)} />;
}
