import { useEffect, useState, type FormEventHandler } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import { tokenStorage } from "../api/tokenStorage";
import {
  ActivityOverview,
  MobileProfileNav,
  NotificationSection,
  PersonalInfoSection,
  ProfessionalDetailsSection,
  ProfileHero,
  ProfileQuickLinks,
  ProfileSidebar,
  ProfileTopNav,
  SecuritySection,
} from "../components/profile";
import { authService } from "../features/auth/services/auth.service";
import type {
  AuthUser,
  ChangePasswordInput,
  ProfileUpdateInput,
} from "../types/auth";

const emptyProfileForm: ProfileUpdateInput = {
  fullName: "",
  phone: "",
  avatar: "",
};

const emptyPasswordForm: ChangePasswordInput = {
  currentPassword: "",
  newPassword: "",
};

const toProfileForm = (user: AuthUser): ProfileUpdateInput => ({
  fullName: user.fullName,
  phone: user.phone ?? "",
  avatar: user.avatar ?? "",
});

interface UserResponse {
  user: AuthUser;
}

interface UpdateProfileResponse {
  data: AuthUser;
}

const ProfilePage = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profileForm, setProfileForm] =
    useState<ProfileUpdateInput>(emptyProfileForm);
  const [passwordForm, setPasswordForm] =
    useState<ChangePasswordInput>(emptyPasswordForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!tokenStorage.get()) {
      navigate("/signin");
      return;
    }

    const loadProfile = async () => {
      try {
        const response = await api.get<UserResponse>("/users/me");
        setUser(response.data.user);
        setProfileForm(toProfileForm(response.data.user));
      } catch {
        setError("Không thể tải hồ sơ. Vui lòng đăng nhập lại.");
      } finally {
        setIsLoading(false);
      }
    };

    void loadProfile();
  }, [navigate]);

  const handleLogout = async () => {
    await authService.logout();
    navigate("/signin");
  };

  const handleProfileChange = (
    field: keyof ProfileUpdateInput,
    value: string,
  ) => {
    setProfileForm((current) => ({ ...current, [field]: value }));
    setProfileMessage(null);
  };

  const handlePasswordChange = (
    field: keyof ChangePasswordInput,
    value: string,
  ) => {
    setPasswordForm((current) => ({ ...current, [field]: value }));
    setPasswordMessage(null);
  };

  const handleCancelProfile = () => {
    if (user) {
      setProfileForm(toProfileForm(user));
    }
    setProfileMessage(null);
  };

  const handleSaveProfile: FormEventHandler<HTMLFormElement> = async (
    event,
  ) => {
    event.preventDefault();
    setIsSavingProfile(true);
    setProfileMessage(null);

    try {
      const response = await api.put<UpdateProfileResponse>(
        "/users/profile",
        profileForm,
      );
      const updatedUser = response.data.data;
      setUser(updatedUser);
      setProfileForm(toProfileForm(updatedUser));
      setProfileMessage("Cập nhật hồ sơ thành công");
    } catch (err) {
      setProfileMessage(
        err instanceof Error ? err.message : "Cập nhật hồ sơ thất bại",
      );
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword: FormEventHandler<HTMLFormElement> = async (
    event,
  ) => {
    event.preventDefault();
    setIsChangingPassword(true);
    setPasswordMessage(null);

    try {
      await api.post("/auth/change-password", passwordForm);
      setPasswordForm(emptyPasswordForm);
      setPasswordMessage("Cập nhật mật khẩu thành công");
    } catch (err) {
      setPasswordMessage(
        err instanceof Error ? err.message : "Cập nhật mật khẩu thất bại",
      );
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-surface font-body-md text-on-surface min-h-screen flex items-center justify-center">
        <p className="text-on-surface-variant">Đang tải hồ sơ...</p>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="bg-surface font-body-md text-on-surface min-h-screen flex items-center justify-center p-6">
        <div className="glass-card p-lg rounded-3xl max-w-md w-full text-center">
          <h1 className="font-headline-lg text-headline-lg text-on-surface mb-3">
            Không thể mở hồ sơ
          </h1>
          <p className="text-on-surface-variant mb-6">
            {error ?? "Vui lòng đăng nhập lại."}
          </p>
          <button
            className="px-6 py-3 bg-primary text-on-primary rounded-xl font-label-md"
            type="button"
            onClick={() => navigate("/login")}
          >
            Đến trang đăng nhập
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface font-body-md text-on-surface overflow-x-hidden min-h-screen">
      <ProfileTopNav user={user} onLogout={handleLogout} />
      <div className="flex min-h-screen pt-4">
        <ProfileSidebar />
        <main className="flex-1 md:ml-64 px-4 md:px-lg pb-xl">
          <div className="max-w-5xl mx-auto space-y-md">
            <ProfileHero user={user} />
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
              <div className="lg:col-span-4 space-y-md">
                <ActivityOverview user={user} />
                <ProfileQuickLinks />
              </div>
              <div className="lg:col-span-8 space-y-md">
                <PersonalInfoSection
                  form={profileForm}
                  isSaving={isSavingProfile}
                  message={profileMessage}
                  user={user}
                  onCancel={handleCancelProfile}
                  onChange={handleProfileChange}
                  onSubmit={handleSaveProfile}
                />
                <ProfessionalDetailsSection role={user.role} />
                <SecuritySection
                  form={passwordForm}
                  isSaving={isChangingPassword}
                  message={passwordMessage}
                  onChange={handlePasswordChange}
                  onSubmit={handleChangePassword}
                />
                <NotificationSection />
              </div>
            </div>
          </div>
        </main>
      </div>
      <MobileProfileNav />
    </div>
  );
};

export default ProfilePage;
