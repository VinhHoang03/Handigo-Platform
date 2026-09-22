import assert from "node:assert/strict";
import axios from "axios";
import { Address, IAddress } from "../models/address.model";
import { createAddress, updateAddress, confirmAddressUpdate, ensureAddressCoordinates } from "../services/address.service";
import { geocodeSavedAddress } from "../services/reverseGeocoding.service";

// Chạy riêng với HTTP và cơ sở dữ liệu giả lập, không đọc .env.
async function main() {
  process.env.LOCATIONIQ_API_KEY = "gia-lap-kiem-thu";
  let calls = 0;
  let rows: unknown[] = [];
  axios.get = (async (_url: string, options: any) => {
    calls++;
    assert.equal(options.params.countrycodes, "vn");
    assert.equal(options.params.matchquality, 1);
    assert.ok(options.params.q.includes("Thành phố Hồ Chí Minh"));
    return { data: rows };
  }) as typeof axios.get;
  const input = {
    fullAddress: "123 Đường kiểm thử", ward: "Phường kiểm thử",
    province: "Thành phố Hồ Chí Minh",
  };
  const precise = {
    lat: "10.77", lon: "106.7", address: { country_code: "vn" },
    matchquality: { matchcode: "exact", matchlevel: "building" },
  };
  rows = [precise];
  const [first, second] = await Promise.all([
    geocodeSavedAddress(input), geocodeSavedAddress(input),
  ]);
  assert.equal(first.latitude, 10.77);
  assert.equal(second.longitude, 106.7);
  assert.equal(calls, 1);
  await geocodeSavedAddress(input);
  assert.equal(calls, 1);

  const rejectRows = [
    [],
    [precise, { ...precise, lon: "106.8" }],
    [{ ...precise, matchquality: { matchcode: "exact", matchlevel: "city" } }],
    [{ ...precise, matchquality: { matchcode: "approximate", matchlevel: "building" } }],
    [{ ...precise, lat: "" }],
    [{ ...precise, lat: "91" }],
  ];
  for (let index = 0; index < rejectRows.length; index++) {
    rows = rejectRows[index];
    await assert.rejects(
      geocodeSavedAddress({ ...input, fullAddress: `Địa chỉ kiểm thử ${index}` }),
      /Chưa xác định được vị trí đủ chính xác/,
    );
  }

  let updates = 0;
  const saved = new Address({ ...input, latitude: 10.8, longitude: 106.8 });
  Address.findOneAndUpdate = (async () => {
    updates++;
    throw new Error("Không được ghi đè tọa độ đã có");
  }) as any;
  const beforeCalls = calls;
  assert.equal(await ensureAddressCoordinates(saved), saved);
  assert.equal(updates, 0);
  assert.equal(calls, beforeCalls);

  const missing = new Address(input);
  let stored: IAddress | null = new Address({ ...input, latitude: 10.77, longitude: 106.7 });
  Address.findOneAndUpdate = (async (filter: any, update: any, options: any) => {
    assert.equal(filter._id, missing._id);
    assert.equal(filter.userId, missing.userId);
    assert.equal(filter.updatedAt, missing.updatedAt);
    assert.equal(options.runValidators, true);
    assert.deepEqual(update.$set, { latitude: 10.77, longitude: 106.7 });
    return stored;
  }) as any;
  assert.equal(await ensureAddressCoordinates(missing), stored);
  stored = null;
  await assert.rejects(ensureAddressCoordinates(missing), /Địa chỉ vừa được thay đổi/);
  // Kiểm tra lưu địa chỉ và tọa độ cùng nhau, kể cả khi sửa địa chỉ có sẵn.
  rows = [precise];
  Address.find = (() => ({ select: () => ({ lean: async () => [] }) })) as any;
  let writes = 0;
  let defaults = 0;
  Address.updateMany = (async () => { defaults++; }) as any;
  Address.create = (async (payload: any) => { writes++; return payload; }) as any;
  const created = await createAddress("customer", input);
  assert.equal(created.latitude, 10.77);
  assert.equal(created.longitude, 106.7);
  const pinned = await createAddress("customer", { ...input, latitude: 11, longitude: 107 });
  assert.equal(pinned.latitude, 11);

  const current = new Address({ ...input, latitude: 11, longitude: 107, placeId: "old-place" });
  Address.findOne = (async () => current) as any;
  let lastUpdate: any;
  Address.findOneAndUpdate = (async (filter: any, update: any, options: any) => {
    writes++;
    assert.equal(filter.userId, "customer");
    assert.equal(filter.updatedAt, current.updatedAt);
    assert.equal(options.runValidators, true);
    lastUpdate = update;
    return { ...current.toObject(), ...update.$set };
  }) as any;
  const changed = { fullAddress: "456 Đường mới kiểm thử" };
  await updateAddress("address", "customer", changed);
  assert.equal(lastUpdate.$set.latitude, 10.77);
  assert.equal(lastUpdate.$set.longitude, 106.7);
  assert.equal(lastUpdate.$unset.placeId, 1);
  // Client gửi lại tọa độ cũ cùng địa chỉ mới cũng phải tra cứu lại.
  await updateAddress("address", "customer", { ...changed, latitude: 11, longitude: 107 });
  assert.equal(lastUpdate.$set.latitude, 10.77);
  await updateAddress("address", "customer", { ...changed, latitude: 12, longitude: 108, placeId: "new-place" });
  assert.equal(lastUpdate.$set.latitude, 12);
  assert.equal(lastUpdate.$set.placeId, "new-place");
  const callsBeforeMetadata = calls;
  await updateAddress("address", "customer", { note: "Gọi trước khi tới" });
  assert.equal(calls, callsBeforeMetadata);
  assert.equal(lastUpdate.$set.latitude, undefined);
  assert.equal(lastUpdate.$unset, undefined);
  await confirmAddressUpdate("address", "customer", changed);
  assert.equal(lastUpdate.$set.latitude, 10.77);
  const beforeFailure = writes;
  rows = [];
  await assert.rejects(updateAddress("address", "customer", { fullAddress: "Địa chỉ không xác định", isDefault: true }), /Chưa xác định/);
  await assert.rejects(createAddress("customer", { ...input, fullAddress: "Địa chỉ không xác định", isDefault: true }), /Chưa xác định/);
  await assert.rejects(updateAddress("address", "customer", { latitude: 12 }), /đầy đủ/);
  assert.equal(writes, beforeFailure);
  assert.equal(defaults, 0);
  Address.findOne = (async () => null) as any;
  await assert.rejects(updateAddress("address", "customer", changed), /Không tìm thấy/);
  assert.equal(writes, beforeFailure);
  console.log("Đã kiểm tra: tọa độ có sẵn, tra cứu và lưu địa chỉ, bộ nhớ đệm, kết quả mơ hồ, tọa độ lỗi và địa chỉ thay đổi đồng thời.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
