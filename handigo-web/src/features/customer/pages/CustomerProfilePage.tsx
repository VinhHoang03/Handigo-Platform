import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardShell } from '@/components/common/DashboardShell';
import { FloatingInput, FloatingTextarea } from '@/components/common/FloatingField';
import { Modal } from '@/components/common/Modal';
import { AddressCard, ProfileSectionHeader, ToggleOption } from '../components/CustomerProfileComponents';
import type { Address, CreateAddressPayload, UserProfile } from '../types/customer.types';
import { getCustomerProfile, updateCustomerProfile } from '../api/customer.api';
import {
  createCustomerAddress,
  deleteCustomerAddress,
  getCustomerAddresses,
  updateCustomerAddress,
} from '../api/address.api';
import { attachPlacesAutocomplete, type ParsedPlaceAddress } from '../utils/googlePlacesAutocomplete';
import { changePasswordApi } from '../../auth/api/auth.api';

const DEFAULT_AVATAR = 'https://lh3.googleusercontent.com/aida-public/AB6AXuCbANF75d7I2j7S59JuBrIhjAZDYPgm9Yc_c5apOhMA5BjhRdccGvK3czXb7T822QwtjdzRWASs_O2t7aHmoOqNtz1eCmvAu3FN-3wmLRpdWr35v4ghB_HAhSmXVWOqnocR4E3XtXVgp2QCFa3eIkEbdQkVMf6R-uwYn05Mw-YXMFpbTjKeN9gdBVTM5VcI9rjungxUY-otBLoWGeWXcplc0h65LBFyBz_QtA-fyp5yRuoPBWRK8r7SvxrxcxpNcof_Ewvv1HskQ-g';

const EMPTY_ADDRESS_FORM: CreateAddressPayload = {
  fullAddress: '',
  province: '',
  ward: '',
  note: '',
  isDefault: false,
};

function ReadOnlyField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="space-y-2">
      <span className="ml-1 block text-label-sm text-on-surface-variant">{label}</span>
      <p className="min-h-14 rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-3 text-on-surface">
        {value || '—'}
      </p>
    </div>
  );
}

