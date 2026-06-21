export const VIETNAMESE_MOBILE_PHONE_PATTERN =
  /^0(?:3[2-9]|5[25689]|7[06789]|8[1-9]|9[0-46-9])\d{7}$/;

export const normalizeVietnamesePhone = (value: string) =>
  value.trim().replace(/[\s.-]/g, "");

export const isValidVietnamesePhone = (value: string) =>
  VIETNAMESE_MOBILE_PHONE_PATTERN.test(normalizeVietnamesePhone(value));
