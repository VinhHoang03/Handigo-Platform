import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/network/api_exception.dart';
import '../../booking/domain/booking_models.dart';
import '../../service_catalog/presentation/service_catalog_provider.dart';
import '../domain/order_summary.dart';
import 'order_screens.dart';
import '../../../app/providers/app_providers.dart';
import '../../booking/data/pending_booking_store.dart';

final orderPaymentsProvider = FutureProvider.autoDispose
    .family<List<Map<String, dynamic>>, String>(
      (ref, id) => ref.watch(orderRepositoryProvider).payments(id),
    );

class OrderPaymentPanel extends ConsumerStatefulWidget {
  const OrderPaymentPanel({required this.order, this.quotation, super.key});
  final OrderDetail order;
  final RepairQuotation? quotation;
  @override
  ConsumerState<OrderPaymentPanel> createState() => _OrderPaymentPanelState();
}

class _OrderPaymentPanelState extends ConsumerState<OrderPaymentPanel>
    with WidgetsBindingObserver {
  bool busy = false;
  String? error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    Future.microtask(_recover);
  }

  Future<void> _recover() async {
    try {
      final order = widget.order;
      final userId = ref.read(authControllerProvider).user?.id;
      if (userId != null &&
          (order.paymentStatus != 'unpaid' ||
              order.depositPaidAt != null ||
              ['completed', 'cancelled'].contains(order.status) ||
              order.paymentMethod == 'cash')) {
        final pending = await const PendingBookingStore().read(userId);
        if (pending == order.id) {
          await const PendingBookingStore().clear(userId);
          if (mounted) ref.invalidate(pendingOrderProvider);
        }
      }
    } catch (_) {
      /* Mở đơn và thanh toán vẫn dùng được khi lưu trữ thiết bị chưa sẵn sàng. */
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      if (widget.order.paymentMethod == 'bank' &&
          widget.order.paymentStatus == 'unpaid') {
        checkPayment();
      } else {
        refresh();
      }
    }
  }

  Future<void> pay() async {
    if (busy) return;
    setState(() => busy = true);
    final methods = PaymentMethod.values
        .where(
          (method) =>
              !widget.order.inspectionRequired || method != PaymentMethod.cash,
        )
        .toList();
    final method = await showModalBottomSheet<PaymentMethod>(
      useRootNavigator: true,
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const ListTile(title: Text('Chọn phương thức thanh toán')),
            for (final method in methods)
              ListTile(
                title: Text(
                  {
                    'wallet': 'Ví Handigo',
                    'bank': 'PayOS',
                    'cash': 'Tiền mặt',
                  }[method.name]!,
                ),
                onTap: () => Navigator.pop(context, method),
              ),
          ],
        ),
      ),
    );
    if (method == null || !mounted) {
      if (mounted) setState(() => busy = false);
      return;
    }
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final repository = ref.read(serviceCatalogRepositoryProvider);
      if (widget.order.paymentMethod == 'bank')
        await repository.reconcilePayment(widget.order.id);
      final latest = await ref
          .read(orderRepositoryProvider)
          .detail(widget.order.id);
      if (latest.paymentStatus == 'paid' ||
          latest.depositPaidAt != null ||
          !latest.canMakeInitialPayment) {
        refresh();
        return;
      }
      final result = await repository.createPayment(
        orderId: latest.id,
        method: method,
        inspectionRequired: latest.inspectionRequired,
        expectedAmount: widget.order.totalAmount,
      );
      refresh();
      if (result.checkoutUrl != null && result.status != 'paid') {
        final uri = Uri.parse(result.checkoutUrl!);
        if (!['https', 'http'].contains(uri.scheme) ||
            !await launchUrl(uri, mode: LaunchMode.externalApplication))
          throw const ApiException(
            'Chưa thể mở trang thanh toán. Vui lòng thử lại.',
          );
      }
    } catch (failure) {
      if (mounted)
        setState(
          () => error = failure is ApiException
              ? failure.message
              : 'Chưa thể thanh toán. Vui lòng kiểm tra lại đơn trước khi thử lại.',
        );
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> editVoucher({bool remove = false}) async {
    if (busy) return;
    setState(() => busy = true);
    final input = TextEditingController();
    final code = remove
        ? ''
        : await showDialog<String>(
            context: context,
            builder: (context) => AlertDialog(
              title: const Text('Áp dụng mã ưu đãi'),
              content: TextField(
                controller: input,
                maxLength: 50,
                textCapitalization: TextCapitalization.characters,
                decoration: const InputDecoration(labelText: 'Mã voucher'),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Quay lại'),
                ),
                FilledButton(
                  onPressed: () {
                    if (input.text.trim().isNotEmpty)
                      Navigator.pop(context, input.text.trim());
                  },
                  child: const Text('Áp dụng'),
                ),
              ],
            ),
          );
    input.dispose();
    if (code == null || !mounted) {
      if (mounted) setState(() => busy = false);
      return;
    }
    try {
      final repository = ref.read(serviceCatalogRepositoryProvider);
      if (remove)
        await repository.removeVoucher(widget.order.id);
      else
        await repository.applyVoucher(orderId: widget.order.id, code: code);
      refresh();
    } catch (failure) {
      if (mounted)
        setState(
          () => error = failure is ApiException
              ? failure.message
              : 'Chưa thể cập nhật voucher.',
        );
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  void refresh() {
    ref.invalidate(orderDetailProvider(widget.order.id));
    ref.invalidate(orderPaymentsProvider(widget.order.id));
    ref.invalidate(orderListProvider);
    ref.invalidate(orderPageProvider);
  }

  Future<void> checkPayment() async {
    if (busy) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await ref
          .read(serviceCatalogRepositoryProvider)
          .reconcilePayment(widget.order.id);
      refresh();
    } catch (failure) {
      if (mounted)
        setState(
          () => error = failure is ApiException
              ? failure.message
              : 'Chưa thể kiểm tra thanh toán.',
        );
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final order = widget.order;
    final theme = Theme.of(context);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            OrderPaymentHeader(order: order),
            const SizedBox(height: 12),
            OrderPaymentSummary(order: order, quotation: widget.quotation),
            if (order.paymentDueAt != null && order.paymentStatus == 'unpaid')
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(
                  'Hạn thanh toán: ${DateFormat('HH:mm dd/MM/yyyy').format(order.paymentDueAt!.toLocal())}',
                  style: theme.textTheme.bodySmall,
                ),
              ),
            if (error != null)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(
                  error!,
                  style: TextStyle(color: theme.colorScheme.error),
                ),
              ),
            if (order.canMakeInitialPayment) ...[
              const SizedBox(height: 8),
              FilledButton(
                onPressed: busy ? null : pay,
                child: Text(
                  busy
                      ? 'Đang xử lý...'
                      : order.inspectionRequired
                      ? 'Thanh toán tiền cọc'
                      : 'Thanh toán / đổi phương thức',
                ),
              ),
            ],
            if (order.paymentMethod == 'bank' &&
                order.paymentStatus == 'unpaid') ...[
              const SizedBox(height: 8),
              OutlinedButton(
                onPressed: busy ? null : checkPayment,
                child: const Text('Kiểm tra thanh toán PayOS'),
              ),
            ],
            if (order.status == 'created' && order.paymentStatus == 'unpaid')
              Wrap(
                spacing: 8,
                children: [
                  TextButton(
                    onPressed: busy ? null : editVoucher,
                    child: const Text('Áp dụng voucher'),
                  ),
                  if ((order.pricing['voucherDiscountAmount'] as num? ?? 0) > 0)
                    TextButton(
                      onPressed: busy ? null : () => editVoucher(remove: true),
                      child: const Text('Gỡ voucher'),
                    ),
                ],
              ),
          ],
        ),
      ),
    );
  }
}

