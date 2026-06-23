import { Order } from "../models/order.model";
import { Provider } from "../models/provider.model";
import { Location } from "../models/location.model";
import { Address } from "../models/address.model";
import { AppError } from "../utils/appError";
import * as locationService from "./location.service";

type TrackingRole = "CUSTOMER" | "PROVIDER";

type TrackingCoordinate = {
  latitude: number;
  longitude: number;
  updatedAt: Date;
};

const toCoordinate = (
  location:
    | {
        coordinates?: { coordinates?: number[] };
        lastUpdatedAt?: Date;
      }
    | null
    | undefined,
): TrackingCoordinate | null => {
  const coordinates = location?.coordinates?.coordinates;
  if (
    !coordinates ||
    !Number.isFinite(coordinates[0]) ||
    !Number.isFinite(coordinates[1])
  ) {
    return null;
  }

  return {
    latitude: coordinates[1],
    longitude: coordinates[0],
    updatedAt: location?.lastUpdatedAt || new Date(),
  };
};

const getTrackingParticipants = async (
  orderId: string,
  userId: string,
  role: TrackingRole,
) => {
  const order = await Order.findById(orderId)
    .select("customerId providerId addressId status createdAt")
    .lean();
  if (!order) {
    throw new AppError("Không tìm thấy đơn hàng.", 404);
  }

  if (!order.providerId) {
    throw new AppError("Đơn hàng chưa có provider nhận đơn.", 400);
  }
  if (!["accepted", "in_progress"].includes(order.status)) {
    throw new AppError(
      "Chỉ có thể theo dõi vị trí khi đơn hàng đang được thực hiện.",
      400,
    );
  }

  const provider = await Provider.findById(order.providerId)
    .select("userId")
    .lean();
  if (!provider) {
    throw new AppError("Không tìm thấy provider của đơn hàng.", 404);
  }

  const customerUserId = order.customerId.toString();
  const providerUserId = provider.userId.toString();
  const canTrack =
    (role === "CUSTOMER" && customerUserId === userId) ||
    (role === "PROVIDER" && providerUserId === userId);

  if (!canTrack) {
    throw new AppError("Bạn không có quyền theo dõi vị trí của đơn hàng này.", 403);
  }

  return {
    order,
    customerUserId,
    providerUserId,
  };
};

export const getOrderTrackingState = async (
  orderId: string,
  userId: string,
  role: TrackingRole,
) => {
  const { order, customerUserId, providerUserId } =
    await getTrackingParticipants(orderId, userId, role);

  const [customerLocation, providerLocation, address] = await Promise.all([
    Location.findOne({
      userId: customerUserId,
      ownerType: "customer",
      isActive: true,
      isDeleted: false,
    })
      .sort({ lastUpdatedAt: -1 })
      .lean(),
    Location.findOne({
      userId: providerUserId,
      ownerType: "provider",
      isActive: true,
      isDeleted: false,
    })
      .sort({ lastUpdatedAt: -1 })
      .lean(),
    Address.findById(order.addressId)
      .select("latitude longitude")
      .lean(),
  ]);

  const customerCoordinate =
    toCoordinate(customerLocation) ||
    (Number.isFinite(address?.latitude) && Number.isFinite(address?.longitude)
      ? {
          latitude: address!.latitude!,
          longitude: address!.longitude!,
          updatedAt: order.createdAt,
        }
      : null);

  return {
    orderId,
    status: order.status,
    customer: customerCoordinate,
    provider: toCoordinate(providerLocation),
  };
};

export const updateOrderTrackingLocation = async (
  orderId: string,
  userId: string,
  role: TrackingRole,
  payload: { latitude: number; longitude: number },
) => {
  await getTrackingParticipants(orderId, userId, role);

  if (
    !Number.isFinite(payload.latitude) ||
    payload.latitude < -90 ||
    payload.latitude > 90 ||
    !Number.isFinite(payload.longitude) ||
    payload.longitude < -180 ||
    payload.longitude > 180
  ) {
    throw new AppError("Tọa độ vị trí không hợp lệ.", 400);
  }

  const location = await locationService.updateCurrentLocation(userId, payload);
  return {
    orderId,
    ownerType: role === "PROVIDER" ? "provider" : "customer",
    latitude: payload.latitude,
    longitude: payload.longitude,
    updatedAt: location?.lastUpdatedAt || new Date(),
  };
};
