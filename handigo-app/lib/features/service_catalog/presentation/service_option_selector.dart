import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../booking/presentation/booking_provider.dart';
import '../../../shared/widgets/service_images.dart';
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
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                ],
              ),
              style: Theme.of(context).textTheme.titleSmall,
            ),
          ),
          for (final option in entry.value)
            _OptionCard(
              option: option,
              image: option.image ?? detail.service.coverImage,
              price: currency.format(option.price),
              selected: draft.selectedOptionIds.contains(option.id),
              quantity: draft.quantities[option.id] ?? 1,
              onSelect: () => controller.toggleOption(
                option.id,
                siblings: entry.value.map((item) => item.id),
                multiple: option.selectionMode != 'single',
              ),
              onQuantity: (value) => controller.setQuantity(option.id, value),
            ),
        ],
      ],
    );
  }
}

class _OptionCard extends StatelessWidget {
  const _OptionCard({
    required this.option,
    required this.image,
    required this.price,
    required this.selected,
    required this.quantity,
    required this.onSelect,
    required this.onQuantity,
  });

  final ServiceOption option;
  final String? image;
  final String price;
  final bool selected;
  final int quantity;
  final VoidCallback onSelect;
  final ValueChanged<int> onQuantity;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return Card(
      key: ValueKey('option-${option.id}'),
      clipBehavior: Clip.antiAlias,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(
          color: selected ? scheme.primary : scheme.outlineVariant,
          width: selected ? 2 : 1,
        ),
      ),
      child: Semantics(
        selected: selected,
        button: true,
        child: InkWell(
          onTap: onSelect,
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SizedBox(
                      width: 96,
                      child: ServiceCoverImage(
                        url: image,
                        name: option.name,
                        fit: BoxFit.cover,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(option.name, style: theme.textTheme.titleSmall),
                          if (option.description?.trim().isNotEmpty ==
                              true) ...[
                            const SizedBox(height: 4),
                            Text(
                              option.description!.trim(),
                              style: theme.textTheme.bodySmall,
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Expanded(
                      child: Text(
                        price,
                        key: ValueKey('option-price-${option.id}'),
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: scheme.primary,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    if (option.allowsQuantity) ...[
                      const SizedBox(width: 8),
                      _OptionQuantity(
                        id: option.id,
                        value: quantity,
                        enabled: selected,
                        onChanged: onQuantity,
                      ),
                    ],
                    const SizedBox(width: 4),
                    SizedBox.square(
                      key: ValueKey('option-selection-${option.id}'),
                      dimension: 48,
                      child: Center(
                        child: Icon(
                          option.selectionMode == 'single'
                              ? (selected
                                    ? Icons.radio_button_checked
                                    : Icons.radio_button_unchecked)
                              : (selected
                                    ? Icons.check_box
                                    : Icons.check_box_outline_blank),
                          color: selected
                              ? scheme.primary
                              : scheme.onSurfaceVariant,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _OptionQuantity extends StatelessWidget {
  const _OptionQuantity({
    required this.id,
    required this.value,
    required this.enabled,
    required this.onChanged,
  });

  final String id;
  final int value;
  final bool enabled;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final height = MediaQuery.textScalerOf(
      context,
    ).scale(24).clamp(48.0, double.infinity);
    return Container(
      key: ValueKey('option-quantity-$id'),
      decoration: BoxDecoration(
        border: Border.all(color: scheme.outlineVariant),
        borderRadius: BorderRadius.circular(10),
      ),
      clipBehavior: Clip.antiAlias,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          IconButton(
            tooltip: 'Giảm số lượng',
            onPressed: enabled && value > 1 ? () => onChanged(value - 1) : null,
            icon: const Icon(Icons.remove, size: 18),
            style: IconButton.styleFrom(
              foregroundColor: scheme.primary,
              minimumSize: Size(48, height),
              padding: EdgeInsets.zero,
              shape: const RoundedRectangleBorder(),
            ),
          ),
          Container(
            width: 40,
            height: height,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              border: Border.symmetric(
                vertical: BorderSide(color: scheme.outlineVariant),
              ),
            ),
            child: Text('$value', style: theme.textTheme.bodyMedium),
          ),
          IconButton(
            tooltip: 'Tăng số lượng',
            onPressed: enabled && value < 99
                ? () => onChanged(value + 1)
                : null,
            icon: const Icon(Icons.add, size: 18),
            style: IconButton.styleFrom(
              foregroundColor: scheme.primary,
              minimumSize: Size(48, height),
              padding: EdgeInsets.zero,
              shape: const RoundedRectangleBorder(),
            ),
          ),
        ],
      ),
    );
  }
}
