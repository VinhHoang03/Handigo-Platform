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

const getProviderBannerMode = (
  application: ProviderApplication | null,
): "rejected" | "waiting" | "cta" => {
  if (application?.status === "rejected") return "rejected";
  if (application && WAITING_PROVIDER_STATUSES.includes(application.status)) {
    return "waiting";
  }
  return "cta";
};

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
      className="flex w-full items-center justify-between gap-3 rounded-lg border border-outline-variant/20 bg-surface-container-low p-4 text-left transition hover:border-primary/30 hover:bg-surface-container"
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

  return (
    <DashboardShell
      role="CUSTOMER"
      userAvatar={profile.avatar || profile.avatarUrl || DEFAULT_AVATAR}
      hideSidebar
    >
      <div className="mx-auto w-full max-w-7xl space-y-6">
        {canRegisterProvider &&
          !isProviderApplicationLoading &&
          providerBannerMode === "rejected" &&
          providerApplication && (
            <section className="flex flex-col justify-between gap-4 rounded-xl border border-error/25 bg-error-container p-5 text-on-error-container md:flex-row md:items-center">
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

        {canRegisterProvider &&
          !isProviderApplicationLoading &&
          providerBannerMode === "waiting" && (
            <section className="flex min-h-14 items-center gap-3 overflow-hidden rounded-xl border border-primary/15 bg-primary px-4 py-3 text-on-primary">
              <span className="material-symbols-outlined shrink-0 text-xl">
                pending_actions
              </span>
              <div
                className="min-w-0 flex-1 overflow-hidden"
                aria-live="polite"
              >
                <p className="provider-status-marquee w-max whitespace-nowrap text-sm font-medium">
                  Đơn đăng ký trở thành thợ cung cấp dịch vụ của bạn đã được gửi
                  thành công. Chúng tôi đang tiến hành xem xét hồ sơ và sẽ phản
                  hồi trong thời gian sớm nhất.
                </p>
              </div>
            </section>
          )}

        {canRegisterProvider &&
          !isProviderApplicationLoading &&
          providerBannerMode === "cta" && (
            <section className="flex flex-col justify-between gap-4 rounded-xl border border-primary/15 bg-primary p-5 text-on-primary md:flex-row md:items-center">
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
                className="rounded-lg bg-white px-5 py-2.5 font-bold text-primary shadow-sm transition hover:bg-white/90"
              >
                Đăng ký ngay
              </button>
            </section>
          )}

        <div
          role="tablist"
          aria-label="Các mục hồ sơ khách hàng"
          className="flex gap-2 overflow-x-auto rounded-xl border border-outline-variant/20 bg-white p-2 shadow-sm"
        >
          {[
            ["profile", "Hồ sơ"],
            ["security", "Bảo mật"],
            ["applications", "Hồ sơ Provider"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={activeTab === value}
              className={`min-h-11 shrink-0 rounded-lg px-4 py-2 text-sm font-bold transition ${
                activeTab === value
                  ? "bg-primary text-on-primary"
                  : "text-on-surface-variant hover:bg-surface-container-low"
              }`}
              onClick={() => setActiveTab(value as typeof activeTab)}
            >
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
          <section className="rounded-xl border border-outline-variant/20 bg-white p-6 shadow-sm md:p-8">
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
          <section className="rounded-xl border border-outline-variant/20 bg-white p-6 shadow-sm md:p-8">
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
          <section className="rounded-xl border border-outline-variant/20 bg-white p-4 shadow-sm sm:p-6 md:p-8">
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
