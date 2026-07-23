import type { CertificateForm } from "@/features/provider/utils/providerProfilePage";
import type {
  ProviderApplication,
  ProviderApplicationCertificate,
} from "../types/providerApplication.types";

export const serviceId = (service: ProviderApplication["serviceIds"][number]) =>
  typeof service === "string" ? service : service._id;

export const toCertificateForm = (
  certificate: ProviderApplicationCertificate,
): CertificateForm => ({
  title: certificate.title,
  issuer: certificate.issuer || "",
  issuedAt: certificate.issuedAt?.slice(0, 10) || "",
  expiresAt: certificate.expiresAt?.slice(0, 10) || "",
  imageUrls: certificate.imageUrls || [],
  description: certificate.description || "",
  isPublic: false,
});

export const toCertificatePayload = (
  certificate: CertificateForm,
): ProviderApplicationCertificate => ({
  title: certificate.title.trim(),
  issuer: certificate.issuer.trim() || undefined,
  issuedAt: certificate.issuedAt || undefined,
  expiresAt: certificate.expiresAt || undefined,
  imageUrls: certificate.imageUrls,
  description: certificate.description.trim() || undefined,
});
