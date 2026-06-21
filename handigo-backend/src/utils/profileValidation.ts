export const VIETNAMESE_PHONE_PATTERN =
  /^0(?:3[2-9]|5[25689]|7[06789]|8[1-9]|9[0-46-9])\d{7}$/;
export const PERSON_NAME_PATTERN = /^[\p{L}\p{M}]+(?: [\p{L}\p{M}]+)*$/u;

export const normalizePersonName = (value: string) =>
  value.trim().replace(/\s+/g, " ");

export const normalizeVietnamesePhone = (value: string) => {
  const compactValue = value.trim().replace(/[\s.-]/g, "");
  return compactValue;
};

export const isValidPersonName = (value: string) =>
  PERSON_NAME_PATTERN.test(normalizePersonName(value));

export const isValidVietnamesePhone = (value: string) =>
  VIETNAMESE_PHONE_PATTERN.test(normalizeVietnamesePhone(value));

export const getVietnamesePhoneLookupValues = (value: string) => {
  const normalized = normalizeVietnamesePhone(value);
  return [normalized, `+84${normalized.slice(1)}`];
};