export default function CustomerProfilePage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [formData, setFormData] = useState<Partial<UserProfile>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isAddressLoading, setIsAddressLoading] = useState(true);
  const [addressError, setAddressError] = useState('');
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [addressForm, setAddressForm] = useState<CreateAddressPayload>(EMPTY_ADDRESS_FORM);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [isCreatingAddress, setIsCreatingAddress] = useState(false);
  const [addressFormError, setAddressFormError] = useState('');
  const [addressAutocompleteError, setAddressAutocompleteError] = useState('');
  const addressInputRef = useRef<HTMLInputElement>(null);

  const [isPwdModalOpen, setIsPwdModalOpen] = useState(false);
  const [pwdData, setPwdData] = useState({ current: '', new: '', confirm: '' });
  const [pwdError, setPwdError] = useState('');
  const [pwdMsg, setPwdMsg] = useState('');
  const [isUpdatingPwd, setIsUpdatingPwd] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setIsLoading(true);
        setIsAddressLoading(true);
        const data = await getCustomerProfile();
        if (cancelled) return;

        const loaded = {
          ...data,
          avatarUrl: data.avatarUrl || DEFAULT_AVATAR,
          joinDate: data.joinDate || 'Jan 2024',
        };
        setProfile(loaded);
        setFormData(loaded);

        try {
          setAddressError('');
          const addressData = await getCustomerAddresses();
          if (!cancelled) setAddresses(addressData);
        } catch {
          if (!cancelled) setAddressError('Không tải được địa chỉ đã lưu.');
        }
      } catch {
        if (cancelled) return;
        const fallback: UserProfile = {
          fullName: 'Người dùng',
          email: '',
          phone: '',
          avatarUrl: DEFAULT_AVATAR,
        };
        setProfile(fallback);
        setFormData(fallback);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setIsAddressLoading(false);
        }
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!isAddressModalOpen || !addressInputRef.current) return undefined;

    let cancelled = false;
    let detachAutocomplete: (() => void) | undefined;
    setAddressAutocompleteError('');

    const handlePlaceSelect = (placeAddress: ParsedPlaceAddress) => {
      setAddressForm((current) => ({
        ...current,
        fullAddress: placeAddress.fullAddress || current.fullAddress,
        province: placeAddress.province || current.province,
        ward: placeAddress.ward || current.ward,
        latitude: placeAddress.latitude,
        longitude: placeAddress.longitude,
        placeId: placeAddress.placeId,
      }));
    };

    void attachPlacesAutocomplete(addressInputRef.current, handlePlaceSelect)
      .then((detach) => {
        if (cancelled) {
          detach();
        } else {
          detachAutocomplete = detach;
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAddressAutocompleteError('Google Places chua duoc cau hinh. Ban van co the nhap thu cong.');
        }
      });

    return () => {
      cancelled = true;
      detachAutocomplete?.();
    };
  }, [isAddressModalOpen]);

  const defaultAddress = addresses.find((address) => address.isDefault);

  const handleEditToggle = () => {
    if (isEditing) setFormData(profile || {});
    setErrorMsg('');
    setIsEditing(!isEditing);
  };

  const handleProfileChange = (field: keyof UserProfile, value: string) => {
    setFormData((current) => ({ ...current, [field]: value }));
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setErrorMsg('');
      const updated = await updateCustomerProfile(formData);
      const updatedProfile = { ...profile, ...updated } as UserProfile;
      setProfile(updatedProfile);
      setFormData(updatedProfile);
      setIsEditing(false);
    } catch {
      setErrorMsg('Cập nhật thất bại. Vui lòng kiểm tra kết nối.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenAddressModal = () => {
    setEditingAddress(null);
    setAddressForm({ ...EMPTY_ADDRESS_FORM, isDefault: addresses.length === 0 });
    setAddressFormError('');
    setAddressAutocompleteError('');
    setIsAddressModalOpen(true);
  };

  const handleOpenEditAddressModal = (address: Address) => {
    setEditingAddress(address);
    setAddressForm({
      fullAddress: address.fullAddress,
      province: address.province,
      ward: address.ward,
      latitude: address.latitude,
      longitude: address.longitude,
      placeId: address.placeId,
      note: address.note || '',
      isDefault: Boolean(address.isDefault),
    });
    setAddressFormError('');
    setAddressAutocompleteError('');
    setIsAddressModalOpen(true);
  };

  const handleAddressInputChange = (field: keyof CreateAddressPayload, value: string | boolean) => {
    setAddressForm((current) => {
      const next = { ...current, [field]: value };
      if (field === 'fullAddress') {
        delete next.latitude;
        delete next.longitude;
        delete next.placeId;
      }
      return next;
    });
  };

  const handleCreateAddress = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAddressFormError('');

    if (!addressForm.fullAddress.trim() || !addressForm.province.trim() || !addressForm.ward.trim()) {
      setAddressFormError('Vui long nhap day du dia chi, tinh/thanh va phuong/xa.');
      return;
    }

    try {
      setIsCreatingAddress(true);
      if (editingAddress) {
        await updateCustomerAddress(editingAddress.id, addressForm);
      } else {
        await createCustomerAddress(addressForm);
      }
      const freshAddresses = await getCustomerAddresses();
      setAddresses(freshAddresses);
      setAddressError('');
      closeAddressModal();
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } } };
      setAddressFormError(err?.response?.data?.message || 'Không thể lưu địa chỉ. Vui lòng thử lại.');
    } finally {
      setIsCreatingAddress(false);
    }
  };

  const closeAddressModal = () => {
    setIsAddressModalOpen(false);
    setEditingAddress(null);
    setAddressForm({ ...EMPTY_ADDRESS_FORM });
    setAddressFormError('');
    setAddressAutocompleteError('');
  };

  const handleDeleteAddress = async (address: Address) => {
    const confirmed = window.confirm(`Xóa địa chỉ "${address.fullAddress}"?`);
    if (!confirmed) return;

    try {
      setIsCreatingAddress(true);
      await deleteCustomerAddress(address.id);
      const freshAddresses = await getCustomerAddresses();
      setAddresses(freshAddresses);
      setAddressError('');
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } } };
      setAddressError(err?.response?.data?.message || 'Không thể xóa địa chỉ. Vui lòng thử lại.');
    } finally {
      setIsCreatingAddress(false);
    }
  };

  const closePasswordModal = () => {
    setIsPwdModalOpen(false);
    setPwdData({ current: '', new: '', confirm: '' });
    setPwdError('');
    setPwdMsg('');
  };

  const handleUpdatePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPwdError('');
    setPwdMsg('');

    if (pwdData.new !== pwdData.confirm) {
      setPwdError('Mật khẩu xác nhận không khớp.');
      return;
    }

    try {
      setIsUpdatingPwd(true);
      await changePasswordApi({
        currentPassword: pwdData.current,
        newPassword: pwdData.new,
      });
      setPwdMsg('Cập nhật mật khẩu thành công.');
      window.setTimeout(closePasswordModal, 1200);
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } } };
      setPwdError(err?.response?.data?.message || 'Không thể cập nhật mật khẩu. Vui lòng kiểm tra lại mật khẩu cũ.');
    } finally {
      setIsUpdatingPwd(false);
    }
  };

  if (isLoading || !profile) {
    return (
      <DashboardShell role="CUSTOMER">
        <div className="flex min-h-[400px] items-center justify-center text-on-surface-variant">
          Đang tải hồ sơ...
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell role="CUSTOMER">
      <div className="mx-auto max-w-5xl space-y-6">
        {errorMsg && (
          <div className="rounded-2xl bg-error/10 p-3 font-label-md text-error">
            {errorMsg}
          </div>
        )}

        {profile.role === 'CUSTOMER' && (
          <section className="relative flex flex-col items-start justify-between gap-4 overflow-hidden rounded-3xl bg-gradient-to-r from-primary to-secondary p-5 md:flex-row md:items-center">
            <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
            <div className="relative flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20">
                <span className="material-symbols-outlined text-2xl text-white">engineering</span>
              </div>
              <div>
                <p className="font-headline-sm font-bold text-white">Trở thành thợ dịch vụ</p>
                <p className="text-sm text-white/80">
                  Kiếm thêm thu nhập bằng kỹ năng của bạn. Gửi hồ sơ để được xét duyệt.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate('/register-provider')}
              className="relative rounded-xl bg-white px-6 py-2.5 font-bold text-primary shadow-lg transition hover:shadow-xl"
            >
              Đăng ký ngay
            </button>
          </section>
        )}

        <section className="glass-card rounded-3xl p-6">
          <div className="flex flex-col items-center gap-6 md:flex-row">
            <div className="relative shrink-0">
              <img
                src={isEditing ? (formData.avatar || formData.avatarUrl || DEFAULT_AVATAR) : (profile.avatar || profile.avatarUrl || DEFAULT_AVATAR)}
                alt="Avatar"
                className="h-24 w-24 rounded-full border-4 border-primary/20 object-cover shadow-lg md:h-32 md:w-32"
              />
              {isEditing && (
                <label
                  htmlFor="avatar-upload"
                  className="absolute bottom-0 right-0 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-primary text-on-primary shadow-md transition hover:bg-primary/85"
                  title="Đổi ảnh đại diện"
                >
                  <span className="material-symbols-outlined text-base">photo_camera</span>
                  <input
                    id="avatar-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        const avatar = reader.result as string;
                        setFormData((current) => ({ ...current, avatar, avatarUrl: avatar }));
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                </label>
              )}
            </div>

            <div className="flex-1 text-center md:text-left">
              <h1 className="font-headline-lg text-headline-lg text-on-surface">{profile.fullName}</h1>
              <p className="mt-1 text-on-surface-variant">Thành viên từ {profile.joinDate}</p>
              {profile.isEmailVerified && (
                <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-secondary-container/30 px-2 py-1 text-xs font-medium text-on-secondary-container">
                  <span className="material-symbols-outlined text-sm">verified</span>
                  Email đã xác minh
                </span>
              )}
            </div>

            <button type="button" onClick={handleEditToggle} className="btn-primary shrink-0">
              {isEditing ? 'Hủy' : 'Chỉnh sửa hồ sơ'}
            </button>
          </div>
        </section>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
          <section className="glass-card h-full rounded-3xl p-6">
            <ProfileSectionHeader icon="person" title="Thông tin cá nhân" />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {isEditing ? (
                <FloatingInput
                  id="profile-full-name"
                  label="Họ và tên"
                  value={formData.fullName || ''}
                  onValueChange={(value) => handleProfileChange('fullName', value)}
                />
              ) : (
                <ReadOnlyField label="Họ và tên" value={profile.fullName} />
              )}

              <ReadOnlyField label="Địa chỉ Email" value={profile.email} />

              {isEditing ? (
                <FloatingInput
                  id="profile-phone"
                  label="Số điện thoại"
                  type="tel"
                  value={formData.phone || ''}
                  onValueChange={(value) => handleProfileChange('phone', value)}
                />
              ) : (
                <ReadOnlyField label="Số điện thoại" value={profile.phone} />
              )}

              <ReadOnlyField
                label="Vai trò"
                value={profile.role === 'CUSTOMER' ? 'Khách hàng' : profile.role === 'PROVIDER' ? 'Nhà cung cấp' : profile.role}
              />

              <div className="md:col-span-2">
                <ReadOnlyField label="Địa chỉ chính" value={defaultAddress?.address || 'Chưa chọn địa chỉ mặc định'} />
              </div>
            </div>
          </section>

          <section className="glass-card h-full rounded-3xl p-6">
            <ProfileSectionHeader
              icon="distance"
              title="Địa chỉ đã lưu"
              action={(
                <button type="button" onClick={handleOpenAddressModal} className="btn-ghost px-0">
                  <span className="material-symbols-outlined text-sm">add</span>
                  Thêm mới
                </button>
              )}
            />
            {isAddressLoading ? (
              <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-4 text-on-surface-variant">
                Đang tải địa chỉ...
              </div>
            ) : addressError ? (
              <div className="rounded-2xl border border-error/20 bg-error/10 p-4 text-error">
                {addressError}
              </div>
            ) : addresses.length > 0 ? (
              <div className="grid grid-cols-1 gap-3">
                {addresses.map((address) => (
                  <AddressCard
                    key={address.id}
                    address={address}
                    isActionDisabled={isCreatingAddress}
                    onDelete={handleDeleteAddress}
                    onEdit={handleOpenEditAddressModal}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-outline-variant/60 bg-surface-container-low p-5 text-center text-on-surface-variant">
                Chưa có địa chỉ đã lưu.
              </div>
            )}
          </section>
        </div>

        <section className="glass-card rounded-3xl p-6">
          <h3 className="mb-5 font-headline-lg text-headline-lg text-on-surface">Bảo mật & Quyền riêng tư</h3>
          <div className="space-y-6">
            <div className="flex flex-col justify-between gap-3 rounded-2xl border border-outline-variant/20 bg-surface-container-low p-4 sm:flex-row sm:items-center">
              <div>
                <p className="font-label-md">Mật khẩu</p>
                <p className="text-sm text-on-surface-variant">
                  Đổi mật khẩu định kỳ để bảo vệ tài khoản.
                </p>
              </div>
              <button onClick={() => setIsPwdModalOpen(true)} className="btn-secondary">
                Cập nhật
              </button>
            </div>
            <ToggleOption
              label="Xác thực hai yếu tố (2FA)"
              desc="Thêm bảo mật bổ sung cho đăng nhập."
              icon="shield_person"
              checked
              color="bg-secondary-container/20 text-secondary"
            />
          </div>
        </section>

        <section className="glass-card rounded-3xl p-6">
          <h3 className="mb-5 font-headline-lg text-headline-lg text-on-surface">Cài đặt thông báo</h3>
          <div className="space-y-5">
            <ToggleOption label="Cập nhật đặt lịch" desc="Nhận thông báo khi lịch đặt được xác nhận hoặc thay đổi." icon="event_available" checked />
            <ToggleOption label="Tiếp thị & Khuyến mãi" desc="Nhận các ưu đãi và cập nhật trên thị trường." icon="campaign" />
            <ToggleOption label="Tin nhắn SMS trực tiếp" desc="Nhận thông báo qua SMS." icon="sms" checked />
          </div>
        </section>

        {(isEditing || isSaving) && (
          <div className="flex flex-col justify-end gap-3 pt-2 sm:flex-row">
            <button type="button" onClick={handleEditToggle} disabled={isSaving} className="btn-secondary">
              Hủy thay đổi
            </button>
            <button type="button" onClick={handleSave} disabled={isSaving} className="btn-primary">
              {isSaving ? 'Đang lưu...' : 'Lưu tất cả cập nhật'}
            </button>
          </div>
        )}
      </div>

      <Modal
        open={isAddressModalOpen}
        title={editingAddress ? 'Cập nhật địa chỉ' : 'Thêm địa chỉ mới'}
        onClose={closeAddressModal}
        size="lg"
      >
        <form onSubmit={handleCreateAddress} className="space-y-4">
          {addressFormError && (
            <div className="rounded-2xl bg-error/10 p-3 text-sm text-error">
              {addressFormError}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FloatingInput
              id="address-full-address"
              label="Địa chỉ đầy đủ"
              value={addressForm.fullAddress}
              minLength={5}
              required
              containerClassName="md:col-span-2"
              inputRef={addressInputRef}
              hint={addressAutocompleteError || 'Nhap dia chi de goi y tu Google Places, hoac nhap thu cong.'}
              onValueChange={(value) => handleAddressInputChange('fullAddress', value)}
            />
            <FloatingInput
              id="address-province"
              label="Tỉnh / Thành phố"
              value={addressForm.province}
              required
              onValueChange={(value) => handleAddressInputChange('province', value)}
            />
            <FloatingInput
              id="address-ward"
              label="Phường / Xã"
              value={addressForm.ward}
              required
              onValueChange={(value) => handleAddressInputChange('ward', value)}
            />
            <FloatingTextarea
              id="address-note"
              label="Ghi chú"
              value={addressForm.note || ''}
              rows={3}
              maxLength={200}
              containerClassName="md:col-span-2"
              onValueChange={(value) => handleAddressInputChange('note', value)}
            />
          </div>

          <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-surface-container-low p-4">
            <input
              type="checkbox"
              checked={Boolean(addressForm.isDefault)}
              onChange={(event) => handleAddressInputChange('isDefault', event.target.checked)}
              className="h-5 w-5 rounded border-outline-variant text-primary focus:ring-primary"
            />
            <span className="font-label-md text-on-surface">Đặt làm địa chỉ mặc định</span>
          </label>

          <div className="flex flex-col justify-end gap-3 pt-2 sm:flex-row">
            <button type="button" onClick={closeAddressModal} disabled={isCreatingAddress} className="btn-secondary">
              Hủy
            </button>
            <button type="submit" disabled={isCreatingAddress} className="btn-primary">
              {isCreatingAddress ? 'Đang lưu...' : editingAddress ? 'Cập nhật địa chỉ' : 'Lưu địa chỉ'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={isPwdModalOpen} title="Bảo vệ tài khoản" onClose={closePasswordModal} size="sm">
        <form onSubmit={handleUpdatePassword} className="space-y-4">
          {(pwdError || pwdMsg) && (
            <div className={`rounded-2xl p-4 text-sm ${pwdError ? 'bg-error/10 text-error' : 'bg-primary/10 text-primary'}`}>
              {pwdError || pwdMsg}
            </div>
          )}

          <FloatingInput
            id="current-password"
            label="Mật khẩu hiện tại"
            type="password"
            value={pwdData.current}
            autoComplete="current-password"
            required
            onValueChange={(value) => setPwdData((current) => ({ ...current, current: value }))}
          />
          <FloatingInput
            id="new-password"
            label="Mật khẩu mới"
            type="password"
            value={pwdData.new}
            autoComplete="new-password"
            minLength={8}
            required
            onValueChange={(value) => setPwdData((current) => ({ ...current, new: value }))}
          />
          <FloatingInput
            id="confirm-password"
            label="Xác nhận mật khẩu mới"
            type="password"
            value={pwdData.confirm}
            autoComplete="new-password"
            minLength={8}
            required
            onValueChange={(value) => setPwdData((current) => ({ ...current, confirm: value }))}
          />

          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <button type="button" onClick={closePasswordModal} className="btn-secondary flex-1">
              Hủy bỏ
            </button>
            <button type="submit" disabled={isUpdatingPwd} className="btn-primary flex-1">
              {isUpdatingPwd ? 'Đang xử lý...' : 'Cập nhật'}
            </button>
          </div>
        </form>
      </Modal>
    </DashboardShell>
  );
}
