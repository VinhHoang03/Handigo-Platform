import type { ProviderAvailabilityStatus } from '@/features/customer-service/components/NearbyProviderSelector';
import { Step2OrderTypeSelector } from './Step2OrderTypeSelector';
import { Step2RecurrenceFieldset } from './Step2RecurrenceFieldset';
import { Step2DateFieldset } from './Step2DateFieldset';
import { Step2TimeSlotFieldset } from './Step2TimeSlotFieldset';
import { Step2RecurringPreview } from './Step2RecurringPreview';
import { Step2ProviderFieldset } from './Step2ProviderFieldset';
import type { RecurrenceCount } from './step2Helpers';

type OrderType = 'normal' | 'urgent' | 'scheduled' | 'recurring';
type RecurrenceUnit = 'weekly' | 'monthly';
interface UpcomingDate { value: string; weekday: string; day: string; month: string; }

interface Step2ScheduleSectionProps {
  orderType: OrderType;
  onChangeOrderType: (type: 'normal' | 'scheduled' | 'recurring') => void;
  scheduledAt: string;
  onSelectDate: (dateValue: string) => void;
  onSelectSlot: (startTime: string) => void;
  todayInputValue: string;
  upcomingDates: UpcomingDate[];
  currentTimestamp: number;
  scheduledAtError?: string;
  recurrenceUnit: RecurrenceUnit;
  onChangeRecurrenceUnit: (unit: RecurrenceUnit) => void;
  recurrenceCount: RecurrenceCount;
  onChangeRecurrenceCount: (count: RecurrenceCount) => void;
  recurrenceCountOptions: readonly RecurrenceCount[];
  recurringPreviewDates: Date[];
  serviceId?: string;
  addressId?: string;
  preferredProviderId?: string;
  requestedProviderId?: string;
  preferredProviderError?: string;
  onSelectProvider: (providerId?: string, providerName?: string) => void;
  onAvailabilityChange: (status: ProviderAvailabilityStatus) => void;
}

/** "Thời gian thực hiện": kiểu đặt lịch + (nếu hẹn giờ) chu kỳ, ngày, giờ, chuyên gia. */
export const Step2ScheduleSection = ({
  orderType, onChangeOrderType, scheduledAt, onSelectDate, onSelectSlot,
  todayInputValue, upcomingDates, currentTimestamp, scheduledAtError,
  recurrenceUnit, onChangeRecurrenceUnit, recurrenceCount, onChangeRecurrenceCount,
  recurrenceCountOptions, recurringPreviewDates,
  serviceId, addressId, preferredProviderId, requestedProviderId, preferredProviderError,
  onSelectProvider, onAvailabilityChange,
}: Step2ScheduleSectionProps) => {
  const shouldShowSchedulePicker = orderType !== 'normal';
  const recurrenceStepOffset = orderType === 'recurring' ? 1 : 0;

  return (
    <section className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-md shadow-sm">
      <h2 className="font-headline-sm text-headline-sm text-primary mb-sm">Thời gian thực hiện</h2>
      <Step2OrderTypeSelector orderType={orderType} onChange={onChangeOrderType} />

      {shouldShowSchedulePicker && (
        <div className="mt-md border-t border-outline-variant/30 pt-md">
          <div className="mb-md flex items-start gap-sm rounded-xl bg-primary-container/10 p-sm">
            <span aria-hidden="true" className="material-symbols-outlined text-primary">event_available</span>
            <div>
              <p className="text-sm font-bold text-on-surface">Đặt trước chuyên gia theo lịch của bạn</p>
              <p className="mt-1 text-xs leading-5 text-on-surface-variant">
                Chọn thời gian trước để Handigo chỉ hiển thị những chuyên gia còn lịch trống.
                Bạn chưa cần thanh toán ở bước này.
              </p>
            </div>
          </div>

          <div className="space-y-lg">
            {orderType === 'recurring' && (
              <Step2RecurrenceFieldset
                recurrenceUnit={recurrenceUnit}
                recurrenceCount={recurrenceCount}
                recurrenceCountOptions={recurrenceCountOptions}
                onChangeUnit={onChangeRecurrenceUnit}
                onChangeCount={onChangeRecurrenceCount}
              />
            )}

            <Step2DateFieldset
              stepNumber={1 + recurrenceStepOffset}
              scheduledAt={scheduledAt}
              todayInputValue={todayInputValue}
              upcomingDates={upcomingDates}
              onSelectDate={onSelectDate}
            />

            <Step2TimeSlotFieldset
              stepNumber={2 + recurrenceStepOffset}
              scheduledAt={scheduledAt}
              currentTimestamp={currentTimestamp}
              error={scheduledAtError}
              onSelectSlot={onSelectSlot}
            />

            {orderType === 'recurring' && <Step2RecurringPreview dates={recurringPreviewDates} />}

            <Step2ProviderFieldset
              stepNumber={3 + recurrenceStepOffset}
              serviceId={serviceId}
              addressId={addressId}
              scheduledAt={scheduledAt?.includes('T') ? scheduledAt : undefined}
              recurrenceUnit={orderType === 'recurring' ? recurrenceUnit : undefined}
              recurrenceCount={orderType === 'recurring' ? recurrenceCount : undefined}
              requireSelection
              preferredProviderId={preferredProviderId}
              requestedProviderId={requestedProviderId}
              error={preferredProviderError}
              onSelectProvider={onSelectProvider}
              onAvailabilityChange={onAvailabilityChange}
            />
          </div>
        </div>
      )}

      {!shouldShowSchedulePicker && (
        <Step2ProviderFieldset
          serviceId={serviceId}
          addressId={addressId}
          preferredProviderId={preferredProviderId}
          requestedProviderId={requestedProviderId}
          onSelectProvider={onSelectProvider}
          onAvailabilityChange={onAvailabilityChange}
        />
      )}
    </section>
  );
};
