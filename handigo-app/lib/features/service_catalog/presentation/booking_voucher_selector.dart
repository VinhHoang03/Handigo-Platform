import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../shared/widgets/app_states.dart';
import '../../account/domain/account_models.dart';
import '../../account/presentation/account_screens.dart';
import '../../booking/presentation/booking_provider.dart';

class BookingVoucherSelector extends ConsumerStatefulWidget {
  const BookingVoucherSelector({
    super.key,
    required this.controller,
    required this.inspectionRequired,
  });

  final TextEditingController controller;
  final bool inspectionRequired;

  @override
  ConsumerState<BookingVoucherSelector> createState() =>
      _BookingVoucherSelectorState();
}

class _BookingVoucherSelectorState
    extends ConsumerState<BookingVoucherSelector> {
  bool _expanded = false;

  void _select(String code) {
    widget.controller.value = TextEditingValue(
      text: code,
      selection: TextSelection.collapsed(offset: code.length),
    );
    ref.read(bookingDraftProvider.notifier).setVoucherCode(code);
    setState(() => _expanded = false);
  }

  String _description(VoucherItem item) {
    final number = NumberFormat.decimalPattern('vi');
    final discount = item.discountType == 'PERCENT'
        ? 'Giảm ${number.format(item.discountValue)}%'
        : 'Giảm ${number.format(item.discountValue)}đ';
    return item.minOrderAmount > 0
        ? '$discount · Đơn từ ${number.format(item.minOrderAmount)}đ'
        : discount;
  }

  @override
  Widget build(BuildContext context) {
    final vouchers = _expanded ? ref.watch(accountVouchersProvider) : null;
    final selectedCode = ref.watch(
      bookingDraftProvider.select((draft) => draft.voucherCode),
    );
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TextField(
          controller: widget.controller,
          textCapitalization: TextCapitalization.characters,
          onChanged: ref.read(bookingDraftProvider.notifier).setVoucherCode,
          decoration: InputDecoration(
            labelText: 'Mã voucher (không bắt buộc)',
            prefixIcon: const Icon(Icons.discount_outlined),
            suffixIcon: IconButton(
              tooltip: _expanded ? 'Đóng danh sách voucher' : 'Chọn voucher',
              onPressed: () {
                FocusScope.of(context).unfocus();
                setState(() => _expanded = !_expanded);
              },
              icon: Icon(_expanded ? Icons.expand_less : Icons.expand_more),
            ),
          ),
        ),
        if (vouchers != null) ...[
          const SizedBox(height: 8),
          Container(
            width: double.infinity,
            constraints: BoxConstraints(
              maxHeight: MediaQuery.sizeOf(context).height * .35,
            ),
            clipBehavior: Clip.antiAlias,
            decoration: BoxDecoration(
              color: theme.colorScheme.surface,
              border: Border.all(color: theme.colorScheme.outlineVariant),
              borderRadius: BorderRadius.circular(12),
            ),
            child: vouchers.when(
              loading: () => const Padding(
                padding: EdgeInsets.all(16),
                child: AppLoading(),
              ),
              error: (_, _) => AppMessage(
                message: 'Không thể tải voucher.',
                onRetry: () => ref.invalidate(accountVouchersProvider),
              ),
              data: (items) {
                final applicableType = widget.inspectionRequired
                    ? 'variable_price'
                    : 'fixed_price';
                final available = items
                    .where(
                      (item) =>
                          item.code.trim().isNotEmpty &&
                          (item.applicableOrderType == null ||
                              item.applicableOrderType == applicableType),
                    )
                    .toList();
                return ListView.separated(
                  shrinkWrap: true,
                  itemCount: available.length + 1,
                  separatorBuilder: (_, _) => const Divider(height: 1),
                  itemBuilder: (context, index) {
                    if (index == 0) {
                      return Column(
                        children: [
                          ListTile(
                            title: const Text('Không sử dụng voucher'),
                            onTap: () => _select(''),
                          ),
                          if (available.isEmpty)
                            const Padding(
                              padding: EdgeInsets.all(16),
                              child: Text(
                                'Bạn chưa có voucher khả dụng cho dịch vụ này.',
                              ),
                            ),
                        ],
                      );
                    }
                    final voucher = available[index - 1];
                    return ListTile(
                      selected: selectedCode == voucher.code.toUpperCase(),
                      title: Text('${voucher.code} · ${voucher.name}'),
                      subtitle: Text(_description(voucher)),
                      trailing: selectedCode == voucher.code.toUpperCase()
                          ? Icon(
                              Icons.check_circle,
                              color: theme.colorScheme.primary,
                            )
                          : null,
                      onTap: () => _select(voucher.code),
                    );
                  },
                );
              },
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Điều kiện voucher sẽ được kiểm tra khi xác nhận đơn.',
            style: theme.textTheme.bodySmall,
          ),
        ],
      ],
    );
  }
}
