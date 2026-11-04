import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:handigo_app/app/providers/app_providers.dart';
import 'package:handigo_app/core/network/api_client.dart';
import 'package:handigo_app/features/auth/data/auth_repository.dart';
import 'package:handigo_app/features/auth/domain/app_user.dart';
import 'package:handigo_app/features/auth/presentation/auth_controller.dart';
import 'package:handigo_app/features/provider/data/provider_repository.dart';
import 'package:handigo_app/features/provider/presentation/provider_inbox_visits.dart';

class _Api extends ApiClient {
  _Api() : super(Dio(), CookieJar());
  final pages = <int>[];

  @override
  Future<Map<String, dynamic>> request(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? data,
    Map<String, dynamic>? query,
    bool authenticated = false,
    Duration? receiveTimeout,
  }) async {
    expect(authenticated, isTrue);
    final page = query!['page'] as int;
    pages.add(page);
    if (path == '/notifications') {
      expect(query['isRead'], 'false');
      return {
        'data': {
          'items': [
            for (final day in page == 1 ? [5, 4] : [1])
              {'createdAt': '2030-01-0${day}T12:00:00Z'},
          ],
          'pagination': {'total': 3, 'totalPages': 2},
        },
      };
    }
    expect(path, '/chat/conversations');
    Map<String, dynamic> conversation(String sender, int day, {int? seen}) => {
      'lastMessage': {
        'senderId': sender,
        'sentAt': '2030-01-0${day}T12:00:00Z',
      },
      if (seen != null) 'providerLastSeenAt': '2030-01-0${seen}T12:00:00Z',
    };
    return {
      'data': {
        'items': page == 1
            ? [
                conversation('customer', 5),
                conversation('provider', 4),
                conversation('customer', 4, seen: 5),
                conversation('customer', 1),
              ]
            : [conversation('customer', 3)],
        'pagination': {'totalPages': 2},
      },
    };
  }
}

void main() {
  test('Thông báo lấy đúng tổng chưa đọc vượt một trang', () async {
    final api = _Api();
    addTearDown(api.close);
    final result = await ProviderRepository(api).notificationBadge(null);
    expect(result.count, 3);
    expect(api.pages, [1]);
  });

  test('Sau khi mở chỉ đếm thông báo mới và dừng khi gặp mốc cũ', () async {
    final api = _Api();
    addTearDown(api.close);
    final result = await ProviderRepository(
      api,
    ).notificationBadge(DateTime.utc(2030, 1, 2));
    expect(result.count, 2);
    expect(api.pages, [1, 2]);
  });

  test(
    'Tin nhắn loại tin tự gửi, hội thoại đã xem và tin trước lần mở',
    () async {
      final api = _Api();
      addTearDown(api.close);
      final result = await ProviderRepository(
        api,
      ).messageBadge('provider', DateTime.utc(2030, 1, 2));
      expect(result.count, 2);
      expect(api.pages, [1, 2]);
    },
  );

  test(
    'Mốc đã mở lưu qua phiên, tách tài khoản và không lùi thời gian',
    () async {
      FlutterSecureStorage.setMockInitialValues({});
      final api = _Api();
      addTearDown(api.close);
      ProviderContainer scope(String id) {
        final container = ProviderContainer(
          overrides: [
            authControllerProvider.overrideWith(
              (ref) => AuthController(AuthRepository(api), api)
                ..user = AppUser(
                  id: id,
                  fullName: 'Thợ kiểm thử',
                  email: 'test@example.test',
                  role: UserRole.provider,
                )
                ..status = AuthStatus.authenticated,
            ),
          ],
        );
        addTearDown(container.dispose);
        return container;
      }

      final first = scope('a');
      await first.read(providerInboxVisitsProvider.future);
      final at = DateTime.now().toUtc().add(const Duration(days: 1));
      final controller = first.read(providerInboxVisitsProvider.notifier);
      await controller.open(ProviderInboxSection.messages, latestAt: at);
      await controller.open(ProviderInboxSection.messages);
      final restored = await scope(
        'a',
      ).read(providerInboxVisitsProvider.future);
      expect(restored.messages, at);
      expect(restored.notifications, isNull);
      final other = await scope('b').read(providerInboxVisitsProvider.future);
      expect(other.messages, isNull);
      expect(other.notifications, isNull);
    },
  );
}
