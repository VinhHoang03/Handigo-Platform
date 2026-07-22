import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookingStepper,
  OrderCreationShell,
  OrderSummaryCard,
} from "../components/BookingComponents";
import { useBookingStore } from "../hooks/useBookingStore";
import {
  bookingApi,
  type CreateOrderPayload,
} from "@/features/booking/api/booking.api";
import { bookingVoucherApi } from "@/features/booking/api/voucher.api";
import { serviceCatalogApi } from "@/features/customer-service/api/serviceCatalog.api";
import type { Address, Service, ServiceOption } from "../../../types/booking";
import type { AvailableVoucher } from "../types/voucher.types";
import { isRequiredOptionSelectionMissing } from "../utils/serviceOptionSelection";
import { tokenStorage } from "@/api/tokenStorage";
import { WalletBalanceText } from "@/features/wallet/components/WalletBalanceText";
import { useSystemAlert } from "@/components/common/SystemAlert";

const paymentMethods = [
  [
    "account_balance_wallet",
    "Ví Handigo",
    "Thanh toán ngay từ số dư ví",
    "wallet",
  ],
  [
    "account_balance",
    "Chuyển khoản ngân hàng",
    "Quét mã VietQR hoặc Internet Banking",
    "bank",
  ],
  ["payments", "Tiền mặt", "Thanh toán trực tiếp cho nhân viên", "cash"],
] as const;

const getOptionPrice = (option: ServiceOption) =>
  option.price ?? option.fixedPrice ?? 0;

const PENDING_ORDER_ID_KEY = "pendingBookingOrderId";
const PENDING_ORDER_FINGERPRINT_KEY = "pendingBookingFingerprint";

const formatAddress = (address: Address | null) => {
  if (!address) return "";
  return [
    address.detailAddress,
    address.ward,
    address.district,
    address.province,
  ]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");
};

