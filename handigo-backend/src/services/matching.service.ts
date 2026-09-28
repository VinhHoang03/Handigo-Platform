import { Types } from "mongoose";
import { Provider, IProvider } from "../models/provider.model";
import { Location } from "../models/location.model";
import { Service } from "../models/service.model";
import { getNumberConfigValue } from "./systemConfig.service";
import { getEligibleProviderUserIds } from "./providerWalletEligibility.service";
import { createLogger } from "../utils/logger";
import { getAvailableProviderIds } from "./providerSchedule.service";
import { getBookingPolicy } from "./systemConfig.service";
import { calculateDuration, ScheduleInterval } from "../utils/bookingPolicy";
import { isAddressInProviderWorkingAreas } from "../utils/providerArea";

// ─── Types ───────────────────────────────────────────────────────────────────

const matchingLogger = createLogger("MatchingService");

export interface ProviderCandidate {
  providerId: Types.ObjectId;
  userId: Types.ObjectId;
  distanceMeters: number;
  latitude?: number;
  longitude?: number;
  averageRating: number;
  totalCompletedOrders: number;
}

export interface FindNearestProvidersOptions {
  scheduleIntervals?: ScheduleInterval[];
  latitude?: number;
  longitude?: number;
  serviceId: string;
  province: string;
  ward: string;
  /** Max search radius in meters. Default: 10 000 m (10 km) */
  maxDistanceMeters?: number;
  /** How many candidates to fetch at most. Default: 10 */
  limit?: number;
  /** Already-tried provider IDs to exclude from result */
  excludeProviderIds?: Types.ObjectId[];
  /** Chỉ kiểm tra một provider cụ thể trong luồng khách hàng ưu tiên thợ. */
  onlyProviderId?: Types.ObjectId;
  /** Lịch hẹn có thể chọn provider đang ngoại tuyến, miễn là không trùng lịch. */
  requireOnline?: boolean;
  /** Các thời điểm phải còn trống khi tự điều phối lịch hẹn hoặc lịch định kỳ. */
  scheduledDates?: Date[];
}

const filterProvidersWithoutScheduleConflicts = async <T extends IProvider>(
  providers: T[],
  intervals: ScheduleInterval[],
): Promise<T[]> => {
  if (!providers.length) return providers;
  const available = await getAvailableProviderIds(providers.map((provider) => provider._id as Types.ObjectId), intervals);
  return providers.filter((provider) => available.has(provider._id.toString()));
};

// ─── Service ─────────────────────────────────────────────────────────────────

