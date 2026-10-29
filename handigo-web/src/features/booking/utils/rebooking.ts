import type { Address, BookingState, Order, Service, ServiceOption } from '@/types/booking';
import { toggleServiceOption } from './serviceOptionSelection';
import { getCategoryId } from '@/features/customer-service/utils/serviceDisplay';

export const canRebook = (status?: string) => status === 'completed' || status === 'cancelled';

export type RebookingDraft = ReturnType<typeof prepareRebooking> & Pick<BookingState,
  'scheduledAt' | 'problemDescription' | 'preferredProviderId' | 'preferredProviderName' | 'voucherCode'>;

export interface PreparedRebooking {
  order: Order;
  service: Service;
  options: ServiceOption[];
  addresses: Address[];
  draft: RebookingDraft;
  session: number;
  restoredAfterPayment?: boolean;
}

/** Chỉ lấy thông tin còn hợp lệ; giá và quyền tạo đơn do luồng đặt mới kiểm tra lại. */
export function prepareRebooking(order: Order, service: Service, options: ServiceOption[], addresses: Address[]) {
  if (!canRebook(order.status)) throw new Error('Chỉ có thể đặt lại đơn đã hoàn thành hoặc đã hủy.');
  if (service._id !== order.serviceId?._id || !service.isActive) {
    throw new Error('Dịch vụ này đã ngừng hoạt động. Vui lòng chọn dịch vụ khác.');
  }
  const notices: string[] = [];
  const activeOptions = options.filter(option => option.isActive);
  const snapshots = order.selectedOptionsSnapshot ?? [];
  let selectedOptionIds: string[] = [];
  const selectedOptionQuantities: Record<string, number> = {};
  const oldIds = [...new Set([...order.selectedOptionIds, ...snapshots.flatMap(item => item.optionId ? [item.optionId] : [])])];
  for (const id of oldIds) {
    const option = activeOptions.find(item => item._id === id);
    if (!option) { notices.push('Một số tùy chọn cũ đã ngừng hoạt động. Vui lòng kiểm tra và chọn lại.'); continue; }
    const snapshot = snapshots.find(item => item.optionId === id);
    const quantity = snapshot?.quantity ?? 1;
    selectedOptionIds = toggleServiceOption(selectedOptionIds, option, activeOptions);
    selectedOptionQuantities[id] = option.allowsQuantity ? Math.min(99, Math.max(1, Math.trunc(quantity) || 1)) : 1;
    if (snapshot && (snapshot.price !== option.price || quantity !== selectedOptionQuantities[id])) {
      notices.push('Giá hoặc số lượng được phép của tùy chọn đã thay đổi. Vui lòng kiểm tra thông tin mới.');
    }
  }
  if (oldIds.filter(id => activeOptions.some(option => option._id === id)).length !== selectedOptionIds.length) {
    notices.push('Quy tắc chọn tùy chọn đã thay đổi. Vui lòng kiểm tra lại các nhóm dịch vụ.');
  }
  const uniformSnapshot = snapshots.find(item => item.optionId === null);
  const uniformQuantity = activeOptions.length === 0 && uniformSnapshot
    ? Math.min(99, Math.max(1, Math.trunc(uniformSnapshot.quantity ?? 1) || 1)) : 1;
  if (uniformSnapshot && (activeOptions.length > 0 || uniformSnapshot.price !== service.fixedPrice)) {
    notices.push('Cách tính giá dịch vụ đã thay đổi. Vui lòng kiểm tra giá và tùy chọn hiện tại.');
  }
  const address = addresses.find(item => item._id === order.addressId?._id);
  const oldAddress = order.addressSnapshot ?? order.addressId;
  const sameAddress = address && oldAddress && (['fullAddress', 'detailAddress', 'province', 'ward', 'recipientName', 'recipientPhone', 'latitude', 'longitude'] as const)
    .every(field => !(field in oldAddress) || (address[field] ?? '') === (oldAddress[field] ?? ''));
  if (!sameAddress) notices.push('Địa chỉ cũ đã thay đổi hoặc không còn trong sổ địa chỉ. Vui lòng chọn lại địa chỉ.');
  const draft: Pick<BookingState, 'categoryId' | 'serviceId' | 'selectedOptionIds' | 'selectedOptionQuantities' | 'uniformQuantity' | 'addressId' | 'paymentMethod' | 'orderType' | 'rebookSource'> = {
    categoryId: getCategoryId(service),
    serviceId: service._id,
    selectedOptionIds,
    selectedOptionQuantities: Object.fromEntries(selectedOptionIds.map(id => [id, selectedOptionQuantities[id]])),
    uniformQuantity,
    addressId: sameAddress ? address._id : undefined,
    paymentMethod: order.paymentMethod,
    orderType: 'scheduled',
    rebookSource: { orderId: order._id, orderCode: order.orderCode, notices: [...new Set(notices)] },
  };
  return draft;
}
