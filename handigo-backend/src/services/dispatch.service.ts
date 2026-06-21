import { Types } from "mongoose";
import { Order } from "../models/order.model";
import { OrderAssignment } from "../models/orderAssignment.model";
import { Provider } from "../models/provider.model";
import { MatchingService, ProviderCandidate } from "./matching.service";
import { AppError } from "../utils/appError";
import { getNumberConfigValue } from "./systemConfig.service";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Seconds a provider has to accept before the next one is tried. */
const DEFAULT_MATCHING_PROVIDER_TIMEOUT_SECONDS = 30;

/** Maximum number of providers to try before giving up. */
const DEFAULT_MAX_MATCHING_ATTEMPTS = 5;

// ─── Types ────────────────────────────────────────────────────────────────────

interface DispatchContext {
  latitude?: number;
  longitude?: number;
  serviceId: string;
  province: string;
  ward: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const DispatchService = {
  /**
   * Step 3 – Dispatch order to nearest available provider.
   *
   * This is designed to run asynchronously (fire-and-forget from OrderService).
   * It:
   *  1. Finds nearest providers via MatchingService.
   *  2. Creates an OrderAssignment record for the first candidate.
   *  3. Schedules a 30-second timeout callback (Step 5) that auto-advances to
   *     the next provider if the current one hasn't responded.
   */
  async dispatchOrder(
    orderId: string,
    ctx: DispatchContext,
    triedProviderIds: Types.ObjectId[] = [],
    attemptNumber = 1,
  ): Promise<void> {
    const maxMatchingAttempts = Math.max(
      Math.floor(await getNumberConfigValue("MAX_MATCHING_ATTEMPTS", DEFAULT_MAX_MATCHING_ATTEMPTS)),
      1,
    );
    const matchingProviderTimeoutSeconds = Math.max(
      await getNumberConfigValue("MATCHING_PROVIDER_TIMEOUT_SECONDS", DEFAULT_MATCHING_PROVIDER_TIMEOUT_SECONDS),
      1,
    );

    if (attemptNumber > maxMatchingAttempts) {
      // All candidates exhausted – cancel the order
      await Order.findByIdAndUpdate(orderId, {
        status: "cancelled",
        "cancellation.cancelledByRole": "admin",
        "cancellation.reason":
          "Không tìm được provider phù hợp sau nhiều lần thử.",
        "cancellation.cancelledAt": new Date(),
      });
      console.warn(
        `[DispatchService] No provider found for order ${orderId} after ${maxMatchingAttempts} attempts.`,
      );
      return;
    }

    // 1. Find nearest providers (excluding already-tried ones)
    const candidates: ProviderCandidate[] =
      await MatchingService.findNearestProviders({
        latitude: ctx.latitude,
        longitude: ctx.longitude,
        serviceId: ctx.serviceId,
        province: ctx.province,
        ward: ctx.ward,
        excludeProviderIds: triedProviderIds,
        limit: 1, // take only the best candidate per round
      });

    if (candidates.length === 0) {
      await Order.findByIdAndUpdate(orderId, {
        status: "cancelled",
        "cancellation.cancelledByRole": "admin",
        "cancellation.reason": "Không có provider khả dụng trong khu vực.",
        "cancellation.cancelledAt": new Date(),
      });
      console.warn(
        `[DispatchService] No available provider found for order ${orderId}.`,
      );
      return;
    }

    const candidate = candidates[0];
    const deadline = new Date(
      Date.now() + matchingProviderTimeoutSeconds * 1000,
    );

    // 2. Create assignment record
    const assignment = await OrderAssignment.create({
      orderId: new Types.ObjectId(orderId),
      providerId: candidate.providerId,
      status: "pending",
      assignedAt: new Date(),
      responseDeadline: deadline,
    });

    console.log(
      `[DispatchService] Order ${orderId} assigned to provider ${candidate.providerId} ` +
      `(attempt #${attemptNumber}, dist: ${candidate.distanceMeters}m). ` +
      `Deadline: ${deadline.toISOString()}`,
    );

    // 3. TODO: emit real-time push / socket event to provider here

    // 4. Schedule timeout retry (Step 5)
    setTimeout(async () => {
      await DispatchService._onAssignmentTimeout(
        orderId,
        assignment._id.toString(),
        candidate.providerId,
        ctx,
        triedProviderIds,
        attemptNumber,
      );
    }, matchingProviderTimeoutSeconds * 1000);
  },

  /**
   * Step 5 – Timeout retry matching.
   *
   * Called automatically after ASSIGNMENT_TIMEOUT_SECONDS if the provider
   * hasn't accepted or rejected yet.
   */
  async _onAssignmentTimeout(
    orderId: string,
    assignmentId: string,
    timedOutProviderId: Types.ObjectId,
    ctx: DispatchContext,
    triedProviderIds: Types.ObjectId[],
    attemptNumber: number,
  ): Promise<void> {
    // Re-read assignment to check if it was already responded to
    const assignment = await OrderAssignment.findById(assignmentId);
    if (!assignment || assignment.status !== "pending") {
      // Provider already accepted or rejected – nothing to do
      return;
    }

    // Mark as timed out
    assignment.status = "timeout";
    await assignment.save();
    console.log(
      `[DispatchService] Assignment ${assignmentId} timed out. Retrying next provider...`,
    );

    // Re-check order status
    const order = await Order.findById(orderId);
    if (!order || order.status !== "created") {
      return; // Order was already handled (e.g. customer cancelled)
    }

    // Recurse with this provider excluded
    await DispatchService.dispatchOrder(
      orderId,
      ctx,
      [...triedProviderIds, timedOutProviderId],
      attemptNumber + 1,
    );
  },

  /**
   * Re-dispatch an already existing order manually (admin / retry endpoint).
   */
  async redispatch(orderId: string): Promise<void> {
    const order = await Order.findById(orderId).populate(
      "serviceId",
      "categoryId",
    );
    if (!order) throw new AppError("Đơn hàng không tồn tại.", 404);
    if (order.status !== "created") {
      throw new AppError(
        "Chỉ có thể re-dispatch đơn hàng ở trạng thái created.",
        400,
      );
    }

    const address = await (
      await import("../models/address.model.js")
    ).Address.findById(order.addressId);

    const service = await (
      await import("../models/service.model.js")
    ).Service.findById(order.serviceId);

    await DispatchService.dispatchOrder(order._id.toString(), {
      latitude: address?.latitude,
      longitude: address?.longitude,
      serviceId: service?._id?.toString() || order.serviceId.toString(),
      province: address?.province || "",
      ward: address?.ward || "",
    });
  },
};
