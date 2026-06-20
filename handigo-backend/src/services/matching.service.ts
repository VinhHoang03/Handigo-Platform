import { Types } from "mongoose";
import { Provider, IProvider } from "../models/provider.model";
import { Location } from "../models/location.model";
import { Service } from "../models/service.model";
import { getNumberConfigValue } from "./systemConfig.service";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ProviderCandidate {
  providerId: Types.ObjectId;
  userId: Types.ObjectId;
  distanceMeters: number;
  averageRating: number;
  totalCompletedOrders: number;
}

export interface FindNearestProvidersOptions {
  latitude?: number;
  longitude?: number;
  serviceCategoryId: string;
  /** Max search radius in meters. Default: 10 000 m (10 km) */
  maxDistanceMeters?: number;
  /** How many candidates to fetch at most. Default: 10 */
  limit?: number;
  /** Already-tried provider IDs to exclude from result */
  excludeProviderIds?: Types.ObjectId[];
}

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
   *  If no coordinates are provided, fall back to a simple filter without
   *  geo-sorting (distance will be reported as -1).
   */
  async findNearestProviders(
    options: FindNearestProvidersOptions,
  ): Promise<ProviderCandidate[]> {
    const configuredRadiusKm = await getNumberConfigValue("MAX_PROVIDER_RADIUS_KM", 10);
    const {
      latitude,
      longitude,
      serviceCategoryId,
      maxDistanceMeters = Math.max(configuredRadiusKm, 0) * 1000,
      limit = 10,
      excludeProviderIds = [],
    } = options;

    const categoryObjectId = new Types.ObjectId(serviceCategoryId);
    const excludeIds = excludeProviderIds.map((id) => id.toString());

    // ── Path A: geo-sorted lookup ──────────────────────────────────────────
    if (latitude != null && longitude != null) {
      /*
       * 1. Query the `locations` collection with 2dsphere near-filter.
       *    Each document stores { userId, ownerType, coordinates }.
       */
      const nearbyLocations = await Location.find({
        ownerType: "provider",
        isActive: true,
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
        .limit(limit * 5) // over-fetch to allow filtering by category/status
        .lean();

      if (nearbyLocations.length === 0) {
        console.log("[MatchingService] No nearby locations found, falling back to simple filter.");
      } else {
        // Build userId → { distance estimation } map (order from $near already sorted)
        const userIdToIndex = new Map<string, number>(
          nearbyLocations.map((loc, idx) => [loc.userId.toString(), idx]),
        );
        const nearbyUserIds = nearbyLocations.map((loc) => loc.userId);

        // 2. Fetch matching providers
        const servicesInCategory = await Service.find({
          categoryId: categoryObjectId,
          isActive: true,
        }).select("_id").lean();
        const serviceIdsInCategory = servicesInCategory.map((s: any) => s._id);

        const providers = await Provider.find({
          userId: { $in: nearbyUserIds },
          serviceIds: { $in: serviceIdsInCategory },
          availabilityStatus: "online",
          verified: true,
          ...(excludeIds.length > 0 && {
            _id: { $nin: excludeIds.map((id) => new Types.ObjectId(id)) },
          }),
        })
          .limit(limit)
          .lean();

        if (providers.length > 0) {
          // 3. Sort by geo distance order (index in nearbyLocations)
          const sorted = providers.sort((a, b) => {
            const ai = userIdToIndex.get(a.userId.toString()) ?? Infinity;
            const bi = userIdToIndex.get(b.userId.toString()) ?? Infinity;
            return ai - bi;
          });

          // 4. Compute approximate distance using Haversine
          return sorted.map((p) => {
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
              averageRating: p.averageRating,
              totalCompletedOrders: p.totalCompletedOrders,
            };
          });
        }
      }
    }

    // ── Path B: no coordinates or no geo-matches found → simple filter ─────
    const servicesInCategory = await Service.find({
      categoryId: categoryObjectId,
      isActive: true,
    }).select("_id").lean();
    const serviceIdsInCategory = servicesInCategory.map((s: any) => s._id);

    const providers = await Provider.find({
      serviceIds: { $in: serviceIdsInCategory },
      availabilityStatus: "online",
      verified: true,
      ...(excludeIds.length > 0 && {
        _id: { $nin: excludeIds.map((id) => new Types.ObjectId(id)) },
      }),
    })
      .sort({ averageRating: -1, totalCompletedOrders: -1 })
      .limit(limit)
      .lean();

    return providers.map((p) => ({
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
