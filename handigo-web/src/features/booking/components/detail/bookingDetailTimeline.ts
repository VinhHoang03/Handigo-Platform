import type { Order } from "@/types/booking";
import { BadgeCheck, Check, HardHat, UserCheck, X, type LucideIcon } from "lucide-react";
export type TimelineStep = {
  icon: LucideIcon;
  title: string;
  description: string;
  time: string;
  state: "done" | "active" | "pending" | "cancelled";
};

export const formatTimelineTime = (value?: string | null) =>
  value ? new Date(value).toLocaleString("vi-VN") : "";

export const buildOrderTimeline = (order: Order): TimelineStep[] => {
  if (order.status === 'cancelled' && order.statusHistory?.length) {
    const names: Record<string, string> = { created: 'Đã tạo đơn hàng', accepted: 'Chuyên gia đã nhận đơn', in_progress: 'Đã bắt đầu thực hiện', completed: 'Đã hoàn tất', cancelled: 'Đơn hàng đã hủy', paid: 'Đã thanh toán', assigned: 'Đã điều phối chuyên gia' };
    const descriptions: Record<string, string> = {
      created: `Yêu cầu ${order.serviceId?.name || 'dịch vụ'} đã được ghi nhận với mã ${order.orderCode}.`,
      accepted: 'Chuyên gia đã xác nhận tiếp nhận yêu cầu dịch vụ.',
      in_progress: 'Chuyên gia đã bắt đầu thực hiện dịch vụ.',
      completed: 'Dịch vụ đã được hoàn tất.',
      paid: 'Hệ thống đã ghi nhận khoản thanh toán của đơn hàng.',
      assigned: 'Hệ thống đã chuyển yêu cầu dịch vụ đến chuyên gia.',
    };
    const steps: TimelineStep[] = order.statusHistory.map(event => {
      const cancelled = event.status === 'cancelled';
      const reason = order.cancellation?.reason?.trim() || event.note?.trim();
      return {
        icon: cancelled ? X : event.status === 'in_progress' ? HardHat : event.status === 'accepted' ? UserCheck : Check,
        title: names[event.status] ?? event.status,
        description: cancelled
          ? reason ? `Lý do hủy: ${reason}` : 'Chưa có thông tin lý do hủy đơn.'
          : event.note?.trim() || descriptions[event.status] || 'Trạng thái đơn hàng đã được cập nhật.',
        time: formatTimelineTime(cancelled ? order.cancellation?.cancelledAt || event.createdAt : event.createdAt),
        state: cancelled ? 'cancelled' : 'done',
      };
    });
    if (!order.statusHistory.some(event => event.status === 'cancelled')) {
      steps.push({
        icon: X, title: 'Đơn hàng đã hủy',
        description: order.cancellation?.reason ? `Lý do hủy: ${order.cancellation.reason}` : 'Chưa có thông tin lý do hủy đơn.',
        time: formatTimelineTime(order.cancellation?.cancelledAt || order.updatedAt), state: 'cancelled',
      });
    }
    return steps;
  }
  if (order.status === "cancelled") {
    return [
      {
        icon: X,
        title: "Đơn hàng đã hủy",
        description: order.cancellation?.reason
          ? `Lý do hủy: ${order.cancellation.reason}`
          : 'Chưa có thông tin lý do hủy đơn.',
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
  const historyTime = (status: string) => [...(order.statusHistory ?? [])]
    .reverse().find(event => event.status === status)?.createdAt;
  const serviceName = order.serviceId?.name || "dịch vụ";
  const providerName = order.providerId?.userId?.fullName || order.providerId?.name;
  const hasPaid = ["paid", "partially_paid"].includes(order.paymentStatus);
  const scheduledTime = formatTimelineTime(order.scheduledAt);

  return [
    {
      icon: Check,
      title: "Đã tạo đơn hàng",
      description: `Yêu cầu ${serviceName} đã được ghi nhận với mã ${order.orderCode}.`,
      time: formatTimelineTime(historyTime('created') || order.createdAt),
      state: currentStatusIndex > 0 ? "done" : "active",
    },
    {
      icon: UserCheck,
      title: currentStatusIndex >= 1 ? `${providerName || 'Chuyên gia'} đã nhận đơn` : "Chờ chuyên gia nhận đơn",
      description: currentStatusIndex >= 1
        ? `${providerName || 'Chuyên gia'} đã xác nhận tiếp nhận yêu cầu ${serviceName}.`
        : order.paymentMethod === 'cash' && !order.inspectionRequired
          ? 'Đơn thanh toán tiền mặt. Bạn thanh toán trực tiếp cho chuyên gia sau khi sử dụng dịch vụ.'
          : hasPaid
          ? "Hệ thống đang điều phối bác thợ phù hợp nhất đến bạn."
          : "Vui lòng hoàn tất thanh toán để hệ thống bắt đầu điều phối thợ.",
      time:
        currentStatusIndex >= 1
          ? formatTimelineTime(historyTime('accepted'))
          : order.matchingStartedAt
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
      icon: HardHat,
      title: "Đang thực hiện",
      description:
        currentStatusIndex > 2
          ? `${providerName || "Chuyên gia"} đã thực hiện ${serviceName}.`
          : currentStatusIndex === 2
          ? `${providerName || "Chuyên gia"} đang thực hiện ${serviceName}.`
          : providerName
            ? `${providerName} sẽ thực hiện dịch vụ theo lịch đã xác nhận.`
            : "Dịch vụ sẽ bắt đầu sau khi kết nối được chuyên gia.",
      time:
        currentStatusIndex >= 2
          ? formatTimelineTime(historyTime('in_progress'))
          : scheduledTime ? `Lịch dự kiến: ${scheduledTime}` : "",
      state:
        currentStatusIndex > 2
          ? "done"
          : currentStatusIndex === 2
            ? "active"
            : "pending",
    },
    {
      icon: BadgeCheck,
      title: "Hoàn thành",
      description:
        order.status === "completed"
          ? `${serviceName} đã được hoàn tất thành công.`
          : "Hoàn tất sau khi dịch vụ được thực hiện và xác nhận.",
      time:
        order.status === "completed" ? formatTimelineTime(historyTime('completed') || order.updatedAt) : "",
      state: currentStatusIndex === 3 ? "done" : "pending",
    },
  ];
};
