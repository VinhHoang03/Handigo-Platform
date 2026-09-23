/**
 * Tách/ghép "địa chỉ cụ thể" (số nhà, tên đường) khỏi chuỗi địa chỉ đầy đủ
 * (đã kèm phường/xã, tỉnh/thành). Dùng chung cho form nhập tay và geocode.
 */

export const normalizeAddressPart = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

export const composeFullAddress = (
  addressLine: string,
  ward: string,
  province: string,
) => {
  const parts = [addressLine.trim()];
  const normalizedAddressLine = normalizeAddressPart(addressLine);

  [ward, province]
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((part) => {
      if (!normalizedAddressLine.includes(normalizeAddressPart(part))) {
        parts.push(part);
      }
    });

  return parts.filter(Boolean).join(", ");
};

export const extractAddressLine = (
  fullAddress: string,
  ward?: string,
  province?: string,
) => {
  const administrativeParts = [ward, province]
    .map((part) => part?.trim().toLowerCase())
    .filter(Boolean);

  return fullAddress
    .split(",")
    .map((part) => part.trim())
    .filter((part) => !administrativeParts.includes(part.toLowerCase()))
    .join(", ")
    .trim();
};

export const extractStreetAddressLine = (
  fullAddress: string,
  ward?: string,
  province?: string,
) => {
  const segments = fullAddress
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (!segments.length) return "";

  const normalizedWard = normalizeAddressPart(ward || "");
  const normalizedProvince = normalizeAddressPart(province || "");
  const streetParts: string[] = [];

  for (const segment of segments) {
    const normalizedSegment = normalizeAddressPart(segment);
    const isAdministrativeSegment =
      normalizedSegment === normalizedWard ||
      normalizedSegment === normalizedProvince ||
      normalizedSegment.includes("viet nam") ||
      normalizedSegment.includes("vietnam") ||
      /\b\d{5,6}\b/.test(segment);

    if (isAdministrativeSegment) break;
    streetParts.push(segment);
  }

  return extractAddressLine(streetParts.join(" "), ward, province);
};
