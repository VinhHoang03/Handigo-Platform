import 'dart:convert';
import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker/image_picker.dart';
import 'package:handigo_app/app/theme/app_theme.dart';
import 'package:handigo_app/core/network/api_client.dart';
import 'package:handigo_app/core/network/api_exception.dart';
import 'package:handigo_app/features/ai_chat/data/ai_chat_repository.dart';
import 'package:handigo_app/features/ai_chat/presentation/ai_chat_controller.dart';
import 'package:handigo_app/features/ai_chat/presentation/ai_chat_sheet.dart';
import 'package:handigo_app/features/booking/domain/booking_models.dart';
import 'package:handigo_app/features/service_catalog/data/service_catalog_repository.dart';
import 'package:handigo_app/features/service_catalog/presentation/service_catalog_provider.dart';
import 'package:handigo_app/features/service_catalog/domain/service_detail.dart';
import 'package:handigo_app/features/service_catalog/domain/service_option.dart';
import 'package:handigo_app/features/services/domain/service.dart';

class _Catalog extends ServiceCatalogRepository {
  _Catalog() : super(ApiClient(Dio(), CookieJar()));
  bool fail = false;
  List<Address> saved = [];
  List<ServiceOption> options = [];
  @override
  Future<List<Address>> addresses() async {
    if (fail) {
      fail = false;
      throw const ApiException('Lỗi tải địa chỉ thử nghiệm.');
    }
    return saved;
  }

  @override
  Future<ServiceDetail> detail(String serviceId) async => ServiceDetail(
    service: const Service(
      id: 'dich-vu',
      name: 'Vệ sinh máy lạnh',
      description: '',
      serviceType: 'fixed_price',
    ),
    options: options,
  );
}

class _Repository extends AiChatRepository {
  _Repository(super.api);
  Map<String, dynamic>? initialSession;
  bool failSend = false, failHistory = false, pauseSend = false;
  final requests = <Map<String, dynamic>>[];
  @override
  Future<Map<String, dynamic>?> latest() async => initialSession;
  @override
  Future<Map<String, dynamic>> send(Map<String, dynamic> request) async {
    requests.add(request);
    if (failSend) {
      failSend = false;
      throw const ApiException('Mất kết nối');
    }
    if (pauseSend) {
      pauseSend = false;
      return {
        'sessionId': request['sessionId'],
        'state': 'FAILED',
        'interruptedRequest': {
          'requestId': request['requestId'],
          'message': request['message'],
        },
        'messages': [
          {'sender': 'user', 'content': request['message']},
          {
            'sender': 'assistant',
            'content': 'Trợ lý phản hồi chậm. Chọn Thử lại.',
          },
        ],
      };
    }
    return {
      'sessionId': request['sessionId'],
      'messages': [
        {'sender': 'user', 'content': request['message']},
      ],
    };
  }

  @override
  Future<Map<String, dynamic>> history(int page) async {
    if (failHistory) {
      failHistory = false;
      throw const ApiException('Không thể tải lịch sử.');
    }
    return {
      'items': [
        {
          'sessionId': 'saved-$page',
          'title': 'Yêu cầu vệ sinh $page',
          'updatedAt': '2026-10-22T08:00:00Z',
        },
      ],
      'pagination': {'page': page, 'totalPages': 2},
    };
  }

  @override
  Future<Map<String, dynamic>> getSession(String id) async => {
    'sessionId': id,
    'messages': [
      {'sender': 'assistant', 'content': 'Nội dung cuộc trò chuyện đã lưu'},
    ],
  };
}

_Repository _repository() {
  final api = ApiClient(Dio(), CookieJar());
  addTearDown(api.close);
  return _Repository(api);
}

