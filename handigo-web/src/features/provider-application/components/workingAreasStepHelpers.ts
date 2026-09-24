import type { SearchableSelectOption } from "@/components/common/SearchableSelect";
import type { AdministrativeUnit } from "@/features/customer/api/vietnamAddress.api";

export const toSelectOptions = (
  items: AdministrativeUnit[],
): SearchableSelectOption[] =>
  items.map((item) => ({
    value: item.code,
    label: item.name,
    searchText: `${item.codeName} ${item.divisionType}`,
  }));

export const getProvinceName = (area: string) => {
  const separatorIndex = area.lastIndexOf(",");
  return separatorIndex >= 0 ? area.slice(separatorIndex + 1).trim() : "";
};

export const normalizeName = (value: string) =>
  value.normalize("NFC").trim().toLocaleLowerCase("vi");
