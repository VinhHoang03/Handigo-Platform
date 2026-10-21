import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../booking/domain/booking_models.dart';
import '../../booking/presentation/booking_provider.dart';
import 'booking_address_card.dart';

class BookingAddressSelector extends ConsumerWidget {
  const BookingAddressSelector({
    super.key,
    required this.addresses,
    required this.onAddAddress,
  });

  final List<Address> addresses;
  final VoidCallback onAddAddress;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (addresses.isEmpty) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Bạn chưa có địa chỉ.'),
          TextButton.icon(
            onPressed: onAddAddress,
            icon: const Icon(Icons.add),
            label: const Text('Thêm địa chỉ'),
          ),
        ],
      );
    }
    final addressId = ref.watch(
      bookingDraftProvider.select((draft) => draft.addressId),
    );
    final selected = addresses
        .where((address) => address.id == addressId)
        .firstOrNull;
    final theme = Theme.of(context);
    final changeButton = FilledButton(
      style: FilledButton.styleFrom(
        backgroundColor: theme.colorScheme.primary,
        foregroundColor: Colors.white,
        minimumSize: const Size(48, 32),
        padding: const EdgeInsets.symmetric(horizontal: 12),
        shape: const StadiumBorder(),
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
      ),
      onPressed: () => _selectAddress(context, ref, addressId),
      child: Text(selected == null ? 'Chọn địa chỉ' : 'Đổi'),
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (selected != null)
          BookingAddressCard(
            address: selected,
            selected: true,
            action: changeButton,
          ),
        if (selected == null) changeButton,
      ],
    );
  }

  Future<void> _selectAddress(
    BuildContext context,
    WidgetRef ref,
    String? addressId,
  ) async {
    var addingAddress = false;
    final id = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
        title: Row(
          children: [
            const Expanded(child: Text('Chọn địa chỉ')),
            IconButton.filled(
              tooltip: 'Thêm địa chỉ',
              icon: const Icon(Icons.add),
              onPressed: () {
                addingAddress = true;
                Navigator.of(context).pop();
              },
            ),
          ],
        ),
        contentPadding: const EdgeInsets.fromLTRB(12, 12, 12, 0),
        content: SizedBox(
          width: 440,
          child: ConstrainedBox(
            constraints: BoxConstraints(
              maxHeight: MediaQuery.sizeOf(context).height * .5,
            ),
            child: ListView.separated(
              shrinkWrap: true,
              itemCount: addresses.length,
              separatorBuilder: (_, _) => const SizedBox(height: 10),
              itemBuilder: (context, index) {
                final address = addresses[index];
                return BookingAddressCard(
                  address: address,
                  selected: address.id == addressId,
                  onTap: () => Navigator.of(context).pop(address.id),
                );
              },
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Đóng'),
          ),
        ],
      ),
    );
    if (!context.mounted) return;
    if (addingAddress) {
      onAddAddress();
      return;
    }
    if (id != null && context.mounted && id != addressId) {
      ref.read(bookingDraftProvider.notifier).setAddress(id);
    }
  }
}