Future<void> _show(
  WidgetTester tester,
  _Repository repository, {
  ServiceCatalogRepository? catalog,
}) async {
  FlutterSecureStorage.setMockInitialValues({});
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = const Size(320, 800);
  addTearDown(tester.view.resetDevicePixelRatio);
  addTearDown(tester.view.resetPhysicalSize);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        if (catalog != null)
          serviceCatalogRepositoryProvider.overrideWithValue(catalog),
        aiChatControllerProvider.overrideWith(
          (ref) => AiChatController(repository),
        ),
      ],
      child: MaterialApp(
        theme: AppTheme.light,
        home: const Scaffold(body: AiChatSheet()),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets(
    'Xác nhận rút tiền hiện đủ nơi nhận và không hiển thị mã ngân hàng nội bộ',
    (tester) async {
      final repository = _repository()
        ..initialSession = {
          'sessionId': 'rut-tien',
          'messages': <Map<String, dynamic>>[],
          'pendingConfirmation': {
            'actionId': 'xac-nhan-rut',
            'tool': 'create_withdrawal',
            'preview': {
              'title': 'Tạo yêu cầu rút tiền',
              'bankName': 'Ngân hàng thử nghiệm',
              'maskedAccountNumber': '••••6789',
              'accountHolderName': 'NGUYEN VAN AN',
              'amount': 100000,
              'bankAccountId': 'ma-ngan-hang-noi-bo',
              'bankFingerprint': 'phien-ban-noi-bo',
              'note': 'Chờ quản trị viên duyệt, chưa chuyển tiền.',
            },
          },
        };
      await _show(tester, repository);
      expect(
        find.textContaining('Ngân hàng nhận: Ngân hàng thử nghiệm'),
        findsOneWidget,
      );
      expect(find.textContaining('Số tài khoản: ••••6789'), findsOneWidget);
      expect(
        find.textContaining('Chủ tài khoản: NGUYEN VAN AN'),
        findsOneWidget,
      );
      expect(find.textContaining('100.000 đ'), findsOneWidget);
      expect(find.textContaining('ma-ngan-hang-noi-bo'), findsNothing);
      expect(find.textContaining('phien-ban-noi-bo'), findsNothing);
      expect(repository.requests, isEmpty);
      await tester.ensureVisible(find.text('Xác nhận'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Xác nhận'));
      await tester.pumpAndSettle();
      expect(repository.requests.single['confirmation'], {
        'actionId': 'xac-nhan-rut',
        'decision': 'CONFIRM',
      });
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'Xác nhận báo cáo có loại, đối tượng và ảnh; lịch cũ mới đều được hiển thị',
    (tester) async {
      final repository = _repository()
        ..initialSession = {
          'sessionId': 'bao-cao',
          'messages': <Map<String, dynamic>>[],
          'pendingConfirmation': {
            'actionId': 'xac-nhan-bao-cao',
            'tool': 'create_report',
            'preview': {
              'title': 'Gửi báo cáo',
              'reportType': 'harassment',
              'targetType': 'chat_conversation',
              'currentSchedule': '2026-11-22T08:00:00+07:00',
              'schedule': '2026-11-23T09:00:00+07:00',
              'customerAttachments': [
                'https://res.cloudinary.com/test/image/upload/handigo/reports/evidence.png',
              ],
            },
          },
        };
      await _show(tester, repository);
      expect(find.text('Loại báo cáo: Quấy rối'), findsOneWidget);
      expect(find.text('Đối tượng: Cuộc trò chuyện'), findsOneWidget);
      expect(find.textContaining('Lịch hiện tại: 22/11/2026'), findsOneWidget);
      expect(find.textContaining('Thời gian: 23/11/2026'), findsOneWidget);
      expect(find.text('Ảnh đính kèm yêu cầu'), findsOneWidget);
      expect(
        find.byWidgetPredicate(
          (widget) =>
              widget is Image && widget.semanticLabel == 'Xem ảnh đính kèm 1',
        ),
        findsOneWidget,
      );
      expect(repository.requests, isEmpty);
      expect(tester.takeException(), isNull);
    },
  );

  Map<String, dynamic> bookingSession() => {
    'sessionId': 'phien-xac-nhan',
    'messages': <Map<String, dynamic>>[
      {'sender': 'assistant', 'content': 'Kiểm tra thông tin đặt đơn.'},
    ],
    'pendingConfirmation': {
      'actionId': 'xac-nhan-dat-don',
      'tool': 'create_booking',
      'preview': <String, dynamic>{
        'title': 'Tạo đơn dịch vụ',
        'policyVersion': 'a' * 64,
        'bookingPolicies': {'version': 'a' * 64, 'paymentHoldMinutes': 15},
      },
    },
  };

  test('Không gửi xác nhận đặt đơn khi chưa đồng ý chính sách', () async {
    final repository = _repository()..initialSession = bookingSession();
    final controller = AiChatController(repository);
    addTearDown(controller.dispose);
    await Future<void>.delayed(Duration.zero);
    await controller.decide('CONFIRM');
    expect(repository.requests, isEmpty);
    await controller.decide('REJECT');
    expect(repository.requests.single['confirmation'], {
      'actionId': 'xac-nhan-dat-don',
      'decision': 'REJECT',
    });
  });

  Map<String, dynamic> editableSession() =>
      bookingSession()
        ..['bookingDraft'] = {
          'status': 'active',
          'revision': 7,
          'values': {
            'recipientName': 'Nguyễn An',
            'recipientPhone': '0912345678',
            'uniformQuantity': 1,
            'paymentMethod': 'bank',
          },
          'availableVouchers': [
            {'code': 'GIAM10', 'name': 'Giảm mười nghìn'},
          ],
        };

  Future<void> openEditor(WidgetTester tester, String label) async {
    await tester.ensureVisible(find.text('Sửa thông tin đặt lịch'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Sửa thông tin đặt lịch'));
    await tester.pumpAndSettle();
    final button = find.widgetWithText(OutlinedButton, label);
    await tester.ensureVisible(button);
    await tester.pumpAndSettle();
    await tester.tap(button);
    await tester.pumpAndSettle();
  }

  testWidgets('Sửa tên kiểm tra dữ liệu, gửi đúng phiên bản và chưa tạo đơn', (
    tester,
  ) async {
    final repository = _repository()..initialSession = editableSession();
    await _show(tester, repository);
    await openEditor(tester, 'Tên người nhận');
    await tester.enterText(find.byType(TextFormField), '123');
    await tester.tap(find.text('Gửi thay đổi'));
    await tester.pumpAndSettle();
    expect(repository.requests, isEmpty);
    expect(find.textContaining('chỉ gồm chữ'), findsOneWidget);
    await tester.enterText(find.byType(TextFormField), '  Trần   Bình ');
    await tester.tap(find.text('Gửi thay đổi'));
    await tester.pumpAndSettle();
    expect(repository.requests.single['bookingAction'], {
      'type': 'update',
      'revision': 7,
      'patch': {'recipientName': 'Trần Bình'},
    });
    expect(repository.requests.single.containsKey('confirmation'), isFalse);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'Sửa số điện thoại chặn số sai, chuẩn hóa số và gửi thay đổi riêng',
    (tester) async {
      final repository = _repository()..initialSession = editableSession();
      await _show(tester, repository);
      await openEditor(tester, 'Số điện thoại người nhận');
      for (final value in ['123', '0301234567', '0501234567', '0951234567']) {
        await tester.enterText(find.byType(TextFormField), value);
        await tester.tap(find.text('Gửi thay đổi'));
        await tester.pumpAndSettle();
        expect(repository.requests, isEmpty);
      }
      await tester.enterText(find.byType(TextFormField), '098 765 4321');
      await tester.tap(find.text('Gửi thay đổi'));
      await tester.pumpAndSettle();
      expect((repository.requests.single['bookingAction'] as Map)['patch'], {
        'recipientPhone': '0987654321',
      });
    },
  );

  testWidgets('Dùng lại tên/số từ địa chỉ gửi null để bỏ lựa chọn riêng', (
    tester,
  ) async {
    for (final entry in {
      'Tên người nhận': 'recipientName',
      'Số điện thoại người nhận': 'recipientPhone',
    }.entries) {
      final repository = _repository()..initialSession = editableSession();
      await _show(tester, repository);
      await openEditor(tester, entry.key);
      await tester.tap(find.byType(CheckboxListTile));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Gửi thay đổi'));
      await tester.pumpAndSettle();
      expect((repository.requests.single['bookingAction'] as Map)['patch'], {
        entry.value: null,
      });
      await tester.pumpWidget(const SizedBox());
      await tester.pumpAndSettle();
    }
  });

  testWidgets('Số lượng chặn rỗng, bằng không, số thập phân và quá giới hạn', (
    tester,
  ) async {
    final repository = _repository()..initialSession = editableSession();
    await _show(tester, repository);
    await openEditor(tester, 'Số lượng');
    for (final value in ['', '0', '1.5', '100']) {
      await tester.enterText(find.byType(TextFormField), value);
      await tester.tap(find.text('Gửi thay đổi'));
      await tester.pumpAndSettle();
      expect(repository.requests, isEmpty);
    }
    await tester.enterText(find.byType(TextFormField), '3');
    await tester.tap(find.text('Gửi thay đổi'));
    await tester.pumpAndSettle();
    expect((repository.requests.single['bookingAction'] as Map)['patch'], {
      'quantity': 3,
    });
  });

  testWidgets(
    'Thanh toán khảo sát không cho tiền mặt, chọn ví gửi bản nháp mới',
    (tester) async {
      final initial = editableSession();
      ((initial['pendingConfirmation'] as Map)['preview']
              as Map)['serviceType'] =
          'variable_price';
      final repository = _repository()..initialSession = initial;
      await _show(tester, repository);
      await openEditor(tester, 'Thanh toán');
      expect(find.text('Tiền mặt'), findsNothing);
      await tester.tap(find.text('Ví Handigo'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Gửi thay đổi'));
      await tester.pumpAndSettle();
      expect((repository.requests.single['bookingAction'] as Map)['patch'], {
        'paymentMethod': 'wallet',
      });
    },
  );

  testWidgets(
    'Chọn voucher gửi mã hệ thống, không thu tiền hoặc chấp nhận form cũ',
    (tester) async {
      final repository = _repository()..initialSession = editableSession();
      await _show(tester, repository);
      await openEditor(tester, 'Mã giảm giá');
      await tester.tap(find.text('GIAM10'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Gửi thay đổi'));
      await tester.pumpAndSettle();
      expect((repository.requests.single['bookingAction'] as Map)['patch'], {
        'voucherCode': 'GIAM10',
      });
    },
  );

  testWidgets(
    'Lịch chưa chọn không gửi, đặt ngay gửi loại lịch và xóa lịch hẹn cũ',
    (tester) async {
      final repository = _repository()..initialSession = editableSession();
      await _show(tester, repository);
      await openEditor(tester, 'Ngày giờ');
      await tester.tap(find.text('Gửi thay đổi'));
      await tester.pumpAndSettle();
      expect(repository.requests, isEmpty);
      await tester.tap(find.text('Chuyển sang đặt ngay'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Gửi thay đổi'));
      await tester.pumpAndSettle();
      expect((repository.requests.single['bookingAction'] as Map)['patch'], {
        'orderType': 'normal',
        'scheduledAt': null,
      });
    },
  );

  testWidgets(
    'Địa chỉ tải lỗi có thử lại; rỗng không gửi; chọn địa chỉ theo ID từ hệ thống',
    (tester) async {
      final repository = _repository()..initialSession = editableSession();
      final catalog = _Catalog()..fail = true;
      await _show(tester, repository, catalog: catalog);
      await openEditor(tester, 'Địa chỉ');
      expect(find.text('Lỗi tải địa chỉ thử nghiệm.'), findsOneWidget);
      await tester.tap(find.text('Tải lại thông tin'));
      await tester.pumpAndSettle();
      expect(find.textContaining('Chưa có địa chỉ'), findsOneWidget);
      expect(
        tester
            .widget<FilledButton>(
              find.widgetWithText(FilledButton, 'Gửi thay đổi'),
            )
            .onPressed,
        isNull,
      );
      await tester.tap(find.text('Đóng'));
      await tester.pumpAndSettle();
      catalog.saved = [
        const Address(
          id: 'dia-chi-that',
          recipientName: 'Trần Bình',
          recipientPhone: '0987654321',
          fullAddress: '12 Lê Lợi',
          province: 'Đà Nẵng',
          ward: 'Phường A',
          isDefault: true,
        ),
      ];
      await tester.tap(find.widgetWithText(OutlinedButton, 'Địa chỉ'));
      await tester.pumpAndSettle();
      await tester.tap(find.textContaining('12 Lê Lợi'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Gửi thay đổi'));
      await tester.pumpAndSettle();
      expect((repository.requests.single['bookingAction'] as Map)['patch'], {
        'addressId': 'dia-chi-that',
      });
    },
  );

  testWidgets('Tùy chọn đã ngừng hoạt động không được gửi số lượng', (
    tester,
  ) async {
    final initial = editableSession();
    (initial['bookingDraft'] as Map)['values'] = {
      'serviceId': 'dich-vu',
      'selectedOptions': [
        {'optionId': 'goi-cu', 'quantity': 1},
      ],
    };
    final repository = _repository()..initialSession = initial;
    await _show(tester, repository, catalog: _Catalog());
    await openEditor(tester, 'Số lượng');
    expect(find.text('Tùy chọn không còn khả dụng'), findsOneWidget);
    await tester.tap(find.text('Gửi thay đổi'));
    await tester.pumpAndSettle();
    expect(
      find.textContaining('Có tùy chọn không còn khả dụng'),
      findsOneWidget,
    );
    expect(repository.requests, isEmpty);
  });

  testWidgets('Form đang mở không ghi nếu bản nháp đã đổi phiên bản', (
    tester,
  ) async {
    final repository = _repository()..initialSession = editableSession();
    await _show(tester, repository);
    await openEditor(tester, 'Tên người nhận');
    final controller = ProviderScope.containerOf(
      tester.element(find.byType(AiChatSheet)),
    ).read(aiChatControllerProvider);
    (controller.session!['bookingDraft'] as Map)['revision'] = 8;
    await tester.tap(find.text('Gửi thay đổi'));
    await tester.pumpAndSettle();
    expect(repository.requests, isEmpty);
    expect(find.textContaining('Bản nháp đã thay đổi'), findsOneWidget);
  });

  testWidgets(
    'Danh sách nhiều yêu cầu hiển thị tiến độ, gửi đúng mục và không hủy đơn đã tạo',
    (tester) async {
      final initial = editableSession()..['pendingConfirmation'] = null;
      initial['bookingPlan'] = {
        'id': 'ke-hoach',
        'revision': 5,
        'status': 'active',
        'activeItemId': 'muc-hai',
        'items': [
          {
            'id': 'muc-mot',
            'label': 'Vệ sinh máy lạnh',
            'status': 'created',
            'orderCode': 'ORD-1',
          },
          {'id': 'muc-hai', 'label': 'Sửa ống nước', 'status': 'active'},
        ],
      };
      final repository = _repository()..initialSession = initial;
      await _show(tester, repository);
      expect(find.textContaining('1/2 đã tạo đơn'), findsOneWidget);
      expect(find.textContaining('ORD-1'), findsOneWidget);
      await tester.ensureVisible(find.text('Để lại yêu cầu'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Để lại yêu cầu'));
      await tester.pumpAndSettle();
      expect(repository.requests.single['bookingAction'], {
        'type': 'plan',
        'plan': {'action': 'defer', 'planId': 'ke-hoach', 'revision': 5},
      });
    },
  );

  test(
    'Thử lại sửa tên giữ nguyên request; chặn sửa đơn đã tạo và khi cần đối soát',
    () async {
      final repository = _repository()
        ..initialSession = editableSession()
        ..failSend = true;
      final controller = AiChatController(repository);
      addTearDown(controller.dispose);
      await Future<void>.delayed(Duration.zero);
      await controller.updateBooking({'recipientName': 'Trần Bình'}, 7);
      final first = repository.requests.single;
      await controller.retry();
      expect(repository.requests.last, first);
      controller.session = editableSession();
      controller.session!['requiresReconciliation'] = true;
      await controller.updateBooking({'recipientName': 'Tên Sai'}, 7);
      controller.session = editableSession();
      (controller.session!['bookingDraft'] as Map)['orderId'] = 'da-tao';
      await controller.updateBooking({'recipientName': 'Tên Sai'}, 7);
      expect(repository.requests.length, 2);
    },
  );

  test('Chặn chính sách thiếu hoặc sai phiên bản dù đã chọn đồng ý', () async {
    for (final policies in [
      null,
      {'version': 'b' * 64},
    ]) {
      final initial = bookingSession();
      final preview = (initial['pendingConfirmation'] as Map)['preview'] as Map;
      preview['bookingPolicies'] = policies;
      final repository = _repository()..initialSession = initial;
      final controller = AiChatController(repository);
      addTearDown(controller.dispose);
      await Future<void>.delayed(Duration.zero);
      await controller.decide('CONFIRM', policyAccepted: true);
      expect(repository.requests, isEmpty);
      expect(controller.bookingPolicies, isNull);
    }
  });

  testWidgets('Bản xác nhận mới cần đồng ý lại, thao tác khác không cần', (
    tester,
  ) async {
    final repository = _repository()..initialSession = bookingSession();
    await _show(tester, repository);
    await tester.ensureVisible(find.byType(Checkbox));
    await tester.pumpAndSettle();
    await tester.tap(find.byType(Checkbox));
    await tester.pumpAndSettle();
    final controller = ProviderScope.containerOf(
      tester.element(find.byType(AiChatSheet)),
    ).read(aiChatControllerProvider);
    repository.initialSession = bookingSession();
    (repository.initialSession!['pendingConfirmation'] as Map)['actionId'] =
        'xac-nhan-moi';
    await controller.load();
    await tester.pumpAndSettle();
    expect(tester.widget<Checkbox>(find.byType(Checkbox)).value, isFalse);
    expect(
      tester
          .widget<FilledButton>(find.widgetWithText(FilledButton, 'Xác nhận'))
          .onPressed,
      isNull,
    );
    (repository.initialSession!['pendingConfirmation'] as Map)['tool'] =
        'submit_booking_feedback';
    final preview =
        (repository.initialSession!['pendingConfirmation'] as Map)['preview']
            as Map;
    preview['rating'] = 4.5;
    await controller.load();
    await tester.pumpAndSettle();
    expect(find.byType(Checkbox), findsNothing);
    expect(find.text('Số sao: 4,5'), findsOneWidget);
    await controller.decide('CONFIRM');
    expect(repository.requests.single['confirmation'], {
      'actionId': 'xac-nhan-moi',
      'decision': 'CONFIRM',
    });
    expect(tester.takeException(), isNull);
  });

  testWidgets('Đặt đơn cần đồng ý chính sách trên đúng form xác nhận', (
    tester,
  ) async {
    final repository = _repository()..initialSession = bookingSession();
    await _show(tester, repository);
    final confirm = find.widgetWithText(FilledButton, 'Xác nhận');
    expect(tester.widget<FilledButton>(confirm).onPressed, isNull);
    await tester.ensureVisible(find.byType(Checkbox));
    await tester.pumpAndSettle();
    await tester.tap(find.byType(Checkbox));
    await tester.pumpAndSettle();
    expect(tester.widget<FilledButton>(confirm).onPressed, isNotNull);
    repository.failSend = true;
    await tester.ensureVisible(confirm);
    await tester.pumpAndSettle();
    await tester.tap(confirm);
    await tester.pumpAndSettle();
    expect(repository.requests.single['confirmation'], {
      'actionId': 'xac-nhan-dat-don',
      'decision': 'CONFIRM',
      'policyConsent': {'accepted': true, 'version': 'a' * 64},
    });
    await tester.ensureVisible(find.text('Thử lại'));
    await tester.tap(find.text('Thử lại'));
    await tester.pumpAndSettle();
    expect(repository.requests, hasLength(2));
    expect(repository.requests.last, repository.requests.first);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'Nút tác vụ ở tiêu đề, nút nhập chỉ xuống hàng khi focus và giữ nội dung',
    (tester) async {
      await _show(tester, _repository());
      final field = find.byType(TextField);
      final send = find.byTooltip('Gửi tin nhắn');
      expect(
        tester.getCenter(find.byTooltip('Tác vụ mới')).dy,
        tester.getCenter(find.byTooltip('Lịch sử trò chuyện')).dy,
      );
      expect(tester.getCenter(send).dy, tester.getCenter(field).dy);
      await tester.tap(field);
      await tester.pumpAndSettle();
      expect(
        tester.getCenter(send).dy,
        greaterThan(tester.getBottomLeft(field).dy),
      );
      await tester.enterText(field, 'Giữ nội dung đang nhập');
      await tester.pump();
      await tester.tap(find.text('Trợ lý Handigo'));
      await tester.pumpAndSettle();
      expect(tester.getCenter(send).dy, tester.getCenter(field).dy);
      expect(
        tester.widget<TextField>(field).controller!.text,
        'Giữ nội dung đang nhập',
      );
      expect(tester.takeException(), isNull);
    },
  );
  test(
    'Upload ảnh AI đúng phiên, xác thực và trường multipart; chặn file không hợp lệ',
    () async {
      final dio = Dio(BaseOptions(baseUrl: 'https://api.example.test'));
      final api = ApiClient(dio, CookieJar());
      addTearDown(api.close);
      api.setToken('test-token');
      final repository = AiChatRepository(api);
      var uploads = 0;
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (request, handler) {
            uploads++;
            expect(request.path, '/ai/sessions/current/attachments');
            expect(request.headers['Authorization'], 'Bearer test-token');
            expect((request.data as FormData).files.single.key, 'image');
            handler.resolve(
              Response(
                requestOptions: request,
                statusCode: 200,
                data: {
                  'data': {'url': 'https://example.test/anh.png'},
                },
              ),
            );
          },
        ),
      );
      await expectLater(
        repository.uploadAttachment(
          'current',
          XFile.fromData(
            Uint8List(5 * 1024 * 1024 + 1),
            name: 'anh.png',
            mimeType: 'image/png',
          ),
        ),
        throwsA(isA<ApiException>()),
      );
      await expectLater(
        repository.uploadAttachment(
          'current',
          XFile.fromData(Uint8List(1), name: 'tep.txt', mimeType: 'text/plain'),
        ),
        throwsA(isA<ApiException>()),
      );
      expect(uploads, 0);
      expect(
        await repository.uploadAttachment(
          'current',
          XFile.fromData(
            Uint8List.fromList([137, 80, 78, 71]),
            name: 'anh.png',
            mimeType: 'image/png',
          ),
        ),
        'https://example.test/anh.png',
      );
      expect(uploads, 1);
    },
  );

  test(
    'Thử lại giữ ảnh và mã yêu cầu, không đổi phiên khi còn yêu cầu lỗi',
    () async {
      final repository = _repository();
      final controller = AiChatController(repository);
      addTearDown(controller.dispose);
      await Future<void>.delayed(Duration.zero);
      final images = ['https://example.test/anh.png'];
      repository.failSend = true;
      await controller.send('Ảnh hiện trạng', attachments: images);
      images.clear();
      expect(await controller.selectSession('saved-1'), isFalse);
      await controller.retry();
      expect(repository.requests.last['customerAttachments'], [
        'https://example.test/anh.png',
      ]);
      expect(
        repository.requests.first['requestId'],
        repository.requests.last['requestId'],
      );
      expect(await controller.selectSession('saved-1'), isTrue);
      expect(controller.sessionId, 'saved-1');
    },
  );

  testWidgets(
    'Mở lịch sử, tải lại lỗi, đổi trang và tiếp tục cuộc trò chuyện',
    (tester) async {
      final repository = _repository()..failHistory = true;
      await _show(tester, repository);
      expect(find.byTooltip('Đính kèm ảnh hiện trạng'), findsOneWidget);
      expect(find.byTooltip('Nhập bằng giọng nói'), findsOneWidget);
      final upload = tester.getCenter(
        find.byTooltip('Đính kèm ảnh hiện trạng'),
      );
      expect(tester.getCenter(find.byTooltip('Gửi tin nhắn')).dy, upload.dy);
      expect(
        tester.getCenter(find.byTooltip('Nhập bằng giọng nói')).dy,
        upload.dy,
      );
      await tester.tap(find.byTooltip('Lịch sử trò chuyện'));
      await tester.pumpAndSettle();
      expect(find.text('Không thể tải lịch sử.'), findsOneWidget);
      await tester.tap(find.text('Thử lại'));
      await tester.pumpAndSettle();
      expect(find.text('Yêu cầu vệ sinh 1'), findsOneWidget);
      await tester.tap(find.byTooltip('Trang sau'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Yêu cầu vệ sinh 2'));
      await tester.pumpAndSettle();
      expect(find.text('Nội dung cuộc trò chuyện đã lưu'), findsOneWidget);
      await tester.enterText(find.byType(TextField), 'Tiếp tục');
      await tester.pump();
      await tester.tap(find.byTooltip('Gửi tin nhắn'));
      await tester.pumpAndSettle();
      expect(repository.requests.single['sessionId'], 'saved-2');
      expect(tester.takeException(), isNull);
    },
  );

  test('Model tạm dừng vẫn thử lại đúng yêu cầu sau HTTP thành công', () async {
    final repository = _repository();
    final controller = AiChatController(repository);
    addTearDown(controller.dispose);
    await Future<void>.delayed(Duration.zero);
    repository.pauseSend = true;
    await controller.send('Hướng dẫn hủy QR');
    expect(controller.error, contains('Thử lại'));
    expect(controller.canSend, isFalse);
    expect(controller.canReset, isFalse);
    expect(await controller.selectSession('saved-1'), isFalse);
    final paused = Map<String, dynamic>.of(repository.requests.single);
    await controller.retry();
    expect(repository.requests, hasLength(2));
    expect(repository.requests.last, paused);
    expect(controller.error, isNull);
    expect(controller.canSend, isTrue);
    expect(
      controller.messages.where((message) => message['sender'] == 'user'),
      hasLength(1),
    );
  });

  const voiceChannel = MethodChannel('plugin.csdcorp.com/speech_to_text');
  testWidgets('Từ chối quyền micro vẫn nhập được bằng bàn phím', (
    tester,
  ) async {
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
      voiceChannel,
      (call) async => false,
    );
    addTearDown(
      () => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        voiceChannel,
        null,
      ),
    );
    await _show(tester, _repository());
    await tester.tap(find.byTooltip('Nhập bằng giọng nói'));
    await tester.pumpAndSettle();
    expect(
      find.text(
        'Vui lòng cấp quyền micro và nhận dạng giọng nói để sử dụng tính năng này.',
      ),
      findsOneWidget,
    );
    expect(tester.widget<TextField>(find.byType(TextField)).readOnly, isFalse);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Giọng nói điền vào ô nhập, chỉ gửi sau khi bấm Gửi', (
    tester,
  ) async {
    final repository = _repository();
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
      voiceChannel,
      (call) async {
        if (call.method == 'initialize' || call.method == 'listen') return true;
        if (call.method == 'locales') return ['vi_VN:Tiếng Việt'];
        return null;
      },
    );
    addTearDown(
      () => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        voiceChannel,
        null,
      ),
    );
    await _show(tester, repository);
    await tester.tap(find.byTooltip('Nhập bằng giọng nói'));
    await tester.pumpAndSettle();
    tester.binding.channelBuffers.push(
      voiceChannel.name,
      const StandardMethodCodec().encodeMethodCall(
        MethodCall(
          'textRecognition',
          jsonEncode({
            'alternates': [
              {
                'recognizedWords': 'Tôi cần vệ sinh máy lạnh',
                'confidence': 1.0,
              },
            ],
            'resultType': 0,
          }),
        ),
      ),
      (_) {},
    );
    await tester.pump();
    expect(
      tester.widget<TextField>(find.byType(TextField)).controller!.text,
      'Tôi cần vệ sinh máy lạnh',
    );
    expect(repository.requests, isEmpty);
    await tester.tap(find.byTooltip('Dừng nhập giọng nói'));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Gửi tin nhắn'));
    await tester.pumpAndSettle();
    expect(repository.requests.single['message'], 'Tôi cần vệ sinh máy lạnh');
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });
}
