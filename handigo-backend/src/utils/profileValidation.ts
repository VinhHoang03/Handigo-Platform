export const VIETNAMESE_PHONE_PATTERN = /^\+84(?:3|5|7|8|9)\d{8}$/;
export const PERSON_NAME_PATTERN = /^[\p{L}\p{M}]+(?: [\p{L}\p{M}]+)*$/u;

export const normalizePersonName = (value: string) =>
  value.trim().replace(/\s+/g, " ");

export const normalizeVietnamesePhone = (value: string) => {
  const compactValue = value.trim().replace(/[\s.-]/g, "");

  if (compactValue.startsWith("+84")) return compactValue;
  if (compactValue.startsWith("84")) return `+${compactValue}`;
  if (compactValue.startsWith("0")) return `+84${compactValue.slice(1)}`;

  return compactValue;
};

export const isValidPersonName = (value: string) =>
  PERSON_NAME_PATTERN.test(normalizePersonName(value));

export const isValidVietnamesePhone = (value: string) =>
  VIETNAMESE_PHONE_PATTERN.test(normalizeVietnamesePhone(value));
