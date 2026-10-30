import type { Order } from "@/types/booking";
import { BadgeCheck, Check, HardHat, Search, UserCheck, X, type LucideIcon } from "lucide-react";
export type TimelineStep = {
  icon: LucideIcon;
  title: string;
  description: string;
  time: string;
  state: "done" | "active" | "pending" | "cancelled";
};

const timelineDateFormatter = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

export const formatTimelineTime = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? timelineDateFormatter.format(date) : '';
};

const getCancellationDescription = (order: Order) => {
  const event = [...(order.statusHistory ?? [])].reverse()
    .find((item) => item.status === "cancelled");
  const cancellation = order.cancellation;
  const role = cancellation
    ? cancellation.cancelledByRole === "admin" && !cancellation.cancelledBy
      ? "system"
      : cancellation.cancelledByRole
    : event?.changedByRole;
  const reason = cancellation?.reason?.trim() || event?.note?.trim();
  if (role === "system" && reason
    && /^Không (?:tìm thấy thợ (?:nhận đơn|phù hợp)|có provider nhận đơn)/u.test(reason)) {
    return `Lý do hủy: ${reason.replace(/^Không tìm thấy thợ nhận đơn/u, "Không tìm thấy thợ phù hợp")}`;
  }
  const customerName = typeof order.customerId === "object" ? order.customerId?.fullName : undefined;
  const providerName = order.providerId?.userId?.fullName || order.providerId?.name;
  const actors: Record<string, string> = {
    customer: customerName ? `Khách hàng (${customerName})` : "Khách hàng",
    provider: providerName ? `Chuyên gia (${providerName})` : "Chuyên gia",
    admin: "Quản trị viên",
    system: "Hệ thống",
  };
  const actor = role ? actors[role] : undefined;
  return `Người hủy: ${actor || "Chưa có thông tin"}. ${reason ? `Lý do hủy: ${reason}` : "Chưa có thông tin lý do hủy đơn."}`;
};

const isReassignmentEvent = (history: NonNullable<Order['statusHistory']>, index: number) => {
  const event = history[index];
  return event.status === 'created' && (event.previousStatus === 'accepted'
    || (!event.previousStatus && history[index - 1]?.status === 'accepted'));
};

const buildHistoryTimeline = (order: Order): TimelineStep[] => {
    const history = order.statusHistory ?? [];
    const names: Record<string, string> = { created: 'Đã tạo đơn hàng', accepted: 'Chuyên gia đã nhận đơn', in_progress: 'Đã bắt đầu thực hiện', completed: 'Đã hoàn tất', cancelled: 'Đơn hàng đã hủy', paid: 'Đã thanh toán', assigned: 'Đã điều phối chuyên gia' };
    const descriptions: Record<string, string> = {
      created: `Yêu cầu ${order.serviceId?.name || 'dịch vụ'} đã được ghi nhận với mã ${order.orderCode}.`,
      accepted: 'Chuyên gia đã xác nhận tiếp nhận yêu cầu dịch vụ.',
      in_progress: 'Chuyên gia đã bắt đầu thực hiện dịch vụ.',
      completed: 'Dịch vụ đã được hoàn tất.',
      paid: 'Hệ thống đã ghi nhận khoản thanh toán của đơn hàng.',
      assigned: 'Hệ thống đã chuyển yêu cầu dịch vụ đến chuyên gia.',
    };
    let findingReplacement = false;
    const steps: TimelineStep[] = history.flatMap((event, index): TimelineStep[] => {
      const active = index === history.length - 1 && order.status !== 'cancelled' && order.status !== 'completed';
      if (isReassignmentEvent(history, index)) {
        findingReplacement = true;
        const time = formatTimelineTime(event.createdAt);
        return [
          { icon: X, title: 'Chuyên gia đã hủy nhận đơn',
            description: 'Chuyên gia trước không thể tiếp tục thực hiện đơn.', time, state: 'done' },
          { icon: Search, title: active ? 'Đang tìm chuyên gia thay thế' : 'Tìm chuyên gia thay thế',
            description: active
              ? 'Handigo đang tìm chuyên gia khác phù hợp để hỗ trợ bạn.'
              : 'Handigo đã bắt đầu tìm chuyên gia khác để hỗ trợ bạn.',
            time, state: active ? 'active' : 'done' },
        ];
      }
      const cancelled = event.status === 'cancelled';
      const replacementAccepted = findingReplacement && event.status === 'accepted';
      return [{
        icon: cancelled ? X : event.status === 'in_progress' ? HardHat : event.status === 'accepted' ? UserCheck : Check,
        title: replacementAccepted ? 'Chuyên gia mới đã nhận đơn' : names[event.status] ?? event.status,
        description: cancelled
          ? getCancellationDescription(order)
          : replacementAccepted
            ? 'Chuyên gia mới đã xác nhận tiếp nhận yêu cầu dịch vụ.'
            : event.note?.trim() || descriptions[event.status] || 'Trạng thái đơn hàng đã được cập nhật.',
        time: formatTimelineTime(cancelled ? order.cancellation?.cancelledAt || event.createdAt : event.createdAt),
        state: cancelled ? 'cancelled' : active ? 'active' : 'done',
      }];
    });
    if (order.status === 'cancelled' && !history.some(event => event.status === 'cancelled')) {
      steps.push({
        icon: X, title: 'Đơn hàng đã hủy',
        description: getCancellationDescription(order),
        time: formatTimelineTime(order.cancellation?.cancelledAt || order.updatedAt), state: 'cancelled',
      });
    }
    return steps;
};

export const buildOrderTimeline = (order: Order): TimelineStep[] => {
  const history = order.statusHistory ?? [];
  if (order.status === 'cancelled' && history.length) {
    return buildHistoryTimeline(order);
  }
  if (order.status === "cancelled") {
    return [
      {
        icon: X,
        title: "Đơn hàng đã hủy",
        description: getCancellationDescription(order),
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

  const timeline: TimelineStep[] = [
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
        order.status === "completed" ? formatTimelineTime(historyTime('completed') || order.confirmation?.providerConfirmedAt || order.updatedAt) : "",
      state: currentStatusIndex === 3 ? "done" : "pending",
    },
  ];
  if (history.some((_, index) => isReassignmentEvent(history, index))) {
    return [...buildHistoryTimeline(order), ...timeline.filter((step) => step.state === 'pending')];
  }
  return timeline;
};
