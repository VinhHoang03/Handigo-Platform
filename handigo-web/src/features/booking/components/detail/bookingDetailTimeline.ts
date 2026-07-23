import type { Order } from "@/types/booking";

export type TimelineStep = {
  icon: string;
  title: string;
  description: string;
  time: string;
  state: "done" | "active" | "pending" | "cancelled";
};

export const formatTimelineTime = (value?: string | null) =>
  value ? new Date(value).toLocaleString("vi-VN") : "";

export const buildOrderTimeline = (order: Order): TimelineStep[] => {
  if (order.status === "cancelled") {
    return [
      {
        icon: "close",
        title: "Đơn hàng đã hủy",
        description: order.cancellation?.reason
          ? `Lý do: ${order.cancellation.reason}`
          : `Đơn ${order.orderCode} đã kết thúc và không tiếp tục được thực hiện.`,
        time: formatTimelineTime(
          order.cancellation?.cancelledAt || order.updatedAt,
        ),
        state: "cancelled",
      },
    ];
  }

  const statusOrder: Record<Order["status"], number> = {
    created: 0,
    accepted: 1,
    in_progress: 2,
    completed: 3,
    cancelled: -1,
  };
  const currentStatusIndex = statusOrder[order.status];
  const serviceName = order.serviceId?.name || "dịch vụ";
  const providerName = order.providerId?.userId?.fullName || order.providerId?.name;
  const hasPaid = ["paid", "partially_paid"].includes(order.paymentStatus);
  const scheduledTime = formatTimelineTime(order.scheduledAt);

  return [
    {
      icon: "check",
      title: "Đã tạo đơn hàng",
      description: `Yêu cầu ${serviceName} đã được ghi nhận với mã ${order.orderCode}.`,
      time: formatTimelineTime(order.createdAt),
      state: currentStatusIndex > 0 ? "done" : "active",
    },
    {
      icon: "person_check",
      title: providerName ? `${providerName} đã nhận đơn` : "Chờ chuyên gia nhận đơn",
      description: providerName
        ? `${providerName} đã xác nhận tiếp nhận yêu cầu ${serviceName}.`
        : hasPaid
          ? "Hệ thống đang điều phối bác thợ phù hợp nhất đến bạn."
          : "Vui lòng hoàn tất thanh toán để hệ thống bắt đầu điều phối thợ.",
      time:
        !providerName && order.matchingStartedAt
          ? `Bắt đầu điều phối: ${formatTimelineTime(order.matchingStartedAt)}`
          : "",
      state:
        currentStatusIndex > 1
          ? "done"
          : currentStatusIndex === 1
            ? "active"
            : "pending",
    },
    {
      icon: "construction",
      title: "Đang thực hiện",
      description:
        currentStatusIndex >= 2
          ? `${providerName || "Chuyên gia"} đang thực hiện ${serviceName}.`
          : providerName
            ? `${providerName} sẽ thực hiện dịch vụ theo lịch đã xác nhận.`
            : "Dịch vụ sẽ bắt đầu sau khi kết nối được chuyên gia.",
      time:
        currentStatusIndex < 2 && scheduledTime
          ? `Lịch dự kiến: ${scheduledTime}`
          : "",
      state:
        currentStatusIndex > 2
          ? "done"
          : currentStatusIndex === 2
            ? "active"
            : "pending",
    },
    {
      icon: "verified",
      title: "Hoàn thành",
      description:
        order.status === "completed"
          ? `${serviceName} đã được hoàn tất thành công.`
          : "Hoàn tất sau khi dịch vụ được thực hiện và xác nhận.",
      time:
        order.status === "completed" ? formatTimelineTime(order.updatedAt) : "",
      state: currentStatusIndex === 3 ? "done" : "pending",
    },
  ];
};
