import { useRef, useState } from 'react';
import { ClockAlert } from 'lucide-react';
import { BookingDateTimeDialog } from './BookingDateTimeDialog';
import { Step2OrderTypeSelector } from './Step2OrderTypeSelector';

type OrderType = 'normal' | 'urgent' | 'scheduled' | 'recurring';
type SelectableOrderType = 'normal' | 'scheduled';
interface UpcomingDate { value: string; weekday: string; day: string; month: string; }

interface Step2ScheduleSectionProps {
  orderType: OrderType;
  onChangeOrderType: (type: SelectableOrderType) => void;
  scheduledAt: string;
  onSelectSlot: (startTime: string, dateValue: string) => void;
  upcomingDates: UpcomingDate[];
  currentTimestamp: number;
  scheduledAtError?: string;
  isImmediateBookingAvailable: boolean;
}

export const Step2ScheduleSection = ({
  orderType, onChangeOrderType, scheduledAt, onSelectSlot,
  upcomingDates, currentTimestamp, scheduledAtError,
  isImmediateBookingAvailable,
}: Step2ScheduleSectionProps) => {
  const isScheduled = orderType === 'scheduled' || orderType === 'recurring';
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const scheduleTriggerRef = useRef<HTMLDivElement>(null);

  const closeDialog = () => {
    setIsDialogOpen(false);
  };

  return (
    <section aria-labelledby="booking-schedule-title" className="space-y-sm">
      <h4 id="booking-schedule-title" className="text-sm font-bold text-on-surface">Thời gian thực hiện</h4>
      <div ref={scheduleTriggerRef}>
        <Step2OrderTypeSelector
        orderType={orderType}
        scheduledAt={scheduledAt}
        isDialogOpen={isDialogOpen}
        onChange={() => {
          setIsDialogOpen((open) => !open);
        }}
        />
      </div>

      {!isDialogOpen && !isScheduled && !isImmediateBookingAvailable && (
        <div role="status" className="flex items-start gap-sm rounded-xl border border-error/20 bg-error/5 p-sm">
          <ClockAlert aria-hidden="true" size={20} className="mt-0.5 shrink-0 text-error" />
          <div>
            <p className="text-sm font-semibold text-on-surface">Đã ngoài khung giờ đặt ngay</p>
            <p className="mt-1 text-xs leading-5 text-on-surface-variant">
              Đặt ngay chỉ khả dụng từ 08:00 đến 21:00. Nhấn Hẹn giờ để chọn ngày và khung giờ phù hợp.
            </p>
          </div>
        </div>
      )}

      {isDialogOpen && (
        <BookingDateTimeDialog
          anchorRef={scheduleTriggerRef}
          scheduledAt={scheduledAt}
          upcomingDates={upcomingDates}
          currentTimestamp={currentTimestamp}
          error={scheduledAtError}
          onCancel={closeDialog}
          onImmediate={() => {
            onChangeOrderType('normal');
            closeDialog();
          }}
          onConfirm={(dateValue, startTime) => {
            onChangeOrderType('scheduled');
            onSelectSlot(startTime, dateValue);
            setIsDialogOpen(false);
          }}
        />
      )}
    </section>
  );
};
