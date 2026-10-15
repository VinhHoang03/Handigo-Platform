export interface MatchingSearch {
  initialRadiusKm: number;
  expandedRadiusKm: number;
  expandsAt: Date;
  expiresAt: Date;
}

/** Đề nghị nhận đơn không dài hơn khoảng chờ trước khi mở rộng tìm kiếm. */
export function getProviderResponseTimeoutSeconds(responseSeconds: number, expandAfterMinutes: number) {
  return Math.min(Math.max(responseSeconds, 1), Math.max(expandAfterMinutes, 0.1) * 60);
}

export function buildMatchingSearch(startedAt: Date, initialRadiusKm: number,
  expandedRadiusKm: number, expandAfterMinutes: number, expandedDurationMinutes: number): MatchingSearch {
  const expandsAt = new Date(startedAt.getTime() + expandAfterMinutes * 60_000);
  return { initialRadiusKm, expandedRadiusKm, expandsAt,
    expiresAt: new Date(expandsAt.getTime() + expandedDurationMinutes * 60_000) };
}

export function getMatchingSearchStage(search: MatchingSearch, now = Date.now()) {
  const expanded = now >= search.expandsAt.getTime();
  return {
    radiusKm: expanded ? search.expandedRadiusKm : search.initialRadiusKm,
    deadline: expanded ? search.expiresAt : search.expandsAt,
    expired: now >= search.expiresAt.getTime(),
  };
}
