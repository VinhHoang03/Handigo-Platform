import mongoose, { Types, type ClientSession, type InferSchemaType, type HydratedDocument, type QueryFilter } from "mongoose";
import { randomUUID } from "node:crypto";
import User from "../../models/user.model";
import { Service } from "../../models/service.model";
import { Category } from "../../models/category.model";
import { reviewApplication } from "../../services/providerApplication.service";
import { updateServiceSuggestion } from "../../services/serviceSuggestion.service";
import { AppError } from "../../utils/appError";
import { AdminAIConfig, AdminAIConfigHistory, AdminAIAssessment, AdminAIQuota } from "./admin-ai.models";
import { FEATURES, RETIRED_FEATURES, policySchema, type AdminAIFeature, type RunInput, type AIOutput, type CriterionResult } from "./admin-ai.validation";
import { adminAIConfig, generateAdminAI, prepareComplaintResolution } from "./admin-ai.provider";
import { loadContext, sourceModel, type SourceRow } from "./admin-ai.context";
import { evaluateCriteria, allRequiredPassed, normalizeServiceName, incompleteApplicationReasons } from "./admin-ai.criteria";
import { applyComplaintAssessment } from "./admin-ai.complaint";

const reviewableStatuses: Record<string, string[]> = {
  provider_application: ["pending", "resubmitted"],
  service_suggestion: ["pending"],
  report: ["pending", "under_review", "evidence_requested"],
  complaint: ["pending", "under_review", "evidence_requested"],
  support_ticket: ["open", "in_progress", "waiting_user"],
};
const reviewableSourceFilter = (type: string): QueryFilter<SourceRow> => ({
  isDeleted: false,
  status: { $in: reviewableStatuses[type] || [] },
  ...(["report", "complaint"].includes(type) ? { createdViolationId: null } : {}),
  ...(type === "report" ? { isCustomerNoShow: { $ne: true } } : {}),
});
const ensureReviewableSource = (type: string, row: SourceRow | null) => {
  if (!row || row.isDeleted || !reviewableStatuses[type]?.includes(row.status || "")
    || (["report", "complaint"].includes(type) && row.createdViolationId)
    || (type === "report" && row.isCustomerNoShow)) {
    throw new AppError("Tài nguyên đã được xử lý hoặc không thuộc phạm vi AI kiểm duyệt.", 409);
  }
};

