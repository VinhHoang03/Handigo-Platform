import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../core/network/api_exception.dart';
import '../domain/order_summary.dart';

/// Lý do hủy của khách hàng, đồng bộ với web (`bookingDetailConstants.ts`).
const customerCancellationReasons = [
  'Không còn nhu cầu sử dụng dịch vụ',
  'Đặt nhầm dịch vụ hoặc thông tin',
  'Thời gian thực hiện không còn phù hợp',
  'Chi phí không phù hợp',
  'Lý do khác',
];

const _otherReason = 'Lý do khác';

List<String> customerCancellationReasonsFor(OrderDetail order) =>
    customerCancellationReasons
        .where(
          (reason) =>
              (reason != 'Thời gian thực hiện không còn phù hợp' ||
                  order.orderType != 'normal') &&
              (reason != 'Chi phí không phù hợp' ||
                  !order.inspectionRequired ||
                  order.currentQuotationId != null),
        )
        .toList();

typedef CancelPreviewLoader = Future<CancellationPreview> Function();
typedef CancelSubmit =
    Future<void> Function(String reason, CancellationPreview preview);

/// Hiện bảng hủy đơn: chính sách hoàn tiền, lý do và xác nhận trong một màn.
/// Trả về `true` khi đã hủy thành công.
Future<bool?> showOrderCancelSheet(
  BuildContext context, {
  required OrderDetail order,
  required CancellationPreview preview,
  required CancelPreviewLoader reload,
  required CancelSubmit submit,
}) => showModalBottomSheet<bool>(
  context: context,
  isScrollControlled: true,
  useSafeArea: true,
  showDragHandle: true,
  backgroundColor: Colors.white,
  builder: (_) => _OrderCancelSheet(
    order: order,
    preview: preview,
    reload: reload,
    submit: submit,
  ),
);

String _money(double value) => NumberFormat.currency(
  locale: 'vi_VN',
  symbol: 'đ',
  decimalDigits: 0,
).format(value);

class _OrderCancelSheet extends StatefulWidget {
  const _OrderCancelSheet({
    required this.order,
    required this.preview,
    required this.reload,
    required this.submit,
  });
  final OrderDetail order;
  final CancellationPreview preview;
  final CancelPreviewLoader reload;
  final CancelSubmit submit;

  @override
  State<_OrderCancelSheet> createState() => _OrderCancelSheetState();
}

class _OrderCancelSheetState extends State<_OrderCancelSheet> {
  final _info = TextEditingController();
  late CancellationPreview _preview = widget.preview;
  late String? _error = widget.preview.canCancel
      ? null
      : widget.preview.blockedReason ?? 'Đã hết thời hạn hủy đơn.';
  String? _reason;
  bool _busy = false;
  Timer? _clock;

  bool get _series => _preview.isSeries;

