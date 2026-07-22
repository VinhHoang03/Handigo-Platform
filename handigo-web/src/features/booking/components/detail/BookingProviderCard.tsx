import { InitialsAvatar } from "@/components/common/InitialsAvatar";
import { OrderChatButton } from "@/features/chat/components/OrderChatButton";
import type { ProviderInfo } from "./bookingDetailProvider";

type ProviderDetailProps = {
  icon: string;
  label: string;
  value: string;
};

const ProviderDetail = ({ icon, label, value }: ProviderDetailProps) => (
  <div className="flex min-w-0 items-start gap-2">
    <span className="material-symbols-outlined mt-0.5 text-base text-primary">
      {icon}
    </span>
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
              <span
                className="material-symbols-outlined text-[16px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                star
              </span>
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
            icon="phone"
            label="Số điện thoại"
            value={providerInfo.phone || "Chưa cập nhật"}
          />
          <ProviderDetail
            icon="location_on"
            label="Khu vực"
            value={providerInfo.area || "Chưa cập nhật"}
          />
          <ProviderDetail
            icon="handyman"
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
            className={`material-symbols-outlined ${hasSuccessfulPayment ? "animate-pulse" : ""}`}
          >
            {hasSuccessfulPayment ? "person_search" : "payments"}
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
