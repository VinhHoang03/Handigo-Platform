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
) => {
  if (!workingAreas?.length || !address.ward || !address.province) return false;

  const expectedArea = normalizeAreaPart(`${address.ward}, ${address.province}`);
  return workingAreas.some((area) => normalizeAreaPart(area) === expectedArea);
};
