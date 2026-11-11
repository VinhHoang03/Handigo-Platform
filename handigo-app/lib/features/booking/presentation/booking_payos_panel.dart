import 'dart:async';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../app/providers/app_providers.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/network/realtime_connection.dart';
import '../../orders/presentation/order_screens.dart';
import '../../service_catalog/presentation/service_catalog_provider.dart';
import '../data/pending_booking_store.dart';
import '../../../shared/widgets/payos_qr_preview.dart';

class BookingPayosPanel extends ConsumerStatefulWidget {
  const BookingPayosPanel({
    required this.orderId,
    this.onPaid,
    this.onReady,
    super.key,
  });

  final String orderId;
  final VoidCallback? onPaid;
  final VoidCallback? onReady;

  @override
  ConsumerState<BookingPayosPanel> createState() => _BookingPayosPanelState();
}

class _BookingPayosPanelState extends ConsumerState<BookingPayosPanel>
    with WidgetsBindingObserver {
  StreamSubscription<dynamic>? _events;
  Timer? _timer;
  Uint8List? _qr;
  String? _paymentId, _error;
  double? _amount;
  DateTime? _dueAt;
  bool _busy = false, _active = true, _terminal = false, _paid = false;
  String _message = 'Đang tải thông tin thanh toán…';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    ref.listenManual(realtimeConnectionProvider, (_, connection) {
      unawaited(_events?.cancel());
      _events = connection?.events.listen((event) {
        final data = event.data;
        if (event.name == 'connect' ||
            (['payment:status', 'order:updated'].contains(event.name) &&
                data is Map &&
                data['orderId'] == widget.orderId)) {
          unawaited(_refresh());
        }
      });
    }, fireImmediately: true);
    _timer = Timer.periodic(const Duration(seconds: 5), (_) {
      if (_active && !_terminal) unawaited(_refresh(reconcile: true));
    });
    unawaited(_refresh());
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _active = state == AppLifecycleState.resumed;
    if (_active && !_paid) unawaited(_refresh(reconcile: true));
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _timer?.cancel();
    unawaited(_events?.cancel());
    super.dispose();
  }

  Future<void> _refresh({bool reconcile = false}) async {
    if (_busy || !mounted || _paid) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final repository = ref.read(serviceCatalogRepositoryProvider);
      if (reconcile) await repository.reconcilePayment(widget.orderId);
      final orders = ref.read(orderRepositoryProvider);
      final order = await orders.detail(widget.orderId);
      final payments = await orders.payments(widget.orderId);
      if (!mounted) return;
      final paid = payments.any(
        (payment) =>
            payment['method'] == 'payos' &&
            payment['isDeleted'] != true &&
            payment['status'] == 'paid' &&
            ['full', 'inspection_deposit'].contains(payment['paymentType']),
      );
      final pending = payments
          .where(
            (payment) =>
                payment['method'] == 'payos' &&
                payment['isDeleted'] != true &&
                payment['status'] == 'pending' &&
                ['full', 'inspection_deposit'].contains(payment['paymentType']),
          )
          .firstOrNull;
      _dueAt = order.paymentDueAt;
      final expired = _dueAt != null && !_dueAt!.isAfter(DateTime.now());
      _terminal =
          paid || order.status == 'cancelled' || expired || pending == null;
      if (_terminal) {
        _qr = null;
        _message = order.status == 'cancelled'
            ? 'Đơn hàng đã hủy. Vui lòng xem chi tiết đơn để kiểm tra giao dịch.'
            : paid
            ? 'Đã xác nhận thanh toán thành công.'
            : expired
            ? 'Đã hết thời gian thanh toán. Vui lòng kiểm tra lại đơn hàng.'
            : 'Giao dịch không còn chờ thanh toán. Vui lòng kiểm tra lại đơn hàng.';
        if (paid && order.status != 'cancelled') {
          try {
            final userId = ref.read(authControllerProvider).user?.id;
            if (userId != null &&
                await const PendingBookingStore().read(userId) ==
                    widget.orderId) {
              await const PendingBookingStore().clear(userId);
            }
          } catch (_) {
            // Kết quả thanh toán đã được backend xác nhận độc lập với lưu trữ thiết bị.
          }
          if (!mounted) return;
          _paid = true;
          ref.invalidate(pendingOrderProvider);
          ref.invalidate(orderListProvider);
          ref.invalidate(orderPageProvider);
          ref.invalidate(orderDetailProvider(widget.orderId));
          widget.onPaid?.call();
        }
      } else {
        final id = (pending!['_id'] ?? pending['id']) as String?;
        final amount = (pending['amount'] as num?)?.toDouble();
        if (id == null || amount == null || amount <= 0) {
          throw const ApiException(
            'Thông tin giao dịch chưa hợp lệ. Vui lòng kiểm tra lại.',
          );
        }
        _amount = amount;
        _message = 'Quét mã để thanh toán qua ứng dụng ngân hàng';
        if (_paymentId != id || _qr == null) {
          final bytes = await repository.paymentQr(id);
          if (!mounted) return;
          _paymentId = id;
          _qr = bytes;
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) widget.onReady?.call();
          });
        }
      }
    } catch (error) {
      if (mounted) {
        _qr = null;
        _error = error is ApiException
            ? error.message
            : 'Chưa thể tải thanh toán. Vui lòng thử lại.';
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      color: theme.colorScheme.surfaceContainerLowest,
      surfaceTintColor: Colors.transparent,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Icon(Icons.qr_code_rounded, color: theme.colorScheme.primary),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Thanh toán PayOS',
                    style: theme.textTheme.titleMedium,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            if (_amount != null && !_terminal)
              Text(
                '${NumberFormat.decimalPattern('vi').format(_amount)} đ',
                textAlign: TextAlign.center,
                style: theme.textTheme.headlineSmall?.copyWith(
                  color: theme.colorScheme.primary,
                ),
              ),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (_paid) ...[
                  Icon(
                    Icons.check_circle_rounded,
                    color: theme.colorScheme.secondary,
                  ),
                  const SizedBox(width: 8),
                ],
                Flexible(child: Text(_message, textAlign: TextAlign.center)),
              ],
            ),
            if (_qr != null && _error == null && !_terminal) ...[
              const SizedBox(height: 12),
              PayosQrPreview(bytes: _qr!),
            ],
            if (_dueAt != null && !_terminal)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(
                  'Hạn thanh toán ${DateFormat('HH:mm · dd/MM/yyyy').format(_dueAt!.toLocal())}',
                  textAlign: TextAlign.center,
                  style: theme.textTheme.bodySmall,
                ),
              ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(
                  _error!,
                  style: TextStyle(color: theme.colorScheme.error),
                ),
              ),
            if (_busy) ...[
              const SizedBox(height: 12),
              const LinearProgressIndicator(),
            ],
            if (!_paid) ...[
              const SizedBox(height: 12),
              OutlinedButton.icon(
                onPressed: _busy ? null : () => _refresh(reconcile: true),
                icon: const Icon(Icons.refresh_rounded),
                label: const Text('Kiểm tra thanh toán'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
