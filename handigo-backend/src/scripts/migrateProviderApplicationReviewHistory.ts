import "dotenv/config";
import mongoose, { Types } from "mongoose";
import { ProviderApplication } from "../models/providerApplication.model";
import { createLogger } from "../utils/logger";

const migrateLogger = createLogger("MigrateProviderApplicationReviewHistory");

type LegacyApplication = {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  status: "draft" | "pending" | "approved" | "rejected" | "resubmitted";
  createdAt?: Date;
  updatedAt?: Date;
  submittedAt?: Date | null;
  reviewedBy?: Types.ObjectId | null;
  reviewedAt?: Date | null;
  rejectionReason?: string | null;
  rejectionNotes?: string | null;
  identityDocument?: { submittedAt?: Date };
  reviewHistory?: unknown[];
};

const migrateDocuments = async () => {
  const collection = ProviderApplication.collection;
  const applications = await collection
    .find<LegacyApplication>({
      $or: [
        { reviewHistory: { $exists: false } },
        { reviewHistory: { $size: 0 } },
      ],
    })
    .toArray();

  let updated = 0;
  for (const application of applications) {
    if (application.status === "draft") {
      await collection.updateOne(
        { _id: application._id },
        { $set: { reviewHistory: [] } },
      );
      updated += 1;
      continue;
    }

    const submittedAt =
      application.submittedAt ||
      application.identityDocument?.submittedAt ||
      application.createdAt ||
      new Date();
    const reviewHistory: Record<string, unknown>[] = [
      {
        action: "submitted",
        status: "pending",
        actorId: application.userId,
        actorRole: "CUSTOMER",
        occurredAt: submittedAt,
        rejectionReason: null,
        notes: null,
      },
    ];

    if (
      ["approved", "rejected"].includes(application.status) &&
      application.reviewedBy
    ) {
      reviewHistory.push({
        action: application.status,
        status: application.status,
        actorId: application.reviewedBy,
        actorRole: "ADMIN",
        occurredAt:
          application.reviewedAt || application.updatedAt || submittedAt,
        rejectionReason:
          application.status === "rejected"
            ? application.rejectionReason || null
            : null,
        notes:
          application.status === "rejected"
            ? application.rejectionNotes || null
            : null,
      });
    }

    await collection.updateOne(
      { _id: application._id },
      { $set: { submittedAt, reviewHistory } },
    );
    updated += 1;
  }

  migrateLogger.info("Đã bổ sung lịch sử xét duyệt cho hồ sơ Provider.", {
    updated,
  });
};

const migrateIndex = async () => {
  const collection = ProviderApplication.collection;
  const indexes = await collection.indexes();
  const userStatusIndexes = indexes.filter(
    (index) => index.unique && index.key?.userId === 1,
  );
  const expectedFilter = JSON.stringify({
    status: { $in: ["pending", "resubmitted"] },
  });

  for (const index of userStatusIndexes) {
    if (JSON.stringify(index.partialFilterExpression) === expectedFilter) continue;
    await collection.dropIndex(index.name as string);
    migrateLogger.info("Đã xóa index cũ.", { indexName: index.name });
  }

  await collection.createIndex(
    { userId: 1 },
    {
      name: "userId_active_review_1",
      unique: true,
      partialFilterExpression: {
        status: { $in: ["pending", "resubmitted"] },
      },
    },
  );
  migrateLogger.info("Đã cập nhật index hồ sơ đang chờ xét duyệt.");
};

const migrate = async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error("Chưa cấu hình MONGODB_URI hoặc MONGO_URI");

  await mongoose.connect(uri, { autoIndex: false });
  await migrateDocuments();
  await migrateIndex();
  await mongoose.disconnect();
};

migrate().catch(async (error) => {
  migrateLogger.error("Migration hồ sơ Provider thất bại.", error);
  await mongoose.disconnect();
  process.exit(1);
});
