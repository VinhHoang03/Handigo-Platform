import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../service_catalog/presentation/service_catalog_provider.dart';
import '../../booking/domain/booking_models.dart';
import 'booking_provider.dart';

final bookingNearbyProviders = FutureProvider.autoDispose
    .family<List<Map<String, dynamic>>, String>(
      (ref, query) => ref
          .watch(serviceCatalogRepositoryProvider)
          .nearbyProviders(Map<String, dynamic>.from(jsonDecode(query) as Map)),
    );

String? bookingProviderQuery(BookingDraft draft) {
  if (draft.serviceId == null ||
      draft.addressId == null ||
      ([BookingType.scheduled, BookingType.recurring].contains(draft.type) &&
          draft.scheduledAt == null))
    return null;
  return jsonEncode({
    'serviceId': draft.serviceId,
    'addressId': draft.addressId,
    if ([BookingType.scheduled, BookingType.recurring].contains(draft.type))
      'scheduledAt': draft.scheduledAt!.toUtc().toIso8601String(),
    if (draft.type == BookingType.recurring)
      'recurrenceUnit': draft.recurrenceUnit,
    if (draft.type == BookingType.recurring)
      'recurrenceCount': draft.recurrenceCount,
    if (draft.selectedOptionIds.isNotEmpty)
      'selectedOptions': jsonEncode(
        draft.selectedOptionIds
            .map(
              (id) => {'optionId': id, 'quantity': draft.quantities[id] ?? 1},
            )
            .toList(),
      ),
  });
}

class BookingProviderSelector extends ConsumerWidget {
  const BookingProviderSelector({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final draft = ref.watch(bookingDraftProvider);
    final query = bookingProviderQuery(draft);
    if (query == null)
      return const Text(
        'Chọn địa chỉ và thời gian để kiểm tra chuyên gia phù hợp.',
      );
    return ref
        .watch(bookingNearbyProviders(query))
        .when(
          loading: () => const ListTile(
            leading: CircularProgressIndicator.adaptive(),
            title: Text('Đang kiểm tra chuyên gia...'),
          ),
          error: (_, stack) => OutlinedButton(
            onPressed: () => ref.invalidate(bookingNearbyProviders(query)),
            child: const Text('Thử lại kiểm tra chuyên gia'),
          ),
          data: (providers) => providers.isEmpty
              ? const Text(
                  'Chưa có chuyên gia phù hợp. Vui lòng đổi địa chỉ hoặc thời gian.',
                )
              : DropdownButtonFormField<String>(
                  key: ValueKey('$query-${draft.preferredProviderId}'),
                  initialValue:
                      providers.any(
                        (item) =>
                            '${item['id'] ?? item['providerId'] ?? item['_id']}' ==
                            draft.preferredProviderId,
                      )
                      ? draft.preferredProviderId
                      : '',
                  isExpanded: true,
                  decoration: const InputDecoration(
                    labelText: 'Chuyên gia thực hiện',
                  ),
                  items: [
                    const DropdownMenuItem(
                      value: '',
                      child: Text('Handigo tự điều phối'),
                    ),
                    ...providers.map(
                      (item) => DropdownMenuItem(
                        value:
                            '${item['id'] ?? item['providerId'] ?? item['_id']}',
                        child: Text(
                          '${(item['user'] is Map ? (item['user'] as Map)['fullName'] : null) ?? item['fullName'] ?? item['name'] ?? 'Chuyên gia'}',
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ),
                  ],
                  onChanged: (value) => ref
                      .read(bookingDraftProvider.notifier)
                      .setPreferredProvider(value == '' ? null : value),
                ),
        );
  }
}

bool isImmediateBookingAvailable(DateTime now) =>
    now.hour >= 8 && (now.hour < 21 || (now.hour == 21 && now.minute == 0));

String? bookingTimeError(BookingDraft draft, DateTime now) {
  if (draft.type == BookingType.normal)
    return !isImmediateBookingAvailable(now)
        ? 'Đặt ngay chỉ khả dụng từ 08:00 đến 21:00.'
        : null;
  final date = draft.scheduledAt;
  if (date == null) return 'Vui lòng chọn thời gian thực hiện.';
  if (date.isBefore(
        DateTime(now.year, now.month, now.day, now.hour, now.minute),
      ) ||
      date.hour < 8 ||
      date.hour > 21 ||
      (date.hour == 21 && date.minute > 0))
    return 'Chọn thời gian từ phút hiện tại, trong khoảng 08:00–21:00.';
  return null;
}
