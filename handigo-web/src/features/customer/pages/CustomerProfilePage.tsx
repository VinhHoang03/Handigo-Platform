import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardShell } from "@/components/common/DashboardShell";
import { Modal } from "@/components/common/Modal";
import { AddressBookManager } from "@/features/profile/components/AddressBookManager";
import { UserProfileSection } from "@/features/profile/components/UserProfileSection";
import { changePasswordApi } from "@/features/auth/api/auth.api";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { ToggleOption } from "@/features/customer/components/ToggleOption";
import { ProviderApplicationHistory } from "@/features/provider-application/components/ProviderApplicationHistory";
import { providerApplicationApi } from "@/features/provider-application/api/providerApplication.api";
import type { ProviderApplication } from "@/features/provider-application/types/providerApplication.types";
import {
  getUserProfile,
  updateUserProfile,
} from "@/features/profile/api/userProfile.api";
import { getErrorMessage } from "@/utils/apiError";
import type {
  UserProfileData,
  UserProfileFormValue,
} from "@/features/profile/types/profile.types";

const DEFAULT_AVATAR =
  "https://ui-avatars.com/api/?name=Customer&background=4f46e5&color=fff";

const WAITING_PROVIDER_STATUSES: ProviderApplication["status"][] = [
  "pending",
  "resubmitted",
];

type ProviderBannerMode = "rejected" | "waiting" | "cta";

const getProviderBannerMode = (
  application: ProviderApplication | null,
): ProviderBannerMode => {
  if (application?.status === "rejected") return "rejected";
  if (application && WAITING_PROVIDER_STATUSES.includes(application.status)) {
    return "waiting";
  }
  return "cta";
};

const getProviderBannerStorageKey = (profileId?: string) =>
  `handigo:customer-profile:provider-banner:${profileId || "current"}`;

function AccountActionRow({
  icon,
  title,
  description,
  onClick,
}: {
  icon: string;
  title: string;
  description: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center justify-between gap-3 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-4 text-left transition hover:border-primary/40 hover:bg-surface-container"
      onClick={onClick}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <span className="material-symbols-outlined text-[20px]">{icon}</span>
        </span>
        <span className="min-w-0">
          <span className="block font-label-md font-bold text-on-surface">
            {title}
          </span>
          <span className="mt-1 block text-sm text-on-surface-variant">
            {description}
          </span>
        </span>
      </span>
      <span className="material-symbols-outlined text-outline-variant">
        chevron_right
      </span>
    </button>
  );
}

