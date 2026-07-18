import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { DashboardShell } from "@/components/common/DashboardShell";
import { UserProfileSection } from "@/features/profile/components/UserProfileSection";
import { changePasswordApi } from "@/features/auth/api/auth.api";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { updateUserProfile } from "@/features/profile/api/userProfile.api";
import { ProviderApplicationHistory } from "@/features/provider-application/components/ProviderApplicationHistory";
import { ServiceAdditionApplicationDialog } from "@/features/provider-application/components/ServiceAdditionApplicationDialog";
import type { ProviderApplication } from "@/features/provider-application/types/providerApplication.types";
import { getErrorMessage } from "@/utils/apiError";
import type {
  UserProfileData,
  UserProfileFormValue,
} from "@/features/profile/types/profile.types";
import {
  AccountFunctionsPanel,
  PerformanceStats,
  ProfileSection,
  ProviderHero,
  ServiceAreaPanel,
  VerificationPanel,
} from "../components/ProviderProfileComponents";
import {
  ProfessionalProfileDialog,
  ServiceAreaDialog,
} from "../components/ProviderProfileDialogs";
import { ProviderFeedbackSection } from "../components/ProviderFeedbackSection";
import {
  ProfessionalSummarySection,
  ProviderCertificatesSection,
} from "../components/ProviderProfileSections";
import {
  ProviderIdentityDialog,
  ProviderPasswordConfirmDialog,
  ProviderPasswordUpdateDialog,
} from "../components/ProviderProfileSecurityDialogs";
import { providerProfileApi } from "../api/providerProfile.api";
import { useProviderAvailability } from "../hooks/useProviderAvailability";
import type {
  ProviderCertificate,
  ProviderProfile,
  ProviderProfileResponse,
  SubmitIdentityPayload,
  VerificationItem,
} from "../types/provider.types";
import {
  buildPerformanceStats,
  buildProviderProfileView,
  buildServiceArea,
  DEFAULT_PROVIDER_AVATAR,
  documentLast4,
  emptyCertificateForm,
  emptyIdentityForm,
  emptyPasswordForm,
  emptyProfessionalForm,
  fillIdentityEmptyFields,
  optional,
  toCertificateForm,
  toIdentityForm,
  toProfessionalForm,
  toUserProfileData,
  type CertificateForm,
  type IdentityForm,
  type PasswordForm,
  type ProfessionalForm,
} from "../utils/providerProfilePage";
import { Navigate } from "react-router-dom";

