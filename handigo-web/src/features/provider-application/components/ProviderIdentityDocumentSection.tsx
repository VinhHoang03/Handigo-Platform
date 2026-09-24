import { FloatingTextarea } from "@/components/common/FloatingField";
import type { DateFieldErrors } from "../utils/providerApplicationValidation";
import type {
  OcrDocumentKind,
  ProviderApplicationPayload,
} from "../types/providerApplication.types";
import { FileUploadSlot } from "./ProviderApplicationUploadControls";
import {
  IdentityDetailFields,
  IdentityTypeSelect,
} from "./ProviderIdentityFields";

type ProviderIdentityDocumentSectionProps = {
  identity: ProviderApplicationPayload["identityDocument"];
  dateErrors: DateFieldErrors;
  today: string;
  uploadingKey: string;
  ocrMessages: Record<string, string>;
  description: string;
  onUpdateIdentity: (
    value: Partial<ProviderApplicationPayload["identityDocument"]>,
  ) => void;
  onUploadIdentity: (
    key: string,
    kind: Exclude<OcrDocumentKind, "certificate">,
    file: File,
  ) => void;
  onDescriptionChange: (description: string) => void;
};

export function ProviderIdentityDocumentSection({
  identity,
  dateErrors,
  today,
  uploadingKey,
  ocrMessages,
  description,
  onUpdateIdentity,
  onUploadIdentity,
  onDescriptionChange,
}: ProviderIdentityDocumentSectionProps) {
  return (
    <div className="space-y-5 rounded-2xl border border-outline-variant/50 bg-surface-container-lowest p-4 md:p-6">
      <div>
        <h3 className="text-title-md font-bold">
          Xác thực giấy tờ định danh
        </h3>
      </div>

      <IdentityTypeSelect
        value={identity.type}
        onChange={(type) => onUpdateIdentity({ type })}
      />

      <div className="grid gap-4 md:grid-cols-2">
        {identity.type === "cccd" ? (
          <>
            <FileUploadSlot
              id="application-identity-front"
              label="Ảnh mặt trước"
              value={identity.frontImageUrl}
              uploading={uploadingKey === "identity-front"}
              onUpload={(file) =>
                onUploadIdentity("identity-front", "cccd_front", file)
              }
              onRemove={() => onUpdateIdentity({ frontImageUrl: "" })}
            />
            <FileUploadSlot
              id="application-identity-back"
              label="Ảnh mặt sau"
              value={identity.backImageUrl}
              uploading={uploadingKey === "identity-back"}
              onUpload={(file) =>
                onUploadIdentity("identity-back", "cccd_back", file)
              }
              onRemove={() => onUpdateIdentity({ backImageUrl: "" })}
            />
          </>
        ) : (
          <FileUploadSlot
            id="application-identity-passport"
            label="Ảnh hộ chiếu"
            value={identity.passportImageUrl}
            uploading={uploadingKey === "identity-passport"}
            onUpload={(file) =>
              onUploadIdentity("identity-passport", "passport", file)
            }
            onRemove={() => onUpdateIdentity({ passportImageUrl: "" })}
          />
        )}
      </div>

      {Object.entries(ocrMessages)
        .filter(([key]) => key.startsWith("identity-"))
        .map(([key, message]) => (
          <p
            key={key}
            className="rounded-lg bg-primary/5 p-3 text-sm text-on-surface-variant"
          >
            {message}
          </p>
        ))}

      <IdentityDetailFields
        identity={identity}
        dateErrors={dateErrors}
        today={today}
        onUpdateIdentity={onUpdateIdentity}
      />

      <FloatingTextarea
        id="provider-description"
        rows={7}
        maxLength={2000}
        label="Mô tả kinh nghiệm"
        value={description}
        onValueChange={onDescriptionChange}
        hint={`${description.length}/2000 ký tự`}
      />
    </div>
  );
}
