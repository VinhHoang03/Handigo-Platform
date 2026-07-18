import "dotenv/config";
import mongoose, { Types } from "mongoose";
import User, {
  type ProviderOnboardingStatus,
  type UserRole,
} from "../models/user.model";
import { Provider } from "../models/provider.model";
import { ProviderApplication } from "../models/providerApplication.model";
import { createLogger } from "../utils/logger";

const logger = createLogger("MigrateSingleUserRole");

type LegacyUser = {
  _id: Types.ObjectId;
  role?: UserRole;
  roles?: UserRole[];
  providerOnboardingStatus?: ProviderOnboardingStatus | null;
};

const resolveRole = (user: LegacyUser): UserRole => {
  const roles = new Set<UserRole>([
    ...(user.roles || []),
    ...(user.role ? [user.role] : []),
  ]);
  if (roles.has("ADMIN")) return "ADMIN";
  if (roles.has("PROVIDER")) return "PROVIDER";
  return "CUSTOMER";
};

const resolveProviderOnboarding = async (
  userId: Types.ObjectId,
): Promise<{ status: ProviderOnboardingStatus; step: 1 | 2 | 3 | null }> => {
  const [approvedProvider, application] = await Promise.all([
    Provider.exists({ userId, verified: true, isDeleted: false }),
    ProviderApplication.findOne({ userId, isDeleted: false })
      .sort({ updatedAt: -1 })
      .select("status serviceIds workingAreas")
      .lean(),
  ]);

  if (approvedProvider || application?.status === "approved") {
    return { status: "APPROVED", step: null };
  }
  if (["pending", "resubmitted"].includes(application?.status || "")) {
    return { status: "PENDING_REVIEW", step: 3 };
  }
  if (application?.status === "rejected") {
    return { status: "REJECTED", step: 3 };
  }
  if (!application?.serviceIds?.length) {
    return { status: "PROFILE_INCOMPLETE", step: 1 };
  }
  if (!application.workingAreas?.length) {
    return { status: "PROFILE_INCOMPLETE", step: 2 };
  }
  return { status: "PROFILE_INCOMPLETE", step: 3 };
};

const migrate = async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error("Chưa cấu hình MONGODB_URI hoặc MONGO_URI");

  await mongoose.connect(uri, { autoIndex: false });
  const users = await User.collection.find<LegacyUser>({}).toArray();
  let updated = 0;

  for (const user of users) {
    const role = resolveRole(user);
    const resolvedOnboarding =
      role === "PROVIDER"
        ? await resolveProviderOnboarding(user._id)
        : { status: null, step: null };
    const providerOnboardingStatus =
      role === "PROVIDER"
        ? user.providerOnboardingStatus || resolvedOnboarding.status
        : null;
    const providerOnboardingStep =
      providerOnboardingStatus === "APPROVED" ? null : resolvedOnboarding.step;

    const result = await User.collection.updateOne(
      { _id: user._id },
      {
        $set: { role, providerOnboardingStatus, providerOnboardingStep },
        $unset: { roles: "" },
      },
    );
    updated += result.modifiedCount;
  }

  logger.info("Đã chuyển dữ liệu người dùng sang một role duy nhất.", { updated });
  await mongoose.disconnect();
};

migrate().catch(async (error) => {
  logger.error("Migration role người dùng thất bại.", error);
  await mongoose.disconnect();
  process.exit(1);
});
