import { InitialsAvatar } from "@/components/common/InitialsAvatar";
import { OrderChatButton } from "@/features/chat/components/OrderChatButton";
import type { ProviderInfo } from "./bookingDetailProvider";
import { Banknote, Hammer, type LucideIcon, MapPin, Phone, Star, UserSearch } from "lucide-react";
type ProviderDetailProps = {
  icon: LucideIcon;
  label: string;
  value: string;
};

const ProviderDetail = ({ icon: Icon, label, value }: ProviderDetailProps) => (
  <div className="flex min-w-0 items-start gap-2">
    <Icon aria-hidden="true" size={16} className="mt-0.5 text-primary" />
    <div className="min-w-0">
      <p className="text-xs text-on-surface-variant">{label}</p>
      <p className="break-words font-medium text-on-surface">{value}</p>
    </div>
  </div>
);

type BookingProviderCardProps = {
  providerInfo: ProviderInfo | null;
  orderId: string;
  orderStatus: string;
  hasSuccessfulPayment: boolean;
};

/** Thẻ "Chuyên gia thực hiện" ở cột phụ; lùi về trạng thái chờ điều phối khi chưa có provider. */
export const BookingProviderCard = ({
  providerInfo,
  orderId,
  orderStatus,
  hasSuccessfulPayment,
}: BookingProviderCardProps) => (
  <section className="overflow-hidden rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-md shadow-sm sm:p-lg">
    <div className="mb-md flex items-center justify-between gap-sm">
      <h3 className="font-label-sm text-label-sm font-bold uppercase tracking-wider text-on-surface-variant">
        Chuyên gia thực hiện
      </h3>
    </div>
    {providerInfo ? (
      <div className="space-y-md">
        <div className="flex items-center gap-md">
          <div className="shrink-0">
            <InitialsAvatar
              name={providerInfo.name}
              src={providerInfo.avatar}
              className="h-16 w-16 rounded-2xl border border-outline-variant/30 shadow-sm"
              rounded="rounded-2xl"
            />
          </div>
          <div className="min-w-0">
            <h4 className="truncate font-headline-sm text-headline-sm text-on-surface">
              {providerInfo.name}
            </h4>
            <div className="mt-1 flex flex-wrap items-center gap-x-1 text-tertiary">
              <Star aria-hidden="true" size={16} fill="currentColor" />
              <span className="font-bold text-label-md">
                {providerInfo.rating.toFixed(1)}
              </span>
              <span className="text-label-sm font-normal text-on-surface-variant">
                ({providerInfo.feedbacks} đánh giá)
              </span>
            </div>
          </div>
        </div>
        <div className="grid gap-2 rounded-2xl bg-surface-container-low p-sm text-sm">
          <ProviderDetail
            icon={Phone}
            label="Số điện thoại"
            value={providerInfo.phone || "Chưa cập nhật"}
          />
          <ProviderDetail
            icon={MapPin}
            label="Khu vực"
            value={providerInfo.area || "Chưa cập nhật"}
          />
          <ProviderDetail
            icon={Hammer}
            label="Kinh nghiệm"
            value={`${providerInfo.experienceYears} năm · ${providerInfo.completedOrders} đơn hoàn thành`}
          />
        </div>
        {["accepted", "in_progress"].includes(orderStatus) && (
          <OrderChatButton orderId={orderId} />
        )}
      </div>
    ) : (
      <div className="rounded-2xl bg-surface-container-low p-md text-center">
        <div className="mx-auto mb-sm grid h-11 w-11 place-items-center rounded-full bg-primary/10 text-primary">
          <span
            className={hasSuccessfulPayment ? "animate-pulse" : ""}
          >
            {hasSuccessfulPayment ? <UserSearch aria-hidden="true" size={24} /> : <Banknote aria-hidden="true" size={24} />}
          </span>
        </div>
        <p className="text-sm font-semibold leading-5 text-on-surface">
          {hasSuccessfulPayment
            ? "Bác thợ phù hợp nhất đang được điều phối đến bạn."
            : "Vui lòng thanh toán để hệ thống điều phối thợ."}
        </p>
      </div>
    )}
  </section>
);
