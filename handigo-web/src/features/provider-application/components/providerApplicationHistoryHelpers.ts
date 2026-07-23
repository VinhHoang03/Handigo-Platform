import type {
  ApplicationActor,
  ProviderApplication,
} from "../types/providerApplication.types";

export const formatDateTime = (value?: string | null) => {
  if (!value) return "Chưa cập nhật";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa cập nhật";
  return date.toLocaleString("vi-VN");
};

export const formatDate = (value?: string | null) => {
  if (!value) return "Chưa cập nhật";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa cập nhật";
  return date.toLocaleDateString("vi-VN");
};

export const downloadUrl = (url: string) =>
  url.includes("/upload/")
    ? url.replace("/upload/", "/upload/fl_attachment/")
    : url;

export const isImageUrl = (url: string) =>
  /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(url) ||
  url.includes("/image/upload/");

export const actorName = (actor: ApplicationActor | string | null) =>
  !actor || typeof actor === "string"
    ? "Người dùng hệ thống"
    : actor.fullName || "Người dùng hệ thống";

export const actionLabel: Record<string, string> = {
  submitted: "Đã gửi hồ sơ",
  rejected: "Hồ sơ bị từ chối",
  resubmitted: "Đã chỉnh sửa và gửi lại",
  approved: "Hồ sơ được phê duyệt",
};

export const applicationTypeLabel: Record<
  ProviderApplication["applicationType"],
  string
> = {
  initial: "Đăng ký trở thành nhà cung cấp dịch vụ",
  service_addition: "Bổ sung dịch vụ mới",
};

export const statusLabel: Record<ProviderApplication["status"], string> = {
  draft: "Bản nháp",
  pending: "Chờ duyệt",
  resubmitted: "Gửi lại",
  approved: "Đã duyệt",
  rejected: "Từ chối",
};

export const getServiceNames = (application: ProviderApplication) =>
  application.serviceIds
    .map((service) => (typeof service === "string" ? "" : service.name))
    .filter(Boolean);

export const applicationName = (application: ProviderApplication) => {
  const serviceNames = getServiceNames(application);
  const prefix =
    application.applicationType === "service_addition"
      ? "Đơn bổ sung dịch vụ"
      : "Hồ sơ đăng ký provider";

  return serviceNames.length
    ? `${prefix}: ${serviceNames.slice(0, 2).join(", ")}`
    : prefix;
};

const submittedDate = (application: ProviderApplication) => {
  const firstSubmission = application.reviewHistory?.find((event) =>
    ["submitted", "resubmitted"].includes(event.action),
  )?.occurredAt;

  if (
    application.status === "draft" &&
    !application.submittedAt &&
    !firstSubmission
  ) {
    return null;
  }

  return application.submittedAt || firstSubmission || application.createdAt;
};

export const getApplicationSummary = (application: ProviderApplication) => {
  const serviceNames = getServiceNames(application);

  return {
    submitted: submittedDate(application),
    serviceNames,
    typeLabel: applicationTypeLabel[application.applicationType],
  };
};
