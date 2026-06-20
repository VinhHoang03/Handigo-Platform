import type { ProviderApplicationPayload } from '../types/providerApplication.types';

export interface DateFieldErrors {
  issuedAt?: string;
  expiresAt?: string;
  dateOfBirth?: string;
}

const localDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const todayDate = () => localDate(new Date());

export const validateDateFields = (
  issuedAt?: string,
  expiresAt?: string,
): DateFieldErrors => {
  const errors: DateFieldErrors = {};
  const today = todayDate();

  if (issuedAt && issuedAt > today) {
    errors.issuedAt = 'Ngày cấp không được sau ngày hiện tại.';
  }
  if (expiresAt && expiresAt < today) {
    errors.expiresAt = 'Tài liệu đã hết hạn.';
  }
  if (issuedAt && expiresAt && expiresAt <= issuedAt) {
    errors.expiresAt = 'Ngày hết hạn phải sau ngày cấp.';
  }

  return errors;
};

export const getProviderApplicationDateErrors = (
  form: ProviderApplicationPayload,
) => ({
  identity: {
    ...validateDateFields(
      form.identityDocument.issuedAt,
      form.identityDocument.expiresAt,
    ),
    ...(form.identityDocument.dateOfBirth &&
    form.identityDocument.dateOfBirth > todayDate()
      ? { dateOfBirth: 'Ngày sinh không được sau ngày hiện tại.' }
      : {}),
  },
  certificates: form.certificates.map((certificate) =>
    validateDateFields(certificate.issuedAt, certificate.expiresAt),
  ),
});

export const hasProviderApplicationDateErrors = (
  form: ProviderApplicationPayload,
) => {
  const errors = getProviderApplicationDateErrors(form);
  return Boolean(
    errors.identity.issuedAt ||
      errors.identity.expiresAt ||
      errors.identity.dateOfBirth ||
      errors.certificates.some((item) => item.issuedAt || item.expiresAt),
  );
};