export const defaults = (feature: AdminAIFeature) => policySchema.parse({
  criteria: feature === "provider_application" ? [
    { code: "identity_images", kind: "identity_images", description: "Có đủ ảnh giấy tờ theo loại đăng ký", required: true },
    { code: "relevance", kind: "ai", description: "Mô tả hồ sơ phù hợp các dịch vụ đăng ký", required: true },
  ] : feature === "service_suggestion" ? [
    { code: "description", kind: "description_length", value: 30, description: "Mô tả đủ phạm vi công việc", required: true },
    { code: "relevance", kind: "ai", description: "Đề xuất rõ ràng, phù hợp danh mục và không trùng nghĩa với dịch vụ hiện có", required: true },
  ] : [],
});
export async function initializeAdminAI() {
  await Promise.all([AdminAIConfig, AdminAIConfigHistory, AdminAIAssessment, AdminAIQuota].map(model => model.init()));
  for (const feature of FEATURES.filter(feature => !RETIRED_FEATURES.some(retired => retired === feature))) await AdminAIConfig.updateOne({ feature }, { $setOnInsert: { feature, draft: defaults(feature) } }, { upsert: true, runValidators: true });
}
export async function listConfigs() {
  return { configured: Boolean(process.env.ADMIN_AI_API_KEY?.trim()), configs: await AdminAIConfig.find({ feature: { $nin: RETIRED_FEATURES } }).select("-fence -cursorAt -cursorId").sort({ feature: 1 }).lean() };
}
export async function listSources(type: string, email?: string) {
  const filter = reviewableSourceFilter(type);
  if (type === "provider_application") {
    if (email) {
      const escaped = email.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const users = await User.find({ isDeleted: false, email: new RegExp(`^${escaped}$`, "i") }).select("_id").lean();
      if (!users.length) return [];
      filter.userId = { $in: users.map(user => user._id) };
    }
  }
  const items = await sourceModel(type).find(filter).select("description suggestedServiceName suggestedCategoryName subject title status applicationType updatedAt").sort({ updatedAt: -1, _id: -1 }).limit(50).lean();
  return items.map(item => ({ id: String(item._id), label: String(item.title || item.subject || item.suggestedServiceName || item.suggestedCategoryName || item.description || "Trường hợp chưa có mô tả").slice(0, 120), status: item.status }));
}
export async function changeConfig(feature: AdminAIFeature, adminId: string, revision: number, change: { draft?: unknown; enabled?: boolean }) {
  if (feature === "support_classification") throw new AppError("Chức năng AI phân loại phản ánh đã được ngừng sử dụng.", 410);
  if (feature === "reply_draft") throw new AppError("Chức năng soạn phản hồi AI đã được ngừng sử dụng.", 410);
  if (feature === "operations_report") throw new AppError("Báo cáo vận hành AI đã được ngừng sử dụng.", 410);
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      const current = await AdminAIConfig.findOne({ feature, revision }).session(session);
      if (!current) throw new AppError("Cấu hình đã thay đổi. Vui lòng tải lại.", 409);
      let action: "draft" | "activate" | "disable" = "disable";
      if (change.draft !== undefined) {
        const draft = policySchema.parse(change.draft);
        if (feature !== "provider_application" && draft.autoRejectIncompleteApplications) throw new AppError("Tự từ chối hồ sơ thiếu thông tin chỉ áp dụng cho đăng ký thợ.", 400);
        if (feature !== "provider_application" && draft.criteria.some(rule => !["description_length", "ai"].includes(rule.kind))) throw new AppError("Loại tiêu chí này chỉ áp dụng hồ sơ thợ.", 400);
        current.draft = draft;
        current.enabled = false;
        action = "draft";
      } else if (change.enabled) {
        adminAIConfig();
        const policy = policySchema.parse(current.draft);
        if (policy.criteria.some(rule => rule.required && rule.kind === "verified_identity")) throw new AppError("Chưa có nguồn xác minh danh tính độc lập. Hãy giữ chế độ phân tích thử hoặc cấu hình bộ tiêu chí có nguồn kiểm tra sẵn sàng.", 422);
        if (["provider_application", "service_suggestion"].includes(feature) && (!policy.criteria.some(rule => rule.required && rule.kind !== "ai") || !policy.criteria.some(rule => rule.required && rule.kind === "ai"))) throw new AppError("Tự duyệt cần ít nhất một tiêu chí bắt buộc bằng code và một tiêu chí AI bắt buộc.", 400);
        current.policy = policy;
        current.enabled = true;
        current.enabledSince = new Date();
        current.cursorAt = null;
        current.cursorId = null;
        action = "activate";
      } else current.enabled = false;
      current.revision += 1;
      current.configuredBy = new Types.ObjectId(adminId);
      await current.save({ session });
      await AdminAIConfigHistory.create([{ feature, revision: current.revision, action, actorId: adminId, snapshot: { enabled: current.enabled, draft: current.draft, policy: current.policy, enabledSince: current.enabledSince } }], { session });
      return current.toObject();
    });
  } finally { await session.endSession(); }
}
export async function enqueueAssessment(input: RunInput, adminId: string, scheduled = false) {
  if (input.feature === "support_classification") throw new AppError("Chức năng AI phân loại phản ánh đã được ngừng sử dụng.", 410);
  if (String(input.feature) === "reply_draft") throw new AppError("Chức năng soạn phản hồi AI đã được ngừng sử dụng.", 410);
  if (String(input.feature) === "operations_report") throw new AppError("Báo cáo vận hành AI đã được ngừng sử dụng.", 410);
  adminAIConfig();
  const config = await AdminAIConfig.findOne({ feature: input.feature }).lean();
  if (!config) throw new AppError("Chưa khởi tạo cấu hình AI quản trị.", 503);
  if (!input.preview && !config.enabled) throw new AppError("Tính năng tự động đang tắt.", 409);
  const policy = policySchema.parse(input.preview ? config.draft : config.policy);
  const context = await loadContext(input);
  ensureReviewableSource(input.sourceType, context.row);
  if (!input.preview && input.feature === "complaint_summary") {
    const previous = await AdminAIAssessment.findOne({ feature: input.feature, sourceType: input.sourceType, sourceId: input.sourceId, revision: config.revision, preview: false, appliedSourceHash: context.hash });
    if (previous && !previous.adminDecision && ["manual", "completed"].includes(previous.status)) return previous;
  }
  if (context.row && input.feature === "provider_application" && !policy.applicationTypes.includes((context.row.applicationType || "initial") as "initial" | "service_addition")) throw new AppError("Hồ sơ nằm ngoài phạm vi bộ tiêu chí.", 422);
  const key = input.preview ? randomUUID() : `${input.feature}:${input.sourceId}:${context.hash}:${config.revision}`;
  const queuedAt = new Date();
  const stored = await AdminAIAssessment.findOneAndUpdate({ key }, { $setOnInsert: {
    key, feature: input.feature, sourceType: input.sourceType, sourceId: input.sourceId,
    revision: config.revision, policy, preview: input.preview, configuredBy: scheduled ? config.configuredBy : adminId,
    sourceHash: context.hash, from: input.from ? new Date(input.from) : null, to: input.to ? new Date(input.to) : null,
    createdAt: queuedAt, updatedAt: queuedAt,
  } }, { upsert: true, returnDocument: "after", runValidators: true, timestamps: false });
  if (!scheduled && !input.preview && ["error", "stale"].includes(stored.status) && !stored.adminDecision) {
    const restarted = await AdminAIAssessment.findOneAndUpdate({ _id: stored._id, status: stored.status, updatedAt: stored.updatedAt }, {
      $set: { status: "queued", attempts: 0, nextAt: new Date(), leaseUntil: null, leaseToken: null,
        error: null, outcome: null, configuredBy: adminId },
    }, { returnDocument: "after", runValidators: true });
    const current = restarted || await AdminAIAssessment.findById(stored._id);
    if (!current) throw new AppError("Tác vụ không còn tồn tại. Vui lòng tải lại.", 404);
    return current;
  }
  return stored;
}
export type Job = HydratedDocument<InferSchemaType<typeof AdminAIAssessment.schema>>;
export async function reserveCall(feature: string, limit: number, now = new Date()) {
  const key = `${feature}:${now.toISOString().slice(0, 10)}`;
  await AdminAIQuota.updateOne({ key }, { $setOnInsert: { count: 0, expiresAt: new Date(now.getTime() + 2 * 86400000) } }, { upsert: true, runValidators: true });
  const quota = await AdminAIQuota.findOneAndUpdate({ key, count: { $lt: limit } }, { $inc: { count: 1 } }, { returnDocument: "after", runValidators: true });
  if (!quota) throw new AppError("Đã hết hạn mức gọi AI quản trị trong ngày UTC.", 429);
}
async function guardAndComplete(job: Job, session: ClientSession, output: AIOutput, checks: CriterionResult[], outcome: string, status: "completed" | "manual" = "completed", applying = true) {
  const config = await AdminAIConfig.findOneAndUpdate({ feature: job.feature, revision: job.revision, ...(!job.preview ? { enabled: true } : {}) }, { $inc: { fence: 1 } }, { returnDocument: "after", runValidators: true, session });
  if (!config) throw new AppError("Công tắc hoặc phiên bản tiêu chí đã thay đổi.", 409);
  const admin = await User.exists({ _id: job.preview ? job.configuredBy : config.configuredBy, role: "ADMIN", status: "active", isDeleted: false }).session(session);
  if (!admin) throw new AppError("Admin cấu hình không còn quyền hoạt động.", 409);
  const context = await loadContext({ sourceType: job.sourceType as RunInput["sourceType"], sourceId: job.sourceId, from: job.from?.toISOString(), to: job.to?.toISOString() }, session);
  ensureReviewableSource(job.sourceType, context.row);
  if (context.hash !== job.sourceHash) throw new AppError("Dữ liệu nguồn đã thay đổi sau khi phân tích.", 409);
  if (applying && job.feature === "provider_application" && context.row) {
    const owner = await User.exists({ _id: String(context.row.userId), role: { $in: context.row.applicationType === "service_addition" ? ["PROVIDER"] : ["CUSTOMER", "PROVIDER"] }, status: "active", isDeleted: false }).session(session);
    if (!owner) throw new AppError("Chủ hồ sơ không còn đủ điều kiện tài khoản để tự duyệt.", 409);
  }
  if (applying && outcome === "auto_rejected") {
    if (job.feature !== "provider_application" || !policySchema.parse(job.policy).autoRejectIncompleteApplications
      || !policySchema.parse(config.policy).autoRejectIncompleteApplications || !context.row || !incompleteApplicationReasons(context.row).length) {
      throw new AppError("Hồ sơ không còn thiếu thông tin hoặc Admin chưa cho phép tự từ chối.", 409);
    }
  } else if (applying && ["provider_application", "service_suggestion"].includes(job.feature)) {
    if (job.feature === "provider_application" && context.row && incompleteApplicationReasons(context.row).length) throw new AppError("Hồ sơ còn thiếu mô tả hoặc ảnh giấy tờ, chưa thể tự duyệt.", 409);
    const latestChecks = [...evaluateCriteria(policySchema.parse(job.policy), context.row), ...output.checks];
    if (!allRequiredPassed(policySchema.parse(job.policy), latestChecks, output)) throw new AppError("Hồ sơ không còn đạt đầy đủ tiêu chí.", 409);
  }
  const saved = await AdminAIAssessment.updateOne({ _id: job._id, status: "running", leaseToken: job.leaseToken, leaseUntil: { $gt: new Date() } }, { $set: { status, outcome, output, checks, leaseUntil: null, error: null } }, { session, runValidators: true });
  if (saved.modifiedCount !== 1) throw new AppError("Tác vụ AI đã mất quyền xử lý.", 409);
}
async function applyResult(job: Job, row: SourceRow | null, output: AIOutput, checks: CriterionResult[], catalogComplete: boolean) {
  const policy = policySchema.parse(job.policy);
  if (job.preview) return { status: "completed", outcome: "preview" };
  if (job.feature === "complaint_summary") return applyComplaintAssessment(job, row, output, checks, catalogComplete,
    (session, outcome) => guardAndComplete(job, session, output, checks, outcome));
  if (job.feature === "provider_application") {
    if (row && ["pending", "resubmitted"].includes(row.status || "") && policy.applicationTypes.includes((row.applicationType || "initial") as "initial" | "service_addition")
      && policy.autoRejectIncompleteApplications && incompleteApplicationReasons(row).length) {
      await reviewApplication(String(job.configuredBy), job.sourceId, {
        status: "rejected", rejectionReason: "Hồ sơ đăng ký thiếu thông tin",
        rejectionNotes: `${incompleteApplicationReasons(row).join(" ")} Vui lòng bổ sung và gửi lại hồ sơ.`,
      }, { assessmentId: String(job._id), beforeWrite: session => guardAndComplete(job, session, output, checks, "auto_rejected") });
      return null;
    }
    if (!row || !["pending", "resubmitted"].includes(row.status || "") || incompleteApplicationReasons(row).length || !(row.serviceIds as unknown[] || []).length || !catalogComplete || !policy.applicationTypes.includes((row.applicationType || "initial") as "initial" | "service_addition") || !allRequiredPassed(policy, checks, output)) return { status: "manual", outcome: "manual_review" };
    await reviewApplication(String(job.configuredBy), job.sourceId, { status: "approved" }, { assessmentId: String(job._id), beforeWrite: session => guardAndComplete(job, session, output, checks, "auto_approved") });
    return null;
  }
  if (job.feature === "service_suggestion") {
    if (!row || row.status !== "pending" || row.suggestionType !== "service" || !catalogComplete || output.duplicateServiceIds.length || !output.categoryId || !allRequiredPassed(policy, checks, output)) return { status: "manual", outcome: "manual_review" };
    const category = await Category.exists({ _id: output.categoryId, isDeleted: false, isActive: true });
    const name = output.normalizedName?.trim() || String(row.suggestedServiceName || "");
    const names = await Service.find({ isDeleted: false }).select("name").limit(501).lean();
    if (!category || !name || names.some(item => [name, String(row.suggestedServiceName || "")].some(candidate => normalizeServiceName(item.name) === normalizeServiceName(candidate)))) return { status: "manual", outcome: "duplicate_or_invalid_category" };
    // Giữ tên và mô tả gốc khi tự duyệt; bản biên tập AI chỉ được áp dụng sau khi admin kiểm tra.
    await updateServiceSuggestion(job.sourceId, { status: "approved", categoryId: output.categoryId }, String(job.configuredBy), { assessmentId: String(job._id), beforeWrite: session => guardAndComplete(job, session, output, checks, "auto_approved") });
    return null;
  }

  throw new AppError("Chức năng AI không còn được hỗ trợ.", 410);
}
export async function processNextAssessment() {
  const token = randomUUID();
  const now = new Date();
  const job = await AdminAIAssessment.findOneAndUpdate({ attempts: { $lt: 3 }, $or: [
    { status: { $in: ["queued", "retry"] }, nextAt: { $lte: now } },
    { status: "running", leaseUntil: { $lt: now } },
  ] }, { $set: { status: "running", leaseToken: token, leaseUntil: new Date(now.getTime() + 120000) }, $inc: { attempts: 1 } }, { sort: { nextAt: 1, _id: 1 }, returnDocument: "after", runValidators: true });
  if (!job) return false;
  const own = { _id: job._id, status: "running" as const, leaseToken: token };
  try {
    if (job.feature === "support_classification") throw new AppError("Chức năng AI phân loại phản ánh đã được ngừng sử dụng.", 410);
    if (job.feature === "reply_draft") throw new AppError("Chức năng soạn phản hồi AI đã được ngừng sử dụng.", 410);
    if (job.feature === "operations_report") throw new AppError("Báo cáo vận hành AI đã được ngừng sử dụng.", 410);
    const config = await AdminAIConfig.findOne({ feature: job.feature }).lean();
    if (!config || config.revision !== job.revision || (!job.preview && !config.enabled)) throw new AppError("Cấu hình đã đổi hoặc tự động hóa đã tắt.", 409);
    const context = await loadContext({ sourceType: job.sourceType as RunInput["sourceType"], sourceId: job.sourceId, from: job.from?.toISOString(), to: job.to?.toISOString() });
    ensureReviewableSource(job.sourceType, context.row);
    if (context.hash !== job.sourceHash) throw new AppError("Dữ liệu nguồn đã thay đổi. Hãy chạy phân tích lại.", 409);
    const policy = policySchema.parse(job.policy);
    let generated: { output: AIOutput; model: string | null; usage: { inputTokens: number; outputTokens: number } | null };
    const incomplete = job.feature === "provider_application" && policy.autoRejectIncompleteApplications && context.row ? incompleteApplicationReasons(context.row) : [];
    if (incomplete.length) {
      // Thiếu trường bắt buộc được kiểm tra trực tiếp; lỗi mô hình không phải căn cứ từ chối.
      generated = { model: null, usage: null, output: {
        summary: `Hồ sơ thiếu thông tin đăng ký: ${incomplete.join(" ")}`,
        checks: [{ code: "description_present", status: typeof context.row?.description === "string" && context.row.description.trim() ? "pass" : "fail", reason: "Kiểm tra hồ sơ đã có mô tả kinh nghiệm và công việc đăng ký.", evidence: [] }],
        evidence: [], categoryId: null, normalizedName: null, normalizedDescription: null, duplicateServiceIds: [],
        classification: null, draftReply: null, timeline: [], missingData: incomplete, complaintResolution: null, imageAnalyses: [],
      } };
    } else {
      await reserveCall(job.feature, policy.dailyCallLimit);
      generated = await generateAdminAI(job.feature as AdminAIFeature, policy, context.sources);
    }
    const output = generated.output;
    if (job.feature === "complaint_summary" && output.complaintResolution) prepareComplaintResolution(output, context.sources);
    if (job.feature === "complaint_summary") {
      const latest = await loadContext({ sourceType: job.sourceType as RunInput["sourceType"], sourceId: job.sourceId });
      const currentConfig = await AdminAIConfig.findOne({ feature: job.feature, revision: job.revision, ...(!job.preview ? { enabled: true } : {}) }).lean();
      if (latest.hash !== job.sourceHash || !currentConfig) throw new AppError("Khiếu nại hoặc cấu hình đã thay đổi trong lúc phân tích. Hãy chạy lại.", 409);
    }
    if (output.categoryId && !context.sources.some(item => item.id === `category:${output.categoryId}`)) throw new AppError("AI chọn danh mục không có trong dữ liệu nguồn.", 502);
    if (output.duplicateServiceIds.some(id => !context.sources.some(item => item.id === `service:${id}`))) throw new AppError("AI đối chiếu dịch vụ không tồn tại trong nguồn.", 502);
    const checks = [...evaluateCriteria(policy, context.row), ...output.checks];
    await AdminAIAssessment.updateOne(own, { $set: { model: generated.model, usage: generated.usage, metrics: context.metrics, output, checks } }, { runValidators: true });
    const result = await applyResult(job, context.row, output, checks, context.catalogComplete);
    if (result) {
      await mongoose.connection.transaction(session => guardAndComplete(job, session, output, checks, result.outcome, result.status as "completed" | "manual", false));
    }
  } catch (error) {
    const code = error instanceof AppError ? error.statusCode : 500;
    const stale = [404, 409].includes(code);
    const quotaWait = code === 429;
    const retry = !stale && ![400, 410, 422, 429, 503].includes(code) && job.attempts < 3;
    const tomorrow = new Date();
    tomorrow.setUTCHours(24, 0, 0, 0);
    await AdminAIAssessment.updateOne(own, { $set: {
      status: stale ? "stale" : retry || quotaWait ? "retry" : "error", outcome: stale ? "stale" : "manual_review",
      error: error instanceof AppError ? error.message : "Tác vụ AI gặp lỗi nội bộ. Vui lòng kiểm tra thủ công.",
      nextAt: quotaWait ? tomorrow : new Date(Date.now() + job.attempts * 30000), leaseUntil: null,
    }, ...(quotaWait ? { $inc: { attempts: -1 } } : {}) }, { runValidators: true });
  }
  return true;
}
export async function scanAutomaticSources() {
  const configs = await AdminAIConfig.find({ enabled: true, feature: { $nin: RETIRED_FEATURES } }).lean();
  for (const config of configs) {
    const feature = config.feature as AdminAIFeature;
    if (feature === "reply_draft" || feature === "operations_report") continue;
    const sourceType = feature === "provider_application" || feature === "service_suggestion" ? feature : feature === "complaint_summary" ? "report" : null;
    if (!sourceType) continue;
    // Lần quét đầu lấy cả dữ liệu tồn; các lượt sau tiếp tục từ bản ghi đã quét.
    const cursor = config.cursorAt || new Date(0);
    const timeField = "updatedAt";
    const query = { ...reviewableSourceFilter(sourceType),
      $or: [{ [timeField]: { $gt: cursor } }, { [timeField]: cursor, ...(config.cursorId ? { _id: { $gt: config.cursorId } } : {}) }] };
    const rows = await sourceModel(sourceType).find(query).sort({ [timeField]: 1, _id: 1 }).limit(30).lean();
    for (const row of rows) {
      if (sourceType === "provider_application" && !policySchema.parse(config.policy).applicationTypes.includes((row.applicationType || "initial") as "initial" | "service_addition")) {
        // Hồ sơ ngoài phạm vi vẫn được bỏ qua trong con trỏ để hàng đợi tiến tiếp.
      } else {
        await enqueueAssessment({ feature, sourceType, sourceId: String(row._id), preview: false }, String(config.configuredBy), true);
      }
      const timestamp = row[timeField] as Date;
      await AdminAIConfig.updateOne({ _id: config._id, revision: config.revision, enabled: true, $or: [{ cursorAt: null }, { cursorAt: { $lt: timestamp } }, { cursorAt: timestamp, cursorId: { $lt: row._id } }] }, { $set: { cursorAt: timestamp, cursorId: row._id } }, { runValidators: true });
    }
  }
}