function ProviderProfileContent() {
  const onboardingStatus = useAuthStore(
    (state) => state.user?.providerOnboardingStatus,
  );
  const canReceiveJobs = !onboardingStatus || onboardingStatus === "APPROVED";
  const { availabilityStatus, isOnline, toggleAvailability } =
    useProviderAvailability(canReceiveJobs);
  const userProfileSectionRef = useRef<HTMLDivElement>(null);

  const [profile, setProfile] = useState<ProviderProfileResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditingProfessional, setIsEditingProfessional] = useState(false);
  const [isServiceApplicationOpen, setIsServiceApplicationOpen] =
    useState(false);
  const [editingServiceApplication, setEditingServiceApplication] =
    useState<ProviderApplication | null>(null);
  const [applicationHistoryKey, setApplicationHistoryKey] = useState(0);
  const [isServiceAreaModalOpen, setIsServiceAreaModalOpen] = useState(false);
  const [workingAreasForm, setWorkingAreasForm] = useState<string[]>([]);
  const [serviceAreaError, setServiceAreaError] = useState("");
  const [isCertificateFormOpen, setIsCertificateFormOpen] = useState(false);
  const [isIdentityModalOpen, setIsIdentityModalOpen] = useState(false);
  const [phoneHighlighted, setPhoneHighlighted] = useState(false);
  const [uploadingAsset, setUploadingAsset] = useState<string | null>(null);
  const [identityError, setIdentityError] = useState("");
  const [certificateError, setCertificateError] = useState("");
  const [professionalForm, setProfessionalForm] = useState<ProfessionalForm>(
    emptyProfessionalForm,
  );
  const [identityForm, setIdentityForm] =
    useState<IdentityForm>(emptyIdentityForm);
  const [certificateForm, setCertificateForm] =
    useState<CertificateForm>(emptyCertificateForm);
  const [isPwdConfirmOpen, setIsPwdConfirmOpen] = useState(false);
  const [isPwdModalOpen, setIsPwdModalOpen] = useState(false);
  const [pwdData, setPwdData] = useState<PasswordForm>(emptyPasswordForm);
  const [pwdError, setPwdError] = useState("");
  const [pwdMsg, setPwdMsg] = useState("");
  const [isUpdatingPwd, setIsUpdatingPwd] = useState(false);

  const syncAuthUser = useCallback((nextUser: UserProfileData) => {
    const { user, setUser } = useAuthStore.getState();
    if (!user) return;

    const syncedUser = {
      ...user,
      fullName: nextUser.fullName,
      phone: nextUser.phone || undefined,
      avatar: nextUser.avatar ?? null,
      birthday: nextUser.birthday,
      gender: nextUser.gender,
    };

    const hasChanged =
      user.fullName !== syncedUser.fullName ||
      (user.phone || undefined) !== syncedUser.phone ||
      (user.avatar ?? null) !== syncedUser.avatar ||
      (user.birthday ?? null) !== (syncedUser.birthday ?? null) ||
      (user.gender ?? null) !== (syncedUser.gender ?? null);

    if (hasChanged) setUser(syncedUser);
  }, []);

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const nextProfile = await providerProfileApi.getProfile();
      setProfile(nextProfile);
      setProfessionalForm(toProfessionalForm(nextProfile));
      syncAuthUser(toUserProfileData(nextProfile));
    } catch {
      setError("Không thể tải hồ sơ provider.");
    } finally {
      setIsLoading(false);
    }
  }, [syncAuthUser]);

  useEffect(() => {
    // Initial remote loads are intentionally started from this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadProfile();
  }, [loadProfile]);

  const profileView = useMemo<ProviderProfile | null>(
    () => buildProviderProfileView(profile),
    [profile],
  );

  const performanceStats = useMemo(
    () => buildPerformanceStats(profile, availabilityStatus),
    [availabilityStatus, profile],
  );

  const serviceArea = useMemo(() => buildServiceArea(profile), [profile]);

  async function handleUserProfileSave(payload: UserProfileFormValue) {
    setIsSaving(true);
    setError(null);

    try {
      const nextUser = await updateUserProfile(payload);
      setProfile((current) =>
        current
          ? {
              ...current,
              user: {
                ...current.user,
                fullName: nextUser.fullName,
                phone: nextUser.phone || undefined,
                avatar: nextUser.avatar ?? null,
                birthday: nextUser.birthday,
                gender: nextUser.gender,
              },
            }
          : current,
      );
      syncAuthUser(nextUser);
    } catch (saveError) {
      setError(
        getErrorMessage(
          saveError,
          "Không thể cập nhật thông tin cá nhân. Vui lòng thử lại.",
        ),
      );
      throw saveError;
    } finally {
      setIsSaving(false);
    }
  }

  async function handleProfessionalSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSaving(true);
    setError(null);
    try {
      const nextProfile = await providerProfileApi.updateProfile({
        bio: optional(professionalForm.bio),
      });

      setProfile(nextProfile);
      setProfessionalForm(toProfessionalForm(nextProfile));
      setIsEditingProfessional(false);
    } catch (saveError) {
      setError(
        getErrorMessage(
          saveError,
          "Không thể cập nhật hồ sơ nghề nghiệp. Vui lòng thử lại.",
        ),
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleIdentityFileUpload(
    field: "frontImageUrl" | "backImageUrl" | "passportImageUrl",
    file: File,
  ) {
    setUploadingAsset(field);
    setIdentityError("");
    try {
      const documentKind =
        field === "frontImageUrl"
          ? "cccd_front"
          : field === "backImageUrl"
            ? "cccd_back"
            : "passport";
      const uploaded = await providerProfileApi.uploadImage(
        file,
        "identity",
        documentKind,
      );
      setIdentityForm((current) => ({
        ...fillIdentityEmptyFields(current, uploaded.ocrSuggestion),
        [field]: uploaded.url,
      }));
    } catch (uploadError) {
      setIdentityError(
        getErrorMessage(
          uploadError,
          "Không thể upload ảnh giấy tờ. Vui lòng thử lại.",
        ),
      );
    } finally {
      setUploadingAsset(null);
    }
  }

  async function handleCertificateFileUpload(file: File) {
    setUploadingAsset("certificate");
    setCertificateError("");
    try {
      const uploaded = await providerProfileApi.uploadImage(
        file,
        "certificate",
      );
      setCertificateForm((current) => ({
        ...current,
        imageUrls: [...current.imageUrls, uploaded.url],
      }));
    } catch (uploadError) {
      setCertificateError(
        getErrorMessage(
          uploadError,
          "Không thể upload chứng chỉ. Vui lòng thử lại.",
        ),
      );
    } finally {
      setUploadingAsset(null);
    }
  }

  async function handleIdentitySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIdentityError("");

    if (!identityForm.documentNumber.trim()) {
      setIdentityError("Vui lòng nhập số giấy tờ.");
      return;
    }

    if (!identityForm.fullName.trim()) {
      setIdentityError("Vui lòng nhập họ tên trên giấy tờ.");
      return;
    }

    if (identityForm.type === "cccd" && !identityForm.frontImageUrl) {
      setIdentityError("Vui lòng upload ảnh mặt trước CCCD.");
      return;
    }

    if (identityForm.type === "passport" && !identityForm.passportImageUrl) {
      setIdentityError("Vui lòng upload ảnh hộ chiếu.");
      return;
    }

    if (!identityForm.consentAccepted) {
      setIdentityError("Vui lòng xác nhận đồng ý xử lý dữ liệu giấy tờ.");
      return;
    }

    setIsSaving(true);
    try {
      const payload: SubmitIdentityPayload = {
        type: identityForm.type,
        documentNumber: optional(identityForm.documentNumber),
        numberLast4: documentLast4(identityForm.documentNumber),
        fullName: optional(identityForm.fullName),
        issuedPlace: optional(identityForm.issuedPlace),
        issuedAt: optional(identityForm.issuedAt),
        expiresAt: optional(identityForm.expiresAt),
        frontImageUrl:
          identityForm.type === "cccd"
            ? optional(identityForm.frontImageUrl)
            : undefined,
        backImageUrl:
          identityForm.type === "cccd"
            ? optional(identityForm.backImageUrl)
            : undefined,
        passportImageUrl:
          identityForm.type === "passport"
            ? optional(identityForm.passportImageUrl)
            : undefined,
        consentAccepted: identityForm.consentAccepted,
      };
      const nextProfile = await providerProfileApi.submitIdentity(payload);

      setProfile(nextProfile);
      setIdentityForm(emptyIdentityForm);
      setIsIdentityModalOpen(false);
    } catch (submitError) {
      setIdentityError(
        getErrorMessage(
          submitError,
          "Không thể gửi giấy tờ xác thực. Vui lòng thử lại.",
        ),
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCertificateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCertificateError("");

    if (!certificateForm.title.trim()) {
      setCertificateError("Vui lòng nhập tên chứng chỉ.");
      return;
    }

    if (certificateForm.imageUrls.length === 0) {
      setCertificateError(
        "Vui lòng upload ít nhất một ảnh hoặc tài liệu chứng chỉ.",
      );
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        title: certificateForm.title.trim(),
        issuer: optional(certificateForm.issuer),
        issuedAt: optional(certificateForm.issuedAt),
        expiresAt: optional(certificateForm.expiresAt),
        imageUrls: certificateForm.imageUrls,
        description: optional(certificateForm.description),
      };

      const nextProfile = certificateForm.id
        ? await providerProfileApi.updateCertificate(
            certificateForm.id,
            payload,
          )
        : await providerProfileApi.createCertificate(payload);

      setProfile(nextProfile);
      setCertificateForm(emptyCertificateForm);
      setIsCertificateFormOpen(false);
    } catch (submitError) {
      setCertificateError(
        getErrorMessage(
          submitError,
          "Không thể lưu chứng chỉ. Vui lòng thử lại.",
        ),
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteCertificate(certificateId: string) {
    const confirmed = window.confirm("Xóa chứng chỉ này?");
    if (!confirmed) return;

    setIsSaving(true);
    try {
      const nextProfile =
        await providerProfileApi.deleteCertificate(certificateId);
      setProfile(nextProfile);
    } finally {
      setIsSaving(false);
    }
  }

  function openProfessionalEdit() {
    if (profile) setProfessionalForm(toProfessionalForm(profile));
    setIsEditingProfessional(true);
  }

  function openServiceApplication(application?: ProviderApplication) {
    setEditingServiceApplication(application || null);
    setIsServiceApplicationOpen(true);
  }

  function openServiceAreaEdit() {
    if (!profile) return;
    const legacyArea = [
      profile.provider.serviceArea?.ward,
      profile.provider.serviceArea?.province,
    ]
      .filter(Boolean)
      .join(", ");
    setWorkingAreasForm(
      profile.provider.workingAreas?.length
        ? profile.provider.workingAreas
        : legacyArea
          ? [legacyArea]
          : [],
    );
    setServiceAreaError("");
    setIsServiceAreaModalOpen(true);
  }

  async function handleServiceAreaSave() {
    const [firstArea = ""] = workingAreasForm;
    const parts = firstArea
      .split(", ")
      .map((item) => item.trim())
      .filter(Boolean);
    setIsSaving(true);
    setServiceAreaError("");
    try {
      const nextProfile = await providerProfileApi.updateProfile({
        workingAreas: workingAreasForm,
        serviceArea: {
          ward: parts[0],
          province: parts.slice(1).join(", ") || undefined,
        },
      });
      setProfile(nextProfile);
      setIsServiceAreaModalOpen(false);
    } catch (saveError) {
      setServiceAreaError(
        getErrorMessage(saveError, "Không thể cập nhật khu vực phục vụ."),
      );
    } finally {
      setIsSaving(false);
    }
  }

  function openIdentityModal() {
    setIdentityForm(toIdentityForm(profile?.provider.identityDocument));
    setIdentityError("");
    setIsIdentityModalOpen(true);
  }

  function handlePhoneVerificationClick() {
    if (profile?.user.phone) return;

    userProfileSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    setPhoneHighlighted(true);
    window.setTimeout(() => setPhoneHighlighted(false), 2600);
  }

  function openCreateCertificateForm() {
    setCertificateForm(emptyCertificateForm);
    setCertificateError("");
    setIsCertificateFormOpen(true);
  }

  function openEditCertificateForm(certificate: ProviderCertificate) {
    setCertificateForm(toCertificateForm(certificate));
    setCertificateError("");
    setIsCertificateFormOpen(true);
  }

  function closeCertificateForm() {
    setCertificateForm(emptyCertificateForm);
    setCertificateError("");
    setIsCertificateFormOpen(false);
  }

  function closePasswordModal() {
    setIsPwdModalOpen(false);
    setPwdData(emptyPasswordForm);
    setPwdError("");
    setPwdMsg("");
  }

  function handlePasswordFieldChange(field: keyof PasswordForm, value: string) {
    setPwdData((current) => ({ ...current, [field]: value }));
  }

  async function handleUpdatePassword(event: FormEvent<HTMLFormElement>) {
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
    } catch (passwordError) {
      setPwdError(
        getErrorMessage(
          passwordError,
          "Không thể cập nhật mật khẩu. Vui lòng kiểm tra lại mật khẩu cũ.",
        ),
      );
    } finally {
      setIsUpdatingPwd(false);
    }
  }

  if (isLoading) {
    return (
      <DashboardShell
        role="PROVIDER"
        showStatusToggle={canReceiveJobs}
        isOnline={isOnline}
        onStatusToggle={toggleAvailability}
      >
        <div className="rounded-xl bg-white p-8 text-center text-on-surface-variant">
          Đang tải hồ sơ...
        </div>
      </DashboardShell>
    );
  }

  if (error || !profile || !profileView) {
    return (
      <DashboardShell
        role="PROVIDER"
        showStatusToggle={canReceiveJobs}
        isOnline={isOnline}
        onStatusToggle={toggleAvailability}
      >
        <div className="rounded-xl border border-error/20 bg-error/10 p-8 text-center text-error">
          <p>{error || "Không thể mở hồ sơ provider."}</p>
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

  const identityStatus =
    profile.provider.identityDocument?.verificationStatus || "unsubmitted";
  const verificationItems: Array<VerificationItem & { onClick?: () => void }> =
    [
      {
        label: "Email",
        status: profile.user.email ? "Đã cập nhật" : "Chưa cập nhật",
        statusTone: profile.user.email ? "approved" : "pending",
      },
      {
        label: "Số điện thoại",
        status: profile.user.phone ? "Đã cập nhật" : "Cần bổ sung",
        statusTone: profile.user.phone ? "approved" : "pending",
        onClick: handlePhoneVerificationClick,
      },
      {
        label: "CCCD/Hộ chiếu",
        status:
          identityStatus === "verified"
            ? "Đã xác thực"
            : identityStatus === "rejected"
              ? "Bị từ chối"
              : identityStatus === "pending"
                ? "Đang chờ duyệt"
                : "Chưa gửi",
        statusTone:
          identityStatus === "verified"
            ? "approved"
            : identityStatus === "rejected"
              ? "rejected"
              : "pending",
        onClick: openIdentityModal,
      },
    ];

  return (
    <DashboardShell
      role="PROVIDER"
      showStatusToggle={canReceiveJobs}
      isOnline={isOnline}
      onStatusToggle={toggleAvailability}
    >
      <div className="grid grid-cols-12 items-start gap-gutter">
        <div className="col-span-12">
          <ProviderHero profile={profileView} />
        </div>

        <div className="col-span-12">
          <PerformanceStats stats={performanceStats} />
        </div>

        <div className="col-span-12 flex min-w-0 flex-col gap-gutter xl:col-span-7">
          <div ref={userProfileSectionRef} className="[&>section]:!p-6">
            <UserProfileSection
              user={toUserProfileData(profile)}
              isSaving={isSaving}
              error={error || undefined}
              defaultAvatar={DEFAULT_PROVIDER_AVATAR}
              showAvatar={false}
              showAddresses={false}
              highlightPhone={phoneHighlighted}
              onSaveProfile={handleUserProfileSave}
            />
          </div>

          <ProfessionalSummarySection
            bio={profileView.bio}
            experience={profileView.experience}
            skills={profileView.skills}
            onEdit={openProfessionalEdit}
            onRequestServiceAddition={() => openServiceApplication()}
          />

          <ProviderCertificatesSection
            certificates={profile.provider.certificates}
            isFormOpen={isCertificateFormOpen}
            form={certificateForm}
            error={certificateError}
            isSaving={isSaving}
            isUploading={uploadingAsset === "certificate"}
            onFormChange={setCertificateForm}
            onUpload={(file) => void handleCertificateFileUpload(file)}
            onSubmit={handleCertificateSubmit}
            onCancelForm={closeCertificateForm}
            onOpenCreate={openCreateCertificateForm}
            onEditCertificate={openEditCertificateForm}
            onDeleteCertificate={(certificateId) =>
              void handleDeleteCertificate(certificateId)
            }
          />
        </div>

        <div className="col-span-12 flex min-w-0 flex-col gap-gutter xl:col-span-5">
          <VerificationPanel items={verificationItems} />
          <ServiceAreaPanel area={serviceArea} onEdit={openServiceAreaEdit} />
          <AccountFunctionsPanel
            onPasswordClick={() => setIsPwdConfirmOpen(true)}
          />
          <ProfileSection title="Lịch sử đơn/hồ sơ">
            <ProviderApplicationHistory
              key={applicationHistoryKey}
              canEditRejected
              compact
              hideLastUpdated
              canEditApplication={(application) =>
                application.applicationType === "service_addition"
              }
              onEdit={(application) => {
                if (application.applicationType === "service_addition") {
                  openServiceApplication(application);
                }
              }}
            />
          </ProfileSection>
        </div>

        <div className="col-span-12">
          <ProviderFeedbackSection enabled={canReceiveJobs} />
        </div>
      </div>

      <ProfessionalProfileDialog
        open={isEditingProfessional}
        bio={professionalForm.bio}
        error={error || undefined}
        saving={isSaving}
        onBioChange={(bio) =>
          setProfessionalForm((current) => ({ ...current, bio }))
        }
        onClose={() => setIsEditingProfessional(false)}
        onSubmit={handleProfessionalSubmit}
      />

      {isServiceApplicationOpen && (
        <ServiceAdditionApplicationDialog
          open
          currentServiceIds={profile.provider.serviceIds}
          application={editingServiceApplication}
          onClose={() => {
            setIsServiceApplicationOpen(false);
            setEditingServiceApplication(null);
          }}
          onSubmitted={() => setApplicationHistoryKey((current) => current + 1)}
        />
      )}

      <ServiceAreaDialog
        open={isServiceAreaModalOpen}
        areas={workingAreasForm}
        saving={isSaving}
        error={serviceAreaError}
        onChange={setWorkingAreasForm}
        onClose={() => setIsServiceAreaModalOpen(false)}
        onSave={() => void handleServiceAreaSave()}
      />

      <ProviderIdentityDialog
        open={isIdentityModalOpen}
        form={identityForm}
        error={identityError}
        isSaving={isSaving}
        uploadingAsset={uploadingAsset}
        onChange={setIdentityForm}
        onUpload={(field, file) => void handleIdentityFileUpload(field, file)}
        onClose={() => setIsIdentityModalOpen(false)}
        onSubmit={handleIdentitySubmit}
      />

      <ProviderPasswordConfirmDialog
        open={isPwdConfirmOpen}
        onClose={() => setIsPwdConfirmOpen(false)}
        onConfirm={() => {
          setIsPwdConfirmOpen(false);
          setIsPwdModalOpen(true);
        }}
      />

      <ProviderPasswordUpdateDialog
        open={isPwdModalOpen}
        data={pwdData}
        error={pwdError}
        message={pwdMsg}
        isSaving={isUpdatingPwd}
        onChange={handlePasswordFieldChange}
        onClose={closePasswordModal}
        onSubmit={handleUpdatePassword}
      />
    </DashboardShell>
  );
}

export default function ProviderProfilePage() {
  const onboardingStatus = useAuthStore(
    (state) => state.user?.providerOnboardingStatus,
  );

  if (
    onboardingStatus &&
    onboardingStatus !== "APPROVED" &&
    onboardingStatus !== "PENDING_REVIEW"
  ) {
    return <Navigate to="/register-provider" replace />;
  }

  return <ProviderProfileContent />;
}
