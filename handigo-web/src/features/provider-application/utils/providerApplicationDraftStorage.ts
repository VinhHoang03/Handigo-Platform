import type { ProviderApplicationDraftPayload } from '../types/providerApplication.types';

type LocalDraft = {
  form: ProviderApplicationDraftPayload;
  sourceVersion: string | null;
};

export const providerApplicationDraftKey = (userId: string, applicationId?: string) =>
  `handigo:provider-application:${userId}:${applicationId || 'initial'}`;

export function readProviderApplicationDraft(key: string, sourceVersion: string | null) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const draft = JSON.parse(raw) as LocalDraft;
    const form = draft.form;
    if (draft.sourceVersion !== sourceVersion ||
      !form || typeof form.description !== 'string' ||
      !Number.isInteger(form.experienceYears) ||
      !Array.isArray(form.serviceIds) || !form.serviceIds.every((id) => typeof id === 'string') ||
      !Array.isArray(form.workingAreas) || !form.workingAreas.every((area) => typeof area === 'string') ||
      !form.identityDocument || !['cccd', 'passport'].includes(form.identityDocument.type) ||
      typeof form.identityDocument.documentNumber !== 'string' ||
      typeof form.identityDocument.fullName !== 'string' ||
      !Array.isArray(form.certificates) || !form.certificates.every((certificate) =>
        certificate && typeof certificate.title === 'string' && Array.isArray(certificate.imageUrls))
    ) return null;
    return form;
  } catch {
    return null;
  }
}

export function writeProviderApplicationDraft(key: string, draft: LocalDraft) {
  try {
    sessionStorage.setItem(key, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function clearProviderApplicationDraft(key: string) {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Trình duyệt có thể chặn bộ nhớ phiên.
  }
}