class OrderPaymentHeader extends StatelessWidget {
  const OrderPaymentHeader({required this.order, super.key});
  final OrderDetail order;
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Expanded(child: Text('Thanh toán', style: theme.textTheme.titleMedium)),
        const SizedBox(width: 8),
        Flexible(
          flex: 2,
          child: Align(
            alignment: Alignment.centerRight,
            child: OrderStatusBadge(
              trailingIcon: switch (order.paymentMethod) {
                'wallet' => Icons.account_balance_wallet_outlined,
                'bank' => Icons.account_balance_outlined,
                'cash' => Icons.payments_outlined,
                _ => null,
              },
              label: _paymentStatusWithMethod(
                order.paymentStatus,
                order.paymentMethod,
              ),
              color: _paymentStatusColor(theme, order.paymentStatus),
            ),
          ),
        ),
      ],
    );
  }
}

class OrderPaymentSummary extends StatelessWidget {
  const OrderPaymentSummary({
    required this.order,
    this.quotation,
    this.providerView = false,
    super.key,
  });
  final bool providerView;

  final OrderDetail order;
  final RepairQuotation? quotation;

  @override
  Widget build(BuildContext context) {
    final voucher = (order.pricing['voucherDiscountAmount'] as num?) ?? 0;
    final baseAmount = order.pricing['baseAmount'] as num?;
    final paidDeposit = quotation?.paidDeposit ?? order.appliedDeposit;
    final amountDue =
        providerView && quotation?.directPaymentConfirmedAt != null
        ? 0
        : quotation?.remainingDirectPaymentAmount ??
              (quotation == null
                  ? order.paymentStatus == 'paid'
                        ? 0
                        : order.totalAmount
                  : (quotation!.finalAmount - paidDeposit).clamp(
                      0,
                      double.infinity,
                    ));
    final showAmountDue =
        amountDue != null &&
        (!providerView || !order.inspectionRequired || quotation != null) &&
        !['cancelled'].contains(order.status) &&
        !['refunded', 'partially_refunded'].contains(order.paymentStatus);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (order.selectedOptions.isNotEmpty)
          for (final option in order.selectedOptions)
            _itemLine(
              '${option['name'] ?? order.serviceName}',
              option['price'] as num? ?? 0,
              (option['quantity'] as num?)?.toInt() ?? 1,
              option['subtotal'] as num?,
            )
        else if (baseAmount != null)
          _itemLine(order.serviceName, baseAmount, 1, baseAmount),
        if (voucher > 0)
          _PaymentLine(
            label: 'Voucher',
            value: '−${_money(voucher.toDouble())}',
          ),
        if (order.inspectionRequired && paidDeposit > 0)
          _PaymentLine(label: 'Đã thanh toán cọc', value: _money(paidDeposit)),
        if (providerView &&
            order.inspectionRequired &&
            quotation == null &&
            order.status != 'cancelled')
          const _PaymentLine(
            label: 'Số tiền cuối cần thu',
            value: 'Chờ báo giá',
          ),
        if (showAmountDue) ...[
          const Divider(height: 20),
          _PaymentLine(
            label: providerView
                ? 'Số tiền cuối cần thu'
                : 'Số tiền cần thanh toán',
            value: _money(amountDue.toDouble()),
            emphasized: true,
          ),
        ],
      ],
    );
  }

  Widget _itemLine(String name, num price, int quantity, num? subtotal) =>
      _PaymentLine(
        label: '$name ${_money(price.toDouble())} × $quantity',
        value: _money((subtotal ?? price * quantity).toDouble()),
      );
}

