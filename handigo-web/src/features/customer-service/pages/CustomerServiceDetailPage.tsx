import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { bookingApi } from "@/features/booking/api/booking.api";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { useBookingStore } from "@/features/booking/hooks/useBookingStore";
import type { Address, Category, Service, ServiceOption } from "@/types/booking";
import { CustomerServiceLayout } from "../components/CustomerServiceLayout";
import { NearbyProviderSelector } from "../components/NearbyProviderSelector";
import type { ProviderAvailabilityStatus } from "../components/NearbyProviderSelector";
import { customerServiceApi } from "../api/customerService.api";
import {
  getCategoryId,
  getCategoryName,
  getOptionPrice,
  getServiceImage,
  getServicePrice,
  money,
} from "../utils/serviceDisplay";
import { ReliableImage } from "@/components/common/ReliableImage";
import { Modal } from "@/components/common/Modal";
import { LocationPickerMap } from "@/components/common/LocationPickerMap";
import {
  groupServiceOptions,
  isRequiredOptionSelectionMissing,
  toggleServiceOption,
} from "@/features/booking/utils/serviceOptionSelection";
import {
  isValidVietnamesePhone,
  normalizeVietnamesePhone,
} from "@/utils/phoneValidation";

const checklist = [
  "Tư vấn phạm vi công việc",
  "Provider đã được xác minh",
  "Có thể theo dõi trạng thái đơn",
  "Thanh toán an toàn",
  "Hỗ trợ sau dịch vụ",
  "Minh bạch chi phí",
];

const getErrorMessage = (
  error: unknown,
  fallback = "Không thể tải chi tiết dịch vụ.",
) => {
  const err = error as {
    response?: {
      data?: {
        message?: string;
        errors?: Array<{ message?: string }>;
      };
    };
  };
  const validationMessage = err.response?.data?.errors?.find(
    (issue) => issue.message?.trim(),
  )?.message;
  return validationMessage || err.response?.data?.message || fallback;
};

const CURRENT_LOCATION_VALUE = "__current_location__";
const CURRENT_LOCATION_DUPLICATE_RADIUS_METERS = 50;

interface CurrentLocationDraft {
  recipientName: string;
  recipientPhone: string;
  fullAddress: string;
  province: string;
  ward: string;
  latitude: number;
  longitude: number;
  placeId?: string;
}

const getDistanceMeters = (
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
) => {
  const earthRadiusMeters = 6_371_000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const latitudeDelta = toRadians(latitudeB - latitudeA);
  const longitudeDelta = toRadians(longitudeB - longitudeA);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(latitudeA)) *
      Math.cos(toRadians(latitudeB)) *
      Math.sin(longitudeDelta / 2) ** 2;

  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const findExistingCurrentLocation = (
  addresses: Address[],
  currentAddress: {
    latitude: number;
    longitude: number;
    placeId?: string;
  },
) =>
  addresses.find((address) => {
    if (currentAddress.placeId && address.placeId === currentAddress.placeId) {
      return true;
    }

    if (
      typeof address.latitude !== "number" ||
      typeof address.longitude !== "number" ||
      !Number.isFinite(address.latitude) ||
      !Number.isFinite(address.longitude)
    ) {
      return false;
    }

    return (
      getDistanceMeters(
        address.latitude,
        address.longitude,
        currentAddress.latitude,
        currentAddress.longitude,
      ) <= CURRENT_LOCATION_DUPLICATE_RADIUS_METERS
    );
  });

const formatAddressLabel = (address: Address) =>
  address.fullAddress ||
  [address.detailAddress, address.ward, address.district, address.province]
    .filter(Boolean)
    .join(", ") ||
  "Địa chỉ đã lưu";

