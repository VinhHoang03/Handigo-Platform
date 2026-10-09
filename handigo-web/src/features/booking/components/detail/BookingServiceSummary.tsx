import type { ReactNode } from "react";
import { ReliableImage } from "@/components/common/ReliableImage";
import type { Order } from "@/types/booking";
import type { PaymentStatusDisplay } from "./bookingDetailFormatters";
import { Banknote, Clock, Grid2X2, MapPin } from "lucide-react";

type BookingServiceSummaryProps = {
  order: Order;
  statusLabel: string;
  paymentMethodLabel: string;
  paymentStatusDisplay: PaymentStatusDisplay;
  address: string;
  /** Khối báo giá sửa chữa — render trong cùng section như bản gốc (không phải thẻ riêng). */
  children?: ReactNode;
};

/** Thẻ tổng quan dịch vụ: ảnh, tên, badge loại giá/lịch, trạng thái, địa chỉ, thanh toán, mô tả vấn đề. */
export const BookingServiceSummary = ({
  order,
  statusLabel,
  paymentMethodLabel,
  paymentStatusDisplay,
  address,
  children,
}: BookingServiceSummaryProps) => (
  <section className="rounded-3xl bg-surface-container-lowest p-lg shadow-sm border border-outline-variant/30">
    <div className="flex flex-col md:flex-row md:justify-between items-start gap-md mb-lg">
      <div className="flex gap-md items-center">
        <ReliableImage
          className="w-20 h-20 rounded-2xl object-cover shadow-sm bg-surface-container"
          src={order.serviceId?.image}
          alt={order.serviceId?.name}
        />
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface leading-tight">
            {order.serviceId?.name}
          </h2>
          <div className="flex flex-wrap gap-xs mt-1">
            <span className="bg-primary/10 text-primary px-3 py-1 rounded-full font-label-sm text-label-sm flex items-center gap-1">
              <Grid2X2 aria-hidden="true" size={14} />
              {order.serviceId?.serviceType === "fixed_price"
                ? "Giá cố định"
                : "Báo giá sau"}
            </span>
            <span className="bg-surface-container text-on-surface-variant px-3 py-1 rounded-full font-label-sm text-label-sm flex items-center gap-1">
              <Clock aria-hidden="true" size={14} />
              {order.scheduledAt
                ? new Date(order.scheduledAt).toLocaleString("vi-VN")
                : "Sớm nhất"}
            </span>
          </div>
        </div>
      </div>
      <div className="flex flex-col md:items-end w-full md:w-auto">
        <div
          className={`px-4 py-2 rounded-full font-bold flex items-center gap-2 shadow-sm ${
            order.status === "completed"
              ? "bg-success-container text-on-success-container"
              : order.status === "cancelled"
                ? "bg-error-container text-on-error-container"
                : "bg-primary/10 text-primary"
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${order.status === "completed" ? "bg-success" : order.status === "cancelled" ? "bg-error" : "bg-primary animate-pulse"}`}
          />
          {statusLabel}
        </div>
        <p className="text-on-surface-variant text-label-sm mt-2 font-label-sm">
          Khởi tạo: {new Date(order.createdAt).toLocaleString("vi-VN")}
        </p>
      </div>
    </div>

    <div className="grid md:grid-cols-2 gap-lg pt-lg border-t border-outline-variant/30">
      <div className="space-y-sm">
        <div className="flex items-start gap-sm">
          <MapPin aria-hidden="true" size={24} className="text-primary bg-primary/10 p-2 rounded-lg" />
          <div>
            <h4 className="text-label-sm font-label-sm text-on-surface-variant uppercase">
              Địa điểm thực hiện
            </h4>
            <p className="font-medium text-on-surface mt-1">
              {address || "Chưa cập nhật địa chỉ"}
            </p>
          </div>
        </div>
      </div>
      <div className="space-y-sm">
        <div className="flex items-start gap-sm">
          <Banknote aria-hidden="true" size={24} className="text-primary bg-primary/10 p-2 rounded-lg" />
          <div>
            <h4 className="text-label-sm font-label-sm text-on-surface-variant uppercase">
              Thanh toán
            </h4>
            <p className="font-medium text-on-surface mt-1">
              {paymentMethodLabel} -
              <span className={`${paymentStatusDisplay.className} ml-1`}>
                {paymentStatusDisplay.label}
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>

    {(order.problemDescription ||
      (order.customerAttachments && order.customerAttachments.length > 0)) && (
      <div className="mt-lg pt-lg border-t border-outline-variant/30">
        <h4 className="text-label-sm font-label-sm text-on-surface-variant uppercase mb-md">
          Mô tả vấn đề & Hình ảnh hiện trạng
        </h4>
        {order.problemDescription && (
          <p className="bg-surface-container-low p-md rounded-2xl text-on-surface mb-md">
            {order.problemDescription}
          </p>
        )}
        {order.customerAttachments && order.customerAttachments.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-md mt-md">
            {order.customerAttachments.map((url, idx) => (
              <div
                key={idx}
                className="aspect-square rounded-2xl overflow-hidden shadow-sm border border-outline-variant/30"
              >
                <ReliableImage
                  src={url}
                  className="w-full h-full object-cover"
                  alt={`Attachment ${idx + 1}`}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    )}

    {children}
  </section>
);
