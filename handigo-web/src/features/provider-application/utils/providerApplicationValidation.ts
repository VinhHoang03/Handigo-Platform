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

export const getProviderApplicationSubmissionErrors = (form: ProviderApplicationPayload) => {
  const errors: string[] = [];
  if (!form.serviceIds.length) errors.push('Chọn ít nhất một dịch vụ ở bước 1.');
  if (!form.workingAreas.length) errors.push('Thêm ít nhất một khu vực hoạt động ở bước 2.');
  if (!form.description.trim()) errors.push('Nhập mô tả kinh nghiệm.');
  if (!form.identityDocument.documentNumber.trim()) errors.push('Nhập số giấy tờ định danh.');
  if (!form.identityDocument.fullName.trim()) errors.push('Nhập họ tên trên giấy tờ.');
  if (form.identityDocument.type === 'cccd' && !form.identityDocument.frontImageUrl) {
    errors.push('Tải ảnh mặt trước CCCD (bắt buộc).');
  }
  if (form.identityDocument.type === 'passport' && !form.identityDocument.passportImageUrl) {
    errors.push('Tải ảnh hộ chiếu (bắt buộc).');
  }
  form.certificates.forEach((certificate, index) => {
    const filled = certificate.title.trim() || certificate.certificateNumber?.trim() ||
      certificate.issuer?.trim() || certificate.issuedAt || certificate.expiresAt || certificate.imageUrls.length;
    if (!filled) return;
    if (!certificate.title.trim()) errors.push(`Nhập tên chứng chỉ ${index + 1} hoặc xóa mục này.`);
    if (!certificate.imageUrls.length) errors.push(`Tải tệp chứng chỉ ${index + 1} hoặc xóa mục này.`);
  });
  if (hasProviderApplicationDateErrors(form)) errors.push('Sửa các ngày không hợp lệ được đánh dấu trong hồ sơ.');
  return errors;
};
