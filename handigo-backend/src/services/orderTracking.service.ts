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

const trackingText = {
  orderNotFound: "Kh\u00f4ng t\u00ecm th\u1ea5y \u0111\u01a1n h\u00e0ng.",
  noProvider: "\u0110\u01a1n h\u00e0ng ch\u01b0a c\u00f3 provider nh\u1eadn \u0111\u01a1n.",
  inactiveOrder:
    "Ch\u1ec9 c\u00f3 th\u1ec3 c\u1eadp nh\u1eadt v\u1ecb tr\u00ed khi \u0111\u01a1n h\u00e0ng \u0111ang \u0111\u01b0\u1ee3c th\u1ef1c hi\u1ec7n.",
  providerNotFound: "Kh\u00f4ng t\u00ecm th\u1ea5y provider c\u1ee7a \u0111\u01a1n h\u00e0ng.",
  forbidden: "B\u1ea1n kh\u00f4ng c\u00f3 quy\u1ec1n theo d\u00f5i v\u1ecb tr\u00ed c\u1ee7a \u0111\u01a1n h\u00e0ng n\u00e0y.",
  invalidCoordinate: "T\u1ecda \u0111\u1ed9 v\u1ecb tr\u00ed kh\u00f4ng h\u1ee3p l\u1ec7.",
};

const activeTrackingStatuses = ["accepted", "in_progress"];
const locationUpdateAllowedStatuses = ["accepted", "in_progress"];

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
  options: { requireActiveTracking?: boolean } = {},
) => {
  const order = await Order.findById(orderId)
    .select("customerId providerId addressId status createdAt")
    .lean();
  if (!order) {
    throw new AppError(trackingText.orderNotFound, 404);
  }

  if (!order.providerId) {
    throw new AppError(trackingText.noProvider, 400);
  }

  if (
    options.requireActiveTracking &&
    !activeTrackingStatuses.includes(order.status)
  ) {
    throw new AppError(trackingText.inactiveOrder, 400);
  }

  const provider = await Provider.findById(order.providerId)
    .select("userId")
    .lean();
  if (!provider) {
    throw new AppError(trackingText.providerNotFound, 404);
  }

  const customerUserId = order.customerId.toString();
  const providerUserId = provider.userId.toString();
  console.log(`[Tracking] canTrack check — role=${role} userId=${userId} customerUserId=${customerUserId} providerUserId=${providerUserId}`);
  const canTrack =
    (role === "CUSTOMER" && customerUserId === userId) ||
    (role === "PROVIDER" && providerUserId === userId);

  if (!canTrack) {
    console.error(`[Tracking] FORBIDDEN — role=${role} userId=${userId} does NOT match customerUserId=${customerUserId} nor providerUserId=${providerUserId}`);
    throw new AppError(trackingText.forbidden, 403);
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
    Address.findById(order.addressId).select("latitude longitude").lean(),
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
  const { order, customerUserId, providerUserId } = await getTrackingParticipants(orderId, userId, role);
  void customerUserId;
  void providerUserId;
  if (!locationUpdateAllowedStatuses.includes(order.status)) {
    throw new AppError(trackingText.inactiveOrder, 400);
  }

  if (
    !Number.isFinite(payload.latitude) ||
    payload.latitude < -90 ||
    payload.latitude > 90 ||
    !Number.isFinite(payload.longitude) ||
    payload.longitude < -180 ||
    payload.longitude > 180
  ) {
    throw new AppError(trackingText.invalidCoordinate, 400);
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
