import { useEffect, useState } from "react";
import type { Order } from "@/types/booking";

/** Đếm ngược thời gian hệ thống tìm chuyên gia nhận đơn (khi chưa có provider). */
export const useMatchingCountdown = (order: Order | null) => {
  const [countdownNow, setCountdownNow] = useState(() => Date.now());

  const matchingExpiresAt = order?.matchingExpiresAt
    ? new Date(order.matchingExpiresAt).getTime()
    : null;
  const isWaitingForProvider = Boolean(
    order &&
      order.status === "created" &&
      !order.providerId &&
      matchingExpiresAt,
  );
  const matchingSecondsRemaining =
    isWaitingForProvider && matchingExpiresAt
      ? Math.max(Math.ceil((matchingExpiresAt - countdownNow) / 1000), 0)
      : null;

  useEffect(() => {
    if (!isWaitingForProvider || !matchingExpiresAt) return;

    const intervalId = window.setInterval(() => {
      setCountdownNow(Date.now());
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [isWaitingForProvider, matchingExpiresAt]);

  return { isWaitingForProvider, matchingSecondsRemaining };
};
