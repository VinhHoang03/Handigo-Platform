const test = require("node:test");
const assert = require("node:assert/strict");
require("ts-node/register/transpile-only");
const {
  parseRewardWeek,
  providerOrderDiamonds,
  providerRewardWeek,
  rewardWeekKey,
  summarizeProviderRewards,
} = require("../src/services/providerRewardsPolicy.ts");

test("Tuần thưởng đổi vào 00:00 thứ Hai theo giờ Việt Nam", () => {
  assert.equal(rewardWeekKey(providerRewardWeek(new Date("2026-11-08T16:59:59.999Z"))), "2026-11-02");
  assert.equal(rewardWeekKey(providerRewardWeek(new Date("2026-11-08T17:00:00.000Z"))), "2026-11-09");
  assert.equal(parseRewardWeek("2026-11-09").toISOString(), "2026-11-08T17:00:00.000Z");
  assert.equal(parseRewardWeek("2026-11-08"), null);
  assert.equal(parseRewardWeek("2026-02-30"), null);
});

test("Giá cố định chia đúng biên và đơn báo giá luôn nhận 10 kim cương", () => {
  assert.deepEqual([149999, 150000, 249999, 250000].map((amount) => providerOrderDiamonds(false, amount)), [10, 15, 15, 20]);
  assert.deepEqual([100000, 200000, 500000].map((amount) => providerOrderDiamonds(true, amount)), [10, 10, 10]);
});

test("Chốt cộng dồn đúng mốc và yêu cầu đạt đủ ba điều kiện", () => {
  assert.equal(summarizeProviderRewards(74, 9, 1, 24, 5).amount, 0);
  assert.equal(summarizeProviderRewards(160, 9, 1, 24, 5).amount, 50000);
  assert.equal(summarizeProviderRewards(225, 9, 1, 24, 5).amount, 100000);
  assert.equal(summarizeProviderRewards(225, 8, 2, 24, 5).amount, 0);
  assert.equal(summarizeProviderRewards(225, 10, 0, 23.5, 5).amount, 0);
  assert.equal(summarizeProviderRewards(225, 10, 0, 0, 0).amount, 0);
});
