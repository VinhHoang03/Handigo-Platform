import { Types } from "mongoose";
import User from "../models/user.model";
import {
  IIdentityDocument,
  IProvider,
  IProviderCertificate,
  Provider,
} from "../models/provider.model";
import { AppError } from "../utils/appError";
import {
  CreateCertificatePayload,
  SubmitIdentityPayload,
  UpdateCertificatePayload,
  UpdateProviderProfilePayload,
} from "../validations/providerProfile.validator";

const safeUserSelect =
  "-passwordHash -registerOtp -registerOtpExpire -resetPasswordOtp -resetPasswordOtpExpire -resetPasswordTokenHash -resetPasswordExpire";

const servicePopulate = {
  path: "serviceIds",
  select: "name slug categoryId serviceType fixedPrice image",
};

const assertObjectId = (id: string, fieldName: string) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${fieldName}`, 400);
  }
};

const toDate = (value?: string) => (value ? new Date(value) : undefined);

const toDocumentLast4 = (documentNumber?: string, numberLast4?: string) => {
  if (numberLast4) return numberLast4;
  const digits = documentNumber?.replace(/\D/g, "") || "";
  return digits.length >= 4 ? digits.slice(-4) : undefined;
};

const getProviderForUser = async (userId: string) => {
  assertObjectId(userId, "user id");

  const provider = await Provider.findOne({
    userId: new Types.ObjectId(userId),
    isDeleted: false,
  }).populate(servicePopulate);

  if (!provider) {
    throw new AppError("Provider profile not found", 404);
  }

  return provider;
};

const toIdString = (value: unknown) => {
  const candidate = value as { _id?: Types.ObjectId };
  if (candidate?._id) return candidate._id.toString();
  return String(value);
};

const formatServices = (provider: IProvider) => {
  const services = provider.serviceIds as unknown[];

  return services
    .filter((service) => typeof service === "object" && service !== null)
    .map((service) => {
      const item = service as {
        _id: Types.ObjectId;
        name?: string;
        slug?: string;
      };

      return {
        id: item._id.toString(),
        name: item.name || "",
        slug: item.slug || "",
      };
    });
};

const formatIdentityDocument = (identity?: IIdentityDocument) => {
  if (!identity) return undefined;

  return {
    type: identity.type,
    documentNumber: identity.documentNumber,
    numberLast4: identity.numberLast4,
    fullName: identity.fullName,
    issuedAt: identity.issuedAt,
    expiresAt: identity.expiresAt,
    dateOfBirth: identity.dateOfBirth,
    gender: identity.gender,
    frontImageUrl: identity.frontImageUrl,
    backImageUrl: identity.backImageUrl,
    passportImageUrl: identity.passportImageUrl,
    selfieImageUrl: identity.selfieImageUrl,
    verificationStatus: identity.verificationStatus,
    provider: identity.provider,
    submittedAt: identity.submittedAt,
    verifiedAt: identity.verifiedAt,
    rejectionReason: identity.rejectionReason || null,
  };
};

const formatCertificate = (certificate: IProviderCertificate) => ({
  id: certificate._id?.toString() || "",
  title: certificate.title,
  issuer: certificate.issuer,
  issuedAt: certificate.issuedAt,
  expiresAt: certificate.expiresAt,
  imageUrls: certificate.imageUrls || [],
  description: certificate.description,
  status: certificate.status,
  reviewedAt: certificate.reviewedAt,
  rejectionReason: certificate.rejectionReason || null,
});

const formatProviderProfile = async (provider: IProvider) => {
  const user = await User.findById(provider.userId).select(safeUserSelect);

  if (!user || user.isDeleted) {
    throw new AppError("User not found", 404);
  }

  return {
    user: {
      id: user._id.toString(),
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      avatar: user.avatar,
      birthday: user.birthday,
      gender: user.gender,
      createdAt: user.createdAt,
    },
    provider: {
      id: provider._id.toString(),
      description: provider.description,
      bio: provider.bio,
      mainServiceText: provider.mainServiceText,
      experienceYears: provider.experienceYears,
      availabilityStatus: provider.availabilityStatus,
      verified: provider.verified,
      serviceIds: (provider.serviceIds as unknown[]).map(toIdString),
      services: formatServices(provider),
      workingAreas: provider.workingAreas || [],
      serviceArea: provider.serviceArea,
      averageRating: provider.averageRating,
      totalFeedbacks: provider.totalFeedbacks,
      totalCompletedOrders: provider.totalCompletedOrders,
      identityDocument: formatIdentityDocument(provider.identityDocument),
      certificates: (provider.certificates || []).map(formatCertificate),
    },
  };
};

export const getMyProviderProfile = async (userId: string) => {
  const provider = await getProviderForUser(userId);
  return formatProviderProfile(provider);
};

export const updateMyProviderProfile = async (
  userId: string,
  payload: UpdateProviderProfilePayload,
) => {
  const provider = await getProviderForUser(userId);

  const userUpdate: Record<string, unknown> = {};
  if (payload.fullName !== undefined) userUpdate.fullName = payload.fullName;
  if (payload.phone !== undefined) userUpdate.phone = payload.phone;
  if (payload.avatar !== undefined) userUpdate.avatar = payload.avatar;
  if (payload.birthday !== undefined) {
    userUpdate.birthday = payload.birthday ? new Date(payload.birthday) : null;
  }
  if (payload.gender !== undefined) userUpdate.gender = payload.gender;

  if (Object.keys(userUpdate).length) {
    await User.findByIdAndUpdate(userId, userUpdate, {
      runValidators: true,
    });
  }

  if (payload.description !== undefined) provider.description = payload.description;
  if (payload.bio !== undefined) provider.bio = payload.bio;
  if (payload.mainServiceText !== undefined) {
    provider.mainServiceText = payload.mainServiceText;
  }
  if (payload.serviceArea !== undefined) {
    provider.serviceArea = {
      province: payload.serviceArea.province,
      ward: payload.serviceArea.ward,
    };
  }

  await provider.save();
  await provider.populate(servicePopulate);

  return formatProviderProfile(provider);
};

export const submitMyIdentityDocument = async (
  userId: string,
  payload: SubmitIdentityPayload,
) => {
  const provider = await getProviderForUser(userId);

  provider.identityDocument = {
    type: payload.type,
    documentNumber: payload.documentNumber,
    numberLast4: toDocumentLast4(payload.documentNumber, payload.numberLast4),
    fullName: payload.fullName,
    issuedAt: toDate(payload.issuedAt),
    expiresAt: toDate(payload.expiresAt),
    dateOfBirth: toDate(payload.dateOfBirth),
    gender: payload.gender,
    frontImageUrl: payload.frontImageUrl,
    backImageUrl: payload.backImageUrl,
    passportImageUrl: payload.passportImageUrl,
    selfieImageUrl: payload.selfieImageUrl,
    verificationStatus: "pending",
    provider: "manual",
    consentAcceptedAt: new Date(),
    submittedAt: new Date(),
    verifiedAt: undefined,
    reviewedBy: null,
    reviewedAt: null,
    rejectionReason: null,
  };

  await provider.save();
  await provider.populate(servicePopulate);

  return formatProviderProfile(provider);
};

export const createMyCertificate = async (
  userId: string,
  payload: CreateCertificatePayload,
) => {
  const provider = await getProviderForUser(userId);

  provider.certificates.push({
    title: payload.title,
    issuer: payload.issuer,
    issuedAt: toDate(payload.issuedAt),
    expiresAt: toDate(payload.expiresAt),
    imageUrls: payload.imageUrls,
    description: payload.description,
    status: "pending",
    reviewedBy: null,
    reviewedAt: null,
    rejectionReason: null,
  });

  await provider.save();
  await provider.populate(servicePopulate);

  return formatProviderProfile(provider);
};

export const updateMyCertificate = async (
  userId: string,
  certificateId: string,
  payload: UpdateCertificatePayload,
) => {
  assertObjectId(certificateId, "certificate id");
  const provider = await getProviderForUser(userId);
  const certificate = (provider.certificates as any).id(certificateId);

  if (!certificate) {
    throw new AppError("Certificate not found", 404);
  }

  if (payload.title !== undefined) certificate.title = payload.title;
  if (payload.issuer !== undefined) certificate.issuer = payload.issuer;
  if (payload.issuedAt !== undefined) certificate.issuedAt = toDate(payload.issuedAt);
  if (payload.expiresAt !== undefined) certificate.expiresAt = toDate(payload.expiresAt);
  if (payload.imageUrls !== undefined) certificate.imageUrls = payload.imageUrls;
  if (payload.description !== undefined) certificate.description = payload.description;

  certificate.status = "pending";
  certificate.reviewedBy = null;
  certificate.reviewedAt = null;
  certificate.rejectionReason = null;

  await provider.save();
  await provider.populate(servicePopulate);

  return formatProviderProfile(provider);
};

export const deleteMyCertificate = async (
  userId: string,
  certificateId: string,
) => {
  assertObjectId(certificateId, "certificate id");
  const provider = await getProviderForUser(userId);
  const certificate = (provider.certificates as any).id(certificateId);

  if (!certificate) {
    throw new AppError("Certificate not found", 404);
  }

  certificate.deleteOne();

  await provider.save();
  await provider.populate(servicePopulate);

  return formatProviderProfile(provider);
};
