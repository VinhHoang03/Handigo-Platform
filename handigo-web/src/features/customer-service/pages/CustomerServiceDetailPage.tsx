import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useBookingStore } from "@/features/booking/hooks/useBookingStore";
import type { Category, Service, ServiceOption } from "@/types/booking";
import { CustomerServiceLayout } from "../components/CustomerServiceLayout";
import { customerServiceApi } from "../api/customerService.api";
import {
  getCategoryId,
  getCategoryName,
  getOptionPrice,
  getServiceImage,
  getServicePrice,
  money,
} from "../utils/serviceDisplay";

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

export default function CustomerServiceDetailPage() {
  const { serviceId } = useParams();
  const navigate = useNavigate();
  const selectService = useBookingStore((state) => state.selectService);
  const [service, setService] = useState<Service | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [options, setOptions] = useState<ServiceOption[]>([]);
  const [relatedServices, setRelatedServices] = useState<Service[]>([]);
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

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

  const handleBookNow = () => {
    if (!service) return;
    selectService(getCategoryId(service), service._id);
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
                <img
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
                  <img
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
                    <img
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

            <button
              type="button"
              onClick={handleBookNow}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 text-lg font-bold text-on-primary shadow-md transition hover:opacity-90 active:scale-95"
            >
              Đặt lịch ngay
              <span className="material-symbols-outlined">arrow_forward</span>
            </button>
          </div>
        </aside>
      </div>
    </CustomerServiceLayout>
  );
}
