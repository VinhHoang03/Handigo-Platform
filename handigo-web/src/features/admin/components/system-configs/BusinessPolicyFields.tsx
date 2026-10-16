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
      ? 'Các tỷ lệ dưới đây áp dụng cho đơn giá cố định. Với đơn báo giá: khách hủy khi đã có thợ nhận hoặc khách/thợ hủy sau báo giá thì cọc chuyển vào ví thợ. Thợ hủy trước báo giá sẽ tự tìm thợ thay thế; nếu không tìm được thì khách được hoàn 100% cọc.'
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
