import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:handigo_app/core/network/api_client.dart';
import 'package:handigo_app/features/booking/domain/booking_models.dart';
import 'package:handigo_app/features/booking/presentation/booking_provider.dart';
import 'package:handigo_app/features/booking/presentation/booking_provider_selector.dart';
import 'package:handigo_app/features/orders/data/order_repository.dart';
import 'package:handigo_app/features/orders/domain/order_summary.dart';
import 'package:handigo_app/features/provider/data/provider_repository.dart';
import 'package:handigo_app/features/service_catalog/data/service_catalog_repository.dart';

class _Api extends ApiClient {
  _Api() : super(Dio(), CookieJar());
  String? path, method;
  Map<String, dynamic>? payload;
  Map<String, dynamic> response = {
    'data': {
      '_id': 'order',
      'payment': {'status': 'pending'},
    },
  };
  @override
  Future<Map<String, dynamic>> request(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? data,
    Map<String, dynamic>? query,
    bool authenticated = false,
    Duration? receiveTimeout,
  }) async {
    this.path = path;
    this.method = method;
    payload = data;
    expect(authenticated, isTrue);
    return response;
  }
}

OrderDetail _order({
  String status = 'accepted',
  bool inspection = true,
  bool deposit = true,
  String bookingStatus = 'confirmed',
  String paymentStatus = 'paid',
  String paymentMethod = 'bank',
}) => OrderDetail(
  id: 'order',
  code: 'HDG-001',
  serviceName: 'Sửa máy lạnh',
  status: status,
  paymentStatus: paymentStatus,
  paymentMethod: paymentMethod,
  orderType: 'scheduled',
  inspectionRequired: inspection,
  bookingStatus: bookingStatus,
  depositPaidAt: deposit ? DateTime.utc(2026) : null,
  durationMinutes: 60,
);

