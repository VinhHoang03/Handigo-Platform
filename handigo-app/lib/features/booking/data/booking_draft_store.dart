import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../domain/booking_models.dart';
import '../presentation/booking_provider.dart';

class BookingDraftStore {
  const BookingDraftStore();
  static const _storage = FlutterSecureStorage();
  String _key(String id) => 'handigo_booking_draft_$id';
  Future<void> clear(String id) => _storage.delete(key: _key(id));
  Future<void> save(String id, BookingDraft draft) => _storage.write(
    key: _key(id),
    value: jsonEncode({
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
    }),
  );
  Future<BookingDraft?> read(String id) async {
    final raw = await _storage.read(key: _key(id));
    if (raw == null) return null;
    final value = jsonDecode(raw) as Map<String, dynamic>;
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
      type: hasSchedule ? BookingType.scheduled : BookingType.normal,
      paymentMethod: PaymentMethod.values.byName(
        value['paymentMethod'] as String,
      ),
      scheduledAt: hasSchedule ? scheduledAt : null,
      problemDescription: value['problemDescription'] as String? ?? '',
      attachments: (value['attachments'] as List? ?? []).cast<String>(),
      voucherCode: value['voucherCode'] as String?,
      uniformQuantity: value['uniformQuantity'] as int? ?? 1,
    );
  }
}
