import { useEffect, useState } from 'react';
import { promotionApi, type AutomaticPromotion } from '@/features/admin/api/promotion.api';

export function PromotionBanner({ serviceId }: { serviceId?: string }) {
  const [items, setItems] = useState<AutomaticPromotion[]>([]);
  useEffect(() => {
    let active = true;
    const refresh = () => { void promotionApi.active().then(rows => { if (active) setItems(rows); }).catch(() => { if (active) setItems([]); }); };
    refresh();
    const timer = window.setInterval(refresh, 60000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);
  useEffect(() => {
    const ending = Math.min(...items.map(item => Date.parse(item.endAt)));
    if (!Number.isFinite(ending)) return;
    const timer = window.setTimeout(() => setItems(current => current.filter(item => Date.parse(item.endAt) > Date.now())), Math.min(Math.max(ending - Date.now(), 0) + 1, 2147483647));
    return () => window.clearTimeout(timer);
  }, [items]);
  const promotion = items.find(item => !serviceId || item.serviceIds.length === 0 || item.serviceIds.includes(serviceId));
  if (!promotion) return null;
  return <aside className="rounded-2xl bg-primary p-5 text-on-primary"><p className="text-xs font-semibold">Ưu đãi đang diễn ra · Tự động áp dụng khi đủ điều kiện</p><h2 className="mt-2 text-xl font-bold">{promotion.name}</h2><p>{promotion.description}</p><p className="mt-2 font-semibold">Giảm {promotion.discountType === 'PERCENT' ? `${promotion.discountValue}%` : `${promotion.discountValue.toLocaleString('vi-VN')} đ`}{promotion.minOrderAmount ? ` cho đơn từ ${promotion.minOrderAmount.toLocaleString('vi-VN')} đ` : ''}</p></aside>;
}
