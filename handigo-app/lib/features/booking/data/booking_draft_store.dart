import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../domain/booking_models.dart';
import '../presentation/booking_provider.dart';

class BookingDraftStore {
  const BookingDraftStore();
  static const _storage = FlutterSecureStorage();
  static const rebookingLifetime = Duration(minutes: 30);
  static final _pending = <String, Future<void>>{};
  String _key(String id) => 'handigo_booking_draft_$id';
  String _rebookKey(String owner, String orderId) =>
      'handigo_rebook_${Uri.encodeComponent(owner)}/${Uri.encodeComponent(orderId)}';

  Future<void> _queue(String key, Future<void> Function() operation) async {
    final previous = _pending[key];
    final next = () async {
      try {
        await previous;
      } catch (_) {
        /* Cho phép lần ghi tiếp theo thử lại. */
      }
      await operation();
    }();
    _pending[key] = next;
    try {
      await next;
    } finally {
      if (identical(_pending[key], next)) _pending.remove(key);
    }
  }

  Future<void> saveRebooking(String owner, String orderId, BookingDraft draft) {
    final key = _rebookKey(owner, orderId);
    final value = jsonEncode({
      ..._encode(draft),
      'preferredProviderId': draft.preferredProviderId,
      'expiresAt': DateTime.now().add(rebookingLifetime).millisecondsSinceEpoch,
    });
    return _queue(key, () => _storage.write(key: key, value: value));
  }

  Future<void> clearRebooking(String owner, String orderId) {
    final key = _rebookKey(owner, orderId);
    return _queue(key, () => _storage.delete(key: key));
  }

  Future<BookingDraft?> readRebooking(String owner, String orderId) async {
    final key = _rebookKey(owner, orderId);
    BookingDraft? draft;
    await _queue(key, () async {
      final raw = await _storage.read(key: key);
      if (raw == null) return;
      final value = jsonDecode(raw) as Map<String, dynamic>;
      final expiresAt = value['expiresAt'] as int?;
      if (expiresAt == null ||
          expiresAt <= DateTime.now().millisecondsSinceEpoch) {
        await _storage.delete(key: key);
        return;
      }
      draft = _decode(value, rebooking: true);
    });
    return draft;
  }

  Future<void> clear(String id) => _storage.delete(key: _key(id));
  Future<void> save(String id, BookingDraft draft) =>
      _storage.write(key: _key(id), value: jsonEncode(_encode(draft)));
  Map<String, dynamic> _encode(BookingDraft draft) => {
    'serviceId': draft.serviceId,
    'selectedOptionIds': draft.selectedOptionIds,
    'quantities': draft.quantities,
    'addressId': draft.addressId,
    'type': draft.type.name,
    'paymentMethod': draft.paymentMethod.name,
    'scheduledAt': draft.scheduledAt?.toIso8601String(),
    'recurrenceUnit': draft.recurrenceUnit,
    'recurrenceCount': draft.recurrenceCount,
    'problemDescription': draft.problemDescription,
    'attachments': draft.attachments,
    'voucherCode': draft.voucherCode,
    'uniformQuantity': draft.uniformQuantity,
  };
  Future<BookingDraft?> read(String id) async {
    final raw = await _storage.read(key: _key(id));
    if (raw == null) return null;
    return _decode(jsonDecode(raw) as Map<String, dynamic>);
  }

  BookingDraft _decode(Map<String, dynamic> value, {bool rebooking = false}) {
    final scheduledAt = DateTime.tryParse(
      value['scheduledAt'] as String? ?? '',
    );
    final savedType = BookingType.values.byName(value['type'] as String);
    final hasSchedule =
        scheduledAt != null &&
        (savedType == BookingType.scheduled ||
            savedType == BookingType.recurring);
    return BookingDraft(
      serviceId: value['serviceId'] as String?,
      selectedOptionIds: (value['selectedOptionIds'] as List? ?? [])
          .cast<String>(),
      quantities: (value['quantities'] as Map? ?? {}).map(
        (key, value) => MapEntry('$key', (value as num).toInt()),
      ),
      addressId: value['addressId'] as String?,
      type: rebooking
          ? savedType
          : hasSchedule
          ? BookingType.scheduled
          : BookingType.normal,
      paymentMethod: PaymentMethod.values.byName(
        value['paymentMethod'] as String,
      ),
      scheduledAt: hasSchedule ? scheduledAt : null,
      recurrenceUnit: rebooking ? value['recurrenceUnit'] as String? : null,
      recurrenceCount: rebooking ? value['recurrenceCount'] as int? : null,
      preferredProviderId: rebooking
          ? value['preferredProviderId'] as String?
          : null,
      problemDescription: value['problemDescription'] as String? ?? '',
      attachments: (value['attachments'] as List? ?? []).cast<String>(),
      voucherCode: value['voucherCode'] as String?,
      uniformQuantity: value['uniformQuantity'] as int? ?? 1,
    );
  }
}
