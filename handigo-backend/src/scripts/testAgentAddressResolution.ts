import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mock } from "node:test";
import axios from "axios";
import mongoose, { Types } from "mongoose";
import * as administrative from "../services/vietnamAddress.service";
import * as geocoding from "../services/reverseGeocoding.service";
import * as addressService from "../services/address.service";
import * as addressResolver from "../services/agentAddressResolver.service";
import { resolveAgentAddress, AGENT_AREA_PLACE_PREFIX } from "../services/agentAddressResolver.service";
import { AgentAddressService, agentAddressSchema } from "../services/agentAddress.service";
import User from "../models/user.model";
import { Address } from "../models/address.model";
import { newSession } from "../ai/agent/agent-state";
import type { IAddress } from "../models/address.model";
import { bookingAddressLabel, type BookingDraftDependencies } from "../ai/agent/booking-draft";
const createAddressWithStorage = addressService.createAddress;

// Toàn bộ dữ liệu hành chính và vị trí dưới đây là fixture; không tra tọa độ hoặc ghi tài khoản thật.
const provinces: administrative.AdministrativeUnit[] = [
  { code: 48, name: "Thành phố Đà Nẵng", codeName: "da_nang", divisionType: "thành phố" },
  { code: 1, name: "Thành phố Hà Nội", codeName: "ha_noi", divisionType: "thành phố" },
];
const wards: administrative.AdministrativeUnit[] = [
  { code: 101, name: "Phường Ngũ Hành Sơn", parentCode: 48, codeName: "ngu_hanh_son", divisionType: "phường" },
  { code: 102, name: "Phường Hải Châu", parentCode: 48, codeName: "hai_chau", divisionType: "phường" },
];
const school: geocoding.AddressSearchCandidate = { fullAddress: "Đại học FPT, Ngũ Hành Sơn, Đà Nẵng", province: "Đà Nẵng",
  administrativeNames: ["Ngũ Hành Sơn"], wardNames: ["Ngũ Hành Sơn"], latitude: 16.01, longitude: 108.21,
  placeId: "osm:way:kiem-thu", category: "amenity" };
const area: geocoding.AddressSearchCandidate = { fullAddress: "Phường Ngũ Hành Sơn, Đà Nẵng", province: "Đà Nẵng",
  administrativeNames: ["Ngũ Hành Sơn"], wardNames: [], latitude: 16.02, longitude: 108.22,
  placeId: "osm:relation:kiem-thu", category: "boundary" };
function query(value: unknown) {
  const result = { then: (resolve: (value: unknown) => unknown) => Promise.resolve(value).then(resolve),
    select: () => result, sort: () => result, session: () => result, lean: () => result };
  return result as never;
}

