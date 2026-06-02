import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../../components/DashboardLayout';
import { AddressCard, ProfileSectionHeader, ToggleOption } from '../components/CustomerProfileComponents';
import type { Address, CreateAddressPayload, UserProfile } from '../types/customer.types';
import { getCustomerProfile, updateCustomerProfile } from '../api/customer.api';
import { createCustomerAddress, deleteCustomerAddress, getCustomerAddresses, updateCustomerAddress } from '../api/address.api';
import { changePasswordApi } from '../../auth/api/auth.api';

const DEFAULT_AVATAR = 'https://lh3.googleusercontent.com/aida-public/AB6AXuCbANF75d7I2j7S59JuBrIhjAZDYPgm9Yc_c5apOhMA5BjhRdccGvK3czXb7T822QwtjdzRWASs_O2t7aHmoOqNtz1eCmvAu3FN-3wmLRpdWr35v4ghB_HAhSmXVWOqnocR4E3XtXVgp2QCFa3eIkEbdQkVMf6R-uwYn05Mw-YXMFpbTjKeN9gdBVTM5VcI9rjungxUY-otBLoWGeWXcplc0h65LBFyBz_QtA-fyp5yRuoPBWRK8r7SvxrxcxpNcof_Ewvv1HskQ-g';

const EMPTY_ADDRESS_FORM: CreateAddressPayload = {
  label: '',
  addressLine: '',
  ward: '',
  district: '',
  city: '',
  isDefault: false,
};

