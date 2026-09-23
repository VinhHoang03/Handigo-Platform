export interface MatchingSearch {
  initialRadiusKm: number;
  expandedRadiusKm: number;
  expandsAt: Date;
  expiresAt: Date;
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