async function run() {
  // Cấu hình giả chỉ tồn tại trong tiến trình test; axios bị chặn hoàn toàn bởi mock.
  process.env.LOCATIONIQ_API_KEY = "khoa-gia-lap-khong-goi-dich-vu";
  let calls = 0;
  mock.method(axios, "get", async (_url: string, options: { params: Record<string, unknown> }) => {
    calls++;
    assert.equal(options.params.countrycodes, "vn");
    return { data: [{ lat: "16.01", lon: "108.21", display_name: school.fullAddress, class: "amenity", place_id: "123",
      address: { country_code: "vn", state: "Đà Nẵng", suburb: "Ngũ Hành Sơn" } },
    { lat: "20", lon: "110", address: { country_code: "us" } },
    { lat: "NaN", lon: "108", address: { country_code: "vn" } }] };
  });
  const [searched, sameSearch] = await Promise.all([
    geocoding.searchAddressLocations("Dia diem kiem thu"), geocoding.searchAddressLocations("Dia diem kiem thu"),
  ]);
  assert.equal(calls, 1); assert.deepEqual(searched, sameSearch);
  assert.equal(searched.length, 1); assert.equal(searched[0].province, "Đà Nẵng");
  assert.deepEqual(searched[0].wardNames, ["Ngũ Hành Sơn"]);
  await geocoding.searchAddressLocations("DIA DIEM KIEM THU");
  assert.equal(calls, 1);
  mock.restoreAll();

  mock.method(administrative, "getProvinces", async () => provinces);
  mock.method(administrative, "getWardsByProvince", async (code: number) => code === 48 ? wards : []);
  let results: geocoding.AddressSearchCandidate[] = [school];
  let lookups = 0;
  mock.method(geocoding, "searchAddressLocations", async (text: string) => {
    lookups++;
    return /^Phường Ngũ Hành Sơn,/.test(text) ? [area] : results;
  });
  const raw = "Đại học FPT, Ngũ hành sơn, Đà nẵng";
  const resolved = await resolveAgentAddress({ addressText: raw });
  assert.equal(resolved.fullAddress, "Đại học FPT");
  assert.equal(resolved.province, provinces[0].name); assert.equal(resolved.provinceCode, 48);
  assert.equal(resolved.ward, wards[0].name); assert.equal(resolved.wardCode, 101);
  assert.equal(resolved.latitude, school.latitude); assert.equal(resolved.precision, "place");
  const changedAddress = "134 trần đại nghĩa phường ngũ hành sơn đà nẵng";
  const duplicatedLabel = `${changedAddress}, Phường Ngũ Hành Sơn, Thành phố Đà Nẵng`;
  const canonicalLabel = "134 trần đại nghĩa, Phường Ngũ Hành Sơn, Thành phố Đà Nẵng";
  assert.equal(bookingAddressLabel({ fullAddress: changedAddress, ward: wards[0].name, province: provinces[0].name }), canonicalLabel);
  assert.equal(bookingAddressLabel({ fullAddress: duplicatedLabel, ward: wards[0].name, province: provinces[0].name }), canonicalLabel);
  for (const [addressText, street] of [
    [changedAddress, "134 trần đại nghĩa"],
    ["134 Trần Đại Nghĩa, phường Ngũ Hành Sơn, Đà Nẵng", "134 Trần Đại Nghĩa"],
    ["134 Tran Dai Nghia P. Ngu Hanh Son TP. Da Nang", "134 Tran Dai Nghia"],
    ["134 trần đại nghĩa phường ngũ hành sơn đà nẵng, Phường Ngũ Hành Sơn, Thành phố Đà Nẵng", "134 trần đại nghĩa"],
    ["134 Ngũ Hành Sơn, Phường Ngũ Hành Sơn, Đà Nẵng", "134 Ngũ Hành Sơn"],
    ["134 Đà Nẵng phường Ngũ Hành Sơn Đà Nẵng", "134 Đà Nẵng"],
    ["134 Đà Nẵng", "134 Đà Nẵng"],
    ["134 Trần Đại Nghĩa, Đà Nẵng, Ngũ Hành Sơn", "134 Trần Đại Nghĩa"],
    ["134 Trần Đại Nghĩa phường Ngũ Hành Sơn Đà Nẵng Đà Nẵng", "134 Trần Đại Nghĩa"],
    ["134 Trần Đại Nghĩa, Phường Ngũ Hành Sơn, Đà Nẵng, cổng sau", "134 Trần Đại Nghĩa, cổng sau"],
    ["Tòa nhà Đà Nẵng, cổng sau phường Ngũ Hành Sơn Đà Nẵng", "Tòa nhà Đà Nẵng, cổng sau"],
  ]) {
    const address = await resolveAgentAddress({ addressText, ward: wards[0].name, province: provinces[0].name });
    assert.equal(address.fullAddress, street, `Tách địa chỉ: ${addressText}`);
    assert.equal(bookingAddressLabel(address), `${street}, Phường Ngũ Hành Sơn, Thành phố Đà Nẵng`);
  }
  assert.equal((await resolveAgentAddress({ fullAddress: changedAddress, ward: wards[0].name,
    province: provinces[0].name })).fullAddress, "134 trần đại nghĩa");
  for (const separator of [", ", "; ", "\n", " "]) {
    for (const repetitions of [1, 2, 3, 4]) {
      const addressText = "134 Trần Đại Nghĩa" + separator
        + Array(repetitions).fill(`Phường Ngũ Hành Sơn${separator}Thành phố Đà Nẵng`).join(separator);
      const address = await resolveAgentAddress({ addressText });
      assert.equal(address.fullAddress, "134 Trần Đại Nghĩa", `Loại khu vực lặp: ${addressText}`);
      assert.equal(bookingAddressLabel(address), "134 Trần Đại Nghĩa, Phường Ngũ Hành Sơn, Thành phố Đà Nẵng");
    }
  }
  const otherProvince = { code: 79, name: "Thành phố Hồ Chí Minh", codeName: "ho_chi_minh", divisionType: "thành phố" };
  const otherWard = { code: 201, name: "Phường Sài Gòn", codeName: "sai_gon", divisionType: "phường" };
  mock.method(administrative, "getProvinces", async () => [...provinces, otherProvince]);
  mock.method(administrative, "getWardsByProvince", async (code: number) => code === 79 ? [otherWard] : wards);
  const otherAddress = await resolveAgentAddress({ addressText: "12 Lê Lợi P. Sài Gòn TP.HCM, Phường Sài Gòn, Thành phố Hồ Chí Minh" });
  assert.equal(otherAddress.fullAddress, "12 Lê Lợi");
  assert.equal(bookingAddressLabel(otherAddress), "12 Lê Lợi, Phường Sài Gòn, Thành phố Hồ Chí Minh");
  mock.method(administrative, "getProvinces", async () => provinces);
  mock.method(administrative, "getWardsByProvince", async (code: number) => code === 48 ? wards : []);
  const withoutAccents = await resolveAgentAddress({ addressText: "DAI HOC FPT, NGU HANH SON, TP. DA NANG" });
  assert.equal(withoutAccents.wardCode, 101); assert.equal(withoutAccents.provinceCode, 48);
  const onlyArea = await resolveAgentAddress({ addressText: "Ngũ Hành Sơn, Đà Nẵng" });
  assert.equal(onlyArea.precision, "ward"); assert.equal(onlyArea.latitude, area.latitude);
  assert(onlyArea.placeId?.startsWith(AGENT_AREA_PLACE_PREFIX));
  assert(onlyArea.fullAddress.includes("Phường Ngũ Hành Sơn"));
  const shortName = await resolveAgentAddress(agentAddressSchema.parse({ fullAddress: "FPT", ward: "Ngũ Hành Sơn", province: "Đà Nẵng" }));
  assert(shortName.fullAddress.startsWith("FPT, Phường Ngũ Hành Sơn"));
  results = [];
  const descriptive = await resolveAgentAddress({ addressText: "Nhà gần bờ sông, Ngũ Hành Sơn, Đà Nẵng" });
  assert.equal(descriptive.fullAddress, "Nhà gần bờ sông"); assert.equal(descriptive.precision, "ward");
  results = [school, { ...school, latitude: 16.03, placeId: "osm:way:diem-thu-hai" }];
  assert.equal((await resolveAgentAddress({ addressText: raw })).precision, "ward");
  results = [school];
  assert.equal((await resolveAgentAddress({ addressText: "Đại học FPT, Đà Nẵng" })).wardCode, 101);
  results = [school, { ...school, wardNames: ["Hải Châu"], latitude: 16.05 }];
  await assert.rejects(() => resolveAgentAddress({ addressText: "Địa điểm trùng tên, Đà Nẵng" }), /nhiều phường\/xã/);
  results = [];
  await assert.rejects(() => resolveAgentAddress({ addressText: "Nhà mẹ, Đà Nẵng" }), /bổ sung tên phường\/xã/);
  results = [{ ...area, wardNames: ["Ngũ Hành Sơn"] }];
  await assert.rejects(() => resolveAgentAddress({ addressText: "Đà Nẵng" }), /bổ sung tên phường\/xã/);
  const beforeInvalid = lookups;
  await assert.rejects(() => resolveAgentAddress({ fullAddress: "Trường học", province: "Đà Nẵng", ward: "Phường không tồn tại" }), /Chưa tìm thấy phường/);
  await assert.rejects(() => resolveAgentAddress({ addressText: raw, province: "Hà Nội" }), /chưa khớp/);
  await assert.rejects(() => resolveAgentAddress({ addressText: raw, ward: "Hải Châu" }), /chưa khớp/);
  await assert.rejects(() => resolveAgentAddress({ fullAddress: "Trường học", province: "Tỉnh không tồn tại", ward: "Ngũ Hành Sơn" }), /Chưa nhận diện/);
  assert.equal(lookups, beforeInvalid, "Khu vực sai không được đi tiếp tới tra tọa độ.");
  results = [{ ...school, province: "Hà Nội" }];
  assert.equal((await resolveAgentAddress({ addressText: raw })).precision, "ward", "Không lấy tọa độ địa điểm ở thành phố khác.");
  mock.method(geocoding, "searchAddressLocations", async () => []);
  const unlocated = await resolveAgentAddress({ addressText: raw });
  assert.equal(unlocated.precision, "unlocated"); assert.equal(unlocated.latitude, undefined);
  assert(unlocated.placeId?.startsWith(AGENT_AREA_PLACE_PREFIX));
  let unavailableLookups = 0;
  mock.method(geocoding, "searchAddressLocations", async () => { unavailableLookups++; throw Error("Bản đồ tạm lỗi"); });
  assert.equal((await resolveAgentAddress({ addressText: raw })).precision, "unlocated");
  assert.equal(unavailableLookups, 1, "Bản đồ lỗi thì không gọi lặp lại các truy vấn dự phòng.");
  mock.method(administrative, "getProvinces", async () => { throw Error("Lỗi nguồn giả lập"); });
  await assert.rejects(() => resolveAgentAddress({ addressText: raw }), /Chưa thể kiểm tra tỉnh/);
  mock.method(administrative, "getProvinces", async () => []);
  await assert.rejects(() => resolveAgentAddress({ addressText: raw }), /Chưa tải được danh sách tỉnh/);
  mock.restoreAll();

  mock.method(administrative, "getProvinces", async () => provinces);
  mock.method(administrative, "getWardsByProvince", async () => wards);
  mock.method(geocoding, "searchAddressLocations", async () => [area]);
  const userId = new Types.ObjectId().toString();
  let saved: IAddress[] = [];
  let writes = 0;
  mock.method(User, "findById", () => ({ select: () => ({ lean: async () => ({ fullName: "Nguyễn An", phone: "0912345678" }) }) }));
  mock.method(addressService, "getUserAddresses", async () => saved);
  mock.method(addressService, "createAddress", async (owner: string, payload: Record<string, unknown>) => {
    assert.equal(owner, userId); assert.equal(payload.wardCode, 101); assert.equal(payload.provinceCode, 48);
    assert.equal(payload.latitude, area.latitude); assert(String(payload.placeId).startsWith(AGENT_AREA_PLACE_PREFIX));
    writes++;
    const address = { ...payload, _id: new Types.ObjectId(), userId: new Types.ObjectId(owner), updatedAt: new Date(), isDefault: false } as IAddress;
    saved = [address]; return address;
  });
  mock.method(Address, "findOne", async () => saved[0]);
  const args = agentAddressSchema.parse({ addressText: raw, useForBooking: true });
  const preview = await AgentAddressService.preview(userId, args);
  assert.equal(preview.recipientPhone, "0912345678"); assert(preview.note.includes("xác nhận vị trí cụ thể"));
  assert.equal(preview.address, "Đại học FPT, Phường Ngũ Hành Sơn, Thành phố Đà Nẵng");
  const shortPreview = await AgentAddressService.preview(userId, agentAddressSchema.parse({ fullAddress: "FPT", ward: "Ngũ Hành Sơn", province: "Đà Nẵng" }));
  assert.equal(shortPreview.address, "FPT, Phường Ngũ Hành Sơn, Thành phố Đà Nẵng");
  assert.equal(writes, 0);
  await assert.rejects(() => AgentAddressService.save(userId, args, { ...preview, address: "Địa chỉ giả" }));
  assert.equal(writes, 0);
  await AgentAddressService.save(userId, args, JSON.parse(JSON.stringify(preview)));
  assert.equal(writes, 1);
  const duplicate = await AgentAddressService.preview(userId, args);
  assert(duplicate.existingId);
  await AgentAddressService.save(userId, args, JSON.parse(JSON.stringify(duplicate)));
  assert.equal(writes, 1);
  assert(!agentAddressSchema.safeParse({ addressText: raw, latitude: 0, longitude: 0, provinceCode: 1 }).success);
  await assert.rejects(() => AgentAddressService.preview(userId, agentAddressSchema.parse({ addressId: new Types.ObjectId().toString(), addressText: raw })), /thuộc tài khoản/);
  let unlocatedSaved = false;
  mock.method(geocoding, "searchAddressLocations", async () => []);
  mock.method(addressService, "createAddress", async (_owner: string, payload: Record<string, unknown>, options?: { allowUnlocated?: boolean }) => {
    assert.equal(options?.allowUnlocated, true); assert.equal(payload.latitude, undefined);
    assert.equal(payload.longitude, undefined); assert.equal(payload.wardCode, 101);
    unlocatedSaved = true; return { ...payload, _id: new Types.ObjectId() } as IAddress;
  });
  saved = [];
  const unlocatedPreview = await AgentAddressService.preview(userId, args);
  assert(unlocatedPreview.note.includes("Địa chỉ vẫn được lưu"));
  await AgentAddressService.save(userId, args, JSON.parse(JSON.stringify(unlocatedPreview)));
  assert(unlocatedSaved);
  mock.method(geocoding, "searchAddressLocations", async () => [area]);
  mock.method(addressService, "createAddress", async (owner: string, payload: Record<string, unknown>) => {
    writes++;
    const address = { ...payload, _id: new Types.ObjectId(), userId: new Types.ObjectId(owner), updatedAt: new Date(), isDefault: false } as IAddress;
    saved = [address]; return address;
  });

  // Tích hợp: địa chỉ trong chat được đưa thẳng vào form đặt đơn, chưa tạo đơn hoặc thanh toán.
  require.cache[require.resolve("../configs/payos.config")] = { exports: { payos: {}, payoutPayos: {} } } as NodeModule;
  const { AgentService, sessionView } = require("../ai/agent/agent.service") as typeof import("../ai/agent/agent.service");
  const { AgentLoop } = require("../ai/agent/agent-loop.service") as typeof import("../ai/agent/agent-loop.service");
  const { ToolRegistry } = require("../ai/tools/tool-registry") as typeof import("../ai/tools/tool-registry");
  const { createUpdateBookingDraftTool } = require("../ai/tools/implementations/update-booking-draft.tool") as typeof import("../ai/tools/implementations/update-booking-draft.tool");
  const { saveBookingAddressTool } = require("../ai/tools/implementations/booking-extras.tools") as typeof import("../ai/tools/implementations/booking-extras.tools");
  saved = [];
  const serviceId = new Types.ObjectId().toString();
  const deps: BookingDraftDependencies = { search: async () => [{ id: serviceId, name: "Vệ sinh điều hòa" }],
    service: async () => ({ id: serviceId, name: "Vệ sinh điều hòa", serviceType: "fixed_price", fixedPrice: 200000, requiresOptionSelection: false, options: [] }),
    addresses: async () => saved.map((item) => ({ id: String(item._id), fullAddress: item.fullAddress, ward: item.ward, province: item.province, isDefault: false })),
  };
  const registry = new ToolRegistry().register(createUpdateBookingDraftTool(deps)).register(saveBookingAddressTool)
    .register({ name: "create_booking", description: "Tạo đơn kiểm thử", inputSchema: require("../ai/tools/implementations/booking.schemas").bookingSchema,
      roles: ["CUSTOMER"], mutates: true, requiresConfirmation: true,
      preview: async (context, booking: { addressId: string }) => ({ title: "Đặt dịch vụ", amount: 400000,
        address: context.session?.bookingDraft?.draftAddress?.payload.fullAddress
          ?? saved.find((item) => String(item._id) === booking.addressId)?.fullAddress }),
      execute: async () => { throw Error("Không được tạo đơn trước xác nhận đặt dịch vụ."); } });
  let step = 0;
  const session = newSession(randomUUID(), userId);
  const loop = new AgentLoop({ generate: async () => {
    if (++step === 1) return { type: "TOOL_CALL", tool: "update_booking_draft", arguments: {
      mode: "update", serviceId, quantity: 2, paymentMethod: "wallet", problemDescription: "Máy chảy nước", addressPreference: raw } };
    if (step === 2) return { type: "TOOL_CALL", tool: "save_booking_address", arguments: { addressText: changedAddress } };
    if (step === 3) return { type: "TOOL_CALL", tool: "save_booking_address", arguments: { addressText: raw, ward: "Phường không tồn tại" } };
    throw Error("Backend phải tự cập nhật địa chỉ và chuẩn bị form đặt đơn, không gọi thêm LLM.");
  } },
  registry, { maxIterations: 3, systemPrompt: "Kiểm thử", timeoutMs: 5000 });
  const agent = new AgentService({ acquire: async () => ({ session, lockId: "khoa" }), save: async () => {}, release: async () => {} }, loop);
  const input = { requestId: randomUUID(), message: `Đặt vệ sinh 2 máy tại ${raw}` };
  const firstView = await agent.send({ id: userId, role: "CUSTOMER" }, session.id, input);
  assert.equal(session.pendingAction?.tool, "create_booking"); assert.equal(writes, 1);
  assert.equal((session.pendingAction?.preview as { address: string }).address, "Đại học FPT");
  const oldSession = structuredClone(session);
  oldSession.pendingAction!.preview = { title: "Tạo đơn dịch vụ", address: duplicatedLabel, amount: 400000 };
  const oldView = sessionView(oldSession);
  assert.equal((oldView.pendingConfirmation!.preview as { address: string }).address, canonicalLabel);
  assert.equal((oldView.messages.find(message => message.confirmation?.actionId === oldSession.pendingAction!.id)!
    .confirmation!.preview as { address: string }).address, canonicalLabel);
  assert.equal((oldSession.pendingAction!.preview as { address: string }).address, duplicatedLabel,
    "Chuẩn hóa hiển thị không sửa dữ liệu xác nhận đã lưu.");
  assert(!firstView.messages.some((message) => message.confirmation?.tool === "save_booking_address"), "Không hiển thị form lưu địa chỉ riêng.");
  assert(!session.actions.some((action) => action.tool === "save_booking_address"));
  assert.equal(session.bookingDraft?.values.addressId, session.bookingDraft?.draftAddress?.id);
  assert.equal(saved.length, 0, "Địa chỉ mới chưa có trong sổ trước xác nhận đặt đơn.");
  assert.equal(session.bookingDraft?.values.uniformQuantity, 2);
  assert.equal(session.bookingDraft?.values.paymentMethod, "wallet");
  assert.equal(session.bookingDraft?.values.problemDescription, "Máy chảy nước");
  await agent.send({ id: userId, role: "CUSTOMER" }, session.id, input);
  assert.equal(writes, 1, "Gửi lại cùng request không ghi thêm địa chỉ.");
  assert.equal(step, 1, "Backend nhận diện và tiếp tục đặt dịch vụ, không cần thêm lượt LLM.");
  const previousConfirmation = session.pendingAction!.id;
  const changedView = await agent.send({ id: userId, role: "CUSTOMER" }, session.id,
    { requestId: randomUUID(), message: `Đổi địa chỉ sang ${changedAddress}` });
  assert.equal(writes, 1); assert.equal(session.pendingAction?.tool, "create_booking");
  assert.equal((session.pendingAction?.preview as { address: string }).address, "134 trần đại nghĩa");
  assert.notEqual(session.pendingAction!.id, previousConfirmation);
  assert.equal(session.actions.find((action) => action.id === previousConfirmation)?.status, "EXPIRED");
  assert(!changedView.messages.some((message) => message.confirmation?.tool === "save_booking_address"));
  assert.equal(session.bookingDraft?.values.addressId, session.bookingDraft?.draftAddress?.id);
  assert.equal(session.bookingDraft?.values.uniformQuantity, 2);
  assert.equal(session.bookingDraft?.values.paymentMethod, "wallet");
  await assert.rejects(() => agent.send({ id: userId, role: "CUSTOMER" }, session.id,
    { requestId: randomUUID(), confirmation: { actionId: previousConfirmation, decision: "CONFIRM" } }), /không khớp/);
  assert.equal(writes, 1, "Xác nhận cũ không được tạo đơn hoặc lưu địa chỉ lại.");
  const selectedAddress = session.bookingDraft?.values.addressId;
  const invalidView = await agent.send({ id: userId, role: "CUSTOMER" }, session.id,
    { requestId: randomUUID(), message: "Thêm Đại học FPT, Phường không tồn tại, Đà Nẵng" });
  assert.equal(writes, 1, "Địa chỉ chưa xác thực không được lưu.");
  assert.equal(session.bookingDraft?.values.addressId, selectedAddress);
  assert.equal(invalidView.pendingConfirmation, null);
  assert.equal(invalidView.state, "WAITING_USER_INPUT");
  assert(invalidView.messages[invalidView.messages.length - 1]?.content.includes("Chưa tìm thấy phường"));
  await loop.prepareBookingDraft(session, { user: { id: userId, role: "CUSTOMER" }, sessionId: session.id,
    session, signal: AbortSignal.timeout(5000) }, async () => {});
  const rejectLoop = new AgentLoop({ generate: async () => ({ type: "MESSAGE", message: "Đã từ chối đặt đơn." }) },
    registry, { maxIterations: 1, systemPrompt: "Kiểm thử", timeoutMs: 5000 });
  const rejectAgent = new AgentService({ acquire: async () => ({ session, lockId: "khoa" }), save: async () => {}, release: async () => {} }, rejectLoop);
  await rejectAgent.send({ id: userId, role: "CUSTOMER" }, session.id,
    { requestId: randomUUID(), confirmation: { actionId: session.pendingAction!.id, decision: "REJECT" } });
  assert.equal(writes, 1); assert.equal(saved.length, 0, "Từ chối đặt đơn không ghi địa chỉ mới.");
  const { updateBookingDraft } = require("../ai/agent/booking-draft") as typeof import("../ai/agent/booking-draft");
  const resumed = await updateBookingDraft(structuredClone(session.bookingDraft), { mode: "resume", quantity: 3 }, userId, deps);
  assert.equal(resumed.draftAddress?.id, selectedAddress, "Khôi phục và sửa số lượng vẫn giữ địa chỉ tạm.");
  assert.equal(resumed.values.addressId, selectedAddress);
  const discarded = await updateBookingDraft(resumed, { mode: "discard" }, userId, deps);
  assert.equal(discarded.draftAddress, undefined); assert.equal(writes, 1);

  // Quản lý sổ và sửa địa chỉ có sẵn vẫn giữ xác nhận, không tự thay dữ liệu đã lưu.
  saved = [{ ...session.bookingDraft!.draftAddress!.payload, _id: new Types.ObjectId(), userId: new Types.ObjectId(userId),
    updatedAt: new Date() } as IAddress];
  const selectedSaved = await updateBookingDraft(resumed, { mode: "update", addressId: String(saved[0]._id) }, userId, deps);
  assert.equal(selectedSaved.draftAddress, undefined);
  for (const addressArgs of [{ addressText: raw, useForBooking: false },
    { addressId: String(saved[0]._id), recipientName: "Nguyễn Bình", useForBooking: true }]) {
    const manageSession = newSession(randomUUID(), userId);
    manageSession.bookingDraft = structuredClone(session.bookingDraft);
    const manageLoop = new AgentLoop({ generate: async () => ({ type: "TOOL_CALL", tool: "save_booking_address", arguments: addressArgs }) },
      registry, { maxIterations: 1, systemPrompt: "Kiểm thử", timeoutMs: 5000 });
    await manageLoop.run(manageSession, { user: { id: userId, role: "CUSTOMER" }, sessionId: manageSession.id,
      session: manageSession, signal: AbortSignal.timeout(5000) }, async () => {});
    assert.equal(manageSession.pendingAction?.tool, "save_booking_address");
    assert.equal(writes, 1);
  }
  mock.restoreAll();

  // Service ghi thật với collection giả: chỉ tùy chọn nội bộ mới được bỏ bước yêu cầu tọa độ.
  const transaction = {};
  mock.method(mongoose.connection, "transaction", async (callback: (session: unknown) => Promise<unknown>) => callback(transaction));
  mock.method(User, "updateOne", async () => ({ matchedCount: 1 }) as never);
  mock.method(Address, "find", () => query([]));
  let createdWithoutCoordinates = false;
  mock.method(Address, "create", async (documents: Record<string, unknown>[], options?: { session?: unknown }) => {
    assert.equal(options?.session, transaction); assert.equal(documents[0].latitude, undefined);
    createdWithoutCoordinates = true; return documents as never;
  });
  let strictGeocodes = 0;
  mock.method(geocoding, "geocodeSavedAddress", async () => { strictGeocodes++; throw Error("Luồng mặc định vẫn yêu cầu vị trí"); });
  const areaPayload = { fullAddress: "Đại học FPT", ward: wards[0].name, province: provinces[0].name, wardCode: 101, provinceCode: 48,
    placeId: `${AGENT_AREA_PLACE_PREFIX}48:101`, recipientName: "Nguyễn An", recipientPhone: "0912345678" };
  await createAddressWithStorage(userId, areaPayload, { allowUnlocated: true });
  assert(createdWithoutCoordinates); assert.equal(strictGeocodes, 0);
  await assert.rejects(() => createAddressWithStorage(userId, areaPayload), /Luồng mặc định/);
  assert.equal(strictGeocodes, 1);
  const current = { ...areaPayload, _id: new Types.ObjectId(), userId: new Types.ObjectId(userId), updatedAt: new Date(),
    latitude: school.latitude, longitude: school.longitude, isDeleted: false,
    toObject() { return { ...this }; } } as unknown as IAddress;
  mock.method(Address, "findOne", () => query(current));
  let clearedOldPin = false;
  mock.method(Address, "findOneAndUpdate", (filter: { userId?: unknown }, update: { $unset?: Record<string, unknown> }, options?: { session?: unknown }) => {
    assert.equal(String(filter.userId), userId); assert.equal(options?.session, transaction);
    assert.equal(update.$unset?.latitude, 1); assert.equal(update.$unset?.longitude, 1);
    clearedOldPin = true; return query(current);
  });
  await addressService.updateAddress(String(current._id), userId, areaPayload, current.updatedAt.toISOString(), { allowUnlocated: true });
  assert(clearedOldPin, "Đổi sang địa chỉ chưa có tọa độ không giữ lại ghim cũ.");
  const locationWithoutPin = { ...current.toObject(), latitude: undefined, longitude: undefined } as IAddress;
  mock.method(addressResolver, "resolveAgentAddress", async () => ({ ...areaPayload, precision: "unlocated", latitude: undefined, longitude: undefined }) as never);
  await assert.rejects(() => addressService.ensureAddressCoordinates(locationWithoutPin), /Địa chỉ đã lưu.*Chưa thể xác định vị trí/);
  mock.method(addressResolver, "resolveAgentAddress", async () => ({ ...areaPayload, precision: "ward", latitude: area.latitude, longitude: area.longitude }) as never);
  mock.method(Address, "findOneAndUpdate", (filter: { userId?: unknown }, update: { $set?: Record<string, unknown> }) => {
    assert.equal(String(filter.userId), userId); assert.equal(update.$set?.latitude, area.latitude);
    return query({ ...locationWithoutPin, latitude: area.latitude, longitude: area.longitude });
  });
  assert.equal((await addressService.ensureAddressCoordinates(locationWithoutPin)).latitude, area.latitude);
  mock.restoreAll();
  console.log("Đạt địa chỉ chat: nhận diện khu vực, chặn địa chỉ sai/mơ hồ, chống trùng/quyền sở hữu, cập nhật thẳng form đặt đơn, giữ thông tin khác, vô hiệu xác nhận cũ và không ghi lặp request.");
}
run().catch((error: unknown) => { mock.restoreAll(); console.error(error); process.exitCode = 1; });
