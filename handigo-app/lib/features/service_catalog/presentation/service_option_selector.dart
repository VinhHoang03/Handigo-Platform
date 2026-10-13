import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../booking/presentation/booking_provider.dart';
import '../domain/service_detail.dart';
import '../domain/service_option.dart';

class ServiceOptionSelector extends ConsumerWidget {
  const ServiceOptionSelector({super.key, required this.detail});
  final ServiceDetail detail;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final draft = ref.watch(bookingDraftProvider);
    final controller = ref.read(bookingDraftProvider.notifier);
    final groups = <String, List<ServiceOption>>{};
    for (final option in detail.options) {
      final key =
          option.groupId ??
          option.selectionGroup?.trim().toLowerCase() ??
          '__ungrouped__';
      groups.putIfAbsent(key, () => []).add(option);
    }
    final currency = NumberFormat.currency(
      locale: 'vi_VN',
      symbol: 'đ',
      decimalDigits: 0,
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final entry in groups.entries) ...[
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Text.rich(
              TextSpan(
                children: [
                  TextSpan(
                    text:
                        entry.value.first.selectionGroup ?? 'Tùy chọn bổ sung',
                  ),
                  if (entry.value.any((option) => option.isRequired))
                    const TextSpan(
                      text: ' *',
                      semanticsLabel: ' bắt buộc',
                      style: TextStyle(
                        color: Colors.red,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                ],
              ),
              style: Theme.of(context).textTheme.titleSmall,
            ),
          ),
          for (final option in entry.value)
            Card(
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: BorderSide(
                  color: draft.selectedOptionIds.contains(option.id)
                      ? Theme.of(context).colorScheme.primary
                      : Theme.of(context).colorScheme.outlineVariant,
                  width: draft.selectedOptionIds.contains(option.id) ? 2 : 1,
                ),
              ),
              child: Column(
                children: [
                  Semantics(
                    selected: draft.selectedOptionIds.contains(option.id),
                    button: true,
                    child: InkWell(
                      borderRadius: BorderRadius.circular(12),
                      onTap: () => controller.toggleOption(
                        option.id,
                        siblings: entry.value.map((item) => item.id),
                        multiple: option.selectionMode != 'single',
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(
                              option.selectionMode == 'single'
                                  ? (draft.selectedOptionIds.contains(option.id)
                                        ? Icons.radio_button_checked
                                        : Icons.radio_button_unchecked)
                                  : (draft.selectedOptionIds.contains(option.id)
                                        ? Icons.check_box
                                        : Icons.check_box_outline_blank),
                              color: draft.selectedOptionIds.contains(option.id)
                                  ? Theme.of(context).colorScheme.primary
                                  : null,
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    option.name,
                                    style: Theme.of(
                                      context,
                                    ).textTheme.titleSmall,
                                  ),
                                  if (option.description?.trim().isNotEmpty ==
                                      true) ...[
                                    const SizedBox(height: 6),
                                    Text(
                                      option.description!.trim(),
                                      style: Theme.of(
                                        context,
                                      ).textTheme.bodySmall,
                                    ),
                                  ],
                                  const SizedBox(height: 6),
                                  Text(
                                    currency.format(option.price),
                                    style: Theme.of(context)
                                        .textTheme
                                        .bodyMedium
                                        ?.copyWith(
                                          color: Theme.of(
                                            context,
                                          ).colorScheme.primary,
                                          fontWeight: FontWeight.w700,
                                        ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  if (option.allowsQuantity &&
                      draft.selectedOptionIds.contains(option.id))
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          const Text('Số lượng'),
                          IconButton(
                            tooltip: 'Giảm số lượng',
                            onPressed: (draft.quantities[option.id] ?? 1) > 1
                                ? () => controller.setQuantity(
                                    option.id,
                                    (draft.quantities[option.id] ?? 1) - 1,
                                  )
                                : null,
                            icon: const Icon(Icons.remove),
                          ),
                          Text('${draft.quantities[option.id] ?? 1}'),
                          IconButton(
                            tooltip: 'Tăng số lượng',
                            onPressed: (draft.quantities[option.id] ?? 1) < 99
                                ? () => controller.setQuantity(
                                    option.id,
                                    (draft.quantities[option.id] ?? 1) + 1,
                                  )
                                : null,
                            icon: const Icon(Icons.add),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
        ],
      ],
    );
  }
}
