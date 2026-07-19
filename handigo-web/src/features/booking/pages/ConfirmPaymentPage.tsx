import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookingStepper, OrderCreationShell, OrderSummaryCard } from '../components/BookingComponents';
import { useBookingStore } from '../hooks/useBookingStore';
import { bookingApi, type CreateOrderPayload } from '@/features/booking/api/booking.api';
import { bookingVoucherApi } from '@/features/booking/api/voucher.api';
import { serviceCatalogApi } from '@/features/customer-service/api/serviceCatalog.api';
import { walletApi } from '@/features/wallet/api/wallet.api';
import type { Address, Service, ServiceOption } from '../../../types/booking';
import type { AvailableVoucher } from '../types/voucher.types';
import type { WalletOverview } from '@/features/wallet/types/wallet.types';
import { getMissingRequiredGroup } from '../utils/serviceOptionSelection';

const paymentMethods = [
  ['account_balance_wallet', 'Ví Handigo', 'Thanh toán ngay từ số dư ví', 'wallet'],
  ['account_balance', 'Chuyển khoản ngân hàng', 'Quét mã VietQR hoặc Internet Banking', 'bank'],
  ['payments', 'Tiền mặt', 'Thanh toán trực tiếp cho nhân viên', 'cash'],
] as const;

const getOptionPrice = (option: ServiceOption) => option.price ?? option.fixedPrice ?? 0;

const formatAddress = (address: Address | null) => {
  if (!address) return '';
  return [address.detailAddress, address.ward, address.district, address.province]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(', ');
};

