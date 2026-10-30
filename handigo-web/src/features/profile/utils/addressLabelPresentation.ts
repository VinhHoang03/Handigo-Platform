export type AddressLabelKind = "home" | "office" | "other";

const normalizeLabel = (label?: string) =>
  label
    ?.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase() || "";

export const getAddressLabelKind = (label?: string): AddressLabelKind => {
  const normalizedLabel = normalizeLabel(label);

  if (["nha", "nha rieng", "home"].includes(normalizedLabel)) {
    return "home";
  }

  if (
    normalizedLabel.includes("van phong") ||
    normalizedLabel.includes("cong ty") ||
    normalizedLabel === "office"
  ) {
    return "office";
  }

  return "other";
};

export const getAddressLabelSelectionKind = (
  label?: string,
): AddressLabelKind => {
  const normalizedLabel = normalizeLabel(label);

  if (["nha", "nha rieng", "home"].includes(normalizedLabel)) {
    return "home";
  }

  if (["van phong", "cong ty", "office"].includes(normalizedLabel)) {
    return "office";
  }

  return "other";
};