export const MatchingService = {
  /**
   * Step 2 – Find nearest available providers.
   *
   * Algorithm:
   *  1. If lat/lng are available: run a 2dsphere `$near` query on the Location
   *     collection to get geospatially-sorted provider userIds.
   *  2. Filter providers by:
   *     - serviceCategoryIds includes the requested category
   *     - availabilityStatus === "online"
   *     - verified === true
   *     - not in excludeProviderIds
   *  3. Return sorted candidates (nearest first).
   *
   * Thiếu tọa độ thì không có kết quả; không thay thế bằng bộ lọc khu vực.
   */
  async findNearestProviders(
    options: FindNearestProvidersOptions,
  ): Promise<ProviderCandidate[]> {
    const configuredRadiusKm = await getNumberConfigValue("MAX_PROVIDER_RADIUS_KM", 10);
    const {
      latitude,
      longitude,
      serviceId,
      province,
      ward,
      maxDistanceMeters = Math.max(configuredRadiusKm, 0) * 1000,
      limit = 10,
      excludeProviderIds = [],
      onlyProviderId,
      requireOnline = true,
      scheduledDates = [],
    } = options;
    const policy = await getBookingPolicy();
    const service = options.scheduleIntervals ? null : await Service.findById(serviceId).select("serviceType").lean();
    const duration = calculateDuration(serviceId, service?.serviceType === "variable_price", [], policy);
    const intervals = options.scheduleIntervals ?? (scheduledDates.length ? scheduledDates : [new Date(Date.now() + policy.travelMinutes * 60000)])
      .map((date) => ({ start: date.getTime(), end: date.getTime() + duration * 60000, bufferMinutes: policy.bufferMinutes, travelMinutes: policy.travelMinutes }));
    const candidateLimit = scheduledDates.length > 0
      ? Math.max(limit * 5, 100)
      : limit * 5;

    const serviceObjectId = new Types.ObjectId(serviceId);
    const excludeIds = excludeProviderIds.map((id) => id.toString());
    const eligibleProviderUserIds = await getEligibleProviderUserIds();
    const eligibleProviderUserIdSet = new Set(
      eligibleProviderUserIds.map((userId) => userId.toString()),
    );

    if (eligibleProviderUserIds.length === 0) {
      matchingLogger.info("Không có provider đủ số dư ví tối thiểu để nhận đơn mới.");
      return [];
    }

    // ── Path A: geo-sorted lookup ──────────────────────────────────────────
    if (latitude != null && longitude != null && Number.isFinite(latitude)
      && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) {
      /*
       * 1. Query the `locations` collection with 2dsphere near-filter.
       *    Each document stores { userId, ownerType, coordinates }.
       */
      const nearbyLocations = await Location.find({
        ownerType: "provider",
        isActive: true,
        isDeleted: false,
        userId: { $in: eligibleProviderUserIds },
        coordinates: {
          $nearSphere: {
            $geometry: {
              type: "Point",
              coordinates: [longitude, latitude], // GeoJSON: [lng, lat]
            },
            $maxDistance: maxDistanceMeters,
          },
        },
      })
        .lean();

      if (nearbyLocations.length === 0) {
        matchingLogger.info("Không tìm thấy provider có vị trí trong bán kính phục vụ.");
      } else {
        // Build userId → { distance estimation } map (order from $near already sorted)
        const userIdToIndex = new Map<string, number>(
          nearbyLocations.map((loc, idx) => [loc.userId.toString(), idx]),
        );
        const nearbyUserIds = nearbyLocations.map((loc) => loc.userId);

        // 2. Fetch matching providers
        const providers = await Provider.find({
          userId: {
            $in: nearbyUserIds.filter((userId) =>
              eligibleProviderUserIdSet.has(userId.toString()),
            ),
          },
          serviceIds: serviceObjectId,
          ...(requireOnline && { availabilityStatus: "online" }),
          verified: true,
          isDeleted: false,
          ...((onlyProviderId || excludeIds.length > 0) && {
            _id: {
              ...(onlyProviderId && { $eq: onlyProviderId }),
              $nin: excludeProviderIds,
            },
          }),
        })
          .lean();

        const providersInArea = providers;

        if (providersInArea.length > 0) {
          // 3. Sort by geo distance order (index in nearbyLocations)
          const sorted = providersInArea.sort((a, b) => {
            const ai = userIdToIndex.get(a.userId.toString()) ?? Infinity;
            const bi = userIdToIndex.get(b.userId.toString()) ?? Infinity;
            return ai - bi;
          });
          const availableProviders = await filterProvidersWithoutScheduleConflicts(
            sorted,
            intervals,
          );

          // 4. Compute approximate distance using Haversine
          return availableProviders.slice(0, limit).map((p) => {
            const loc = nearbyLocations.find(
              (l) => l.userId.toString() === p.userId.toString(),
            );
            const dist = loc
              ? haversineMeters(
                latitude,
                longitude,
                loc.coordinates.coordinates[1],
                loc.coordinates.coordinates[0],
              )
              : -1;

            return {
              providerId: p._id as Types.ObjectId,
              userId: p.userId as Types.ObjectId,
              distanceMeters: dist,
              latitude: loc?.coordinates.coordinates[1],
              longitude: loc?.coordinates.coordinates[0],
              averageRating: p.averageRating,
              totalCompletedOrders: p.totalCompletedOrders,
            };
          });
        }
      }

      matchingLogger.info(
        "Không có provider phù hợp theo khoảng cách; chuyển sang tìm theo khu vực phục vụ.",
      );
    }

    // ── Path B: không có tọa độ hoặc không tìm thấy theo khoảng cách → lọc khu vực ──
    const providers = await Provider.find({
      userId: { $in: eligibleProviderUserIds },
      serviceIds: serviceObjectId,
      ...(requireOnline && { availabilityStatus: "online" }),
      verified: true,
      isDeleted: false,
      ...(onlyProviderId && { _id: onlyProviderId }),
      ...(excludeIds.length > 0 && {
        _id: { $nin: excludeIds.map((id) => new Types.ObjectId(id)) },
      }),
    })
      .sort({ averageRating: -1, totalCompletedOrders: -1 })
      .limit(candidateLimit)
      .lean();

    const providersInArea = providers.filter((provider) =>
      isAddressInProviderWorkingAreas(
        provider.workingAreas,
        { province, ward },
        provider.serviceArea,
      ),
    );
    const availableProviders = await filterProvidersWithoutScheduleConflicts(
      providersInArea,
      intervals,
    );

    if (providers.length === 0) {
      matchingLogger.warn("Không có provider hợp lệ cho dịch vụ.", {
        serviceId,
        excludedProviderCount: excludeIds.length,
      });
    } else if (providersInArea.length === 0) {
      matchingLogger.warn("Có provider đúng dịch vụ và đang online nhưng khu vực không khớp.", {
        serviceId,
        providerCount: providers.length,
        ward,
        province,
      });
      matchingLogger.debug("Danh sách khu vực provider bị loại.", {
        providers: providers.map((provider) => ({
          providerId: provider._id.toString(),
          workingAreas: provider.workingAreas,
          serviceArea: provider.serviceArea,
        })),
      });
    }

    return availableProviders
      .slice(0, limit)
      .map((p) => ({
        providerId: p._id as Types.ObjectId,
        userId: p.userId as Types.ObjectId,
        distanceMeters: -1,
        averageRating: p.averageRating,
        totalCompletedOrders: p.totalCompletedOrders,
      }));
  },
};

// ─── Utilities ────────────────────────────────────────────────────────────────

/**
 * Haversine formula – returns distance in meters between two lat/lng points.
 */
function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6_371_000; // Earth radius in metres
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
