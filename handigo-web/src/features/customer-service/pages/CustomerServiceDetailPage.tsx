import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { bookingApi } from "@/api/booking";
import { useBookingStore } from "@/features/booking/hooks/useBookingStore";
import type { Address, Category, Service, ServiceOption } from "@/types/booking";
import { CustomerServiceLayout } from "../components/CustomerServiceLayout";
import { customerServiceApi, type NearbyProvider } from "../api/customerService.api";
import {
  getCategoryId,
  getCategoryName,
  getOptionPrice,
  getServiceImage,
  getServicePrice,
  money,
} from "../utils/serviceDisplay";
import { ReliableImage } from "@/components/common/ReliableImage";

const checklist = [
  "Tư vấn phạm vi công việc",
  "Provider đã được xác minh",
  "Có thể theo dõi trạng thái đơn",
  "Thanh toán an toàn",
  "Hỗ trợ sau dịch vụ",
  "Minh bạch chi phí",
];

const getErrorMessage = (error: unknown) => {
  const err = error as { response?: { data?: { message?: string } } };
  return err?.response?.data?.message || "Không thể tải chi tiết dịch vụ.";
};

const formatAddressLabel = (address: Address) =>
  address.fullAddress ||
  [address.detailAddress, address.ward, address.district, address.province]
    .filter(Boolean)
    .join(", ") ||
  "Địa chỉ đã lưu";

const formatDistance = (distanceMeters: number) => {
  if (distanceMeters < 0) return "Trong khu vực";
  if (distanceMeters < 1000) return `${Math.round(distanceMeters)} m`;
  return `${(distanceMeters / 1000).toFixed(1)} km`;
};

const getProviderAvatar = (provider: NearbyProvider) =>
  provider.user.avatar ||
  `https://ui-avatars.com/api/?name=${encodeURIComponent(provider.user.fullName || "Handigo")}&background=E2DFFF&color=0F006D`;

