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
  const OrderPaymentPanel({required this.order, super.key});
  final OrderDetail order;
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
    final payments = ref.watch(orderPaymentsProvider(widget.order.id));
    final order = widget.order;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Thanh toán', style: Theme.of(context).textTheme.titleMedium),
            Text(
              order.paymentMethod == 'cash' && order.paymentStatus == 'unpaid'
                  ? 'Thanh toán trực tiếp bằng tiền mặt'
                  : {
                          'paid': 'Đã thanh toán',
                          'partially_paid': 'Đã thanh toán một phần',
                          'refunded': 'Đã hoàn tiền',
                          'unpaid': 'Chưa thanh toán',
                        }[order.paymentStatus] ??
                        order.paymentStatus,
            ),
            if (order.inspectionRequired)
              Text('Tiền cọc đã áp dụng: ${_money(order.appliedDeposit)}'),
            if (order.paymentDueAt != null && order.paymentStatus == 'unpaid')
              Text(
                'Hạn thanh toán: ${DateFormat('HH:mm dd/MM/yyyy').format(order.paymentDueAt!.toLocal())}',
              ),
            if (error != null)
              Text(
                error!,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            if (order.canMakeInitialPayment)
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
            if (order.paymentMethod == 'bank' &&
                order.paymentStatus == 'unpaid')
              OutlinedButton(
                onPressed: busy ? null : checkPayment,
                child: const Text('Kiểm tra thanh toán PayOS'),
              ),
            for (final entry in const {
              'baseAmount': 'Giá gốc',
              'promotionDiscountAmount': 'Ưu đãi tự động',
              'voucherDiscountAmount': 'Giảm từ voucher',
            }.entries)
              if (order.pricing[entry.key] is num)
                Text(
                  '${entry.value}: ${_money((order.pricing[entry.key] as num).toDouble())}',
                ),
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
            payments.when(
              loading: () => const LinearProgressIndicator(),
              error: (_, stack) => TextButton(
                onPressed: () =>
                    ref.invalidate(orderPaymentsProvider(order.id)),
                child: const Text('Tải lại lịch sử thanh toán'),
              ),
              data: (items) => Column(
                children: [
                  for (final payment in items)
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(
                        _money((payment['amount'] as num? ?? 0).toDouble()),
                      ),
                      subtitle: Text(
                        '${payment['method']} · ${payment['status']}',
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

String _money(double value) => NumberFormat.currency(
  locale: 'vi_VN',
  symbol: 'đ',
  decimalDigits: 0,
).format(value);
