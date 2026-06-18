import { providerApplicationApi } from '../api/providerApplication.api';
import type {
  ProviderApplicationCertificate,
  ProviderApplicationIdentityDocument,
  ProviderApplicationPayload,
} from '../types/providerApplication.types';

const optional = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed || undefined;
};

const cleanIdentity = (
  identity: ProviderApplicationIdentityDocument,
): ProviderApplicationIdentityDocument => {
  const clean: ProviderApplicationIdentityDocument = {
    type: identity.type,
    documentNumber: identity.documentNumber.trim(),
    fullName: identity.fullName.trim(),
    issuedPlace: optional(identity.issuedPlace),
    issuedAt: optional(identity.issuedAt),
    expiresAt: optional(identity.expiresAt),
    frontImageUrl:
      identity.type === 'cccd' ? optional(identity.frontImageUrl) : undefined,
    backImageUrl:
      identity.type === 'cccd' ? optional(identity.backImageUrl) : undefined,
    passportImageUrl:
      identity.type === 'passport'
        ? optional(identity.passportImageUrl)
        : undefined,
  };

  if (!clean.documentNumber || !clean.fullName) {
    throw new Error('Vui lòng nhập đầy đủ thông tin giấy tờ định danh.');
  }

  if (clean.type === 'cccd' && !clean.frontImageUrl) {
    throw new Error('Vui lòng tải ảnh CCCD trước khi gửi hồ sơ.');
  }

  if (clean.type === 'passport' && !clean.passportImageUrl) {
    throw new Error('Vui lòng tải ảnh hộ chiếu trước khi gửi hồ sơ.');
  }

  return clean;
};

const hasCertificateDraftData = (certificate: ProviderApplicationCertificate) =>
  Boolean(
    certificate.title.trim() ||
      optional(certificate.issuer) ||
      optional(certificate.issuedAt) ||
      optional(certificate.expiresAt) ||
      certificate.imageUrls.length,
  );

const cleanCertificates = (
  certificates: ProviderApplicationCertificate[],
): ProviderApplicationCertificate[] =>
  certificates.filter(hasCertificateDraftData).map((certificate) => {
    const clean: ProviderApplicationCertificate = {
      title: certificate.title.trim(),
      issuer: optional(certificate.issuer),
      issuedAt: optional(certificate.issuedAt),
      expiresAt: optional(certificate.expiresAt),
      imageUrls: certificate.imageUrls,
    };

    if (!clean.title) {
      throw new Error(
        'Vui lòng nhập tên chứng chỉ hoặc xóa chứng chỉ đang để trống.',
      );
    }

    if (!clean.imageUrls.length) {
      throw new Error(
        'Vui lòng tải tệp chứng chỉ hoặc xóa chứng chỉ đang để trống.',
      );
    }

    return clean;
  });

const cleanDraft = (payload: ProviderApplicationPayload): ProviderApplicationPayload => ({
  ...payload,
  serviceIds: [...new Set(payload.serviceIds)],
  description: payload.description.trim(),
  workingAreas: [
    ...new Set(
      payload.workingAreas.map((area) => area.trim()).filter(Boolean),
    ),
  ],
  identityDocument: {
    type: payload.identityDocument.type,
    documentNumber: payload.identityDocument.documentNumber.trim(),
    fullName: payload.identityDocument.fullName.trim(),
    issuedPlace: optional(payload.identityDocument.issuedPlace),
    issuedAt: optional(payload.identityDocument.issuedAt),
    expiresAt: optional(payload.identityDocument.expiresAt),
    frontImageUrl: optional(payload.identityDocument.frontImageUrl),
    backImageUrl: optional(payload.identityDocument.backImageUrl),
    passportImageUrl: optional(payload.identityDocument.passportImageUrl),
  },
  certificates: payload.certificates
    .filter(hasCertificateDraftData)
    .map((certificate) => ({
      ...certificate,
      title: certificate.title.trim(),
      issuer: optional(certificate.issuer),
      issuedAt: optional(certificate.issuedAt),
      expiresAt: optional(certificate.expiresAt),
      imageUrls: certificate.imageUrls.filter(Boolean),
    })),
});

export const providerApplicationService = {
  loadCategories: providerApplicationApi.categories,
  loadMine: providerApplicationApi.mine,
  uploadImage: providerApplicationApi.uploadImage,
  saveDraft: (payload: ProviderApplicationPayload) =>
    providerApplicationApi.saveDraft(cleanDraft(payload)),
  submit: (payload: ProviderApplicationPayload) => {
    const clean = {
      ...payload,
      serviceIds: [...new Set(payload.serviceIds)],
      description: payload.description.trim(),
      workingAreas: [
        ...new Set(
          payload.workingAreas.map((area) => area.trim()).filter(Boolean),
        ),
      ],
      identityDocument: cleanIdentity(payload.identityDocument),
      certificates: cleanCertificates(payload.certificates),
    };

    if (!clean.serviceIds.length || !clean.workingAreas.length || !clean.description) {
      throw new Error('Vui lòng hoàn thành tất cả thông tin bắt buộc.');
    }

    return providerApplicationApi.create(clean);
  },
};