const ConfirmPaymentPage = () => {
  const {
    categoryId, serviceId, selectedOptionIds, addressId, orderType,
    preferredProviderId, preferredProviderName, scheduledAt, problemDescription, customerAttachments, paymentMethod, setPaymentMethod, reset
  } = useBookingStore();

  const [service, setService] = useState<Service | null>(null);
  const [address, setAddress] = useState<Address | null>(null);
  const [options, setOptions] = useState<ServiceOption[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [availableVouchers, setAvailableVouchers] = useState<AvailableVoucher[]>([]);
  const [voucherCode, setVoucherCode] = useState('');
  const [voucherError, setVoucherError] = useState('');
  const [pendingOrderId, setPendingOrderId] = useState('');
  const [wallet, setWallet] = useState<WalletOverview | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;
    if (serviceId) {
      serviceCatalogApi.serviceById(serviceId).then(data => {
        if (isMounted) setService(data);
      });
      serviceCatalogApi.options(serviceId).then(data => {
        if (isMounted) setOptions(data);
      });
    }
    if (addressId) {
      bookingApi.getAddresses().then(addresses => {
        if (!isMounted) return;
        const found = addresses.find(a => a._id === addressId);
        if (found) setAddress(found);
      });
    }
    return () => { isMounted = false; };
  }, [serviceId, addressId, categoryId]);

  useEffect(() => {
    let isMounted = true;
    bookingVoucherApi.available()
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

  useEffect(() => {
    let isMounted = true;
    walletApi.getMine()
      .then((currentWallet) => {
        if (isMounted) setWallet(currentWallet);
      })
      .catch(() => {
        if (isMounted) setWallet(null);
      });
    return () => {
      isMounted = false;
    };
  }, []);


  const selectedOptions = options.filter(opt => selectedOptionIds.includes(opt._id));
  const effectivePaymentMethod = paymentMethod;

  const handleConfirm = async () => {
    if (!serviceId) {
      alert('Vui lòng chọn dịch vụ trước khi thanh toán.');
      return;
    }
    if (!addressId) {
      alert('Vui lòng chọn địa chỉ thực hiện.');
      return;
    }
    if (
      (orderType === 'scheduled' || orderType === 'recurring') &&
      (!scheduledAt || new Date(scheduledAt).getTime() <= Date.now())
    ) {
      setPaymentError('Vui lòng chọn thời gian thực hiện trong tương lai.');
      return;
    }
    const missingGroup = getMissingRequiredGroup(selectedOptionIds, options);
    if (missingGroup) {
      setPaymentError(`Vui lòng chọn một tùy chọn trong nhóm “${missingGroup.label}”.`);
      return;
    }

    setIsSubmitting(true);
    setPaymentError('');
    setVoucherError('');
    try {
      const payload: CreateOrderPayload = {
        serviceId,
        selectedOptionIds,
        addressId,
        preferredProviderId,
        orderType,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        problemDescription,
        customerAttachments,
        paymentMethod: effectivePaymentMethod,
      };

      let orderId = pendingOrderId;
      if (!orderId) {
        const createdOrder = await bookingApi.createOrder(payload);
        orderId = createdOrder._id;
        setPendingOrderId(orderId);
      }

      const currentOrder = await bookingApi.getOrderById(orderId);
      const currentVoucherCode = currentOrder.voucherSnapshot?.code || '';
      const desiredVoucherCode = voucherCode.trim().toUpperCase();

      if (currentVoucherCode && currentVoucherCode !== desiredVoucherCode) {
        await bookingVoucherApi.remove(orderId);
      }
      if (desiredVoucherCode && currentVoucherCode !== desiredVoucherCode) {
        await bookingVoucherApi.apply(orderId, desiredVoucherCode);
      }

      if (effectivePaymentMethod === 'bank') {
        const payment = await bookingApi.createPayment({
          orderId,
          method: 'PAYOS',
          paymentType: service?.serviceType === 'variable_price' ? 'INSPECTION_DEPOSIT' : 'FULL',
          returnUrl: `${window.location.origin}/customer/bookings/success?orderId=${orderId}`,
          cancelUrl: `${window.location.origin}/customer/bookings/new/payment`,
        });

        if (!payment.checkoutUrl) {
          throw new Error('PayOS checkoutUrl is missing');
        }

        sessionStorage.setItem('latestBookingOrderId', orderId);
        window.location.href = payment.checkoutUrl;
        return;
      }

      await bookingApi.createPayment(
        effectivePaymentMethod === 'wallet'
          ? {
              orderId,
              method: 'WALLET',
              paymentType: 'FULL',
            }
          : {
              orderId,
              method: 'CASH',
              paymentType: 'FULL',
            },
      );

      const orderDetail = await bookingApi.getOrderById(orderId);

      reset();
      navigate('/customer/bookings/success', { state: { order: orderDetail } });
    } catch (error) {
      const requestError = error as {
        response?: {
          data?: {
            message?: string;
            errors?: Array<{ message?: string }>;
          };
        };
      };
      const message = requestError.response?.data?.errors?.find(
        (issue) => issue.message,
      )?.message || requestError.response?.data?.message ||
        'Không thể tạo đơn đặt lịch. Vui lòng thử lại hoặc chọn địa chỉ khác.';
      console.error('Không thể tạo đơn đặt lịch.', error);
      if (message.toLowerCase().includes('voucher')) {
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
    ['cleaning_services', 'Dịch vụ', service?.name || '...'],
    ['calendar_today', 'Thời gian', scheduledAt ? new Date(scheduledAt).toLocaleString('vi-VN') : 'Sớm nhất có thể'],
    ...(addressText ? [['location_on', 'Địa chỉ', addressText]] : []),
    [
      'person_search',
      'Điều phối chuyên gia',
      preferredProviderId
        ? `Ưu tiên ${preferredProviderName || 'chuyên gia đã chọn'}`
        : 'Handigo tự điều phối',
    ],
  ] as string[][];

  return (
    <OrderCreationShell>
      <BookingStepper currentStep={3} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-start">
        <div className="lg:col-span-8 space-y-gutter">
          <section className="bg-surface-container-lowest rounded-xl p-md border border-outline-variant/30 shadow-sm">
            <h2 className="font-headline-md text-headline-md mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">receipt_long</span>
              Chi tiết dịch vụ
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              {detailItems.map(([icon, label, value], index) => (
                <div key={label} className={`flex items-start gap-4 ${index === 2 ? 'md:col-span-2' : ''}`}>
                  <div className="bg-primary-fixed-dim/30 p-3 rounded-lg text-primary">
                    <span className="material-symbols-outlined">{icon}</span>
                  </div>
                  <div>
                    <p className="font-label-md text-label-md text-on-surface-variant">{label}</p>
                    <p className="font-body-md text-body-md font-semibold">{value}</p>
                  </div>
                </div>
              ))}
            </div>

            {selectedOptions.length > 0 && (
              <div className="mt-6 pt-6 border-t border-outline-variant">
                <p className="font-label-md text-on-surface-variant mb-3">Dịch vụ bổ sung:</p>
                <div className="flex flex-wrap gap-2">
                  {selectedOptions.map(opt => (
                    <span key={opt._id} className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">
                      {opt.name}
                      {service?.serviceType !== 'variable_price' && ` (+${getOptionPrice(opt).toLocaleString()}đ)`}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="bg-surface-container-lowest rounded-xl p-md border border-outline-variant/30 shadow-sm">
            <h2 className="font-headline-md text-headline-md mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">account_balance_wallet</span>
              Phương thức thanh toán
            </h2>
            <div className="space-y-3">
              {paymentMethods
                .filter(([, , , value]) => {
                  if (service?.serviceType === 'variable_price') {
                    // Dịch vụ cần khảo sát không hỗ trợ thanh toán tiền mặt.
                    return value !== 'cash';
                  }
                  return true;
                })
                .map(([icon, title, subtitle, value]) => (
                  <label
                    key={value}
                    className="group relative flex items-center p-4 rounded-xl border border-outline-variant/50 hover:border-primary cursor-pointer transition-all bg-surface-container-low/30 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                  >
                    <input
                      checked={effectivePaymentMethod === value}
                      onChange={() => setPaymentMethod(value)}
                      className="hidden peer"
                      name="payment"
                      type="radio"
                      value={value}
                    />
                    <div className="flex-1 flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${effectivePaymentMethod === value ? 'bg-primary text-white' : 'bg-on-surface/5 text-on-surface'}`}>
                        <span className="material-symbols-outlined">{icon}</span>
                      </div>
                      <div>
                        <p className="font-body-md text-body-md font-semibold">{title}</p>
                        <p className="font-label-sm text-label-sm text-on-surface-variant">
                          {value === 'wallet'
                            ? wallet
                              ? `Số dư khả dụng: ${wallet.balance.toLocaleString('vi-VN')}đ`
                              : 'Đang tải số dư ví...'
                            : subtitle}
                        </p>
                      </div>
                    </div>
                    <div className="w-6 h-6 border-2 border-outline-variant rounded-full peer-checked:border-primary peer-checked:bg-primary flex items-center justify-center transition-all">
                      <div className="w-2.5 h-2.5 bg-white rounded-full" />
                    </div>
                  </label>
                ))}
            </div>

            {paymentError && (
              <div className="mt-4 rounded-xl bg-error/10 px-4 py-3 text-sm font-medium text-error">
                {paymentError}
              </div>
            )}

          </section>
        </div>

        <div className="lg:col-span-4">
          <OrderSummaryCard
            step={3}
            actionLabel="Xác nhận & Thanh toán"
            onAction={handleConfirm}
            isLoading={isSubmitting}
            summaryContent={
              <div className="border-t border-dashed border-outline-variant pt-md">
                <label className="block text-sm font-semibold text-on-surface">
                  Voucher
                  <select
                    value={voucherCode}
                    onChange={(event) => {
                      setVoucherCode(event.target.value);
                      setVoucherError('');
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
                      setVoucherError('');
                    }}
                    maxLength={50}
                    disabled={isSubmitting}
                    placeholder="Hoặc nhập mã voucher"
                    className="min-h-11 min-w-0 flex-1 rounded-xl border border-outline-variant px-3 uppercase"
                  />
                  {voucherCode && (
                    <button type="button" onClick={() => setVoucherCode('')} disabled={isSubmitting} className="rounded-xl border border-outline-variant px-3 font-semibold text-on-surface-variant">
                      Gỡ
                    </button>
                  )}
                </div>
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
