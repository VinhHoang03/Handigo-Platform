import { Types } from "mongoose";
import User from "../models/user.model";
import {
  updateProfileService,
  type UpdateProfileInput,
} from "./user.service";
import {
  IIdentityDocument,
  IProvider,
  IProviderCertificate,
  Provider,
} from "../models/provider.model";
import { AppError } from "../utils/appError";
import { Service } from "../models/service.model";
import { Address } from "../models/address.model";
import { Feedback } from "../models/feedback.model";
import { Category } from "../models/category.model";
import { MatchingService } from "./matching.service";
import { Order } from "../models/order.model";
import { OrderAssignment } from "../models/orderAssignment.model";
import {
  ProviderApplication,
  type IProviderApplication,
} from "../models/providerApplication.model";
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
    throw new AppError(`Định danh ${fieldName} không hợp lệ`, 400);
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
    throw new AppError("Không tìm thấy hồ sơ nhà cung cấp", 404);
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
    issuedPlace: identity.issuedPlace,
    issuedAt: identity.issuedAt,
    expiresAt: identity.expiresAt,
    dateOfBirth: identity.dateOfBirth,
    gender: identity.gender,
    nationality: identity.nationality,
    placeOfOrigin: identity.placeOfOrigin,
    placeOfResidence: identity.placeOfResidence,
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
  certificateNumber: certificate.certificateNumber,
  issuer: certificate.issuer,
  issuedAt: certificate.issuedAt,
  expiresAt: certificate.expiresAt,
  imageUrls: certificate.imageUrls || [],
  description: certificate.description,
  isPublic: Boolean(certificate.isPublic),
  status: certificate.status,
  reviewedAt: certificate.reviewedAt,
  rejectionReason: certificate.rejectionReason || null,
});

const formatPendingProviderProfile = async (
  application: IProviderApplication,
) => {
  const user = await User.findById(application.userId).select(safeUserSelect);

  if (
    !user ||
    user.isDeleted ||
    user.role !== "PROVIDER" ||
    user.providerOnboardingStatus !== "PENDING_REVIEW"
  ) {
    throw new AppError("Không tìm thấy hồ sơ nhà cung cấp", 404);
  }

  const services = (application.serviceIds as unknown[])
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
      id: application._id.toString(),
      description: application.description,
      experienceYears: application.experienceYears,
      availabilityStatus: "offline" as const,
      verified: false,
      serviceIds: application.serviceIds.map(toIdString),
      services,
      workingAreas: application.workingAreas || [],
      averageRating: 0,
      totalFeedbacks: 0,
      totalCompletedOrders: 0,
      identityDocument: formatIdentityDocument(application.identityDocument),
      certificates: (application.certificates || []).map(formatCertificate),
    },
  };
};