const ConfirmPaymentPage = () => {
  const { showSystemAlert } = useSystemAlert();
  const {
    categoryId,
    serviceId,
    selectedOptionIds,
    selectedOptionQuantities,
    addressId,
    orderType,
    preferredProviderId,
    preferredProviderName,
    scheduledAt,
    recurrenceUnit,
    recurrenceCount,
    problemDescription,
    customerAttachments,
    paymentMethod,
    setPaymentMethod,
    reset,
  } = useBookingStore();

  const bookingFingerprint = JSON.stringify({
    serviceId,
    selectedOptionIds: [...selectedOptionIds].sort(),
    addressId,
    orderType,
    preferredProviderId,
    scheduledAt,
    recurrenceUnit,
    recurrenceCount,
  });

  const [service, setService] = useState<Service | null>(null);
  const [address, setAddress] = useState<Address | null>(null);
  const [options, setOptions] = useState<ServiceOption[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [availableVouchers, setAvailableVouchers] = useState<
    AvailableVoucher[]
  >([]);
  const [voucherCode, setVoucherCode] = useState("");
  const [appliedVoucher, setAppliedVoucher] = useState<AvailableVoucher | null>(
    null,
  );
  const [voucherError, setVoucherError] = useState("");
  const [pendingOrderId, setPendingOrderId] = useState(() =>
    sessionStorage.getItem(PENDING_ORDER_FINGERPRINT_KEY) === bookingFingerprint
      ? sessionStorage.getItem(PENDING_ORDER_ID_KEY) || ""
      : "",
  );
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;
    if (serviceId) {
      serviceCatalogApi.serviceById(serviceId).then((data) => {
        if (isMounted) setService(data);
      });
      serviceCatalogApi.options(serviceId).then((data) => {
        if (isMounted) setOptions(data);
      });
    }
    if (addressId) {
      bookingApi.getAddresses().then((addresses) => {
        if (!isMounted) return;
        const found = addresses.find((a) => a._id === addressId);
        if (found) setAddress(found);
      });
    }
    return () => {
      isMounted = false;
    };
  }, [serviceId, addressId, categoryId]);

  useEffect(() => {
    let isMounted = true;
    bookingVoucherApi
      .available()
      .then((vouchers) => {
        if (isMounted) setAvailableVouchers(vouchers);
      })
      .catch(() => {
        if (isMounted) setAvailableVouchers([]);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const selectedOptions = options.filter((opt) =>
    selectedOptionIds.includes(opt._id),
  );
  const orderAmount =
    service?.serviceType === "variable_price"
      ? service.depositAmount || 0
      : (service?.fixedPrice || 0) +
        selectedOptions.reduce((sum, option) => sum + getOptionPrice(option), 0);
  const voucherDiscountAmount = appliedVoucher
    ? Math.min(
        appliedVoucher.discountType === "PERCENT"
          ? Math.floor((orderAmount * appliedVoucher.discountValue) / 100)
          : appliedVoucher.discountValue,
        appliedVoucher.maxDiscountAmount ?? Number.POSITIVE_INFINITY,
        orderAmount,
      )
    : 0;
  const effectivePaymentMethod =
    service?.serviceType === "variable_price" && paymentMethod === "cash"
      ? "bank"
      : paymentMethod;
  const isAppointment = orderType === "scheduled" || orderType === "recurring";

  const applyVoucherCode = (code: string) => {
    const normalizedCode = code.trim().toUpperCase();
    if (!normalizedCode) {
      setAppliedVoucher(null);
      setVoucherError("");
      return;
    }

    const voucher = availableVouchers.find(
      (item) => item.code.toUpperCase() === normalizedCode,
    );
    if (!voucher) {
      setAppliedVoucher(null);
      setVoucherError("Voucher không tồn tại hoặc không còn khả dụng.");
      return;
    }
    if (orderAmount < (voucher.minOrderAmount ?? 0)) {
      setAppliedVoucher(null);
      setVoucherError("Giá trị đơn hàng chưa đạt mức tối thiểu để áp dụng voucher.");
      return;
    }

    setVoucherCode(voucher.code);
    setAppliedVoucher(voucher);
    setVoucherError("");
  };

  const handleConfirm = async () => {
    if (!serviceId) {
      showSystemAlert("Vui lòng chọn dịch vụ trước khi thanh toán.", {
        title: "Chưa chọn dịch vụ",
        variant: "error",
      });
      return;
    }
    if (!addressId) {
      showSystemAlert("Vui lòng chọn địa chỉ thực hiện.", {
        title: "Chưa chọn địa chỉ",
        variant: "error",
      });
      return;
    }
    if (
      (orderType === "scheduled" || orderType === "recurring") &&
      (!scheduledAt || new Date(scheduledAt).getTime() <= Date.now())
    ) {
      setPaymentError("Vui lòng chọn thời gian thực hiện trong tương lai.");
      return;
    }
    if (isRequiredOptionSelectionMissing(service, selectedOptionIds)) {
      setPaymentError("Vui lòng chọn ít nhất một tùy chọn dịch vụ.");
      return;
    }
    if (voucherCode.trim() && !appliedVoucher) {
      setVoucherError("Vui lòng áp dụng voucher hợp lệ trước khi thanh toán.");
      return;
    }

    setIsSubmitting(true);
    setPaymentError("");
    setVoucherError("");
    let orderId = pendingOrderId;
    try {
      const payload: CreateOrderPayload = {
        serviceId,
        selectedOptionIds,
        selectedOptions: selectedOptionIds.map((optionId) => ({
          optionId,
          quantity: selectedOptionQuantities?.[optionId] ?? 1,
        })),
        addressId,
        preferredProviderId,
        orderType,
        scheduledAt: scheduledAt
          ? new Date(scheduledAt).toISOString()
          : undefined,
        recurrenceUnit: orderType === "recurring" ? recurrenceUnit : undefined,
        recurrenceCount: orderType === "recurring" ? recurrenceCount : undefined,
        problemDescription,
        customerAttachments,
        paymentMethod: effectivePaymentMethod,
        voucherCode: appliedVoucher?.code,
      };

      if (!orderId) {
        const createdOrder = await bookingApi.createOrder(payload);
        orderId = createdOrder._id;
        setPendingOrderId(orderId);
        sessionStorage.setItem(PENDING_ORDER_ID_KEY, orderId);
        sessionStorage.setItem(
          PENDING_ORDER_FINGERPRINT_KEY,
          bookingFingerprint,
        );
      }

      if (orderType === "scheduled" || orderType === "recurring") {
        sessionStorage.removeItem(PENDING_ORDER_ID_KEY);
        sessionStorage.removeItem(PENDING_ORDER_FINGERPRINT_KEY);
        reset();
        navigate(`/customer/bookings/${orderId}`);
        return;
      }

      if (effectivePaymentMethod === "bank") {
        const payment = await bookingApi.createPayment({
          orderId,
          method: "PAYOS",
          paymentType:
            service?.serviceType === "variable_price"
              ? "INSPECTION_DEPOSIT"
              : "FULL",
          returnUrl: `${window.location.origin}/customer/bookings/success?orderId=${orderId}`,
          cancelUrl: `${window.location.origin}/customer/bookings/new/payment`,
        });

        if (!payment.checkoutUrl) {
          throw new Error("PayOS checkoutUrl is missing");
        }

        sessionStorage.setItem("latestBookingOrderId", orderId);
        tokenStorage.prepareExternalRedirect();
        window.location.href = payment.checkoutUrl;
        return;
      }

      await bookingApi.createPayment(
        effectivePaymentMethod === "wallet"
          ? {
              orderId,
              method: "WALLET",
              paymentType:
                service?.serviceType === "variable_price"
                  ? "INSPECTION_DEPOSIT"
                  : "FULL",
            }
          : {
              orderId,
              method: "CASH",
              paymentType: "FULL",
            },
      );

      const orderDetail = await bookingApi.getOrderById(orderId);

      sessionStorage.removeItem(PENDING_ORDER_ID_KEY);
      sessionStorage.removeItem(PENDING_ORDER_FINGERPRINT_KEY);
      reset();
      navigate("/customer/bookings/success", { state: { order: orderDetail } });
    } catch (error) {
      const requestError = error as {
        response?: {
          data?: {
            message?: string;
            errors?: Array<{ message?: string }>;
          };
        };
      };
      const message =
        requestError.response?.data?.errors?.find((issue) => issue.message)
          ?.message ||
        requestError.response?.data?.message ||
        "Không thể tạo đơn đặt lịch. Vui lòng thử lại hoặc chọn địa chỉ khác.";
      if (orderId && !isAppointment) {
        try {
          await bookingApi.discardUnpaidOrder(orderId);
          setPendingOrderId("");
          sessionStorage.removeItem(PENDING_ORDER_ID_KEY);
          sessionStorage.removeItem(PENDING_ORDER_FINGERPRINT_KEY);
        } catch {
          // Giữ lại mã đơn để lần thử sau tiếp tục trên cùng một đơn hợp lệ.
        }
      }
      console.error("Không thể tạo đơn đặt lịch.", error);
      if (message.toLowerCase().includes("voucher")) {
        setVoucherError(message);
      } else {
        setPaymentError(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const addressText = formatAddress(address);
  const detailItems = [
    ["cleaning_services", "Dịch vụ", service?.name || "…"],
    [
      "calendar_today",
      "Thời gian",
      scheduledAt
        ? new Date(scheduledAt).toLocaleString("vi-VN")
        : "Sớm nhất có thể",
    ],
    ...(addressText ? [["location_on", "Địa chỉ", addressText]] : []),
    [
      "person_search",
      isAppointment ? "Chuyên gia đặt trước" : "Điều phối chuyên gia",
      preferredProviderId
        ? isAppointment
          ? preferredProviderName || "Chuyên gia đã chọn"
          : `Yêu cầu trực tiếp ${preferredProviderName || "provider đã chọn"}`
        : "Handigo tự điều phối",
    ],
  ] as string[][];

  return (
    <OrderCreationShell>
      <BookingStepper currentStep={3} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-start">
        <div className="lg:col-span-8 space-y-gutter">
          {isAppointment && (
            <section className="flex items-start gap-sm rounded-xl border border-primary/20 bg-primary-container/10 p-md">
              <span aria-hidden="true" className="material-symbols-outlined text-primary">event_available</span>
              <div>
                <h2 className="font-bold text-on-surface">Xác nhận yêu cầu lịch hẹn</h2>
                <p className="mt-1 text-sm leading-6 text-on-surface-variant">
                  Handigo chưa thu tiền ở bước này. Chuyên gia sẽ xác nhận lịch trước,
                  sau đó bạn có 15 phút để thanh toán và giữ chỗ.
                </p>
              </div>
            </section>
          )}
          <section className="bg-surface-container-lowest rounded-xl p-md border border-outline-variant/30 shadow-sm">
            <h2 className="font-headline-md text-headline-md mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">
                receipt_long
              </span>
              Chi tiết dịch vụ
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              {detailItems.map(([icon, label, value], index) => (
                <div
                  key={label}
                  className={`flex items-start gap-4 ${index === 2 ? "md:col-span-2" : ""}`}
                >
                  <div className="bg-primary-fixed-dim/30 p-3 rounded-lg text-primary">
                    <span className="material-symbols-outlined">{icon}</span>
                  </div>
                  <div>
                    <p className="font-label-md text-label-md text-on-surface-variant">
                      {label}
                    </p>
                    <p className="font-body-md text-body-md font-semibold">
                      {value}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {selectedOptions.length > 0 && (
              <div className="mt-6 pt-6 border-t border-outline-variant">
                <p className="font-label-md text-on-surface-variant mb-3">
                  Dịch vụ bổ sung:
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedOptions.map((opt) => (
                    <span
                      key={opt._id}
                      className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium"
                    >
                      {opt.name}
                      {(selectedOptionQuantities?.[opt._id] ?? 1) > 1 &&
                        ` × ${selectedOptionQuantities?.[opt._id]}`}
                      {service?.serviceType !== "variable_price" &&
                        ` (${(getOptionPrice(opt) * (selectedOptionQuantities?.[opt._id] ?? 1)).toLocaleString()}đ)`}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="bg-surface-container-lowest rounded-xl p-md border border-outline-variant/30 shadow-sm">
            <h2 className="font-headline-md text-headline-md mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">
                account_balance_wallet
              </span>
              {isAppointment ? "Phương thức sẽ thanh toán" : "Phương thức thanh toán"}
            </h2>
            {isAppointment && (
              <p className="mb-4 text-sm text-on-surface-variant">
                Phương thức này được lưu cho bước thanh toán sau khi chuyên gia nhận lịch.
              </p>
            )}
            <div className="space-y-3">
              {paymentMethods
                .filter(([, , , value]) => {
                  if (service?.serviceType === "variable_price") {
                    // Dịch vụ cần khảo sát cho phép đặt cọc qua PayOS hoặc Ví Handigo.
                    return value !== "cash";
                  }
                  return true;
                })
                .map(([icon, title, subtitle, value]) => (
                  <label
                    key={value}
                    className="group relative flex items-center p-4 rounded-xl border border-outline-variant/50 hover:border-primary cursor-pointer transition-colors bg-surface-container-low/30 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                  >
                    <input
                      checked={effectivePaymentMethod === value}
                      onChange={() => setPaymentMethod(value)}
                      className="peer sr-only"
                      name="payment"
                      type="radio"
                      value={value}
                    />
                    <div className="flex-1 flex items-center gap-4 peer-focus-visible:rounded-lg peer-focus-visible:ring-4 peer-focus-visible:ring-primary/15">
                      <div
                        className={`w-12 h-12 rounded-lg flex items-center justify-center ${effectivePaymentMethod === value ? "bg-primary text-on-primary" : "bg-on-surface/5 text-on-surface"}`}
                      >
                        <span className="material-symbols-outlined">
                          {icon}
                        </span>
                      </div>
                      <div>
                        <p className="font-body-md text-body-md font-semibold">
                          {title}
                        </p>
                        <p className="font-label-sm text-label-sm text-on-surface-variant">
                          {subtitle}
                        </p>
                        {value === "wallet" && <WalletBalanceText />}
                      </div>
                    </div>
                    <div className="w-6 h-6 border-2 border-outline-variant rounded-full peer-checked:border-primary peer-checked:bg-primary flex items-center justify-center transition-all">
                      <div className="w-2.5 h-2.5 bg-surface-container-lowest rounded-full" />
                    </div>
                  </label>
                ))}
            </div>

            {paymentError && (
              <div role="alert" className="mt-4 rounded-xl bg-error/10 px-4 py-3 text-sm font-medium text-error">
                {paymentError}
              </div>
            )}
          </section>
        </div>

        <div className="lg:col-span-4">
          <OrderSummaryCard
            step={3}
            discountAmount={voucherDiscountAmount}
            actionLabel={
              orderType === "scheduled" || orderType === "recurring"
                ? "Gửi yêu cầu lịch hẹn"
                : "Xác nhận & Thanh toán"
            }
            onAction={handleConfirm}
            isLoading={isSubmitting}
            summaryContent={
              <div className="border-t border-dashed border-outline-variant pt-md">
                <label className="block text-sm font-semibold text-on-surface">
                  Voucher
                  <select
                    value={voucherCode}
                    onChange={(event) => {
                      const code = event.target.value;
                      setVoucherCode(code);
                      applyVoucherCode(code);
                    }}
                    disabled={isSubmitting}
                    className="mt-2 min-h-11 w-full rounded-xl border border-outline-variant bg-surface px-3"
                  >
                    <option value="">Không sử dụng voucher</option>
                    {availableVouchers.map((voucher) => (
                      <option key={voucher.id} value={voucher.code}>
                        {voucher.code} · {voucher.discountType === 'PERCENT'
                          ? `Giảm ${voucher.discountValue}%`
                          : `Giảm ${voucher.discountValue.toLocaleString('vi-VN')}đ`}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="mt-2 flex gap-2">
                  <input
                    value={voucherCode}
                    onChange={(event) => {
                      setVoucherCode(event.target.value.toUpperCase());
                      setAppliedVoucher(null);
                      setVoucherError('');
                    }}
                    maxLength={50}
                    disabled={isSubmitting}
                    placeholder="Hoặc nhập mã voucher"
                    className="min-h-11 min-w-0 flex-1 rounded-xl border border-outline-variant px-3 uppercase"
                  />
                  <button
                    type="button"
                    onClick={() => applyVoucherCode(voucherCode)}
                    disabled={isSubmitting || !voucherCode.trim()}
                    className="rounded-xl bg-primary px-3 font-semibold text-on-primary disabled:opacity-50"
                  >
                    Áp dụng
                  </button>
                </div>
                {appliedVoucher && (
                  <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                    <span>Đã áp dụng {appliedVoucher.code}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setVoucherCode('');
                        setAppliedVoucher(null);
                        setVoucherError('');
                      }}
                      disabled={isSubmitting}
                      className="underline"
                    >
                      Gỡ
                    </button>
                  </div>
                )}
                {voucherError && <p className="mt-2 text-sm font-medium text-error">{voucherError}</p>}
              </div>
            }
          />
        </div>
      </div>
    </OrderCreationShell>
  );
};

export default ConfirmPaymentPage;
