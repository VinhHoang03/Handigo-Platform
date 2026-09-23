import type {
  ProviderApplication,
  ProviderApplicationPayload,
  Service,
} from "../types/providerApplication.types";

export const initialProviderApplicationForm: ProviderApplicationPayload = {
  description: "",
  experienceYears: 2,
  serviceIds: [],
  workingAreas: [],
  identityDocument: {
    type: "cccd",
    documentNumber: "",
    fullName: "",
    issuedPlace: "",
    frontImageUrl: "",
    backImageUrl: "",
    passportImageUrl: "",
    dateOfBirth: "",
    gender: undefined,
    nationality: "",
    placeOfOrigin: "",
    placeOfResidence: "",
  },
  certificates: [],
};

export const hasRequiredIdentityImage = (form: ProviderApplicationPayload) =>
  form.identityDocument.type === "cccd"
    ? Boolean(form.identityDocument.frontImageUrl)
    : Boolean(form.identityDocument.passportImageUrl);

const serviceId = (service: string | Service) =>
  typeof service === "string" ? service : service._id;

export const applicationToForm = (
  application: ProviderApplication,
): ProviderApplicationPayload => ({
  description: application.description || "",
  experienceYears: application.experienceYears || 0,
  serviceIds: (application.serviceIds || []).map(serviceId).filter(Boolean),
  workingAreas: application.workingAreas || [],
  identityDocument: {
    type: application.identityDocument?.type || "cccd",
    documentNumber: application.identityDocument?.documentNumber || "",
    fullName: application.identityDocument?.fullName || "",
    issuedPlace: application.identityDocument?.issuedPlace || "",
    issuedAt: application.identityDocument?.issuedAt?.slice(0, 10) || "",
    expiresAt: application.identityDocument?.expiresAt?.slice(0, 10) || "",
    frontImageUrl: application.identityDocument?.frontImageUrl || "",
    backImageUrl: application.identityDocument?.backImageUrl || "",
    passportImageUrl: application.identityDocument?.passportImageUrl || "",
    dateOfBirth: application.identityDocument?.dateOfBirth?.slice(0, 10) || "",
    gender: application.identityDocument?.gender,
    nationality: application.identityDocument?.nationality || "",
    placeOfOrigin: application.identityDocument?.placeOfOrigin || "",
    placeOfResidence: application.identityDocument?.placeOfResidence || "",
  },
  certificates: (application.certificates || []).map((certificate) => ({
    title: certificate.title || "",
    certificateNumber: certificate.certificateNumber || "",
    issuer: certificate.issuer || "",
    issuedAt: certificate.issuedAt?.slice(0, 10) || "",
    expiresAt: certificate.expiresAt?.slice(0, 10) || "",
    imageUrls: certificate.imageUrls || [],
  })),
});

export const hasUploadedAsset = (form: ProviderApplicationPayload) =>
  Boolean(
    form.identityDocument.frontImageUrl ||
    form.identityDocument.backImageUrl ||
    form.identityDocument.passportImageUrl ||
    form.certificates.some((certificate) => certificate.imageUrls.length),
  );
