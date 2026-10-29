import { Banknote, CreditCard, Wallet } from 'lucide-react';
import { chartMoney } from '@/components/common/chart';
import type { AdminRevenueInsights } from '../../types/adminRevenue.types';
import { PAYMENT_METHOD_LABELS } from '../payments/payment-constants';

export function RevenuePaymentChannels({ channels, onSelect, selectedMethod, showHeading = true }: { channels: AdminRevenueInsights['channels']; onSelect: (method: string) => void; selectedMethod?: string; showHeading?: boolean }) {
  return <section aria-label="Các kênh thanh toán" aria-labelledby={showHeading ? 'revenue-channels-title' : undefined} className="space-y-3">
    {showHeading && <h3 id="revenue-channels-title" className="text-title-lg font-bold">Dòng tiền theo kênh thanh toán</h3>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {channels.map(channel => {
        const Icon = channel.method === 'wallet' ? Wallet : channel.method === 'cash' ? Banknote : CreditCard;
        const label = PAYMENT_METHOD_LABELS[channel.method as keyof typeof PAYMENT_METHOD_LABELS] || channel.method;
        return <button key={channel.method} type="button" aria-pressed={selectedMethod === channel.method} onClick={() => onSelect(channel.method)}
          className={`rounded-2xl border bg-surface-container-lowest p-4 text-left transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-primary ${selectedMethod === channel.method ? 'border-primary' : 'border-outline-variant/40'}`}>
          <span className="flex items-center justify-between gap-2"><span className="flex items-center gap-2 text-sm font-medium"><Icon size={17} aria-hidden="true" className="text-primary" />{label}</span><span className="rounded-full bg-primary/5 px-2 py-0.5 text-xs text-primary">{channel.share.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%</span></span>
          <strong className="mt-3 block text-right text-xl">{chartMoney.format(channel.collected)}</strong>
          <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-surface-container-high"><span className={`block h-full rounded-full ${channel.method === 'cash' ? 'bg-amber-500' : channel.method === 'wallet' ? 'bg-emerald-500' : 'bg-primary'}`} style={{ width: `${Math.min(100, channel.share)}%` }} /></span>
          <span className="mt-3 flex justify-between gap-2 text-xs text-on-surface-variant"><span>{channel.count} khoản đã thu</span><span>Hoàn: {chartMoney.format(channel.refunded)}</span></span>
          <span className="mt-2 flex justify-between gap-2 border-t border-outline-variant/30 pt-2 text-xs"><span>Thu ròng</span><span className="font-bold">{chartMoney.format(channel.net)}</span></span>
          <span className="mt-3 block text-xs text-primary">Xem giao dịch →</span>
        </button>;
      })}
    </div>
  </section>;
}
