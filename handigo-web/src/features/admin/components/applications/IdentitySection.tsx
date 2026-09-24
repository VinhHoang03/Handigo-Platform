import type { ApplicationIdentityDocument } from "../../types/admin.types";
import { AssetPreview } from "./AssetPreview";
import { documentTypeLabel, formatDate } from "./application-detail.utils";

const genderLabel = (gender?: ApplicationIdentityDocument["gender"]) =>
  gender === "male" ? "Nam" : gender === "female" ? "Nữ" : gender === "other" ? "Khác" : "Chưa cập nhật";

export function IdentitySection({ identity }: { identity?: ApplicationIdentityDocument }) {
  if (!identity) {
    return (
      <div className="rounded-2xl border border-dashed border-outline-variant/60 p-4 text-sm text-on-surface-variant">
        Hồ sơ chưa có giấy tờ định danh.
      </div>
    );
  }

  const assets = [
    { label: "Ảnh mặt trước", url: identity.frontImageUrl },
    { label: "Ảnh mặt sau", url: identity.backImageUrl },
    { label: "Ảnh hộ chiếu", url: identity.passportImageUrl },
  ].filter((asset): asset is { label: string; url: string } => Boolean(asset.url));

  return (
    <section className="space-y-3 rounded-2xl border border-outline-variant/50 p-4">
      <h3 className="font-bold">Giấy tờ định danh</h3>
      <div className="grid gap-2 text-sm md:grid-cols-2">
        <p><b>Loại giấy tờ:</b> {documentTypeLabel(identity.type)}</p>
        <p><b>Số giấy tờ:</b> {identity.documentNumber || "Chưa cập nhật"}</p>
        <p><b>Họ tên:</b> {identity.fullName || "Chưa cập nhật"}</p>
        <p><b>Nơi cấp:</b> {identity.issuedPlace || "Chưa cập nhật"}</p>
        <p><b>Nguồn xác thực:</b> {identity.provider || "manual"}</p>
        <p><b>Ngày cấp:</b> {formatDate(identity.issuedAt)}</p>
        <p><b>Ngày hết hạn:</b> {formatDate(identity.expiresAt)}</p>
        <p><b>Ngày sinh:</b> {formatDate(identity.dateOfBirth)}</p>
        <p><b>Giới tính:</b> {genderLabel(identity.gender)}</p>
        <p><b>Quốc tịch:</b> {identity.nationality || "Chưa cập nhật"}</p>
        <p><b>Quê quán/Nơi sinh:</b> {identity.placeOfOrigin || "Chưa cập nhật"}</p>
        <p><b>Nơi thường trú:</b> {identity.placeOfResidence || "Chưa cập nhật"}</p>
      </div>
      {assets.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {assets.map((asset) => <AssetPreview key={asset.url} url={asset.url} label={asset.label} />)}
        </div>
      )}
    </section>
  );
}
