import 'package:flutter/material.dart';

import '../../booking/domain/booking_models.dart';

class BookingAddressCard extends StatelessWidget {
  const BookingAddressCard({
    super.key,
    required this.address,
    required this.selected,
    this.action,
    this.onTap,
  });

  final Address address;
  final bool selected;
  final Widget? action;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final radius = BorderRadius.circular(14);
    return Semantics(
      selected: selected,
      child: Card(
        color: selected
            ? scheme.surfaceContainerLow
            : scheme.surfaceContainerLowest,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(borderRadius: radius),
        child: InkWell(
          onTap: onTap,
          borderRadius: radius,
          child: SizedBox(
            width: double.infinity,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Wrap(
                          spacing: 8,
                          runSpacing: 4,
                          crossAxisAlignment: WrapCrossAlignment.center,
                          children: [
                            Text(
                              address.recipientName,
                              style: theme.textTheme.titleSmall?.copyWith(
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            if (address.isDefault) ...[
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 8,
                                  vertical: 4,
                                ),
                                decoration: BoxDecoration(
                                  color: scheme.primaryFixed,
                                  borderRadius: BorderRadius.circular(99),
                                ),
                                child: Text(
                                  'Mặc định',
                                  style: theme.textTheme.labelSmall?.copyWith(
                                    color: scheme.onPrimaryFixed,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                      if (action != null) ...[
                        const SizedBox(width: 8),
                        action!,
                      ] else if (selected) ...[
                        const SizedBox(width: 8),
                        Icon(Icons.check_circle, color: scheme.primary),
                      ],
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    address.displayAddress,
                    style: theme.textTheme.bodySmall,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    address.recipientPhone,
                    style: theme.textTheme.bodySmall,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
