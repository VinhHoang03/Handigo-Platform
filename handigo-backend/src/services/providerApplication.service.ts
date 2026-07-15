import mongoose, { Types } from "mongoose";
import { AppError } from "../utils/appError";
import User from "../models/user.model";
import { Provider, type IIdentityDocument, type IProviderCertificate } from "../models/provider.model";
import { ProviderApplication } from "../models/providerApplication.model";
import { Session } from "../models/session.model";
import { Service } from "../models/service.model";

type IdentityDocumentPayload = {
  type: "cccd" | "passport";
  documentNumber: string;
  fullName: string;
  issuedPlace?: string;
  issuedAt?: string;
  expiresAt?: string;
  dateOfBirth?: string;
  gender?: "male" | "female" | "other";
  nationality?: string;
  placeOfOrigin?: string;
  placeOfResidence?: string;
  frontImageUrl?: string;
  backImageUrl?: string;
  passportImageUrl?: string;
};

type CertificatePayload = {
  title: string;
  certificateNumber?: string;
  issuer?: string;
  issuedAt?: string;
  expiresAt?: string;
  imageUrls: string[];
};

interface CreateProviderApplicationPayload {
  description: string;
  experienceYears: number;
  serviceIds: string[];
  workingAreas: string[];
  identityDocument: IdentityDocumentPayload;
  certificates?: CertificatePayload[];
}

interface SaveProviderApplicationDraftPayload {
  description?: string;
  experienceYears?: number;
  serviceIds?: string[];
  workingAreas?: string[];
  identityDocument?: Partial<IdentityDocumentPayload>;
  certificates?: Array<Partial<CertificatePayload>>;
}

interface ReviewProviderApplicationPayload {
  status: "approved" | "rejected";
  rejectionReason?: string;
  rejectionNotes?: string;
}

interface ApplicationQuery {
  status?: string;
  keyword?: string;
  categoryId?: string;
  page?: string | number;
  limit?: string | number;
}