const CustomerProfilePage: React.FC = () => {
  const navigate = useNavigate();

  const navItems = [
    { icon: 'grid_view', label: 'Bảng điều khiển', path: '/customer' },
    { icon: 'event_available', label: 'Đặt lịch', path: '#' },
    { icon: 'mail', label: 'Tin nhắn', path: '#' },
    { icon: 'payments', label: 'Ví', path: '#' },
    { icon: 'settings', label: 'Cài đặt', path: '/customer/profile' },
  ];


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

  // Password modal states
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

  const handleEditToggle = () => {
    if (isEditing) {
      // Revert changes
      setFormData(profile || {});
    }
    setIsEditing(!isEditing);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
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
      // Local fallback for display purposes
      setProfile({ ...profile, ...formData } as UserProfile);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenAddressModal = () => {
    setEditingAddress(null);
    setAddressForm({ ...EMPTY_ADDRESS_FORM, isDefault: addresses.length === 0 });
    setAddressFormError('');
    setIsAddressModalOpen(true);
  };

  const handleOpenEditAddressModal = (address: Address) => {
    setEditingAddress(address);
    setAddressForm({
      label: address.label,
      addressLine: address.addressLine,
      ward: address.ward,
      district: address.district,
      city: address.city,
      isDefault: Boolean(address.isDefault),
    });
    setAddressFormError('');
    setIsAddressModalOpen(true);
  };

  const handleAddressInputChange = (field: keyof CreateAddressPayload, value: string | boolean) => {
    setAddressForm((current) => ({ ...current, [field]: value }));
  };

  const handleCreateAddress = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAddressFormError('');

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
      setIsAddressModalOpen(false);
      setEditingAddress(null);
      setAddressForm(EMPTY_ADDRESS_FORM);
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } } };
      setAddressFormError(err?.response?.data?.message || 'Không thể thêm địa chỉ. Vui lòng thử lại.');
    } finally {
      setIsCreatingAddress(false);
    }
  };

  const handleCloseAddressModal = () => {
    setIsAddressModalOpen(false);
    setEditingAddress(null);
    setAddressForm(EMPTY_ADDRESS_FORM);
    setAddressFormError('');
  };

  const handleDeleteAddress = async (address: Address) => {
    const confirmed = window.confirm(`Xóa địa chỉ "${address.label}"?`);
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

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError('');
    setPwdMsg('');

    if (pwdData.new !== pwdData.confirm) {
      setPwdError('Mật khẩu xác nhận không khớp');
      return;
    }

    try {
      setIsUpdatingPwd(true);
      await changePasswordApi({
        currentPassword: pwdData.current,
        newPassword: pwdData.new
      });
      setPwdMsg('Cập nhật mật khẩu thành công!');
      // Tự động đóng modal sau 2s
      setTimeout(() => {
        setIsPwdModalOpen(false);
        setPwdData({ current: '', new: '', confirm: '' });
        setPwdMsg('');
      }, 2000);
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } } };
      setPwdError(err?.response?.data?.message || 'Lỗi cập nhật mật khẩu. Vui lòng kiểm tra lại mật khẩu cũ.');
    } finally {
      setIsUpdatingPwd(false);
    }
  };

  if (isLoading || !profile) {
    return (
      <DashboardLayout navItems={navItems} switchLabel="Đăng ký thợ dịch vụ" switchVariant="gradient" onSwitch={() => navigate('/register-provider')} userAvatar={DEFAULT_AVATAR}>
        <div className="flex items-center justify-center min-h-[400px]">Đang tải...</div>
      </DashboardLayout>
    );
  }

  const defaultAddress = addresses.find((address) => address.isDefault);

  return (
    <DashboardLayout navItems={navItems} switchLabel="Đăng ký thợ dịch vụ" switchVariant="gradient" onSwitch={() => navigate('/register-provider')} userAvatar={profile.avatarUrl || profile.avatar || DEFAULT_AVATAR}>
      <div className="max-w-5xl mx-auto space-y-md">
        {errorMsg && (
          <div className="bg-error/10 text-error p-3 rounded-xl mb-4 font-label-md">
            {errorMsg}
          </div>
        )}
        {/* Banner đăng ký thợ — chỉ hiện khi role là CUSTOMER */}
        {profile.role === 'CUSTOMER' && (
          <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-primary to-secondary p-5 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="absolute -top-8 -right-8 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-white text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>engineering</span>
              </div>
              <div>
                <p className="font-headline-sm text-white font-bold">Trở thành Thợ Dịch Vụ</p>
                <p className="text-white/80 font-body-sm text-sm">Kiếm thêm thu nhập bằng kỹ năng của bạn — đăng ký ngay hôm nay!</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate('/register-provider')}
              className="px-6 py-2.5 bg-white text-primary font-bold rounded-xl shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all shrink-0 font-label-md"
            >
              Đăng ký ngay
            </button>
          </section>
        )}
        <section className="glass-card rounded-3xl p-md">
          <div className="flex flex-col md:flex-row items-center gap-6">
            {/* Avatar */}
            <div className="relative shrink-0">
              <img
                src={isEditing ? (formData.avatar || formData.avatarUrl || DEFAULT_AVATAR) : (profile.avatar || profile.avatarUrl || DEFAULT_AVATAR)}
                alt="Avatar"
                className="w-24 h-24 md:w-32 md:h-32 rounded-full object-cover border-4 border-primary/20 shadow-lg"
              />
              {isEditing && (
                <label
                  htmlFor="avatar-upload"
                  className="absolute bottom-0 right-0 w-9 h-9 bg-primary text-on-primary rounded-full flex items-center justify-center cursor-pointer shadow-md hover:bg-primary/80 transition-all"
                  title="Đổi ảnh đại diện"
                >
                  <span className="material-symbols-outlined text-base">photo_camera</span>
                  <input
                    id="avatar-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        setFormData((prev) => ({ ...prev, avatar: reader.result as string, avatarUrl: reader.result as string }));
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                </label>
              )}
            </div>
            {/* Name & join date */}
            <div className="flex-1 text-center md:text-left">
              <h1 className="font-headline-lg text-headline-lg text-on-surface">{profile.fullName}</h1>
              <p className="text-on-surface-variant font-body-md mt-1">Thành viên từ {profile.joinDate}</p>
              {profile.isEmailVerified && (
                <span className="inline-flex items-center gap-1 mt-2 px-2 py-1 rounded-full bg-secondary-container/30 text-on-secondary-container text-[12px] font-medium">
                  <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                  Email đã xác minh
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleEditToggle}
              className="px-6 py-2 bg-primary text-on-primary rounded-xl font-label-md shrink-0"
            >
              {isEditing ? 'Hủy' : 'Chỉnh sửa hồ sơ'}
            </button>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-gutter items-start">
          <section className="glass-card p-lg rounded-3xl h-full">
            <ProfileSectionHeader icon="person" title="Thông tin cá nhân" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
              <div className="space-y-2">
                <label className="text-label-sm text-on-surface-variant block ml-1">Họ và tên</label>
                {isEditing ? (
                  <input name="fullName" value={formData.fullName || ''} onChange={handleChange} className="w-full px-4 py-3 rounded-xl border border-primary focus:outline-none" />
                ) : (
                  <p className="w-full px-4 py-3 rounded-xl border border-outline-variant bg-surface-bright">{profile.fullName}</p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-label-sm text-on-surface-variant block ml-1">Địa chỉ Email</label>
                <p className="w-full px-4 py-3 rounded-xl border border-outline-variant bg-surface-container-low text-on-surface-variant">
                  {profile.email || '—'}
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-label-sm text-on-surface-variant block ml-1">Số điện thoại</label>
                {isEditing ? (
                  <input name="phone" value={formData.phone || ''} onChange={handleChange} className="w-full px-4 py-3 rounded-xl border border-primary focus:outline-none" />
                ) : (
                  <p className="w-full px-4 py-3 rounded-xl border border-outline-variant bg-surface-bright">{profile.phone || '—'}</p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-label-sm text-on-surface-variant block ml-1">Vai trò</label>
                <p className="w-full px-4 py-3 rounded-xl border border-outline-variant bg-surface-container-low text-on-surface-variant">
                  {profile.role === 'CUSTOMER' ? 'Khách hàng' : profile.role === 'PROVIDER' ? 'Nhà cung cấp' : profile.role || '—'}
                </p>
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-label-sm text-on-surface-variant block ml-1">Địa chỉ chính</label>
                <p className="w-full px-4 py-3 rounded-xl border border-outline-variant bg-surface-bright leading-relaxed">
                  {defaultAddress?.address || 'Chưa chọn địa chỉ mặc định'}
                </p>
              </div>
            </div>
          </section>

          <section className="glass-card p-lg rounded-3xl h-full">
            <ProfileSectionHeader
              icon="distance"
              title="Địa chỉ đã lưu"
              action={(
                <button type="button" onClick={handleOpenAddressModal} className="text-primary font-label-md text-label-md flex items-center gap-1 hover:underline">
                  <span className="material-symbols-outlined text-sm">add</span>
                  Thêm mới
                </button>
              )}
            />
            {isAddressLoading ? (
              <div className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-4 text-on-surface-variant">
                Đang tải địa chỉ...
              </div>
            ) : addressError ? (
              <div className="rounded-xl border border-error/20 bg-error/10 p-4 text-error">
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
              <div className="rounded-xl border border-dashed border-outline-variant/60 bg-surface-container-low p-5 text-center text-on-surface-variant">
                Chưa có địa chỉ đã lưu.
              </div>
            )}
          </section>
        </div>

        <section className="glass-card p-lg rounded-3xl">
          <h3 className="font-headline-lg text-headline-lg text-on-surface mb-lg">Bảo mật & Quyền riêng tư</h3>
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-2xl border border-outline-variant/20">
              <div><p className="font-label-md">Mật khẩu</p><p className="text-sm text-on-surface-variant">Đổi lần cuối 2 tháng trước</p></div>
              <button onClick={() => setIsPwdModalOpen(true)} className="px-6 py-2 border border-primary text-primary rounded-xl hover:bg-primary/5 transition-colors">Cập nhật</button>
            </div>
            <ToggleOption label="Xác thực hai yếu tố (2FA)" desc="Thêm bảo mật bổ sung cho đăng nhập." icon="shield_person" checked color="bg-secondary-container/20 text-secondary" />
          </div>
        </section>

        <section className="glass-card p-lg rounded-3xl">
          <h3 className="font-headline-lg text-headline-lg text-on-surface mb-lg">Cài đặt thông báo</h3>
          <div className="space-y-5">
            <ToggleOption label="Cập nhật đặt lịch" desc="Nhận thông báo khi lịch đặt được xác nhận hoặc thay đổi." icon="event_available" checked />
            <ToggleOption label="Tiếp thị & Khuyến mãi" desc="Nhận các ưu đãi và cập nhật trên thị trường." icon="campaign" />
            <ToggleOption label="Tin nhắn SMS trực tiếp" desc="Nhận thông báo qua SMS." icon="sms" checked />
          </div>
        </section>

        {(isEditing || isSaving) && (
          <div className="flex justify-end gap-md pt-lg">
            <button type="button" onClick={handleEditToggle} disabled={isSaving} className="px-8 py-3 text-on-surface-variant font-label-md hover:text-primary transition-all disabled:opacity-50">
              Hủy thay đổi
            </button>
            <button type="button" onClick={handleSave} disabled={isSaving} className="px-12 py-3 bg-primary text-on-primary rounded-2xl font-bold disabled:opacity-50">
              {isSaving ? 'Đang lưu...' : 'Lưu tất cả cập nhật'}
            </button>
          </div>
        )}
      </div>

      {isAddressModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
          <div className="bg-surface w-[92vw] max-w-[560px] rounded-3xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-outline-variant/30">
              <div>
                <h2 className="font-headline-md text-headline-md text-on-surface">
                  {editingAddress ? 'Cập nhật địa chỉ' : 'Thêm địa chỉ mới'}
                </h2>
                <p className="text-sm text-on-surface-variant">Lưu địa chỉ để đặt dịch vụ nhanh hơn.</p>
              </div>
              <button
                type="button"
                onClick={handleCloseAddressModal}
                className="h-9 w-9 rounded-full bg-surface-container-low text-on-surface-variant hover:text-on-surface flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateAddress} className="p-6 space-y-4">
              {addressFormError && (
                <div className="rounded-2xl bg-error/10 p-3 text-sm text-error">
                  {addressFormError}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-label-sm text-on-surface font-semibold pl-1">Tên địa chỉ</label>
                  <input
                    value={addressForm.label}
                    onChange={(event) => handleAddressInputChange('label', event.target.value)}
                    placeholder="Nhà riêng, Văn phòng..."
                    className="w-full px-4 py-3 rounded-2xl border border-outline-variant/60 bg-surface-bright focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                    required
                    maxLength={50}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-label-sm text-on-surface font-semibold pl-1">Tỉnh / Thành phố</label>
                  <input
                    value={addressForm.city}
                    onChange={(event) => handleAddressInputChange('city', event.target.value)}
                    placeholder="TP. Hồ Chí Minh"
                    className="w-full px-4 py-3 rounded-2xl border border-outline-variant/60 bg-surface-bright focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                    required
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-label-sm text-on-surface font-semibold pl-1">Địa chỉ cụ thể</label>
                  <input
                    value={addressForm.addressLine}
                    onChange={(event) => handleAddressInputChange('addressLine', event.target.value)}
                    placeholder="Số nhà, tên đường, tòa nhà..."
                    className="w-full px-4 py-3 rounded-2xl border border-outline-variant/60 bg-surface-bright focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                    required
                    minLength={5}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-label-sm text-on-surface font-semibold pl-1">Phường / Xã</label>
                  <input
                    value={addressForm.ward}
                    onChange={(event) => handleAddressInputChange('ward', event.target.value)}
                    placeholder="Phường Bến Thành"
                    className="w-full px-4 py-3 rounded-2xl border border-outline-variant/60 bg-surface-bright focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-label-sm text-on-surface font-semibold pl-1">Quận / Huyện</label>
                  <input
                    value={addressForm.district}
                    onChange={(event) => handleAddressInputChange('district', event.target.value)}
                    placeholder="Quận 1"
                    className="w-full px-4 py-3 rounded-2xl border border-outline-variant/60 bg-surface-bright focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                    required
                  />
                </div>
              </div>

              <label className="flex items-center gap-3 rounded-2xl bg-surface-container-low p-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(addressForm.isDefault)}
                  onChange={(event) => handleAddressInputChange('isDefault', event.target.checked)}
                  className="h-5 w-5 rounded border-outline-variant text-primary focus:ring-primary"
                />
                <span className="font-label-md text-on-surface">Đặt làm địa chỉ mặc định</span>
              </label>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCloseAddressModal}
                  disabled={isCreatingAddress}
                  className="px-6 py-3 rounded-2xl bg-surface-container-high text-on-surface font-label-md disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isCreatingAddress}
                  className="px-8 py-3 rounded-2xl bg-primary text-on-primary font-bold shadow-lg shadow-primary/20 disabled:opacity-50"
                >
                  {isCreatingAddress ? 'Đang lưu...' : editingAddress ? 'Cập nhật địa chỉ' : 'Lưu địa chỉ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Modal */}
      {isPwdModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 transition-all">
          <div className="bg-surface w-[90vw] sm:w-[420px] rounded-3xl shadow-2xl relative flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header decoration */}
            <div className="bg-gradient-to-br from-primary/20 to-surface h-32 absolute top-0 left-0 right-0 pointer-events-none" />

            <button
              onClick={() => setIsPwdModalOpen(false)}
              className="absolute top-4 right-4 h-8 w-8 flex items-center justify-center bg-surface/50 backdrop-blur-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded-full transition-all z-10 border border-outline-variant/30"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>

            <div className="px-8 pt-10 pb-6 relative z-10 text-center flex flex-col items-center">
              <div className="w-16 h-16 bg-gradient-to-tr from-primary to-primary-container rounded-2xl flex items-center justify-center mb-5 shadow-lg shadow-primary/30 text-white">
                <span className="material-symbols-outlined text-[32px]" style={{ fontVariationSettings: "'FILL' 1" }}>lock</span>
              </div>
              <h2 className="font-headline-sm text-on-surface font-bold">Bảo vệ tài khoản</h2>
              <p className="text-on-surface-variant font-body-sm mt-1">Đổi mật khẩu định kỳ để nâng cao tính bảo mật</p>
            </div>

            <form onSubmit={handleUpdatePassword} className="px-8 pb-8 space-y-5 relative z-10">
              {(pwdError || pwdMsg) && (
                <div className={`p-4 rounded-2xl text-sm flex items-start gap-3 ${pwdError ? 'bg-error/10 text-error' : 'bg-primary/10 text-primary'}`}>
                  <span className="material-symbols-outlined text-[20px] shrink-0 mt-0.5">
                    {pwdError ? 'error' : 'check_circle'}
                  </span>
                  <p className="font-medium leading-relaxed">{pwdError || pwdMsg}</p>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-label-sm text-on-surface font-semibold pl-1">Mật khẩu hiện tại</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">key</span>
                  <input
                    type="password"
                    placeholder="Nhập mật khẩu hiện tại"
                    value={pwdData.current}
                    onChange={(e) => setPwdData({ ...pwdData, current: e.target.value })}
                    className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-outline-variant/60 bg-surface-bright focus:bg-surface focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none font-body-md"
                    required
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-label-sm text-on-surface font-semibold pl-1">Mật khẩu mới</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">lock_reset</span>
                  <input
                    type="password"
                    placeholder="Tối thiểu 8 ký tự"
                    value={pwdData.new}
                    onChange={(e) => setPwdData({ ...pwdData, new: e.target.value })}
                    className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-outline-variant/60 bg-surface-bright focus:bg-surface focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none font-body-md"
                    required
                    minLength={8}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-label-sm text-on-surface font-semibold pl-1">Xác nhận mật khẩu mới</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">fact_check</span>
                  <input
                    type="password"
                    placeholder="Nhập lại mật khẩu mới"
                    value={pwdData.confirm}
                    onChange={(e) => setPwdData({ ...pwdData, confirm: e.target.value })}
                    className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-outline-variant/60 bg-surface-bright focus:bg-surface focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none font-body-md"
                    required
                    minLength={8}
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsPwdModalOpen(false)}
                  className="flex-1 py-3.5 rounded-2xl font-label-md bg-surface-container-high text-on-surface hover:bg-surface-container-highest active:scale-95 transition-all"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingPwd}
                  className="flex-1 py-3.5 rounded-2xl font-bold bg-primary text-on-primary shadow-lg shadow-primary/30 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 active:scale-95 disabled:opacity-50 disabled:hover:translate-y-0 transition-all"
                >
                  {isUpdatingPwd ? 'Đang xử lý...' : 'Cập nhật'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default CustomerProfilePage;

