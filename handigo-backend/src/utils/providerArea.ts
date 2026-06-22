const normalizeAreaPart = (value?: string) =>
  (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

export const isAddressInProviderWorkingAreas = (
  workingAreas: string[] | undefined,
  address: { ward?: string; province?: string },
  legacyServiceArea?: { ward?: string; province?: string },
) => {
  if (!address.ward || !address.province) return false;

  const legacyArea = [legacyServiceArea?.ward, legacyServiceArea?.province]
    .filter(Boolean)
    .join(", ");
  const areas =
    workingAreas?.length
      ? workingAreas
      : legacyArea
        ? [legacyArea]
        : [];
  if (areas.length === 0) return false;

  const expectedArea = normalizeAreaPart(`${address.ward}, ${address.province}`);
  return areas.some((area) => normalizeAreaPart(area) === expectedArea);
};