export default function CustomerProfilePage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<
    "profile" | "security" | "applications"
  >("profile");

  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [providerApplication, setProviderApplication] =
    useState<ProviderApplication | null>(null);
  const [isProviderApplicationLoading, setIsProviderApplicationLoading] =
    useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [dismissedProviderBanner, setDismissedProviderBanner] =
    useState<ProviderBannerMode | null>(null);

  const [isPwdConfirmOpen, setIsPwdConfirmOpen] = useState(false);
  const [isPwdModalOpen, setIsPwdModalOpen] = useState(false);
  const [pwdData, setPwdData] = useState({
    current: "",
    next: "",
    confirm: "",
  });
  const [pwdError, setPwdError] = useState("");
  const [pwdMsg, setPwdMsg] = useState("");
  const [isUpdatingPwd, setIsUpdatingPwd] = useState(false);

  const syncAuthUser = useCallback((nextProfile: UserProfileData) => {
    const { user, setUser } = useAuthStore.getState();
    if (!user) return;

    const nextUser = {
      ...user,
      fullName: nextProfile.fullName,
      phone: nextProfile.phone || undefined,
      avatar: nextProfile.avatar ?? null,
      birthday: nextProfile.birthday,
      gender: nextProfile.gender,
    };

    const hasChanged =
      user.fullName !== nextUser.fullName ||
      (user.phone || undefined) !== nextUser.phone ||
      (user.avatar ?? null) !== nextUser.avatar ||
      (user.birthday ?? null) !== (nextUser.birthday ?? null) ||
      (user.gender ?? null) !== (nextUser.gender ?? null);

    if (hasChanged) setUser(nextUser);
  }, []);

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg("");

    try {
      const nextProfile = await getUserProfile();
      try {
        const dismissedMode = window.localStorage.getItem(
          getProviderBannerStorageKey(nextProfile.id),
        );
        setDismissedProviderBanner(
          ["rejected", "waiting", "cta"].includes(dismissedMode || "")
            ? (dismissedMode as ProviderBannerMode)
            : null,
        );
      } catch {
        setDismissedProviderBanner(null);
      }
      setProfile(nextProfile);
      syncAuthUser(nextProfile);
    } catch {
      setErrorMsg("Không tải được hồ sơ. Vui lòng thử lại.");
    } finally {
      setIsLoading(false);
    }
  }, [syncAuthUser]);

  const loadProviderApplication = useCallback(async () => {
    try {
      setProviderApplication(await providerApplicationApi.mine());
    } catch {
      setProviderApplication(null);
    } finally {
      setIsProviderApplicationLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial remote loads are intentionally started from this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadProfile();
    void loadProviderApplication();
  }, [loadProfile, loadProviderApplication]);

  const handleSaveProfile = async (payload: UserProfileFormValue) => {
    setIsSaving(true);
    setErrorMsg("");

    try {
      const nextProfile = await updateUserProfile(payload);
      setProfile(nextProfile);
      syncAuthUser(nextProfile);
    } catch (error) {
      setErrorMsg(
        getErrorMessage(error, "Cập nhật hồ sơ thất bại. Vui lòng thử lại."),
      );
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const closePasswordModal = () => {
    setIsPwdModalOpen(false);
    setPwdData({ current: "", next: "", confirm: "" });
    setPwdError("");
    setPwdMsg("");
  };

  const handleUpdatePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPwdError("");
    setPwdMsg("");

    if (!pwdData.current.trim()) {
      setPwdError("Vui lòng nhập mật khẩu hiện tại.");
      return;
    }

    if (pwdData.next.length < 8) {
      setPwdError("Mật khẩu mới phải có ít nhất 8 ký tự.");
      return;
    }

    if (pwdData.next !== pwdData.confirm) {
      setPwdError("Mật khẩu xác nhận không khớp.");
      return;
    }

    try {
      setIsUpdatingPwd(true);
      await changePasswordApi({
        currentPassword: pwdData.current,
        newPassword: pwdData.next,
      });
      setPwdMsg("Cập nhật mật khẩu thành công.");
      window.setTimeout(closePasswordModal, 1200);
    } catch (error) {
      setPwdError(
        getErrorMessage(
          error,
          "Không thể cập nhật mật khẩu. Vui lòng kiểm tra lại mật khẩu cũ.",
        ),
      );
    } finally {
      setIsUpdatingPwd(false);
    }
  };

  if (isLoading) {
    return (
      <DashboardShell role="CUSTOMER" userAvatar={DEFAULT_AVATAR} hideSidebar>
        <div className="rounded-xl bg-white p-8 text-center text-on-surface-variant">
          Đang tải hồ sơ...
        </div>
      </DashboardShell>
    );
  }

  if (!profile) {
    return (
      <DashboardShell role="CUSTOMER" userAvatar={DEFAULT_AVATAR} hideSidebar>
        <div className="rounded-xl border border-error/20 bg-error/10 p-8 text-center text-error">
          <p>{errorMsg || "Không thể mở hồ sơ."}</p>
          <button
            type="button"
            className="mt-4 rounded-lg bg-error px-4 py-2 font-bold text-on-error"
            onClick={() => void loadProfile()}
          >
            Thử lại
          </button>
        </div>
      </DashboardShell>
    );
  }

  const canRegisterProvider =
    String(profile.role || "").toUpperCase() === "CUSTOMER";
  const providerBannerMode = getProviderBannerMode(providerApplication);
  const showProviderBanner =
    canRegisterProvider &&
    !isProviderApplicationLoading &&
    dismissedProviderBanner !== providerBannerMode;

  const dismissProviderBanner = () => {
    try {
      window.localStorage.setItem(
        getProviderBannerStorageKey(profile.id),
        providerBannerMode,
      );
    } catch {
      // Trạng thái trong phiên hiện tại vẫn được cập nhật nếu bộ nhớ trình duyệt bị chặn.
    }
    setDismissedProviderBanner(providerBannerMode);
  };

  return (
    <DashboardShell
      role="CUSTOMER"
      userAvatar={profile.avatar || profile.avatarUrl || DEFAULT_AVATAR}
      hideSidebar
    >
      <div className="mx-auto w-full max-w-7xl space-y-6">
        {showProviderBanner &&
          providerBannerMode === "rejected" &&
          providerApplication && (
            <section className="relative flex flex-col justify-between gap-4 overflow-hidden rounded-3xl border border-error/25 bg-error-container p-5 pr-14 text-on-error-container shadow-sm md:flex-row md:items-center md:p-6 md:pr-16">
              <button type="button" aria-label="Đóng thông báo" title="Không hiển thị lại" onClick={dismissProviderBanner} className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full text-on-error-container transition hover:bg-error/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/30">
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
              <div className="flex items-start gap-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-error/10 text-error">
                  <span className="material-symbols-outlined text-2xl">
                    warning
                  </span>
                </div>
                <p className="text-sm font-semibold leading-6">
                  Hồ sơ đăng ký Provider của bạn đã bị từ chối. Vui lòng xem chi tiết hồ sơ để biết lý do và thực hiện chỉnh sửa trước khi gửi lại.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  navigate(`/register-provider?applicationId=${providerApplication._id}`)
                }
                className="rounded-lg bg-error px-5 py-2.5 font-bold text-on-error shadow-sm transition hover:bg-error/90"
              >
                Xem hồ sơ
              </button>
            </section>
          )}

        {showProviderBanner &&
          providerBannerMode === "waiting" && (
            <section className="relative flex items-start gap-4 overflow-hidden rounded-3xl border border-primary/20 bg-primary p-5 pr-14 text-on-primary shadow-sm sm:items-center sm:p-6 sm:pr-16">
              <button type="button" aria-label="Đóng thông báo" title="Không hiển thị lại" onClick={dismissProviderBanner} className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full text-on-primary transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50">
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
              <span className="material-symbols-outlined shrink-0 rounded-2xl bg-white/15 p-3 text-2xl">
                pending_actions
              </span>
              <div className="min-w-0 flex-1" aria-live="polite">
                <p className="font-headline-sm text-lg font-bold">Hồ sơ đang được xem xét</p>
                <p className="mt-1 text-sm leading-5 text-on-primary/85">
                  Đơn đăng ký trở thành thợ cung cấp dịch vụ của bạn đã được gửi
                  thành công. Chúng tôi đang tiến hành xem xét hồ sơ và sẽ phản
                  hồi trong thời gian sớm nhất.
                </p>
              </div>
            </section>
          )}

        {showProviderBanner &&
          providerBannerMode === "cta" && (
            <section className="relative flex flex-col justify-between gap-5 overflow-hidden rounded-3xl border border-primary/15 bg-primary p-5 pr-14 text-on-primary shadow-sm md:flex-row md:items-center md:p-6 md:pr-16">
              <span aria-hidden="true" className="absolute -bottom-16 -right-10 h-40 w-40 rounded-full bg-white/10" />
              <button type="button" aria-label="Đóng thông báo" title="Không hiển thị lại" onClick={dismissProviderBanner} className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full text-on-primary transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50">
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
              <div className="flex items-center gap-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/15">
                  <span className="material-symbols-outlined text-2xl">
                    engineering
                  </span>
                </div>
                <div>
                  <p className="font-headline-sm font-bold">
                    Trở thành thợ dịch vụ
                  </p>
                  <p className="mt-1 text-sm text-on-primary/80">
                    Gửi hồ sơ để mở rộng vai trò provider trên cùng tài khoản.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate("/register-provider")}
                className="relative z-10 rounded-lg bg-white px-5 py-2.5 font-bold text-primary shadow-sm transition hover:bg-white/90"
              >
                Đăng ký ngay
              </button>
            </section>
          )}

        <div
          role="tablist"
          aria-label="Các mục hồ sơ khách hàng"
          className="flex gap-2 overflow-x-auto rounded-2xl border border-outline-variant/30 bg-surface-container-low p-2 shadow-sm sm:grid sm:grid-cols-3"
        >
          {[
            ["profile", "Hồ sơ", "person"],
            ["security", "Bảo mật", "shield"],
            ["applications", "Hồ sơ Provider", "engineering"],
          ].map(([value, label, icon]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={activeTab === value}
              className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
                activeTab === value
                  ? "bg-primary text-on-primary"
                  : "text-on-surface-variant hover:bg-surface-container-low"
              }`}
              onClick={() => setActiveTab(value as typeof activeTab)}
            >
              <span className="material-symbols-outlined text-[18px]">{icon}</span>
              {label}
            </button>
          ))}
        </div>

        {activeTab === "profile" && (
          <UserProfileSection
            user={profile}
            addresses={[]}
            isSaving={isSaving}
            error={errorMsg}
            defaultAvatar={DEFAULT_AVATAR}
            onSaveProfile={handleSaveProfile}
            addressManager={
              <AddressBookManager
                defaultRecipient={{
                  name: profile.fullName,
                  phone: profile.phone || "",
                }}
              />
            }
          />
        )}

        {activeTab === "security" && (
          <section className="rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-sm md:p-8">
            <h3 className="mb-5 font-headline-md text-headline-md text-on-surface">
              Chức năng tài khoản
            </h3>
            <div className="space-y-3">
              <AccountActionRow
                icon="lock"
                title="Mật khẩu và bảo mật"
                description="Cập nhật mật khẩu để bảo vệ tài khoản."
                onClick={() => setIsPwdConfirmOpen(true)}
              />
              <AccountActionRow
                icon="shield"
                title="Quyền riêng tư"
                description="Các tùy chọn quyền riêng tư sẽ được bổ sung."
              />
              <AccountActionRow
                icon="more_horiz"
                title="Các tùy chọn khác"
                description="Khu vực cho các thiết lập tài khoản khác."
              />
            </div>
          </section>
        )}

        {activeTab === "profile" && (
          <section className="rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-sm md:p-8">
            <h3 className="mb-5 font-headline-md text-headline-md text-on-surface">
              Cài đặt thông báo
            </h3>
            <div className="space-y-5">
              <ToggleOption
                label="Cập nhật đặt lịch"
                desc="Nhận thông báo khi lịch đặt được xác nhận hoặc thay đổi."
                icon="event_available"
                checked
              />
              <ToggleOption
                label="Tiếp thị và khuyến mãi"
                desc="Nhận các ưu đãi và cập nhật từ Handigo."
                icon="campaign"
              />
              <ToggleOption
                label="Tin nhắn SMS trực tiếp"
                desc="Nhận thông báo qua SMS."
                icon="sms"
                checked
              />
            </div>
          </section>
        )}

        {activeTab === "applications" && (
          <section className="rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-sm sm:p-6 md:p-8">
            <div className="mb-5">
              <h3 className="font-headline-md text-headline-md text-on-surface">
                Hồ sơ đăng ký Provider
              </h3>
              <p className="mt-1 text-sm text-on-surface-variant">
                Theo dõi trạng thái, phản hồi xét duyệt và gửi lại hồ sơ bị từ
                chối.
              </p>
            </div>
            <ProviderApplicationHistory
              canEditRejected
              onEdit={(application) =>
                navigate(
                  application.status === "draft"
                    ? "/register-provider"
                    : `/register-provider?applicationId=${application._id}`,
                )
              }
            />
          </section>
        )}
      </div>

      <Modal
        open={isPwdConfirmOpen}
        title="Mật khẩu và bảo mật"
        onClose={() => setIsPwdConfirmOpen(false)}
        size="sm"
      >
        <div className="space-y-5">
          <p className="text-on-surface">
            Bạn có muốn cập nhật mật khẩu không?
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              className="btn-secondary flex-1"
              onClick={() => setIsPwdConfirmOpen(false)}
            >
              Không
            </button>
            <button
              type="button"
              className="btn-primary flex-1"
              onClick={() => {
                setIsPwdConfirmOpen(false);
                setIsPwdModalOpen(true);
              }}
            >
              Đồng ý
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={isPwdModalOpen}
        title="Cập nhật mật khẩu"
        onClose={closePasswordModal}
        size="sm"
      >
        <form onSubmit={handleUpdatePassword} className="space-y-4">
          {(pwdError || pwdMsg) && (
            <div
              className={`rounded-lg p-4 text-sm ${
                pwdError
                  ? "bg-error/10 text-error"
                  : "bg-primary/10 text-primary"
              }`}
            >
              {pwdError || pwdMsg}
            </div>
          )}

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-on-surface">
              Mật khẩu hiện tại
            </span>
            <input
              type="password"
              value={pwdData.current}
              autoComplete="current-password"
              required
              onChange={(event) =>
                setPwdData((current) => ({
                  ...current,
                  current: event.target.value,
                }))
              }
              className="min-h-12 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-3 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-on-surface">
              Mật khẩu mới
            </span>
            <input
              type="password"
              value={pwdData.next}
              autoComplete="new-password"
              minLength={8}
              required
              onChange={(event) =>
                setPwdData((current) => ({
                  ...current,
                  next: event.target.value,
                }))
              }
              className="min-h-12 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-3 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-on-surface">
              Xác nhận mật khẩu mới
            </span>
            <input
              type="password"
              value={pwdData.confirm}
              autoComplete="new-password"
              minLength={8}
              required
              onChange={(event) =>
                setPwdData((current) => ({
                  ...current,
                  confirm: event.target.value,
                }))
              }
              className="min-h-12 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-3 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </label>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <button
              type="button"
              onClick={closePasswordModal}
              className="btn-secondary flex-1"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={isUpdatingPwd}
              className="btn-primary flex-1"
            >
              {isUpdatingPwd ? "Đang xử lý..." : "Cập nhật"}
            </button>
          </div>
        </form>
      </Modal>
    </DashboardShell>
  );
}
