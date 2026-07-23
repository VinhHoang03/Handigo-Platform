import { AvatarEditor } from "@/features/profile/components/AvatarEditor";

interface ProfileAvatarPanelProps {
  avatarSrc?: string;
  fullName: string;
  isEmailVerified?: boolean;
  disabled?: boolean;
  onSave: (url: string) => Promise<void> | void;
}

export function ProfileAvatarPanel({
  avatarSrc,
  fullName,
  isEmailVerified,
  disabled,
  onSave,
}: ProfileAvatarPanelProps) {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-outline-variant/20 bg-surface-container-low p-4">
      <AvatarEditor
        src={avatarSrc}
        fullName={fullName}
        disabled={disabled}
        onSave={onSave}
      />
      <div className="min-w-0">
        <p className="truncate font-bold text-on-surface">{fullName}</p>
        {isEmailVerified && (
          <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-secondary-container/30 px-2 py-1 text-xs font-bold text-on-secondary-container">
            <span className="material-symbols-outlined text-sm">verified</span>
            Email đã xác minh
          </span>
        )}
      </div>
    </div>
  );
}
