export const isAirConditionerCleaning = (service: { slug?: string; name?: string }) =>
  (service.slug || service.name?.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d").toLowerCase().trim().replace(/\s+/g, "-")) === "ve-sinh-dieu-hoa";