export default function CustomerServiceDetailPage() {
  const { serviceId } = useParams();
  const navigate = useNavigate();
  const {
    addressId,
    preferredProviderId,
    selectService,
    setAddressId,
    setPreferredProviderId,
  } = useBookingStore();
  const [service, setService] = useState<Service | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [options, setOptions] = useState<ServiceOption[]>([]);
  const [relatedServices, setRelatedServices] = useState<Service[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [nearbyProviders, setNearbyProviders] = useState<NearbyProvider[]>([]);
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(true);
  const [isLoadingProviders, setIsLoadingProviders] = useState(false);
  const [error, setError] = useState("");
  const [addressSelectionError, setAddressSelectionError] = useState("");
  const [providerListError, setProviderListError] = useState("");

  useEffect(() => {
    const loadDetail = async () => {
      if (!serviceId) return;
      setIsLoading(true);
      setError("");
      try {
        const [serviceData, categoryData, optionData] = await Promise.all([
          customerServiceApi.serviceById(serviceId),
          customerServiceApi.categories(),
          customerServiceApi.options(serviceId),
        ]);
        setService(serviceData);
        setCategories(categoryData);
        setOptions(optionData);

        const categoryId = getCategoryId(serviceData);
        if (categoryId) {
          const related = await customerServiceApi.services({
            categoryId,
            limit: 4,
          });
          setRelatedServices(
            related.items.filter((item) => item._id !== serviceData._id).slice(0, 3),
          );
        }
      } catch (loadError) {
        setError(getErrorMessage(loadError));
      } finally {
        setIsLoading(false);
      }
    };

    void loadDetail();
  }, [serviceId]);

  useEffect(() => {
    let isMounted = true;

    const loadAddresses = async () => {
      setIsLoadingAddresses(true);
      setAddressSelectionError("");
      try {
        const data = await bookingApi.getAddresses();
        if (!isMounted) return;

        setAddresses(data);
        if (!addressId && data.length > 0) {
          const defaultAddress = data.find((item) => item.isDefault) || data[0];
          setAddressId(defaultAddress._id);
        }
      } catch {
        if (isMounted) {
          setAddressSelectionError("Không tải được danh sách địa chỉ đã lưu.");
        }
      } finally {
        if (isMounted) setIsLoadingAddresses(false);
      }
    };

    void loadAddresses();

    return () => {
      isMounted = false;
    };
  }, [addressId, setAddressId]);

  useEffect(() => {
    let isMounted = true;

    const loadNearbyProviders = async () => {
      if (!service?._id || !addressId) {
        setNearbyProviders([]);
        return;
      }

      setIsLoadingProviders(true);
      setProviderListError("");
      try {
        const data = await customerServiceApi.nearbyProviders(service._id, addressId);
        if (isMounted) setNearbyProviders(data);
      } catch {
        if (isMounted) {
          setNearbyProviders([]);
          setProviderListError("Không tải được chuyên gia phù hợp với địa chỉ này.");
        }
      } finally {
        if (isMounted) setIsLoadingProviders(false);
      }
    };

    void loadNearbyProviders();

    return () => {
      isMounted = false;
    };
  }, [addressId, service?._id]);

  useEffect(() => {
    if (!preferredProviderId) return;
    if (nearbyProviders.some((provider) => provider.id === preferredProviderId)) return;
    setPreferredProviderId(undefined);
  }, [nearbyProviders, preferredProviderId, setPreferredProviderId]);

  const selectedOptions = options.filter((option) =>
    selectedOptionIds.includes(option._id),
  );

  const basePrice = service ? getServicePrice(service, options) : 0;
  const selectedOptionTotal = selectedOptions.reduce(
    (total, option) => total + getOptionPrice(option),
    0,
  );

  const estimatePrice = useMemo(() => {
    if (!service) return 0;
    if (service.serviceType === "fixed_price") {
      return (service.fixedPrice || 0) + selectedOptionTotal;
    }
    return selectedOptions.length > 0 ? selectedOptionTotal : basePrice;
  }, [basePrice, selectedOptionTotal, selectedOptions.length, service]);

  const handleToggleOption = (optionId: string) => {
    setSelectedOptionIds((current) =>
      current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : [...current, optionId],
    );
  };

  const handleAddressChange = (value: string) => {
    setAddressSelectionError("");
    setAddressId(value);
    setPreferredProviderId(undefined);
  };

  const handleBookNow = () => {
    if (!service) return;
    if (!addressId) {
      setAddressSelectionError("Vui lòng chọn địa chỉ thực hiện trước khi đặt lịch.");
      return;
    }

    selectService(getCategoryId(service), service._id, selectedOptionIds);
    navigate("/customer/bookings/new/location");
  };

  if (isLoading) {
    return (
      <CustomerServiceLayout>
        <div className="rounded-xl bg-white p-8 text-center text-on-surface-variant">
          Đang tải chi tiết dịch vụ...
        </div>
      </CustomerServiceLayout>
    );
  }

  if (error || !service) {
    return (
      <CustomerServiceLayout>
        <div className="rounded-xl border border-error/20 bg-error/10 p-8 text-center text-error">
          {error || "Không tìm thấy dịch vụ."}
        </div>
      </CustomerServiceLayout>
    );
  }

  const categoryName = getCategoryName(service, categories);

  return (
    <CustomerServiceLayout>
      <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-on-surface-variant">
        <Link to="/customer" className="hover:text-primary">
          Trang chủ
        </Link>
        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        <Link to="/customer/services" className="hover:text-primary">
          Dịch vụ
        </Link>
        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        <span className="font-semibold text-on-surface">{service.name}</span>
      </nav>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="space-y-8 lg:col-span-8">
          <section className="overflow-hidden rounded-xl bg-white p-5 shadow-sm">
            <div className="mb-5 grid h-[360px] grid-cols-4 grid-rows-2 gap-3">
              <div className="col-span-4 row-span-2 overflow-hidden rounded-lg md:col-span-3">
                <ReliableImage
                  src={getServiceImage(service)}
                  alt={service.name}
                  className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                />
              </div>
              {[1, 2].map((item) => (
                <div
                  key={item}
                  className="hidden overflow-hidden rounded-lg bg-surface-container md:block"
                >
                  <ReliableImage
                    src={getServiceImage(service, item)}
                    alt={`${service.name} ${item}`}
                    className="h-full w-full object-cover"
                  />
                </div>
              ))}
            </div>

            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <p className="text-sm font-bold uppercase text-primary">
                  {categoryName}
                </p>
                <h1 className="mt-2 text-3xl font-bold text-on-background">
                  {service.name}
                </h1>
                <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-on-surface-variant">
                  <span className="flex items-center gap-1">
                    <span
                      className="material-symbols-outlined text-star-gold"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      star
                    </span>
                    <b className="text-on-surface">4.8</b>
                    (128 đánh giá)
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-primary">
                      verified_user
                    </span>
                    300+ đơn hàng thành công
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="grid h-11 w-11 place-items-center rounded-full border border-outline-variant hover:bg-surface-container-low">
                  <span className="material-symbols-outlined">share</span>
                </button>
                <button className="grid h-11 w-11 place-items-center rounded-full border border-outline-variant hover:bg-surface-container-low">
                  <span className="material-symbols-outlined">favorite</span>
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-xl bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-2xl font-bold">Mô tả dịch vụ</h2>
            <p className="leading-7 text-on-surface-variant">
              {service.description ||
                "Dịch vụ được thiết kế để xử lý nhanh nhu cầu tại nhà, minh bạch về phạm vi công việc và kết nối với provider phù hợp trên Handigo."}
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-bold">Gói dịch vụ</h2>
            {options.length === 0 ? (
              <div className="rounded-xl border border-dashed border-outline-variant bg-white p-6 text-on-surface-variant">
                Dịch vụ này chưa có tùy chọn bổ sung.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {options.map((option) => {
                  const checked = selectedOptionIds.includes(option._id);
                  return (
                    <button
                      key={option._id}
                      type="button"
                      onClick={() => handleToggleOption(option._id)}
                      className={`rounded-xl border-2 bg-white p-5 text-left transition ${
                        checked
                          ? "border-primary bg-surface-container-low shadow-sm"
                          : "border-outline-variant hover:border-primary/50"
                      }`}
                    >
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <h3 className="font-bold text-primary">{option.name}</h3>
                        <span className="font-bold text-on-surface">
                          {getOptionPrice(option) > 0
                            ? money.format(getOptionPrice(option))
                            : "Báo giá"}
                        </span>
                      </div>
                      <p className="text-sm text-on-surface-variant">
                        {option.description || "Tùy chọn bổ sung cho dịch vụ này."}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-xl bg-white p-5 shadow-sm">
            <h2 className="mb-5 text-2xl font-bold">Danh mục công việc</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
              {checklist.map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <div className="grid h-8 w-8 place-items-center rounded-full bg-primary-container/10 text-primary">
                    <span className="material-symbols-outlined text-[20px]">
                      check_circle
                    </span>
                  </div>
                  <span className="font-semibold">{item}</span>
                </div>
              ))}
            </div>
          </section>

          {relatedServices.length > 0 && (
            <section>
              <h2 className="mb-4 text-2xl font-bold">Dịch vụ liên quan</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {relatedServices.map((item, index) => (
                  <Link
                    key={item._id}
                    to={`/customer/services/${item._id}`}
                    className="group overflow-hidden rounded-xl border border-outline-variant/30 bg-white transition hover:shadow-md"
                  >
                    <ReliableImage
                      src={getServiceImage(item, index + 1)}
                      alt={item.name}
                      className="h-32 w-full object-cover"
                    />
                    <div className="p-4">
                      <h3 className="font-bold text-on-surface group-hover:text-primary">
                        {item.name}
                      </h3>
                      <p className="mt-1 text-sm font-bold text-primary">
                        {item.serviceType === "fixed_price" && item.fixedPrice
                          ? money.format(item.fixedPrice)
                          : "Xem chi tiết"}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-5 lg:sticky lg:top-28 lg:col-span-4">
          <div className="rounded-xl border border-outline-variant/20 bg-white p-5 shadow-lg">
            <div className="mb-5 flex items-center justify-between">
              <span className="text-on-surface-variant">Giá tạm tính</span>
              <span className="text-2xl font-bold text-primary">
                {estimatePrice > 0 ? money.format(estimatePrice) : "Báo giá"}
              </span>
            </div>

            <div className="mb-5 space-y-3">
              <div className="rounded-lg bg-surface-container-low p-3">
                <p className="text-xs font-bold uppercase text-on-surface-variant">
                  Loại giá
                </p>
                <p className="mt-1 font-semibold">
                  {service.serviceType === "fixed_price"
                    ? "Giá cố định"
                    : "Báo giá sau khảo sát"}
                </p>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-success-green/10 p-3">
                <span className="material-symbols-outlined text-success-green">
                  verified_user
                </span>
                <span className="text-sm font-bold">Provider đã được xác minh</span>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-primary-container/5 p-3">
                <span className="material-symbols-outlined text-primary">
                  security
                </span>
                <span className="text-sm">Thanh toán an toàn</span>
              </div>
            </div>

            <div className="mb-5">
              <label
                htmlFor="service-detail-address"
                className="mb-2 block text-xs font-bold uppercase text-on-surface-variant"
              >
                Địa chỉ thực hiện
              </label>
              <div className="relative">
                <select
                  id="service-detail-address"
                  value={addressId || ""}
                  disabled={isLoadingAddresses}
                  onChange={(event) => handleAddressChange(event.target.value)}
                  className="w-full appearance-none rounded-lg border border-outline-variant bg-surface-container-low px-3 py-3 pr-10 text-sm font-semibold text-on-surface outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="" disabled>
                    {isLoadingAddresses ? "Đang tải địa chỉ..." : "Chọn địa chỉ"}
                  </option>
                  {addresses.map((address) => (
                    <option key={address._id} value={address._id}>
                      {address.isDefault ? "Mặc định - " : ""}
                      {formatAddressLabel(address)}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant">
                  expand_more
                </span>
              </div>
              {addressSelectionError && (
                <p className="mt-2 rounded-lg bg-error/10 px-3 py-2 text-xs font-semibold text-error">
                  {addressSelectionError}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={handleBookNow}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 text-lg font-bold text-on-primary shadow-md transition hover:opacity-90 active:scale-95"
            >
              Đặt lịch ngay
              <span className="material-symbols-outlined">arrow_forward</span>
            </button>
          </div>

          <div className="rounded-xl border border-outline-variant/20 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Các chuyên gia phụ trách
              </h3>
              {nearbyProviders.length > 0 && (
                <span className="rounded-full bg-primary-container/10 px-2 py-1 text-xs font-bold text-primary">
                  {nearbyProviders.length} phù hợp
                </span>
              )}
            </div>

            {isLoadingProviders ? (
              <div className="flex items-center gap-2 rounded-lg bg-surface-container-low p-3 text-sm font-semibold text-on-surface-variant">
                <span className="material-symbols-outlined animate-spin text-primary">
                  progress_activity
                </span>
                Đang tìm chuyên gia gần bạn...
              </div>
            ) : providerListError ? (
              <p className="rounded-lg bg-error/10 px-3 py-2 text-sm font-semibold text-error">
                {providerListError}
              </p>
            ) : nearbyProviders.length === 0 ? (
              <p className="rounded-lg border border-dashed border-outline-variant bg-surface-container-low px-3 py-3 text-sm text-on-surface-variant">
                Chưa có chuyên gia phù hợp với địa chỉ đã chọn. Bạn vẫn có thể đặt lịch để hệ thống tiếp tục điều phối.
              </p>
            ) : (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setPreferredProviderId(undefined)}
                  className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition ${
                    !preferredProviderId
                      ? "border-primary bg-primary-container/10"
                      : "border-outline-variant/40 bg-surface-container-lowest hover:border-primary/50"
                  }`}
                >
                  <span
                    className={`material-symbols-outlined ${
                      !preferredProviderId ? "text-primary" : "text-on-surface-variant"
                    }`}
                  >
                    auto_awesome
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold text-on-surface">Handigo tự chọn chuyên gia</span>
                    <span className="block text-xs text-on-surface-variant">
                      Hệ thống sẽ điều phối người phù hợp nhất khi bạn đặt lịch.
                    </span>
                  </span>
                  {!preferredProviderId && (
                    <span className="material-symbols-outlined text-primary">check_circle</span>
                  )}
                </button>
                {nearbyProviders.map((provider) => (
                  <div
                    key={provider.id}
                    className={`rounded-lg border p-3 ${
                      preferredProviderId === provider.id
                        ? "border-primary bg-primary-container/10"
                        : "border-outline-variant/40 bg-surface-container-lowest"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative shrink-0">
                        <img
                          src={getProviderAvatar(provider)}
                          alt={provider.user.fullName}
                          className="h-14 w-14 rounded-full object-cover"
                        />
                        <span className="absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-white bg-success-green" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold text-on-surface">
                          {provider.user.fullName}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
                          <span className="inline-flex items-center gap-1">
                            <span
                              className="material-symbols-outlined text-[16px] text-star-gold"
                              style={{ fontVariationSettings: "'FILL' 1" }}
                            >
                              star
                            </span>
                            <b className="text-on-surface">
                              {provider.averageRating.toFixed(1)}
                            </b>
                          </span>
                          <span>{provider.totalCompletedOrders}+ đơn</span>
                          <span>{formatDistance(provider.distanceMeters)}</span>
                        </div>
                      </div>
                      <Link
                        to={`/customer/providers/${provider.id}`}
                        className="grid h-10 w-10 place-items-center rounded-full bg-primary-container/10 text-primary hover:bg-primary-container/20"
                        aria-label={`Xem chuyên gia ${provider.user.fullName}`}
                      >
                        <span className="material-symbols-outlined">person_search</span>
                      </Link>
                    </div>
                    <p className="mt-3 line-clamp-1 text-xs text-on-surface-variant">
                      {[provider.serviceArea?.ward, provider.serviceArea?.province]
                        .filter(Boolean)
                        .join(", ") ||
                        provider.workingAreas.slice(0, 2).join(", ") ||
                        "Khu vực hoạt động chưa cập nhật"}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        setPreferredProviderId(
                          preferredProviderId === provider.id ? undefined : provider.id,
                        )
                      }
                      className={`mt-3 flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold transition ${
                        preferredProviderId === provider.id
                          ? "border-primary bg-primary text-on-primary"
                          : "border-primary text-primary hover:bg-primary/5"
                      }`}
                    >
                      {preferredProviderId === provider.id ? "Đã chọn chuyên gia" : "Chọn chuyên gia này"}
                      <span className="material-symbols-outlined text-[18px]">
                        {preferredProviderId === provider.id ? "check_circle" : "add_circle"}
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </CustomerServiceLayout>
  );
}
