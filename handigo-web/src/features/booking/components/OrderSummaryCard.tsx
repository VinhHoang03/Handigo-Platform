import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { selectedServiceImage } from '../constants/bookingImages';
import { useBookingStore } from '../hooks/useBookingStore';
import { serviceCatalogApi } from '@/features/customer-service/api/serviceCatalog.api';
import type { Service, ServiceOption } from '../../../types/booking';
import { OrderSummaryPriceDetails } from './OrderSummaryPriceDetails';
import { OrderSummaryActions } from './OrderSummaryActions';

const getOptionPrice = (option: ServiceOption) => option.price ?? option.fixedPrice ?? 0;

export const OrderSummaryCard: React.FC<{
  step: 1 | 2 | 3;
  actionLabel: string;
  actionTo?: string;
  onAction?: () => void;
  isLoading?: boolean;
  summaryContent?: React.ReactNode;
  discountAmount?: number;
}> = ({
  step,
  actionLabel,
  actionTo,
  onAction,
  isLoading,
  summaryContent,
  discountAmount = 0,
}) => {
  const {
    categoryId,
    serviceId,
    selectedOptionIds,
    selectedOptionQuantities,
    orderType,
    scheduledAt,
    preferredProviderName,
  } = useBookingStore();
  const [service, setService] = useState<Service | null>(null);
  const [options, setOptions] = useState<ServiceOption[]>([]);
  const navigate = useNavigate();

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

  const selectedOptions = options.filter(opt => selectedOptionIds.includes(opt._id));

  const calculateTotal = () => {
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

  const total = calculateTotal();
  const finalTotal = Math.max(total - discountAmount, 0);

  const handleAction = () => {
    if (onAction) {
      onAction();
    } else if (actionTo) {
      navigate(actionTo);
    }
  };

  return (
    <aside className="space-y-md lg:sticky lg:top-24">
      <div className="bg-surface-container-lowest rounded-3xl p-md shadow-lg border border-outline-variant/30">
        <h3 className="font-headline-md text-headline-md text-primary mb-md">Tóm tắt đơn hàng</h3>

        <div className="space-y-md">
          <div className="flex gap-sm p-sm bg-surface-container-low rounded-2xl">
            <img
              className="w-16 h-16 rounded-xl object-cover"
              src={service?.image || selectedServiceImage}
              alt={service?.name || 'Dịch vụ'}
            />
            <div>
              <p className="font-bold">{service?.name || 'Chưa chọn dịch vụ'}</p>
              <p className="text-xs text-on-surface-variant truncate max-w-[150px]">
                {service?.description || 'Vui lòng chọn dịch vụ'}
              </p>
              <p className="text-sm font-bold text-primary mt-1">
                {service?.serviceType === 'fixed_price'
                  ? 'Giá theo tùy chọn'
                  : service?.serviceType === 'variable_price'
                    ? `Phí cọc: ${(service.depositAmount || 0).toLocaleString()}đ`
                    : '0đ'}
              </p>
            </div>
          </div>

          {step >= 2 && orderType !== 'normal' && (
            <div className="space-y-sm border-t border-dashed border-outline-variant pt-md text-sm">
              <div className="flex items-start gap-sm">
                <span aria-hidden="true" className="material-symbols-outlined text-[19px] text-primary">calendar_today</span>
                <div>
                  <p className="text-xs text-on-surface-variant">Lịch thực hiện</p>
                  <p className="font-bold text-on-surface">
                    {scheduledAt?.includes('T')
                      ? new Date(scheduledAt).toLocaleString('vi-VN')
                      : 'Chưa chọn đủ ngày giờ'}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-sm">
                <span aria-hidden="true" className="material-symbols-outlined text-[19px] text-primary">person</span>
                <div>
                  <p className="text-xs text-on-surface-variant">Chuyên gia</p>
                  <p className="font-bold text-on-surface">
                    {preferredProviderName || 'Handigo tự điều phối'}
                  </p>
                </div>
              </div>
            </div>
          )}

          <OrderSummaryPriceDetails
            service={service}
            selectedOptions={selectedOptions}
            selectedOptionQuantities={selectedOptionQuantities}
            total={total}
            finalTotal={finalTotal}
            discountAmount={discountAmount}
            summaryContent={summaryContent}
          />
        </div>

        <OrderSummaryActions
          step={step}
          orderType={orderType}
          actionLabel={actionLabel}
          isLoading={isLoading}
          disableAction={Boolean(isLoading || (step === 1 && !serviceId))}
          onBack={() => navigate(-1)}
          onAction={handleAction}
        />
      </div>
    </aside>
  );
};
