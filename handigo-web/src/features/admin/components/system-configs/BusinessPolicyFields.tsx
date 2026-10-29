import { defaultRefundPolicy, defaultRewardPolicy, refundPolicyFields, rewardPolicyFields } from './business-policies';

export function BusinessPolicyFields({ configKey, value, onChange }: {
  configKey: 'REFUND_POLICY' | 'REWARD_POLICY';
  value: string;
  onChange: (value: string) => void;
}) {
  const isRefund = configKey === 'REFUND_POLICY';
  const policy: Record<string, number> = {
    ...(isRefund ? defaultRefundPolicy : defaultRewardPolicy), ...JSON.parse(value),
  };
  const fields = isRefund ? refundPolicyFields : rewardPolicyFields;
  return <div className="space-y-4">
    <p className="text-sm text-on-surface-variant">{isRefund
      ? 'Thợ đã xác nhận đến nơi rồi hủy trước khi làm việc, với mọi lý do: thợ nhận 5.000đ vào ví, tiền đã trả/cọc trừ 5.000đ được hoàn về ví khách và không tìm thợ thay thế. Tiền mặt chưa thu do Handigo hỗ trợ 5.000đ. Quy tắc cố định này không phụ thuộc các tỷ lệ bên dưới. Thợ chưa đến nơi và chưa báo giá hủy thì giữ luồng tìm thợ thay thế; khách hủy trong thời hạn cho phép được hoàn 100% về ví.'
      : 'Điểm được làm tròn xuống theo từng đơn hoàn thành, đã thanh toán đủ. Hạn dùng áp dụng cho mã đổi mới; mã đã cấp giữ nguyên ngày hết hạn.'}</p>
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.map(([key, label, min, max]) => <label key={key} className="block space-y-1 text-sm font-medium text-on-surface">
        <span>{label}</span>
        <input type="number" required min={min} max={max} step={isRefund ? 'any' : 1}
          value={policy[key]} onChange={(event) => onChange(JSON.stringify({ ...policy, [key]: Number(event.target.value) }, null, 2))}
          className="w-full rounded-xl border border-outline-variant bg-surface px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/30" />
      </label>)}
    </div>
  </div>;
}
