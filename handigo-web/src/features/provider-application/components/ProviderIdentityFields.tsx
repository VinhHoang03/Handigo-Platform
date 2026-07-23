import { FloatingInput } from "@/components/common/FloatingField";
import type { DateFieldErrors } from "../utils/providerApplicationValidation";
import type {
  IdentityDocumentType,
  ProviderApplicationPayload,
} from "../types/providerApplication.types";

/** Chọn loại giấy tờ định danh (CCCD hoặc hộ chiếu). */
export function IdentityTypeSelect({
  value,
  onChange,
}: {
  value: IdentityDocumentType;
  onChange: (value: IdentityDocumentType) => void;
}) {
  return (
    <label className="form-select max-w-sm">
      <span className="form-select__label">Loại giấy tờ</span>
      <select
        id="application-identity-type"
        value={value}
        onChange={(event) =>
          onChange(event.target.value as IdentityDocumentType)
        }
        className="form-select__control"
      >
        <option value="cccd">CCCD</option>
        <option value="passport">Hộ chiếu</option>
      </select>
    </label>
  );
}

/** Lưới các trường thông tin chi tiết trích xuất/nhập tay từ giấy tờ định danh. */
export function IdentityDetailFields({
  identity,
  dateErrors,
  today,
  onUpdateIdentity,
}: {
  identity: ProviderApplicationPayload["identityDocument"];
  dateErrors: DateFieldErrors;
  today: string;
  onUpdateIdentity: (
    value: Partial<ProviderApplicationPayload["identityDocument"]>,
  ) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <FloatingInput
        id="application-identity-number"
        label="Số giấy tờ"
        value={identity.documentNumber}
        onValueChange={(documentNumber) =>
          onUpdateIdentity({ documentNumber })
        }
      />
      <FloatingInput
        id="application-identity-name"
        label="Họ tên trên giấy tờ"
        value={identity.fullName}
        onValueChange={(fullName) => onUpdateIdentity({ fullName })}
      />
      <FloatingInput
        id="application-identity-birth-date"
        label="Ngày sinh"
        type="date"
        value={identity.dateOfBirth || ""}
        max={today}
        error={dateErrors.dateOfBirth}
        onValueChange={(dateOfBirth) => onUpdateIdentity({ dateOfBirth })}
      />
      <label className="form-select">
        <span className="form-select__label">Giới tính</span>
        <select
          className="form-select__control"
          value={identity.gender || ""}
          onChange={(event) =>
            onUpdateIdentity({
              gender: (event.target.value || undefined) as
                | "male"
                | "female"
                | "other"
                | undefined,
            })
          }
        >
          <option value="">Chưa cập nhật</option>
          <option value="male">Nam</option>
          <option value="female">Nữ</option>
          <option value="other">Khác</option>
        </select>
      </label>
      <FloatingInput
        id="application-identity-nationality"
        label="Quốc tịch"
        value={identity.nationality || ""}
        onValueChange={(nationality) => onUpdateIdentity({ nationality })}
      />
      <FloatingInput
        id="application-identity-origin"
        label="Quê quán / Nơi sinh"
        value={identity.placeOfOrigin || ""}
        onValueChange={(placeOfOrigin) => onUpdateIdentity({ placeOfOrigin })}
      />
      <FloatingInput
        id="application-identity-residence"
        label="Nơi thường trú"
        value={identity.placeOfResidence || ""}
        onValueChange={(placeOfResidence) =>
          onUpdateIdentity({ placeOfResidence })
        }
      />
      <FloatingInput
        id="application-identity-issued-place"
        label="Nơi cấp"
        value={identity.issuedPlace || ""}
        onValueChange={(issuedPlace) => onUpdateIdentity({ issuedPlace })}
      />
      <FloatingInput
        id="application-identity-issued-at"
        label="Ngày cấp"
        type="date"
        value={identity.issuedAt || ""}
        max={today}
        error={dateErrors.issuedAt}
        onValueChange={(issuedAt) => onUpdateIdentity({ issuedAt })}
      />
      <FloatingInput
        id="application-identity-expires-at"
        label="Ngày hết hạn"
        type="date"
        value={identity.expiresAt || ""}
        min={identity.issuedAt || today}
        error={dateErrors.expiresAt}
        onValueChange={(expiresAt) => onUpdateIdentity({ expiresAt })}
      />
    </div>
  );
}