class _PaymentLine extends StatelessWidget {
  const _PaymentLine({
    required this.label,
    required this.value,
    this.emphasized = false,
  });

  final String label;
  final String value;
  final bool emphasized;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final style = emphasized
        ? theme.textTheme.titleSmall?.copyWith(
            color: theme.colorScheme.primary,
            fontWeight: FontWeight.w600,
          )
        : theme.textTheme.bodyMedium;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(flex: 3, child: Text(label, style: style)),
          const SizedBox(width: 12),
          Expanded(
            flex: 2,
            child: Text(value, textAlign: TextAlign.right, style: style),
          ),
        ],
      ),
    );
  }
}

String _paymentStatusWithMethod(String status, String method) {
  final label = switch (method) {
    'wallet' => 'Ví Handigo',
    'bank' => 'PayOS',
    'cash' => 'Tiền mặt',
    _ => method,
  };
  final state = _paymentStatusLabel(status);
  if (label.isEmpty) return state;
  final separator =
      [
        'paid',
        'partially_paid',
        'refunded',
        'partially_refunded',
      ].contains(status)
      ? ' qua '
      : ' · ';
  return '$state$separator$label';
}

String _paymentStatusLabel(String status) => switch (status) {
  'paid' => 'Đã thanh toán',
  'partially_paid' => 'Đã thanh toán một phần',
  'refunded' => 'Đã hoàn tiền',
  'partially_refunded' => 'Đã hoàn tiền một phần',
  'failed' => 'Thanh toán thất bại',
  _ => 'Chưa thanh toán',
};

Color _paymentStatusColor(ThemeData theme, String status) => switch (status) {
  'paid' => theme.colorScheme.secondary,
  'refunded' || 'partially_refunded' => theme.colorScheme.secondary,
  'failed' => theme.colorScheme.error,
  _ => theme.colorScheme.tertiary,
};

String _money(double value) =>
    '${NumberFormat.decimalPattern('vi_VN').format(value)}đ';
