import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../../app/providers/app_providers.dart';
import '../../../core/config/app_config.dart';

enum ProviderInboxSection { messages, notifications }

class ProviderInboxVisits {
  const ProviderInboxVisits({this.userId, this.messages, this.notifications});
  final String? userId;
  final DateTime? messages, notifications;
}

final providerInboxVisitsProvider =
    AsyncNotifierProvider<ProviderInboxVisitsController, ProviderInboxVisits>(
      ProviderInboxVisitsController.new,
    );

class ProviderInboxVisitsController extends AsyncNotifier<ProviderInboxVisits> {
  static const _storage = FlutterSecureStorage();
  Future<void> _writes = Future.value();

  String _key(String userId) =>
      'handigo.provider.inbox.${AppConfig.apiBaseUrl}.$userId';

  @override
  Future<ProviderInboxVisits> build() async {
    final userId = ref.watch(
      authControllerProvider.select((auth) => auth.user?.id),
    );
    if (userId == null) return const ProviderInboxVisits();
    try {
      final raw = await _storage.read(key: _key(userId));
      final data = raw == null ? null : jsonDecode(raw);
      if (data is Map) {
        return ProviderInboxVisits(
          userId: userId,
          messages: DateTime.tryParse('${data['messages']}'),
          notifications: DateTime.tryParse('${data['notifications']}'),
        );
      }
    } catch (_) {
      // Kho thiết bị chưa sẵn sàng vẫn cho phép theo dõi trong phiên hiện tại.
    }
    return ProviderInboxVisits(userId: userId);
  }

  Future<void> open(ProviderInboxSection section, {DateTime? latestAt}) async {
    final userId = ref.read(authControllerProvider).user?.id;
    if (userId == null) return;
    final cached = state.asData?.value;
    ProviderInboxVisits previous;
    try {
      previous = cached?.userId == userId ? cached! : await future;
    } catch (_) {
      return;
    }
    if (!ref.mounted ||
        previous.userId != userId ||
        ref.read(authControllerProvider).user?.id != userId) {
      return;
    }
    final now = DateTime.now().toUtc();
    var openedAt = latestAt != null && latestAt.isAfter(now) ? latestAt : now;
    final previousAt = section == ProviderInboxSection.messages
        ? previous.messages
        : previous.notifications;
    if (previousAt != null && previousAt.isAfter(openedAt)) {
      openedAt = previousAt;
    }
    final next = ProviderInboxVisits(
      userId: userId,
      messages: section == ProviderInboxSection.messages
          ? openedAt
          : previous.messages,
      notifications: section == ProviderInboxSection.notifications
          ? openedAt
          : previous.notifications,
    );
    state = AsyncData(next);
    final value = jsonEncode({
      'messages': next.messages?.toIso8601String(),
      'notifications': next.notifications?.toIso8601String(),
    });
    _writes = _writes.then((_) async {
      try {
        await _storage.write(key: _key(userId), value: value);
      } catch (_) {
        /* Mốc trong phiên vẫn được giữ nếu thiết bị chưa ghi được. */
      }
    });
    await _writes;
  }
}