void main() {
  test(
    'Đơn khảo sát cần cọc, lịch xác nhận và báo giá có thời lượng trước start',
    () {
      const quote = RepairQuotation(
        id: 'quote',
        status: 'saved',
        finalAmount: 500000,
        estimatedDurationMinutes: 90,
      );
      expect(_order().canStart(null), isFalse);
      expect(_order(deposit: false).canStart(quote), isFalse);
      expect(
        _order(bookingStatus: 'awaiting_payment').canStart(quote),
        isFalse,
      );
      expect(
        _order().canStart(
          const RepairQuotation(id: 'quote', status: 'saved', finalAmount: 1),
        ),
        isFalse,
      );
      expect(_order().canStart(quote), isTrue);
      expect(_order(status: 'completed').canStart(quote), isFalse);
    },
  );

  test('Đơn cố định đã trả hoặc tiền mặt không cần báo giá', () {
    expect(_order(inspection: false).canStart(null), isTrue);
    expect(
      _order(inspection: false, paymentStatus: 'unpaid').canStart(null),
      isFalse,
    );
    expect(
      _order(
        inspection: false,
        paymentMethod: 'cash',
        paymentStatus: 'unpaid',
      ).canStart(null),
      isTrue,
    );
    expect(_order(inspection: false).canEditQuotation, isFalse);
  });

  test('Báo giá saved không cần khách duyệt, pending cũ chưa được start', () {
    expect(
      const RepairQuotation(id: 'q', status: 'saved', finalAmount: 1).usable,
      isTrue,
    );
    expect(
      const RepairQuotation(id: 'q', status: 'pending', finalAmount: 1).usable,
      isFalse,
    );
    expect(
      const RepairQuotation(
        id: 'q',
        status: 'approved',
        customerConfirmed: true,
        finalAmount: 1,
      ).usable,
      isTrue,
    );
  });

  test('Đọc cọc thực trả, snapshot địa chỉ và phiên bản báo giá từ API', () {
    final order = OrderDetail.fromJson({
      '_id': 'order',
      'serviceId': {'serviceType': 'variable_price'},
      'addressSnapshot': {'fullAddress': 'Địa chỉ khi đặt đơn'},
      'addressId': {'fullAddress': 'Địa chỉ đã thay đổi'},
      'depositPaidAt': '2026-10-20T00:00:00Z',
      'depositAmount': 100000,
      'pricing': {'baseAmount': 100000, 'totalPaidAmount': 80000},
    });
    expect(order.inspectionRequired, isTrue);
    expect(order.appliedDeposit, 80000);
    expect(order.addressLabel, 'Địa chỉ khi đặt đơn');
    final quote = RepairQuotation.fromJson({
      'quotation': {
        '_id': 'q',
        'revision': 4,
        'status': 'saved',
        'finalAmount': 400000,
        'estimatedDurationMinutes': 60,
      },
      'items': [
        {
          'title': 'Nhân công',
          'itemType': 'labor',
          'quantity': 1,
          'unitPrice': 400000,
        },
      ],
    });
    expect(quote.revision, 4);
    expect(quote.items.single.itemType, 'labor');
  });

  test('Chặn lịch quá khứ, 21:01 và đặt ngay ngoài giờ', () {
    final now = DateTime(2026, 10, 20, 10, 0);
    expect(
      bookingTimeError(
        BookingDraft(
          type: BookingType.scheduled,
          scheduledAt: DateTime(2026, 10, 20, 9),
        ),
        now,
      ),
      isNotNull,
    );
    expect(
      bookingTimeError(
        BookingDraft(
          type: BookingType.scheduled,
          scheduledAt: DateTime(2026, 10, 20, 21, 1),
        ),
        now,
      ),
      isNotNull,
    );
    expect(
      bookingTimeError(
        BookingDraft(
          type: BookingType.scheduled,
          scheduledAt: DateTime(2026, 10, 20, 21),
        ),
        now,
      ),
      isNull,
    );
    expect(
      bookingTimeError(
        const BookingDraft(type: BookingType.normal),
        DateTime(2026, 10, 20, 22),
      ),
      isNotNull,
    );
  });

  test(
    'Chỉnh báo giá gửi đúng ID và revision, hoàn thành giữ cùng kỳ vọng',
    () async {
      final api = _Api();
      addTearDown(api.close);
      final repository = ProviderRepository(api);
      const quote = RepairQuotation(
        id: 'quote',
        status: 'saved',
        revision: 7,
        finalAmount: 1,
      );
      await repository.saveQuotation('order', {'items': []}, current: quote);
      expect(api.path, '/orders/order/quotation');
      expect(api.method, 'PATCH');
      expect(api.payload!['quotationId'], 'quote');
      expect(api.payload!['expectedRevision'], 7);
      await repository.completeOrder(
        'order',
        ['https://example.test/image.jpg'],
        'Đã kiểm tra',
        quotation: quote,
      );
      expect(api.payload!['expectedQuotationRevision'], 7);
      await repository.confirmQuotationPayment('order', quote);
      expect(api.path, '/orders/order/quotation/payment/confirm');
      expect(api.payload!['expectedRevision'], 7);
    },
  );

  test(
    'Tạo đơn normal bỏ trường định kỳ và gửi giá khách đã xác nhận',
    () async {
      final api = _Api();
      addTearDown(api.close);
      await ServiceCatalogRepository(api).createOrder(
        serviceId: 'service',
        selectedOptions: [],
        addressId: 'address',
        type: BookingType.normal,
        paymentMethod: PaymentMethod.wallet,
        scheduledAt: DateTime.utc(2026),
        recurrenceCount: 4,
        recurrenceUnit: 'weekly',
        preferredProviderId: 'provider',
        expectedBookingAmount: 120000,
        expectedFinalAmount: 100000,
        uniformQuantity: 2,
      );
      expect(api.payload!['scheduledAt'], isNull);
      expect(api.payload!['recurrenceCount'], isNull);
      expect(api.payload!['expectedFinalAmount'], 100000);
      expect(api.payload!['preferredProviderId'], 'provider');
      expect(api.payload!['uniformQuantity'], 2);
    },
  );

  test(
    'Thanh toán khảo sát gửi inspection deposit và kỳ vọng số tiền',
    () async {
      final api = _Api();
      addTearDown(api.close);
      await ServiceCatalogRepository(api).createPayment(
        orderId: 'order',
        method: PaymentMethod.bank,
        inspectionRequired: true,
        expectedAmount: 90000,
      );
      expect(api.payload!['method'], 'PAYOS');
      expect(api.payload!['paymentType'], 'INSPECTION_DEPOSIT');
      expect(api.payload!['expectedAmount'], 90000);
    },
  );

  test('Hủy đơn gửi đúng các số tiền đã xem trong preview', () async {
    final api = _Api();
    addTearDown(api.close);
    await OrderRepository(api).cancel(
      'order',
      'Thay đổi lịch',
      preview: const CancellationPreview(
        paidAmount: 100,
        refundAmount: 80,
        cancellationFee: 20,
        providerCompensation: 10,
      ),
    );
    expect(api.payload!['confirmedExpectation'], {
      'paidAmount': 100.0,
      'refundAmount': 80.0,
      'cancellationFee': 20.0,
      'providerCompensation': 10.0,
    });
  });

  test('Đơn khảo sát đã kết thúc không có nút trả cọc lại', () {
    expect(
      _order(
        status: 'completed',
        paymentStatus: 'unpaid',
      ).canMakeInitialPayment,
      isFalse,
    );
    expect(
      _order(
        status: 'in_progress',
        inspection: false,
        paymentStatus: 'unpaid',
      ).canMakeInitialPayment,
      isTrue,
    );
  });
}