  @override
  void initState() {
    super.initState();
    // Cập nhật mỗi giây để khóa nút ngay khi hết thời hạn hủy.
    _clock = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted && !_busy) setState(() {});
    });
  }

  @override
  void dispose() {
    _clock?.cancel();
    _info.dispose();
    super.dispose();
  }

  String get _lockedMessage {
    final order = widget.order;
    if (order.status == 'in_progress') {
      return 'Thợ đã bắt đầu làm việc, bạn không thể hủy đơn hàng.';
    }
    if (order.hasArrived) {
      return 'Thợ đã xác nhận đến nơi, bạn không thể hủy đơn hàng.';
    }
    return 'Đã hết thời hạn hủy kể từ khi thợ nhận đơn.';
  }

  Future<void> _confirm() async {
    if (_busy) return;
    if (!widget.order.canCancelAt(DateTime.now())) {
      setState(() => _error = _lockedMessage);
      return;
    }
    if (!_preview.canCancel) {
      setState(
        () => _error =
            'Vui lòng tải lại chính sách hoàn tiền trước khi xác nhận hủy.',
      );
      return;
    }
    final reason = _reason;
    final info = _info.text.trim();
    if (reason == null) {
      setState(() => _error = 'Vui lòng chọn lý do hủy đơn.');
      return;
    }
    if (reason == _otherReason && info.isEmpty) {
      setState(() => _error = 'Vui lòng nhập thông tin cho lý do khác.');
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.submit(info.isEmpty ? reason : '$reason: $info', _preview);
      if (mounted) Navigator.pop(context, true);
    } on ApiException catch (error) {
      var message = error.message;
      if (error.statusCode == 409) {
        try {
          final fresh = await widget.reload();
          if (!mounted) return;
          _preview = fresh;
          message = fresh.canCancel
              ? 'Thông tin hủy đơn đã thay đổi. Vui lòng xem số tiền vừa cập nhật và xác nhận lại nếu muốn tiếp tục hủy.'
              : 'Đơn không còn đủ điều kiện hủy. Vui lòng kiểm tra lại trạng thái đơn.';
        } catch (_) {
          message =
              'Không thể tải lại chính sách hoàn tiền. Vui lòng đóng và thử lại.';
        }
      }
      if (mounted) setState(() => _error = message);
    } catch (_) {
      if (mounted) {
        setState(
          () => _error = 'Không thể thực hiện thao tác. Vui lòng thử lại.',
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final order = widget.order;
    final canConfirm =
        !_busy && order.canCancelAt(DateTime.now()) && _preview.canCancel;
    return PopScope(
      canPop: !_busy,
      child: Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.viewInsetsOf(context).bottom,
        ),
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                _series ? 'Hủy các buổi còn lại' : 'Hủy yêu cầu',
                style: theme.textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                _series
                    ? 'Buổi đang xem và tất cả buổi phía sau còn có thể hủy sẽ được hủy. Khoản đã thanh toán của từng buổi được xử lý theo chính sách hiện tại.'
                    : 'Nhập lý do hủy yêu cầu. Thao tác này sẽ cập nhật trạng thái đơn hàng thành đã hủy.',
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: scheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 16),
              if (order.paymentMethod != 'cash') _PolicyCard(preview: _preview),
              if (order.inspectionRequired &&
                  order.providerId == null &&
                  _preview.providerCompensation == 0) ...[
                const SizedBox(height: 12),
                Text(
                  'Khi chưa có thợ nhận, toàn bộ tiền cọc đã thanh toán được hoàn lại cho bạn (100%).',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: scheme.onSurfaceVariant,
                    height: 1.5,
                  ),
                ),
              ],
              const SizedBox(height: 16),
              Text(
                'CHỌN LÝ DO HỦY',
                style: theme.textTheme.labelSmall?.copyWith(
                  fontWeight: FontWeight.w800,
                  color: scheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 8),
              for (final reason in customerCancellationReasonsFor(order))
                CancelReasonTile(
                  label: reason,
                  selected: _reason == reason,
                  enabled: !_busy,
                  onTap: () => setState(() {
                    _reason = reason;
                    _error = null;
                  }),
                ),
              const SizedBox(height: 12),
              TextField(
                controller: _info,
                enabled: !_busy,
                maxLength: 500,
                minLines: 3,
                maxLines: 4,
                onChanged: (_) {
                  if (_error != null) setState(() => _error = null);
                },
                decoration: InputDecoration(
                  filled: true,
                  fillColor: Colors.white,
                  labelText: _reason == _otherReason
                      ? 'Thông tin thêm *'
                      : 'Thông tin thêm',
                  hintText:
                      'Nhập thêm thông tin để chúng tôi hỗ trợ tốt hơn...',
                  alignLabelWithHint: true,
                ),
              ),
              if (_error != null) ...[
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 12,
                  ),
                  decoration: BoxDecoration(
                    color: scheme.error.withValues(alpha: 0.08),
                    border: Border.all(
                      color: scheme.error.withValues(alpha: 0.3),
                    ),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Text(
                    _error!,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: scheme.error,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: _busy ? null : () => Navigator.pop(context),
                      child: const Text('Đóng'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: FilledButton(
                      style: FilledButton.styleFrom(
                        backgroundColor: scheme.error,
                        foregroundColor: scheme.onError,
                      ),
                      onPressed: canConfirm ? _confirm : null,
                      child: Text(
                        _busy
                            ? 'Đang xử lý...'
                            : _series
                            ? 'Hủy các buổi còn lại'
                            : 'Hủy yêu cầu',
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class CancelReasonTile extends StatelessWidget {
  const CancelReasonTile({
    required this.label,
    required this.selected,
    required this.enabled,
    required this.onTap,
  });
  final String label;
  final bool selected, enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: selected
            ? scheme.error.withValues(alpha: 0.08)
            : Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(
            color: selected
                ? scheme.error.withValues(alpha: 0.3)
                : scheme.outlineVariant.withValues(alpha: 0.5),
          ),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: enabled ? onTap : null,
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  selected
                      ? Icons.radio_button_checked
                      : Icons.radio_button_unchecked,
                  size: 20,
                  color: selected ? scheme.error : scheme.onSurfaceVariant,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    label,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _PolicyCard extends StatelessWidget {
  const _PolicyCard({required this.preview});
  final CancellationPreview preview;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final rate = preview.singleRefundRate;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: scheme.primary.withValues(alpha: 0.3)),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Chính sách hoàn tiền',
                      style: theme.textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      preview.isSeries
                          ? '${preview.orderCount} buổi được tính riêng theo thời gian bắt đầu.'
                          : preview.policyReason ?? '',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: scheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: scheme.primary,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  rate == null ? 'Hoàn theo từng buổi' : 'Hoàn $rate%',
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: scheme.onPrimary,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          if (preview.paidAmount > 0)
            Row(
              children: [
                _Figure('Đã thanh toán', _money(preview.paidAmount), null),
                const SizedBox(width: 8),
                _Figure(
                  'Hoàn lại',
                  _money(preview.refundAmount),
                  scheme.primary,
                ),
                const SizedBox(width: 8),
                _Figure(
                  'Phí hủy',
                  _money(preview.cancellationFee),
                  scheme.error,
                ),
              ],
            )
          else
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                'Chưa ghi nhận khoản thanh toán trực tuyến cần hoàn cho đơn này.',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: scheme.onSurfaceVariant,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _Figure extends StatelessWidget {
  const _Figure(this.label, this.value, this.color);
  final String label, value;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: Colors.white,
          border: Border.all(
            color: theme.colorScheme.outlineVariant.withValues(alpha: 0.5),
          ),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          children: [
            Text(
              label,
              textAlign: TextAlign.center,
              style: theme.textTheme.labelSmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 4),
            FittedBox(
              child: Text(
                value,
                style: theme.textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w800,
                  color: color,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