export default function CustomerServiceDetailPage() {
  const { serviceId } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user); 
  const {
    addressId,
    selectService,
    setAddressId,
  } = useBookingStore();
  const [service, setService] = useState<Service | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [options, setOptions] = useState<ServiceOption[]>([]);
  const [relatedServices, setRelatedServices] = useState<Service[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
  const [selectedOptionQuantities, setSelectedOptionQuantities] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(true);
  const [error, setError] = useState("");
  const [addressSelectionError, setAddressSelectionError] = useState("");
  const [optionSelectionError, setOptionSelectionError] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [requiresPhoneUpdate, setRequiresPhoneUpdate] = useState(false);
  const [providerAvailability, setProviderAvailability] = useState<ProviderAvailabilityStatus>("idle");
  const [currentLocationDraft, setCurrentLocationDraft] =
    useState<CurrentLocationDraft | null>(null);
  const [currentLocationError, setCurrentLocationError] = useState("");
  const [isResolvingCurrentAddress, setIsResolvingCurrentAddress] =
    useState(false);
  const [isSavingCurrentLocation, setIsSavingCurrentLocation] = useState(false);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isAuthInitializing = useAuthStore((state) => state.isInitializing);

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
      if (isAuthInitializing) return;

      if (!isAuthenticated) {
        setAddresses([]);
        setAddressSelectionError("");
        setIsLoadingAddresses(false);
        return;
      }

      setIsLoadingAddresses(true);
      setAddressSelectionError("");
      try {
        const data = await bookingApi.getAddresses();
        if (!isMounted) return;

        setAddresses(data);
      } catch {
        if (isMounted) {
          setAddresses([]);
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
  }, [isAuthenticated, isAuthInitializing]);

  useEffect(() => {
    if (isAuthInitializing || isLoadingAddresses) return;
    if (addresses.some((address) => address._id === addressId)) return;

    const nextAddress = addresses.find((address) => address.isDefault) || addresses[0];
    setAddressId(nextAddress?._id || "");
  }, [addressId, addresses, isAuthInitializing, isLoadingAddresses, setAddressId]);

  const selectedOptions = options.filter((option) =>
    selectedOptionIds.includes(option._id),
  );

  const basePrice = service ? getServicePrice(service) : 0;
  const optionGroups = groupServiceOptions(options);
  const selectedOptionTotal = selectedOptions.reduce(
    (total, option) => total + getOptionPrice(option) * (selectedOptionQuantities[option._id] ?? 1),
    0,
  );

  const estimatePrice = useMemo(() => {
    if (!service) return 0;
    if (service.serviceType === "fixed_price") {
      return selectedOptionTotal;
    }
    return basePrice;
  }, [basePrice, selectedOptionTotal, service]);

  const handleToggleOption = (option: ServiceOption) => {
    setOptionSelectionError("");
    setSelectedOptionIds((current) => toggleServiceOption(current, option, options));
    setSelectedOptionQuantities((current) => ({ ...current, [option._id]: current[option._id] ?? 1 }));
  };

  const handleUseCurrentLocation = () => {
    setAddressSelectionError("");
    setRequiresPhoneUpdate(false);

    if (!service) return;

    if (!navigator.geolocation) {
      setAddressSelectionError("Trình duyệt không hỗ trợ định vị hiện tại.");
      return;
    }

     if (!isAuthenticated) {
      navigate("/login", {
        state: {
          from: service ? `/customer/services/${service._id}` : "/customer/services",
        },
      });
      return;
    }

    const addressWithValidPhone = addresses.find((address) =>
      isValidVietnamesePhone(address.recipientPhone || ""),
    );
    const phoneCandidates = [user?.phone, addressWithValidPhone?.recipientPhone];
    const recipientPhone = normalizeVietnamesePhone(
      phoneCandidates.find((phone) => isValidVietnamesePhone(phone || "")) || "",
    );

    if (!recipientPhone) {
      setRequiresPhoneUpdate(true);
      setAddressSelectionError(
        "Vui lòng cập nhật số điện thoại Việt Nam hợp lệ trước khi dùng vị trí hiện tại.",
      );
      return;
    }

    const recipientName =
      user?.fullName || addressWithValidPhone?.recipientName || "Khách hàng";

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const currentAddress = await bookingApi.reverseGeocode(
            coords.latitude,
            coords.longitude,
          );

          setCurrentLocationDraft({
            recipientName,
            recipientPhone,
            fullAddress: currentAddress.fullAddress,
            ward: currentAddress.ward,
            province: currentAddress.province,
            latitude: currentAddress.latitude,
            longitude: currentAddress.longitude,
            placeId: currentAddress.placeId,
          });
          setCurrentLocationError("");
        } catch (createError) {
          setAddressSelectionError(
            getErrorMessage(
              createError,
              "Không thể lưu vị trí hiện tại. Vui lòng thử lại.",
            ),
          );
        } finally {
          setIsLocating(false);
        }
      },
      () => {
        setAddressSelectionError("Không thể lấy vị trí hiện tại. Vui lòng kiểm tra quyền định vị.");
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 },
    );
  };

  const handleCurrentLocationPositionChange = async (
    latitude: number,
    longitude: number,
  ) => {
    if (!currentLocationDraft) return;

    setCurrentLocationError("");
    setIsResolvingCurrentAddress(true);
    try {
      const currentAddress = await bookingApi.reverseGeocode(
        latitude,
        longitude,
      );
      setCurrentLocationDraft((current) =>
        current
          ? {
              ...current,
              fullAddress: currentAddress.fullAddress,
              province: currentAddress.province,
              ward: currentAddress.ward,
              latitude: currentAddress.latitude,
              longitude: currentAddress.longitude,
              placeId: currentAddress.placeId,
            }
          : null,
      );
    } catch (resolveError) {
      setCurrentLocationDraft((current) =>
        current
          ? { ...current, latitude, longitude, placeId: undefined }
          : null,
      );
      setCurrentLocationError(
        getErrorMessage(
          resolveError,
          "Đã ghim tọa độ nhưng không thể xác định địa chỉ tại vị trí này. Vui lòng thử vị trí khác.",
        ),
      );
    } finally {
      setIsResolvingCurrentAddress(false);
    }
  };

  const handleConfirmCurrentLocation = async () => {
    if (!currentLocationDraft) return;

    setCurrentLocationError("");
    setIsSavingCurrentLocation(true);
    try {
      const existingAddress = findExistingCurrentLocation(
        addresses,
        currentLocationDraft,
      );

      if (existingAddress) {
        setAddressId(existingAddress._id);
        setCurrentLocationDraft(null);
        return;
      }

      const createdAddress = await bookingApi.createAddress({
        ...currentLocationDraft,
        isDefault: false,
      });

      setAddresses((current) => [
        createdAddress,
        ...current.filter((address) => address._id !== createdAddress._id),
      ]);
      setAddressId(createdAddress._id);
      setCurrentLocationDraft(null);
    } catch (createError) {
      setCurrentLocationError(
        getErrorMessage(
          createError,
          "Không thể lưu vị trí đã chọn. Vui lòng thử lại.",
        ),
      );
    } finally {
      setIsSavingCurrentLocation(false);
    }
  };

  const handleAddressChange = (value: string) => {
    if (value === CURRENT_LOCATION_VALUE) {
      handleUseCurrentLocation();
      return;
    }
    setAddressSelectionError("");
    setProviderAvailability("idle");
    setAddressId(value);
  };

  const handleBookNow = () => {
    if (!service) return;
    if (!isAuthenticated) {
      navigate("/login", { state: { from: `/customer/services/${service._id}` } });
      return;
    }
    if (!addressId || !addresses.some((address) => address._id === addressId)) {
      setAddressSelectionError("Vui lòng chọn địa chỉ thực hiện trước khi đặt lịch.");
      return;
    }
    if (providerAvailability !== "available") {
      setAddressSelectionError(
        providerAvailability === "loading" || providerAvailability === "idle"
          ? "Vui lòng chờ hệ thống kiểm tra chuyên gia phù hợp."
          : "Chưa có chuyên gia phù hợp với dịch vụ và địa chỉ đã chọn.",
      );
      return;
    }
    if (isRequiredOptionSelectionMissing(service, selectedOptionIds)) {
      setOptionSelectionError("Vui lòng chọn ít nhất một tùy chọn dịch vụ.");
      return;
    }

    selectService(
      getCategoryId(service),
      service._id,
      selectedOptionIds,
      selectedOptionQuantities,
    );
    navigate("/customer/bookings/new/location", {
      state: { fromServiceDetail: true },
    });
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
            <h2 className="mb-3 text-2xl font-bold">
              Gói dịch vụ
              {service.requiresOptionSelection ? (
                <span className="text-error"> *</span>
              ) : null}
            </h2>
            {options.length === 0 ? (
              <div className="rounded-xl border border-dashed border-outline-variant bg-white p-6 text-on-surface-variant">
                Dịch vụ này chưa có tùy chọn bổ sung.
              </div>
            ) : (
              <div className="space-y-6">
                {optionGroups.map((group) => (
                  <fieldset key={group.key}>
                    <legend className="mb-3 font-bold text-on-surface">
                      {group.label}
                    </legend>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {group.options.map((option) => {
                        const checked = selectedOptionIds.includes(option._id);
                        return (
                          <div key={option._id} className="space-y-2">
                            <button
                              type="button"
                              role={group.selectionMode === "single" ? "radio" : "checkbox"}
                              aria-checked={checked}
                              onClick={() => handleToggleOption(option)}
                              className={`w-full rounded-xl border-2 bg-white p-5 text-left transition ${checked ? "border-primary bg-surface-container-low shadow-sm" : "border-outline-variant hover:border-primary/50"}`}
                            >
                            <div className="flex gap-4">
                              <ReliableImage
                                src={option.image}
                                alt={`Ảnh tùy chọn ${option.name}`}
                                className="h-24 w-24 shrink-0 rounded-lg object-cover"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="mb-2 flex items-start justify-between gap-3">
                                  <h3 className="font-bold text-primary">{option.name}</h3>
                                  {service.serviceType === "fixed_price" ? (
                                    <span className="font-bold text-on-surface">
                                      {getOptionPrice(option) > 0
                                        ? `+${money.format(getOptionPrice(option))}`
                                        : "Miễn phí"}
                                    </span>
                                  ) : null}
                                </div>
                                <p className="text-sm text-on-surface-variant">
                                  {option.description || "Tùy chọn bổ sung cho dịch vụ này."}
                                </p>
                              </div>
                            </div>
                            </button>
                            {checked && option.allowsQuantity && (
                              <label className="flex items-center justify-end gap-2 text-sm font-semibold">
                                Số lượng
                                <input
                                  type="number"
                                  min={1}
                                  max={99}
                                  value={selectedOptionQuantities[option._id] ?? 1}
                                  onChange={(event) => setSelectedOptionQuantities((current) => ({
                                    ...current,
                                    [option._id]: Math.min(Math.max(Math.trunc(Number(event.target.value)) || 1, 1), 99),
                                  }))}
                                  className="w-20 rounded-lg border border-outline-variant px-3 py-2 text-center"
                                />
                              </label>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </fieldset>
                ))}
              </div>
            )}
            {optionSelectionError && (
              <p className="mt-3 rounded-lg bg-error/10 px-3 py-2 text-sm font-semibold text-error">
                {optionSelectionError}
              </p>
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
                {estimatePrice > 0
                  ? money.format(estimatePrice)
                  : service.serviceType === "fixed_price"
                    ? "Chọn tùy chọn"
                    : "Báo giá"}
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
              <p className="mb-2 text-xs font-bold uppercase text-on-surface-variant">
                Địa chỉ thực hiện
              </p>
              <div
                className="grid max-h-72 gap-2 overflow-y-auto pr-1"
                role="radiogroup"
                aria-label="Chọn địa chỉ thực hiện"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={false}
                  disabled={isLoadingAddresses || isLocating}
                  onClick={() => handleAddressChange(CURRENT_LOCATION_VALUE)}
                  className="relative flex min-h-20 w-full items-start gap-3 rounded-xl border border-outline-variant/50 bg-surface-container-low p-3 text-left transition hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="material-symbols-outlined mt-0.5 shrink-0 text-xl leading-none text-primary">
                    my_location
                  </span>
                  <span className="min-w-0 text-sm font-semibold leading-5 text-on-surface">
                    {isLocating ? "Đang lấy vị trí hiện tại..." : "Vị trí hiện tại"}
                  </span>
                </button>

                {addresses.map((address) => {
                  const isSelected = address._id === addressId;

                  return (
                    <button
                      key={address._id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      disabled={isLoadingAddresses || isLocating}
                      onClick={() => handleAddressChange(address._id)}
                      className={`relative flex min-h-20 w-full items-start gap-3 rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-60 ${
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-outline-variant/50 bg-surface-container-low hover:border-primary/50 hover:bg-primary/5"
                      } ${address.isDefault ? "pb-8" : ""}`}
                    >
                      <span className="material-symbols-outlined mt-0.5 shrink-0 text-xl leading-none text-primary">
                        location_on
                      </span>
                      <span className="min-w-0 flex-1 text-sm font-semibold leading-5 text-on-surface">
                        {formatAddressLabel(address)}
                      </span>
                      {isSelected && (
                        <span className="material-symbols-outlined shrink-0 text-xl leading-none text-primary">
                          check_circle
                        </span>
                      )}
                      {address.isDefault && (
                        <span className="absolute bottom-2 right-3 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                          Mặc định
                        </span>
                      )}
                    </button>
                  );
                })}

                {isLoadingAddresses && (
                  <p className="rounded-xl bg-surface-container-low px-3 py-4 text-center text-sm text-on-surface-variant">
                    Đang tải địa chỉ...
                  </p>
                )}
              </div>
              {addressSelectionError && (
                <div className="mt-2 rounded-lg bg-error/10 px-3 py-2 text-xs font-semibold text-error">
                  <p>{addressSelectionError}</p>
                  {requiresPhoneUpdate && (
                    <Link
                      to="/customer/profile"
                      className="mt-2 inline-flex items-center gap-1 underline underline-offset-2"
                    >
                      Cập nhật số điện thoại
                      <span className="material-symbols-outlined text-sm">
                        arrow_forward
                      </span>
                    </Link>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleBookNow}
              disabled={
                isAuthenticated &&
                addresses.some((address) => address._id === addressId) &&
                providerAvailability !== "available"
              }
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 text-lg font-bold text-on-primary shadow-md transition hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100"
            >
              Đặt lịch ngay
              <span className="material-symbols-outlined">arrow_forward</span>
            </button>
          </div>

          <NearbyProviderSelector
            serviceId={service._id}
            addressId={addressId}
            enabled={
              !isLoadingAddresses &&
              addresses.some((address) => address._id === addressId)
            }
            allowSelection={false}
            onAvailabilityChange={setProviderAvailability}
          />
        </aside>
      </div>

      <Modal
        open={Boolean(currentLocationDraft)}
        title="Chọn vị trí thực hiện"
        size="lg"
        closeOnOverlayClick={!isSavingCurrentLocation}
        closeOnEsc={!isSavingCurrentLocation}
        onClose={() => {
          if (!isSavingCurrentLocation) setCurrentLocationDraft(null);
        }}
      >
        {currentLocationDraft && (
          <div className="space-y-4">
            <LocationPickerMap
              latitude={currentLocationDraft.latitude}
              longitude={currentLocationDraft.longitude}
              disabled={isSavingCurrentLocation || isResolvingCurrentAddress}
              isResolvingAddress={isResolvingCurrentAddress}
              onPositionChange={(latitude, longitude) =>
                void handleCurrentLocationPositionChange(latitude, longitude)
              }
            />

            <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-low p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                Địa chỉ theo vị trí ghim
              </p>
              <p className="mt-1.5 text-sm font-semibold leading-6 text-on-surface">
                {currentLocationDraft.fullAddress}
              </p>
            </div>

            {currentLocationError && (
              <div className="rounded-2xl bg-error/10 px-4 py-3 text-sm font-medium text-error">
                {currentLocationError}
              </div>
            )}

            <div className="flex flex-col justify-end gap-3 pt-1 sm:flex-row">
              <button
                type="button"
                className="btn-secondary"
                disabled={isSavingCurrentLocation}
                onClick={() => setCurrentLocationDraft(null)}
              >
                Hủy
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={
                  isSavingCurrentLocation ||
                  isResolvingCurrentAddress ||
                  Boolean(currentLocationError)
                }
                onClick={() => void handleConfirmCurrentLocation()}
              >
                {isSavingCurrentLocation
                  ? "Đang lưu vị trí..."
                  : "Xác nhận vị trí này"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </CustomerServiceLayout>
  );
}
