import assert from "node:assert/strict";
import { mock } from "node:test";
import { Types } from "mongoose";
import { bookingFixture, bookingFixtureIds as ids } from "./fixtures/agentBooking.fixture";
import { bookingDraftPatchSchema, updateBookingDraft, readyBookingArguments } from "../ai/agent/booking-draft";
import { getUniformServicePrice } from "../utils/uniformServicePrice";
import { ServiceOption } from "../models/serviceOption.model";
import { Order } from "../models/order.model";
import type { IService } from "../models/service.model";

// Cô lập cấu hình giá để kiểm tra service thật mà không đọc .env hoặc kết nối database.
const configId = require.resolve("../services/systemConfig.service");
require.cache[configId] = { id: configId, filename: configId, loaded: true,
  exports: { getNumberConfigValue: async () => 0 } } as NodeModule;

async function main() {
  const { buildServicePricingSnapshot } = await import("../services/servicePricing.service");
  const fixture = bookingFixture();
  const service = fixture.services[1];
  service.options.push({ ...service.options[0], _id: "999999999999999999999999", name: "Máy âm trần" });
  const patch = (value: unknown) => bookingDraftPatchSchema.parse(value);
  let draft = await updateBookingDraft(undefined, patch({ serviceId: ids.other }), "khách", fixture.deps);
  assert.equal(draft.values.uniformQuantity, 1);
  assert.equal(draft.values.selectedOptions, undefined);
  assert.deepEqual(draft.missing, []);
  assert.deepEqual(draft.choiceGroups, []);
  assert.ok(!draft.summary.join(" ").includes("Máy treo tường"));
  assert.ok(!draft.summary.join(" ").includes("Máy âm trần"));
  assert.equal(readyBookingArguments(draft)?.uniformQuantity, 1);
  draft = await updateBookingDraft(draft, patch({ quantity: 2 }), "khách", fixture.deps);
  assert.equal(draft.values.uniformQuantity, 2);
  assert.equal(draft.sources.uniformQuantity, "customer");
  const optionQuery = mock.method(ServiceOption, "find", () => ({ sort: async () => service.options }));
  try {
    const pricingService = { _id: new Types.ObjectId(service.id), name: service.name, serviceType: service.serviceType,
      requiresOptionSelection: true } as IService;
    const price = await buildServicePricingSnapshot(pricingService, [], undefined, 2);
    assert.equal(price.bookingAmount, 300000);
    assert.deepEqual(price.optionIds, []);
    assert.equal(price.selectedOptionsSnapshot[0].optionId, null);
    assert.equal(price.selectedOptionsSnapshot[0].name, service.name);
    assert.equal(price.selectedOptionsSnapshot[0].quantity, 2);
    assert.equal(price.selectedOptionsSnapshot[0].subtotal, 300000);
    const order = new Order({ selectedOptionsSnapshot: price.selectedOptionsSnapshot });
    await order.validate(["selectedOptionsSnapshot"]);
    await assert.rejects(buildServicePricingSnapshot(pricingService, [], [{ optionId: ids.single, quantity: 1 }], 2));
    service.options[1].price = 200000;
    await assert.rejects(buildServicePricingSnapshot(pricingService, [], undefined, 2));
    const changed = await updateBookingDraft(draft, patch({}), "khách", fixture.deps);
    assert.equal(changed.values.uniformQuantity, undefined);
    assert.ok(changed.missing.length > 0);
    service.options[1].price = 150000;
    const explicit = await updateBookingDraft(draft, patch({ selectedOptions: [{ optionId: ids.single, quantity: 2 }] }), "khách", fixture.deps);
    assert.equal(explicit.values.uniformQuantity, undefined);
    assert.equal(explicit.values.selectedOptions?.[0].optionId, ids.single);
    const normal = await buildServicePricingSnapshot(pricingService, [], [{ optionId: ids.single, quantity: 2 }]);
    assert.equal(String(normal.selectedOptionsSnapshot[0].optionId), ids.single);
    assert.equal(normal.selectedOptionsSnapshot[0].name, "Máy treo tường");
  } finally { optionQuery.mock.restore(); }

  const options = service.options;
  assert.ok(getUniformServicePrice("fixed_price", options));
  assert.equal(getUniformServicePrice("variable_price", options), null);
  assert.equal(getUniformServicePrice("fixed_price", options.map((option) => ({ ...option, optionType: "area_size" }))), null);
  assert.equal(getUniformServicePrice("fixed_price", options.map((option) => ({ ...option, optionType: "package" }))), null);
  assert.equal(getUniformServicePrice("fixed_price", [options[0], { ...options[1], allowsQuantity: false }]), null);
  assert.equal(getUniformServicePrice("fixed_price", [options[0], { ...options[1], description: "Cần thiết bị chuyên dụng" }]), null);
  assert.equal(getUniformServicePrice("fixed_price", [options[0], { ...options[1], selectionGroup: "Phạm vi khác" }]), null);
  assert.equal(getUniformServicePrice("fixed_price", [options[0], { ...options[1], isRequired: true }]), null);
  const withAddon = [...options, { ...options[0], optionType: "add_on", price: 50000 }];
  assert.equal(getUniformServicePrice("fixed_price", withAddon)?.unitPrice, 150000);
  console.log("Đã kiểm tra đồng giá không hỏi loại máy, giữ số lượng, snapshot không gán loại máy, cấu hình đổi, gói khác phạm vi và tùy chọn khách đã chọn.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
