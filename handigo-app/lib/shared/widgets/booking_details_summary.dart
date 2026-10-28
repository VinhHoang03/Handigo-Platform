import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

class BookingDetailsSummary extends StatelessWidget {
  const BookingDetailsSummary({
    required this.address,
    this.contact,
    this.scheduledAt,
    this.placedAt,
    this.isPreview = false,
    this.compact = false,
    this.providerName,
    this.options = const [],
    this.quantity,
    super.key,
  });

  final String address;
  final String? contact, providerName;
  final DateTime? scheduledAt, placedAt;
  final bool isPreview, compact;
  final List<({String name, int quantity})> options;
  final int? quantity;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    String date(DateTime value) =>
        DateFormat('HH:mm · dd/MM/yyyy').format(value.toLocal());
    Widget field(IconData icon, String label, String value) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: theme.colorScheme.primary, size: 20),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 4),
                Text(value, style: theme.textTheme.bodyMedium),
              ],
            ),
          ),
        ],
      ),
    );
    Widget timeField(IconData icon, String label, DateTime value) => compact
        ? Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Icon(icon, color: theme.colorScheme.primary, size: 18),
                const SizedBox(width: 8),
                Expanded(
                  child: Text.rich(
                    TextSpan(
                      children: [
                        TextSpan(
                          text: '$label: ',
                          style: TextStyle(
                            color: theme.colorScheme.onSurfaceVariant,
                          ),
                        ),
                        TextSpan(
                          text: date(value),
                          style: const TextStyle(fontWeight: FontWeight.w500),
                        ),
                      ],
                    ),
                    style: theme.textTheme.bodyMedium,
                  ),
                ),
              ],
            ),
          )
        : field(icon, label, date(value));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (compact)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  Icons.location_on_outlined,
                  size: 20,
                  color: theme.colorScheme.primary,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(address, style: theme.textTheme.bodyMedium),
                ),
              ],
            ),
          )
        else
          field(
            Icons.location_on_outlined,
            'Địa chỉ thực hiện',
            [if (contact?.isNotEmpty == true) contact!, address].join('\n'),
          ),
        if (scheduledAt != null)
          timeField(Icons.calendar_month_outlined, 'Lịch hẹn', scheduledAt!),
        if (placedAt != null)
          timeField(
            Icons.access_time_rounded,
            isPreview ? 'Thời gian đặt dự kiến' : 'Thời gian đặt',
            placedAt!,
          ),
        if (providerName?.isNotEmpty == true)
          field(
            Icons.person_outline_rounded,
            isPreview ? 'Thợ đã chọn' : 'Thợ thực hiện',
            providerName!,
          ),
        if (options.isNotEmpty) ...[
          const Divider(height: 24),
          Text('Tùy chọn đã chọn', style: theme.textTheme.titleMedium),
          for (final option in options)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(child: Text(option.name)),
                  const SizedBox(width: 12),
                  Text(
                    '× ${option.quantity}',
                    style: theme.textTheme.bodyMedium,
                  ),
                ],
              ),
            ),
        ],
        if (quantity != null)
          field(Icons.numbers_rounded, 'Số lượng', '$quantity'),
      ],
    );
  }
}