const formatProviderProfile = async (provider: IProvider) => {
  const user = await User.findById(provider.userId).select(safeUserSelect);

  if (!user || user.isDeleted) {
    throw new AppError("Không tìm thấy người dùng", 404);
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

export const getFeaturedProviders = async () => {
  const activeUserIds = await User.distinct("_id", {
    status: "active",
    isDeleted: false,
  });
  const providers = await Provider.find({
    verified: true,
    isDeleted: false,
    userId: { $in: activeUserIds },
    "serviceIds.0": { $exists: true },
  })
    .sort({ averageRating: -1, totalFeedbacks: -1, createdAt: -1 })
    .limit(12)
    .populate({ path: "userId", select: "fullName avatar" })
    .populate(servicePopulate)
    .lean();

  return providers
    .filter((provider) => provider.userId)
    .map((provider) => {
      const user = provider.userId as unknown as { _id: Types.ObjectId; fullName: string; avatar?: string };
      const services = provider.serviceIds as unknown as Array<{ _id: Types.ObjectId; name?: string }>;
      return {
        id: provider._id.toString(),
        user: {
          id: user._id.toString(),
          fullName: user.fullName,
          avatar: user.avatar,
        },
        workingAreas: provider.workingAreas || [],
        serviceArea: provider.serviceArea,
        services: services.map((service) => ({
          id: service._id.toString(),
          name: service.name || "",
        })),
        averageRating: provider.averageRating,
        totalFeedbacks: provider.totalFeedbacks,
      };
    });
};

export const getNearbyProvidersForCustomer = async (
  userId: string,
  serviceId: string,
  addressId: string,
  scheduledAtValue?: string,
  recurrenceUnitValue?: string,
  recurrenceCountValue?: number,
  orderIdValue?: string,
) => {
  assertObjectId(userId, "user id");
  assertObjectId(serviceId, "service id");
  assertObjectId(addressId, "address id");
  if (orderIdValue) assertObjectId(orderIdValue, "order id");

  const [service, address] = await Promise.all([
    Service.findOne({
      _id: serviceId,
      isActive: true,
      isDeleted: false,
    }).lean(),
    Address.findOne({
      _id: addressId,
      userId: new Types.ObjectId(userId),
    }).lean(),
  ]);

  if (!service) {
    throw new AppError("Không tìm thấy dịch vụ phù hợp.", 404);
  }

  if (!address) {
    throw new AppError("Không tìm thấy địa chỉ của bạn.", 404);
  }

  const scheduledAt = scheduledAtValue ? new Date(scheduledAtValue) : null;
  if (scheduledAt && (Number.isNaN(scheduledAt.getTime()) || scheduledAt <= new Date())) {
    throw new AppError("Thời gian lịch hẹn không hợp lệ.", 400);
  }
  const recurrenceUnit = ["weekly", "monthly"].includes(recurrenceUnitValue || "")
    ? (recurrenceUnitValue as "weekly" | "monthly")
    : undefined;
  const validRecurrenceCounts = recurrenceUnit === "weekly"
    ? [1, 2, 3, 4]
    : recurrenceUnit === "monthly"
      ? [4, 8, 12]
      : [];
  const recurrenceCount = validRecurrenceCounts.includes(recurrenceCountValue || 0)
    ? recurrenceCountValue
    : undefined;
  const occurrenceDates = scheduledAt
    ? recurrenceUnit && recurrenceCount
      ? Array.from({ length: recurrenceCount }, (_, index) => {
          const occurrence = new Date(scheduledAt);
          if (recurrenceUnit === "weekly") {
            occurrence.setDate(scheduledAt.getDate() + index * 7);
          } else {
            const targetDay = scheduledAt.getDate();
            occurrence.setDate(1);
            occurrence.setMonth(scheduledAt.getMonth() + index);
            const lastDay = new Date(
              occurrence.getFullYear(),
              occurrence.getMonth() + 1,
              0,
            ).getDate();
            occurrence.setDate(Math.min(targetDay, lastDay));
          }
          return occurrence;
        })
      : [scheduledAt]
    : [];

  let excludeProviderIds: Types.ObjectId[] = [];
  if (orderIdValue) {
    const order = await Order.findOne({
      _id: orderIdValue,
      customerId: new Types.ObjectId(userId),
      isDeleted: false,
    })
      .select("_id recurringGroupId")
      .lean();
    if (!order) {
      throw new AppError("Không tìm thấy đơn hàng của bạn.", 404);
    }

    const relatedOrderIds = order.recurringGroupId
      ? await Order.find({
          recurringGroupId: order.recurringGroupId,
          customerId: new Types.ObjectId(userId),
          isDeleted: false,
        }).distinct("_id")
      : [order._id];
    excludeProviderIds = await OrderAssignment.find({
      orderId: { $in: relatedOrderIds },
      status: { $in: ["rejected", "timeout"] },
      isDeleted: false,
    }).distinct("providerId");
  }

  const candidates = await MatchingService.findNearestProviders({
    latitude: address.latitude,
    longitude: address.longitude,
    serviceId: service._id.toString(),
    province: address.province,
    ward: address.ward,
    limit: 5,
    requireOnline: !scheduledAt,
    scheduledDates: occurrenceDates,
    excludeProviderIds,
  });

  if (candidates.length === 0) return [];

  const candidateByProviderId = new Map(
    candidates.map((candidate) => [candidate.providerId.toString(), candidate]),
  );
  const providerIds = candidates.map((candidate) => candidate.providerId);
  const availableProviderIdSet = new Set(providerIds.map(String));
  const providers = await Provider.find({
    _id: { $in: providerIds },
    isDeleted: false,
  })
    .populate({ path: "userId", select: "fullName avatar" })
    .populate(servicePopulate)
    .lean();

  return providers
    .filter((provider) => availableProviderIdSet.has(provider._id.toString()))
    .map((provider) => {
      const candidate = candidateByProviderId.get(provider._id.toString());
      const user = provider.userId as unknown as {
        _id: Types.ObjectId;
        fullName?: string;
        avatar?: string | null;
      };
      const services = provider.serviceIds as unknown as Array<{
        _id: Types.ObjectId;
        name?: string;
      }>;

      return {
        id: provider._id.toString(),
        user: {
          id: user?._id?.toString() || "",
          fullName: user?.fullName || "Chuyên gia Handigo",
          avatar: user?.avatar || null,
        },
        services: services.map((item) => ({
          id: item._id.toString(),
          name: item.name || "",
        })),
        workingAreas: provider.workingAreas || [],
        serviceArea: provider.serviceArea,
        availabilityStatus: provider.availabilityStatus,
        averageRating: provider.averageRating,
        totalFeedbacks: provider.totalFeedbacks,
        totalCompletedOrders: provider.totalCompletedOrders,
        distanceMeters: candidate?.distanceMeters ?? -1,
      };
    })
    .sort((a, b) => {
      const aIndex = providerIds.findIndex((id) => id.toString() === a.id);
      const bIndex = providerIds.findIndex((id) => id.toString() === b.id);
      return aIndex - bIndex;
    });
};

export const getPublicProviderProfile = async (providerId: string) => {
  assertObjectId(providerId, "provider id");

  const provider = await Provider.findOne({
    _id: providerId,
    isDeleted: false,
    verified: true,
  })
    .populate({ path: "userId", select: "fullName avatar createdAt" })
    .populate(servicePopulate)
    .lean();

  if (!provider || !provider.userId) {
    throw new AppError("Không tìm thấy hồ sơ chuyên gia.", 404);
  }

  const user = provider.userId as unknown as {
    _id: Types.ObjectId;
    fullName?: string;
    avatar?: string | null;
    createdAt?: Date;
  };
  const services = provider.serviceIds as unknown as Array<{
    _id: Types.ObjectId;
    name?: string;
    slug?: string;
    categoryId?: Types.ObjectId;
  }>;
  const categoryIds = services.flatMap((service) =>
    service.categoryId ? [service.categoryId] : [],
  );

  const [latestFeedbacks, categories] = await Promise.all([
    Feedback.find({
      providerId: provider._id,
      isVisible: true,
      isDeleted: false,
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("customerId", "fullName avatar")
      .populate("serviceId", "name image")
      .lean(),
    Category.find({
      _id: { $in: categoryIds },
      isActive: true,
      isDeleted: false,
    })
      .select("name slug icon")
      .sort({ name: 1 })
      .lean(),
  ]);

  return {
    user: {
      id: user._id.toString(),
      fullName: user.fullName || "Chuyên gia Handigo",
      avatar: user.avatar || null,
      joinedAt: user.createdAt,
    },
    provider: {
      id: provider._id.toString(),
      description: provider.description,
      bio: provider.bio,
      mainServiceText: provider.mainServiceText,
      experienceYears: provider.experienceYears,
      availabilityStatus: provider.availabilityStatus,
      verified: provider.verified,
      services: services.map((service) => ({
        id: service._id.toString(),
        name: service.name || "",
        slug: service.slug || "",
        categoryId: service.categoryId?.toString() || "",
      })),
      serviceCategories: categories.map((category) => ({
        id: category._id.toString(),
        name: category.name,
        slug: category.slug,
        icon: category.icon,
        services: services
          .filter(
            (service) =>
              service.categoryId?.toString() === category._id.toString(),
          )
          .map((service) => ({
            id: service._id.toString(),
            name: service.name || "",
            slug: service.slug || "",
          })),
      })),
      workingAreas: provider.workingAreas || [],
      serviceArea: provider.serviceArea,
      averageRating: provider.averageRating,
      totalFeedbacks: provider.totalFeedbacks,
      totalCompletedOrders: provider.totalCompletedOrders,
      identityVerified:
        provider.identityDocument?.verificationStatus === "verified",
      certificates: (provider.certificates || [])
        .filter(
          (certificate) =>
            certificate.status === "approved" && certificate.isPublic,
        )
        .map(formatCertificate),
    },
    feedbacks: latestFeedbacks.map((feedback) => {
      const customer = feedback.customerId as unknown as {
        fullName?: string;
        avatar?: string | null;
      };
      const service = feedback.serviceId as unknown as {
        name?: string;
        image?: string | null;
      };

      return {
        id: feedback._id.toString(),
        rating: feedback.rating,
        comment: feedback.comment,
        images: feedback.images || [],
        createdAt: feedback.createdAt,
        customer: {
          fullName: customer?.fullName || "Khách hàng Handigo",
          avatar: customer?.avatar || null,
        },
        service: {
          name: service?.name || "Dịch vụ",
          image: service?.image || null,
        },
        providerReply: feedback.providerReply
          ? {
              content: feedback.providerReply.content,
              repliedAt: feedback.providerReply.repliedAt,
            }
          : null,
      };
    }),
  };
};

export const getMyProviderProfile = async (userId: string) => {
  assertObjectId(userId, "user id");

  const provider = await Provider.findOne({
    userId: new Types.ObjectId(userId),
    isDeleted: false,
  }).populate(servicePopulate);

  if (provider) return formatProviderProfile(provider);

  const pendingApplication = await ProviderApplication.findOne({
    userId: new Types.ObjectId(userId),
    applicationType: { $in: ["initial", null] },
    status: { $in: ["pending", "resubmitted"] },
    isDeleted: false,
  })
    .sort({ updatedAt: -1 })
    .populate(servicePopulate);

  if (!pendingApplication) {
    throw new AppError("Không tìm thấy hồ sơ nhà cung cấp", 404);
  }

  return formatPendingProviderProfile(pendingApplication);
};

export const updateMyProviderProfile = async (
  userId: string,
  payload: UpdateProviderProfilePayload,
) => {
  const provider = await getProviderForUser(userId);

  const userUpdate: UpdateProfileInput = {};
  if (payload.fullName !== undefined) userUpdate.fullName = payload.fullName;
  if (payload.phone !== undefined) userUpdate.phone = payload.phone;
  if (payload.avatar !== undefined) userUpdate.avatar = payload.avatar;
  if (payload.birthday !== undefined) {
    userUpdate.birthday = payload.birthday ? new Date(payload.birthday) : null;
  }
  if (payload.gender !== undefined) userUpdate.gender = payload.gender;

  if (Object.keys(userUpdate).length) {
    await updateProfileService(userId, userUpdate);
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
  if (payload.workingAreas !== undefined) {
    provider.workingAreas = [...new Set(payload.workingAreas)];
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
  const currentIdentity = provider.identityDocument;

  provider.identityDocument = {
    type: payload.type,
    documentNumber: payload.documentNumber,
    numberLast4: toDocumentLast4(payload.documentNumber, payload.numberLast4),
    fullName: payload.fullName,
    issuedPlace: payload.issuedPlace,
    issuedAt: toDate(payload.issuedAt),
    expiresAt: toDate(payload.expiresAt),
    dateOfBirth: toDate(payload.dateOfBirth),
    gender: payload.gender,
    nationality: payload.nationality ?? currentIdentity?.nationality,
    placeOfOrigin: payload.placeOfOrigin ?? currentIdentity?.placeOfOrigin,
    placeOfResidence:
      payload.placeOfResidence ?? currentIdentity?.placeOfResidence,
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
    certificateNumber: payload.certificateNumber,
    issuer: payload.issuer,
    issuedAt: toDate(payload.issuedAt),
    expiresAt: toDate(payload.expiresAt),
    imageUrls: payload.imageUrls,
    description: payload.description,
    isPublic: payload.isPublic ?? false,
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
    throw new AppError("Không tìm thấy chứng chỉ", 404);
  }

  if (payload.title !== undefined) certificate.title = payload.title;
  if (payload.certificateNumber !== undefined) {
    certificate.certificateNumber = payload.certificateNumber;
  }
  if (payload.issuer !== undefined) certificate.issuer = payload.issuer;
  if (payload.issuedAt !== undefined) certificate.issuedAt = toDate(payload.issuedAt);
  if (payload.expiresAt !== undefined) certificate.expiresAt = toDate(payload.expiresAt);
  if (payload.imageUrls !== undefined) certificate.imageUrls = payload.imageUrls;
  if (payload.description !== undefined) certificate.description = payload.description;
  if (payload.isPublic !== undefined) certificate.isPublic = payload.isPublic;

  const reviewSensitiveFields = [
    "title",
    "certificateNumber",
    "issuer",
    "issuedAt",
    "expiresAt",
    "imageUrls",
    "description",
  ];
  if (reviewSensitiveFields.some((field) => field in payload)) {
    certificate.status = "pending";
    certificate.reviewedBy = null;
    certificate.reviewedAt = null;
    certificate.rejectionReason = null;
  }

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
    throw new AppError("Không tìm thấy chứng chỉ", 404);
  }

  certificate.deleteOne();

  await provider.save();
  await provider.populate(servicePopulate);

  return formatProviderProfile(provider);
};
