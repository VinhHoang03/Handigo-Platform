import assert from "node:assert/strict";
import { mock } from "node:test";
import { Types } from "mongoose";
import { Order } from "../models/order.model";
import { Provider } from "../models/provider.model";
import { Location } from "../models/location.model";
import { Address } from "../models/address.model";

require.cache[require.resolve("../services/routing.service")] = { exports: {
  getDrivingRoute: async (origin: unknown, destination: unknown) => ({ origin, destination }),
} } as NodeModule;

async function run() {
  const customerId = new Types.ObjectId(); const providerId = new Types.ObjectId(); const providerUserId = new Types.ObjectId();
  const stored: Record<string, any> = { _id: new Types.ObjectId(), customerId, providerId, addressId: new Types.ObjectId(),
    status: "accepted", createdAt: new Date(), addressSnapshot: { latitude: 21, longitude: 105 } };
  const query = <T>(value: T): any => Object.assign(Promise.resolve(value), { lean: () => query(value), sort: () => query(value) });
  mock.method(Order, "findById", () => ({ select: (fields: string) => query(Object.fromEntries(fields.split(" ").map((field) => [field, stored[field]]))) }));
  mock.method(Provider, "findById", () => ({ select: () => query({ userId: providerUserId }) }));
  mock.method(Location, "findOne", (filter: any) => query(filter.ownerType === "provider" ? { coordinates: { coordinates: [105.1, 21.1] } } : null));
  let liveAddressReads = 0;
  mock.method(Address, "findById", () => { liveAddressReads++; return { select: () => query({ latitude: 22, longitude: 106 }) }; });
  try {
    const tracking = require("../services/orderTracking.service") as typeof import("../services/orderTracking.service");
    const route = await tracking.getOrderTrackingRoute(String(stored._id), String(customerId), "CUSTOMER") as unknown as { destination: unknown };
    assert.deepEqual(route.destination, { latitude: 21, longitude: 105 });
    const state = await tracking.getOrderTrackingState(String(stored._id), String(customerId), "CUSTOMER");
    assert.equal(state.customer?.latitude, 21); assert.equal(liveAddressReads, 0);
    delete stored.addressSnapshot;
    const legacy = await tracking.getOrderTrackingRoute(String(stored._id), String(customerId), "CUSTOMER") as unknown as { destination: unknown };
    assert.deepEqual(legacy.destination, { latitude: 22, longitude: 106 });
    assert.equal(liveAddressReads, 1, "Đơn cũ chưa có snapshot vẫn đọc địa chỉ như trước.");
    console.log("Đạt: tuyến đường và vị trí dùng địa chỉ chốt trong đơn; tương thích đơn cũ chưa có snapshot.");
  } finally { mock.restoreAll(); }
}
run().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
