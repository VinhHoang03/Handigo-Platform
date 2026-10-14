import React, { useEffect, useState } from 'react';
import { isAirConditionerCleaning } from '@/utils/airConditionerCleaning';
import { useNavigate } from 'react-router-dom';
import { ReliableImage } from '@/components/common/ReliableImage';
import { useBookingStore } from '../hooks/useBookingStore';
import { serviceCatalogApi } from '@/features/customer-service/api/serviceCatalog.api';
import type { Service, ServiceOption } from '../../../types/booking';
import { OrderSummaryPriceDetails } from './OrderSummaryPriceDetails';
import { OrderSummaryActions } from './OrderSummaryActions';
import { useBookingPreview } from '../hooks/useBookingPreview';
import type { BookingPreview } from '../api/booking.api';

const getOptionPrice = (option: ServiceOption) => option.price ?? option.fixedPrice ?? 0;

export const OrderSummaryCard: React.FC<{
  step: 1 | 2 | 3;
  actionLabel: string;
  actionTo?: string;
  onAction?: () => void;
  isLoading?: boolean;
  summaryContent?: React.ReactNode;
  scheduleContent?: React.ReactNode;
  providerContent?: React.ReactNode;
  discountAmount?: number;
  voucherCode?: string;
  priceSnapshot?: Pick<BookingPreview, 'bookingAmount' | 'discountedAmount' | 'promotionDiscountAmount' | 'voucherDiscountAmount' | 'depositAmount'>;
  skipPricePreview?: boolean;
}> = ({
  step,
  actionLabel,
  actionTo,
  onAction,
  isLoading,
  summaryContent,
  scheduleContent,
  providerContent,
  discountAmount = 0,
  voucherCode,
  priceSnapshot,
  skipPricePreview = false,
}) => {
  const {
    categoryId,
    serviceId,
    selectedOptionIds,
    selectedOptionQuantities,
    uniformQuantity,
    orderType,
  } = useBookingStore();
  const [service, setService] = useState<Service | null>(null);
  const [options, setOptions] = useState<ServiceOption[]>([]);
  const navigate = useNavigate();
  const { preview, loading: priceLoading, error: priceError, retry } = useBookingPreview(voucherCode, !skipPricePreview);
  const effectivePreview = priceSnapshot ?? preview;

  useEffect(() => {
    let isMounted = true;
    if (serviceId) {
      serviceCatalogApi.servicesByCategory(categoryId || '').then(services => {
        if (!isMounted) return;
        const found = services.find(s => s._id === serviceId);
        if (found) setService(found);
      });

      serviceCatalogApi.options(serviceId).then(data => {
        if (isMounted) setOptions(data);
      });
    } else {
      setTimeout(() => {
        if (isMounted) {
          setService(null);
          setOptions([]);
        }
      }, 0);
    }
    return () => { isMounted = false; };
  }, [serviceId, categoryId]);

  const isCleaning = isAirConditionerCleaning(service) && options.length === 0;
  const selectedOptions = options.filter(opt => !isCleaning && selectedOptionIds.includes(opt._id));

  const calculateTotal = () => {
    if (isCleaning) return (service?.fixedPrice || 0) * uniformQuantity;
    let total = 0;
    if (service?.serviceType === 'fixed_price') {
      total = 0;
    } else if (service?.serviceType === 'variable_price') {
      total = service?.depositAmount || 0;
    }
    if (service?.serviceType !== 'variable_price') {
      selectedOptions.forEach(opt => {
        total += getOptionPrice(opt) * (selectedOptionQuantities?.[opt._id] ?? 1);
      });
    }
    return total;
  };

  const total = effectivePreview?.bookingAmount ?? calculateTotal();
  const effectiveDiscount = effectivePreview ? effectivePreview.promotionDiscountAmount + effectivePreview.voucherDiscountAmount : discountAmount;
  const finalTotal = effectivePreview?.discountedAmount ?? Math.max(total - Math.min(discountAmount, total), 0);

  const handleAction = () => {
    if (onAction) {
      onAction();
    } else if (actionTo) {
      navigate(actionTo);
    }
  };

  return (
    <aside className="space-y-md lg:sticky lg:top-24 lg:self-start lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto">
      <div className="bg-surface-container-lowest rounded-3xl p-md shadow-lg border border-outline-variant/30">
        <h3 className="font-headline-md text-headline-md text-primary mb-md">Tóm tắt đơn hàng</h3>

        <div className="space-y-md">
          <div className="flex gap-sm p-sm bg-surface-container-low rounded-2xl">
            <ReliableImage
              className="w-24 aspect-video shrink-0 rounded-xl object-contain"
              src={service?.coverImage === undefined ? service?.image : service.coverImage}
              alt={service?.name || 'Dịch vụ'}
            />
            <div>
              <p className="font-bold">{service?.name || 'Chưa chọn dịch vụ'}</p>
              <p className="text-xs text-on-surface-variant truncate max-w-[150px]">
                {service?.description || 'Vui lòng chọn dịch vụ'}
              </p>
              {!isCleaning && <p className="text-sm font-bold text-primary mt-1">
                {service?.serviceType === 'fixed_price'
                  ? 'Giá theo tùy chọn'
                  : service?.serviceType === 'variable_price'
                    ? `Phí cọc: ${(effectivePreview?.depositAmount ?? service.depositAmount ?? 0).toLocaleString()}đ`
                    : '0đ'}
              </p>}
            </div>
          </div>

          {step === 2 && scheduleContent}
          {step === 2 && providerContent}

          <OrderSummaryPriceDetails
            service={service}
            selectedOptions={selectedOptions}
            selectedOptionQuantities={selectedOptionQuantities}
            total={total}
            finalTotal={finalTotal}
            discountAmount={effectiveDiscount}
            summaryContent={summaryContent}
          />
          {priceLoading && <p role="status" className="text-sm">Đang cập nhật giá…</p>}
          {priceError && <p role="alert" className="text-sm text-error">{priceError} <button type="button" onClick={retry} className="underline">Thử lại</button></p>}
        </div>

        <OrderSummaryActions
          step={step}
          orderType={orderType}
          actionLabel={actionLabel}
          isLoading={isLoading}
          disableAction={Boolean(isLoading || priceLoading || priceError || !effectivePreview || (step === 1 && !serviceId))}
          onBack={() => navigate(-1)}
          onAction={handleAction}
        />
      </div>
    </aside>
  );
};