const assertObjectId = (id: string, fieldName: string) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${fieldName}`, 400);
  }
};

const getPagination = (query: ApplicationQuery) => {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 50);

  return { page, limit, skip: (page - 1) * limit };
};

const servicePopulate = {
  path: "serviceIds",
  select: "name slug categoryId serviceType fixedPrice image",
  populate: {
    path: "categoryId",
    select: "name slug icon",
  },
};

const assertServicesActive = async (serviceIds: string[]) => {
  const uniqueIds = [...new Set(serviceIds)];
  const count = await Service.countDocuments({
    _id: { $in: uniqueIds },
    isActive: true,
    isDeleted: false,
  });

  if (count !== uniqueIds.length) {
    throw new AppError("One or more services are invalid", 400);
  }

  return uniqueIds;
};

const toDate = (value?: string | Date) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const toDocumentLast4 = (documentNumber?: string) => {
  const digits = String(documentNumber || "").replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(-4) : undefined;
};

const buildPendingIdentityDocument = (
  payload: IdentityDocumentPayload,
): IIdentityDocument => ({
  type: payload.type,
  documentNumber: payload.documentNumber,
  numberLast4: toDocumentLast4(payload.documentNumber),
  fullName: payload.fullName,
  issuedPlace: payload.issuedPlace,
  issuedAt: toDate(payload.issuedAt),
  expiresAt: toDate(payload.expiresAt),
  dateOfBirth: toDate(payload.dateOfBirth),
  gender: payload.gender,
  nationality: payload.nationality,
  placeOfOrigin: payload.placeOfOrigin,
  placeOfResidence: payload.placeOfResidence,
  frontImageUrl: payload.type === "cccd" ? payload.frontImageUrl : undefined,
  backImageUrl: payload.type === "cccd" ? payload.backImageUrl : undefined,
  passportImageUrl:
    payload.type === "passport" ? payload.passportImageUrl : undefined,
  verificationStatus: "pending",
  provider: "manual",
  consentAcceptedAt: new Date(),
  submittedAt: new Date(),
  reviewedBy: null,
  reviewedAt: null,
  rejectionReason: null,
});

const buildPendingCertificates = (
  certificates: CertificatePayload[] = [],
): IProviderCertificate[] =>
  certificates.map((certificate) => ({
    title: certificate.title,
    certificateNumber: certificate.certificateNumber,
    issuer: certificate.issuer,
    issuedAt: toDate(certificate.issuedAt),
    expiresAt: toDate(certificate.expiresAt),
    imageUrls: certificate.imageUrls,
    status: "pending",
    reviewedBy: null,
    reviewedAt: null,
    rejectionReason: null,
  }));

const buildDraftIdentityDocument = (
  payload?: Partial<IdentityDocumentPayload>,
): Partial<IIdentityDocument> | undefined => {
  if (!payload) return undefined;

  return {
    type: payload.type || "cccd",
    documentNumber: payload.documentNumber,
    numberLast4: toDocumentLast4(payload.documentNumber),
    fullName: payload.fullName,
    issuedPlace: payload.issuedPlace,
    issuedAt: toDate(payload.issuedAt),
    expiresAt: toDate(payload.expiresAt),
    dateOfBirth: toDate(payload.dateOfBirth),
    gender: payload.gender,
    nationality: payload.nationality,
    placeOfOrigin: payload.placeOfOrigin,
    placeOfResidence: payload.placeOfResidence,
    frontImageUrl: payload.frontImageUrl,
    backImageUrl: payload.backImageUrl,
    passportImageUrl: payload.passportImageUrl,
    verificationStatus: "unsubmitted",
    provider: "manual",
    reviewedBy: null,
    reviewedAt: null,
    rejectionReason: null,
  };
};

const buildDraftCertificates = (
  certificates: Array<Partial<CertificatePayload>> = [],
): Partial<IProviderCertificate>[] =>
  certificates
    .filter((certificate) =>
      Boolean(
        certificate.title ||
          certificate.certificateNumber ||
          certificate.issuer ||
          certificate.issuedAt ||
          certificate.expiresAt ||
          certificate.imageUrls?.length,
      ),
    )
    .map((certificate) => ({
      title: certificate.title || "",
      certificateNumber: certificate.certificateNumber,
      issuer: certificate.issuer,
      issuedAt: toDate(certificate.issuedAt),
      expiresAt: toDate(certificate.expiresAt),
      imageUrls: certificate.imageUrls || [],
      status: "pending",
      reviewedBy: null,
      reviewedAt: null,
      rejectionReason: null,
    }));

const approveIdentityDocument = (
  identity: IIdentityDocument | undefined,
  adminId: string,
): IIdentityDocument | undefined => {
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
    verificationStatus: "verified",
    provider: "manual",
    providerReferenceId: identity.providerReferenceId,
    ocrResult: identity.ocrResult,
    consentAcceptedAt: identity.consentAcceptedAt,
    submittedAt: identity.submittedAt,
    verifiedAt: new Date(),
    reviewedBy: new Types.ObjectId(adminId),
    reviewedAt: new Date(),
    rejectionReason: null,
  };
};

const approveCertificates = (
  certificates: IProviderCertificate[] = [],
  adminId: string,
): IProviderCertificate[] =>
  certificates.map((certificate) => ({
    title: certificate.title,
    certificateNumber: certificate.certificateNumber,
    issuer: certificate.issuer,
    issuedAt: certificate.issuedAt,
    expiresAt: certificate.expiresAt,
    imageUrls: certificate.imageUrls || [],
    status: "approved",
    reviewedBy: new Types.ObjectId(adminId),
    reviewedAt: new Date(),
    rejectionReason: null,
  }));

export const createApplication = async (
  userId: string,
  payload: CreateProviderApplicationPayload,
) => {
  assertObjectId(userId, "user id");
  const serviceIds = await assertServicesActive(payload.serviceIds);

  const user = await User.findOne({ _id: userId, isDeleted: false });

  if (!user) {
    throw new AppError("Không tìm thấy người dùng", 404);
  }

  if (user.status !== "active") {
    throw new AppError("Account is not active", 403);
  }

  if (user.role !== "CUSTOMER") {
    throw new AppError("Only customers can apply to become providers", 403);
  }

  const pendingApplication = await ProviderApplication.findOne({
    userId,
    status: { $in: ["pending", "resubmitted"] },
    isDeleted: false,
  });

  if (pendingApplication) {
    throw new AppError("Bạn đã có hồ sơ đang chờ xét duyệt", 400);
  }

  const rejectedApplication = await ProviderApplication.findOne({
    userId,
    status: "rejected",
    isDeleted: false,
  });

  if (rejectedApplication) {
    throw new AppError(
      "Vui lòng chỉnh sửa và gửi lại hồ sơ đã bị từ chối",
      409,
    );
  }

  const draftApplication = await ProviderApplication.findOne({
    userId,
    status: "draft",
    isDeleted: false,
  });

  if (draftApplication) {
    const submittedAt = new Date();
    draftApplication.description = payload.description;
    draftApplication.experienceYears = payload.experienceYears;
    draftApplication.serviceIds = serviceIds.map((id) => new Types.ObjectId(id));
    draftApplication.workingAreas = payload.workingAreas;
    draftApplication.identityDocument = buildPendingIdentityDocument(payload.identityDocument);
    draftApplication.certificates = buildPendingCertificates(payload.certificates);
    draftApplication.status = "pending";
    draftApplication.submittedAt = submittedAt;
    draftApplication.rejectionReason = null;
    draftApplication.rejectionNotes = null;
    draftApplication.reviewedBy = null;
    draftApplication.reviewedAt = null;
    draftApplication.reviewHistory.push({
      action: "submitted",
      status: "pending",
      actorId: new Types.ObjectId(userId),
      actorRole: "CUSTOMER",
      occurredAt: submittedAt,
    });
    return draftApplication.save();
  }

  const submittedAt = new Date();
  return ProviderApplication.create({
    userId,
    description: payload.description,
    experienceYears: payload.experienceYears,
    serviceIds,
    workingAreas: payload.workingAreas,
    identityDocument: buildPendingIdentityDocument(payload.identityDocument),
    certificates: buildPendingCertificates(payload.certificates),
    status: "pending",
    submittedAt,
    reviewHistory: [
      {
        action: "submitted",
        status: "pending",
        actorId: new Types.ObjectId(userId),
        actorRole: "CUSTOMER",
        occurredAt: submittedAt,
      },
    ],
  });
};

export const saveDraftApplication = async (
  userId: string,
  payload: SaveProviderApplicationDraftPayload,
) => {
  assertObjectId(userId, "user id");

  const user = await User.findOne({ _id: userId, isDeleted: false });

  if (!user) {
    throw new AppError("Không tìm thấy người dùng", 404);
  }

  if (user.status !== "active") {
    throw new AppError("Account is not active", 403);
  }

  if (user.role !== "CUSTOMER") {
    throw new AppError("Only customers can apply to become providers", 403);
  }

  const pendingApplication = await ProviderApplication.findOne({
    userId,
    status: { $in: ["pending", "resubmitted"] },
    isDeleted: false,
  });

  if (pendingApplication) {
    throw new AppError("Bạn đã có hồ sơ đang chờ xét duyệt", 400);
  }

  const rejectedApplication = await ProviderApplication.exists({
    userId,
    status: "rejected",
    isDeleted: false,
  });
  if (rejectedApplication) {
    throw new AppError(
      "Hồ sơ bị từ chối phải được sửa bằng chức năng gửi lại",
      409,
    );
  }

  const serviceIds = payload.serviceIds?.length
    ? await assertServicesActive(payload.serviceIds)
    : [];

  const application = await ProviderApplication.findOneAndUpdate(
    { userId, status: "draft", isDeleted: false },
    {
      userId,
      description: payload.description || "",
      experienceYears: payload.experienceYears ?? 0,
      serviceIds: serviceIds.map((id) => new Types.ObjectId(id)),
      workingAreas: payload.workingAreas || [],
      identityDocument: buildDraftIdentityDocument(payload.identityDocument),
      certificates: buildDraftCertificates(payload.certificates),
      status: "draft",
      rejectionReason: null,
      rejectionNotes: null,
      reviewedBy: null,
      reviewedAt: null,
      isDeleted: false,
      deletedAt: null,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  return getMyApplication(String(application.userId));
};

export const getMyApplication = async (userId: string) => {
  assertObjectId(userId, "user id");

  const activeApplication = await ProviderApplication.findOne({
    userId,
    status: { $in: ["draft", "pending", "resubmitted"] },
    isDeleted: false,
  })
    .sort({ updatedAt: -1 })
    .populate(servicePopulate)
    .populate("reviewedBy", "fullName email")
    .populate("reviewHistory.actorId", "fullName email role");

  if (activeApplication) return activeApplication;

  return ProviderApplication.findOne({ userId, isDeleted: false })
    .sort({ updatedAt: -1 })
    .populate(servicePopulate)
    .populate("reviewedBy", "fullName email")
    .populate("reviewHistory.actorId", "fullName email role");
};

export const getMyApplications = async (
  userId: string,
  query: ApplicationQuery = {},
) => {
  assertObjectId(userId, "user id");
  const { page, limit, skip } = getPagination(query);
  const filter = { userId, isDeleted: false };
  const [items, total] = await Promise.all([
    ProviderApplication.find(filter)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate(servicePopulate)
      .populate("reviewedBy", "fullName email")
      .populate("reviewHistory.actorId", "fullName email role"),
    ProviderApplication.countDocuments(filter),
  ]);

  return {
    items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

export const getMyApplicationById = async (
  userId: string,
  applicationId: string,
) => {
  assertObjectId(userId, "user id");
  assertObjectId(applicationId, "application id");

  const application = await ProviderApplication.findOne({
    _id: applicationId,
    userId,
    isDeleted: false,
  })
    .populate(servicePopulate)
    .populate("reviewedBy", "fullName email")
    .populate("reviewHistory.actorId", "fullName email role");

  if (!application) {
    throw new AppError("Không tìm thấy hồ sơ Provider", 404);
  }
  return application;
};

export const resubmitApplication = async (
  userId: string,
  applicationId: string,
  payload: CreateProviderApplicationPayload,
) => {
  assertObjectId(userId, "user id");
  assertObjectId(applicationId, "application id");
  const serviceIds = await assertServicesActive(payload.serviceIds);

  const activeApplication = await ProviderApplication.exists({
    userId,
    _id: { $ne: applicationId },
    status: { $in: ["pending", "resubmitted"] },
    isDeleted: false,
  });
  if (activeApplication) {
    throw new AppError("Bạn đã có hồ sơ khác đang chờ xét duyệt", 409);
  }

  const resubmittedAt = new Date();
  const application = await ProviderApplication.findOne({
    _id: applicationId,
    userId,
    status: "rejected",
    isDeleted: false,
  });
  if (!application) {
    throw new AppError("Chỉ hồ sơ bị từ chối mới có thể gửi lại", 400);
  }

  application.description = payload.description;
  application.experienceYears = payload.experienceYears;
  application.serviceIds = serviceIds.map((id) => new Types.ObjectId(id));
  application.workingAreas = payload.workingAreas;
  application.identityDocument = buildPendingIdentityDocument(payload.identityDocument);
  application.certificates = buildPendingCertificates(payload.certificates);
  application.status = "resubmitted";
  application.resubmittedAt = resubmittedAt;
  application.reviewHistory.push({
    action: "resubmitted",
    status: "resubmitted",
    actorId: new Types.ObjectId(userId),
    actorRole: "CUSTOMER",
    occurredAt: resubmittedAt,
  });

  await application.save();
  return getMyApplicationById(userId, applicationId);
};

export const getApplications = async (query: ApplicationQuery = {}) => {
  const { page, limit, skip } = getPagination(query);
  const filter: Record<string, unknown> = { isDeleted: false };

  if (
    query.status &&
    ["draft", "pending", "resubmitted", "approved", "rejected"].includes(
      query.status,
    )
  ) {
    filter.status = query.status;
  } else {
    filter.status = { $ne: "draft" };
  }

  if (query.keyword) {
    const keywordRegex = new RegExp(String(query.keyword).trim(), "i");
    const users = await User.find({
      isDeleted: false,
      $or: [{ email: keywordRegex }, { fullName: keywordRegex }],
    }).select("_id");

    filter.userId = { $in: users.map((user) => user._id) };
  }

  if (query.categoryId) {
    assertObjectId(String(query.categoryId), "category id");
    const services = await Service.find({
      categoryId: new Types.ObjectId(String(query.categoryId)),
      isActive: true,
      isDeleted: false,
    }).select("_id");
    filter.serviceIds = { $in: services.map((service) => service._id) };
  }

  const [items, total] = await Promise.all([
    ProviderApplication.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("userId", "fullName email phone avatar role status")
      .populate(servicePopulate)
      .populate("reviewedBy", "fullName email")
      .populate("reviewHistory.actorId", "fullName email role"),
    ProviderApplication.countDocuments(filter),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getApplicationById = async (applicationId: string) => {
  assertObjectId(applicationId, "application id");

  const application = await ProviderApplication.findOne({
    _id: applicationId,
    isDeleted: false,
  })
    .populate("userId", "fullName email phone avatar role status")
    .populate(servicePopulate)
    .populate("reviewedBy", "fullName email")
    .populate("reviewHistory.actorId", "fullName email role");

  if (!application) {
    throw new AppError("Provider application not found", 404);
  }

  return application;
};

export const reviewApplication = async (
  adminId: string,
  applicationId: string,
  payload: ReviewProviderApplicationPayload,
) => {
  assertObjectId(adminId, "admin id");
  assertObjectId(applicationId, "application id");

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const application = await ProviderApplication.findOne({
        _id: applicationId,
        isDeleted: false,
      }).session(session);

      if (!application) {
        throw new AppError("Provider application not found", 404);
      }

      if (!["pending", "resubmitted"].includes(application.status)) {
        throw new AppError("Chỉ hồ sơ đang chờ duyệt mới có thể xét duyệt", 400);
      }

      const reviewedAt = new Date();
      application.status = payload.status;
      application.reviewedBy = new Types.ObjectId(adminId);
      application.reviewedAt = reviewedAt;

      if (payload.status === "rejected") {
        application.rejectionReason = payload.rejectionReason || null;
        application.rejectionNotes = payload.rejectionNotes || null;
        application.reviewHistory.push({
          action: "rejected",
          status: "rejected",
          actorId: new Types.ObjectId(adminId),
          actorRole: "ADMIN",
          occurredAt: reviewedAt,
          rejectionReason: payload.rejectionReason || null,
          notes: payload.rejectionNotes || null,
        });
        await application.save({ session });
        return;
      }

      application.rejectionReason = null;
      application.rejectionNotes = null;
      application.reviewHistory.push({
        action: "approved",
        status: "approved",
        actorId: new Types.ObjectId(adminId),
        actorRole: "ADMIN",
        occurredAt: reviewedAt,
      });

      const identityDocument = approveIdentityDocument(
        application.identityDocument,
        adminId,
      );
      const certificates = approveCertificates(application.certificates, adminId);

      await application.save({ session });

      await Provider.findOneAndUpdate(
        { userId: application.userId },
        {
          $set: {
            userId: application.userId,
            description: application.description,
            experienceYears: application.experienceYears,
            serviceIds: application.serviceIds,
            workingAreas: application.workingAreas,
            identityDocument,
            certificates,
            availabilityStatus: "offline",
            verified: true,
            isDeleted: false,
            deletedAt: null,
          },
        },
        {
          upsert: true,
          new: true,
          runValidators: true,
          setDefaultsOnInsert: true,
          session,
        },
      );

      const updatedUser = await User.findOneAndUpdate(
        { _id: application.userId, isDeleted: false },
        { $set: { role: "PROVIDER" } },
        { new: true, runValidators: true, session },
      );
      if (!updatedUser) {
        throw new AppError("Không tìm thấy người dùng của hồ sơ provider", 404);
      }

      await Session.updateMany(
        { userId: application.userId, revokedAt: null },
        { $set: { revokedAt: reviewedAt } },
        { session },
      );
    });
  } finally {
    await session.endSession();
  }

  return getApplicationById(applicationId);
};
