import { Download } from "lucide-react";
import type { ProviderApplication } from "../types/providerApplication.types";
import { downloadUrl, formatDate } from "./providerApplicationHistoryHelpers";

export function DownloadButton({ url, label }: { url: string; label: string }) {
  return (
    <a
      href={downloadUrl(url)}
      download
      target="_blank"
      rel="noreferrer"
      className="btn-secondary min-h-10 px-3 py-2 text-sm"
    >
      <Download size={16} /> Tải {label}
    </a>
  );
}

/** Ảnh giấy tờ định danh không hiển thị trực tiếp — chỉ tải xuống khi cần kiểm tra. */
export function IdentityDetail({ application }: { application: ProviderApplication }) {
  const identity = application.identityDocument;

  if (!identity) {
    return (
      <div className="rounded-lg border border-dashed border-outline-variant/60 p-4 text-sm text-on-surface-variant">
        Hồ sơ chưa có giấy tờ định danh.
      </div>
    );
  }

  const assets = [
    { label: "mặt trước", url: identity.frontImageUrl },
    { label: "mặt sau", url: identity.backImageUrl },
    { label: "hộ chiếu", url: identity.passportImageUrl },
  ].filter((item): item is { label: string; url: string } => Boolean(item.url));

  const genderLabel =
    identity.gender === "male"
      ? "Nam"
      : identity.gender === "female"
        ? "Nữ"
        : identity.gender === "other"
          ? "Khác"
          : "Chưa cập nhật";

  return (
    <section className="space-y-4 rounded-2xl border border-outline-variant/40 p-4">
      <h3 className="font-bold">Thông tin định danh</h3>
      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <p>
          <b>Loại:</b> {identity.type === "passport" ? "Hộ chiếu" : "CCCD"}
        </p>
        <p>
          <b>Số giấy tờ:</b> {identity.documentNumber || "Chưa cập nhật"}
        </p>
        <p>
          <b>Họ tên:</b> {identity.fullName || "Chưa cập nhật"}
        </p>
        <p>
          <b>Ngày sinh:</b> {formatDate(identity.dateOfBirth)}
        </p>
        <p>
          <b>Giới tính:</b> {genderLabel}
        </p>
        <p>
          <b>Quốc tịch:</b> {identity.nationality || "Chưa cập nhật"}
        </p>
        <p>
          <b>Quê quán/Nơi sinh:</b>{" "}
          {identity.placeOfOrigin || "Chưa cập nhật"}
        </p>
        <p>
          <b>Nơi thường trú:</b>{" "}
          {identity.placeOfResidence || "Chưa cập nhật"}
        </p>
        <p>
          <b>Ngày cấp:</b> {formatDate(identity.issuedAt)}
        </p>
        <p>
          <b>Nơi cấp:</b> {identity.issuedPlace || "Chưa cập nhật"}
        </p>
        <p>
          <b>Ngày hết hạn:</b> {formatDate(identity.expiresAt)}
        </p>
      </div>

      <div className="rounded-lg bg-surface-container-low p-4">
        <p className="mb-3 text-sm text-on-surface-variant">
          Ảnh giấy tờ được ẩn để bảo vệ thông tin cá nhân. Chỉ tải xuống khi cần
          kiểm tra.
        </p>
        <div className="flex flex-wrap gap-2">
          {assets.map((asset) => (
            <DownloadButton
              key={asset.url}
              url={asset.url}
              label={asset.label}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
