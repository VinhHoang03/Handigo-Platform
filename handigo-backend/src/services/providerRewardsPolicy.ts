const dayMs = 86_400_000;
const vietnamOffsetMs = 7 * 3_600_000;
export const rewardWeekMs = 7 * dayMs;

export const providerRewardMilestones = [
  { diamonds: 75, amount: 20_000 },
  { diamonds: 150, amount: 30_000 },
  { diamonds: 225, amount: 50_000 },
] as const;

export function providerRewardWeek(date: Date) {
  const local = new Date(date.getTime() + vietnamOffsetMs);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(),
    local.getUTCDate() - (local.getUTCDay() + 6) % 7) - vietnamOffsetMs);
}

export function rewardWeekKey(date: Date) {
  return new Date(date.getTime() + vietnamOffsetMs).toISOString().slice(0, 10);
}

export function parseRewardWeek(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00+07:00`);
  if (!Number.isFinite(date.getTime()) || rewardWeekKey(date) !== value
    || providerRewardWeek(date).getTime() !== date.getTime()) return null;
  return date;
}

export function providerOrderDiamonds(inspectionRequired: boolean, amount: number) {
  if (inspectionRequired) return 10;
  if (amount < 150_000) return 10;
  if (amount < 250_000) return 15;
  return 20;
}

export function summarizeProviderRewards(diamonds: number, completed: number, cancelled: number,
  ratingSum: number, ratingCount: number) {
  const total = completed + cancelled;
  const completionRate = total ? completed * 100 / total : null;
  const cancellationRate = total ? cancelled * 100 / total : null;
  const averageRating = ratingCount ? ratingSum / ratingCount : null;
  const completionMet = total > 0 && completed * 10 >= total * 9;
  const cancellationMet = total > 0 && cancelled * 10 <= total;
  const ratingMet = ratingCount > 0 && ratingSum * 5 >= ratingCount * 24;
  const eligible = completionMet && cancellationMet && ratingMet;
  const milestones = providerRewardMilestones.filter((milestone) => diamonds >= milestone.diamonds);
  return {
    diamonds, completed, cancelled, completionRate, cancellationRate, averageRating, ratingCount,
    completionMet, cancellationMet, ratingMet, eligible,
    amount: eligible ? milestones.reduce((sum, milestone) => sum + milestone.amount, 0) : 0,
  };
}
