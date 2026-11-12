import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/network/api_exception.dart';
import '../../../shared/widgets/app_feedback.dart';
import '../domain/order_reschedule.dart';
import '../domain/order_summary.dart';
import 'order_screens.dart';

const _vietnamOffset = Duration(hours: 7);

String _formatTime(DateTime? time) => time == null
    ? 'Chưa xác định'
    : DateFormat('HH:mm · dd/MM/yyyy').format(time.toUtc().add(_vietnamOffset));

String _message(Object error) => error is ApiException
    ? error.message
    : 'Chưa thể cập nhật lịch hẹn. Vui lòng thử lại.';

class OrderReschedulePanel extends ConsumerStatefulWidget {
  const OrderReschedulePanel({required this.order, super.key});

  final OrderDetail order;

  @override
  ConsumerState<OrderReschedulePanel> createState() =>
      _OrderReschedulePanelState();
}

class _OrderReschedulePanelState extends ConsumerState<OrderReschedulePanel> {
  bool _busy = false;
  String? _error;

  void _refresh() {
    ref.invalidate(orderDetailProvider(widget.order.id));
    ref.invalidate(orderListProvider);
    ref.invalidate(orderPageProvider);
  }

  Future<void> _openRequest(OrderRescheduleEligibility eligibility) async {
    final message = await showDialog<String>(
      context: context,
      barrierDismissible: false,
      builder: (_) =>
          _RescheduleDialog(order: widget.order, eligibility: eligibility),
    );
    if (message == null || !mounted) return;
    _refresh();
    AppToast.show(context, message, type: AppToastType.success);
  }

  Future<void> _updateRequest(
    OrderRescheduleRequest request, {
    bool? accept,
  }) async {
    if (_busy) return;
    final reason = accept == false
        ? await showDialog<String>(
            context: context,
            builder: (_) => const _RejectDialog(),
          )
        : null;
    if (!mounted || (accept == false && reason == null)) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final repository = ref.read(orderRepositoryProvider);
      if (accept == null) {
        await repository.withdrawReschedule(widget.order.id, request.id);
      } else {
        await repository.respondReschedule(
          widget.order,
          request.id,
          accept: accept,
          reason: reason,
        );
      }
      if (!mounted) return;
      _refresh();
      AppToast.show(context, switch (accept) {
        true => 'Đã đồng ý lịch hẹn mới.',
        false => 'Đã từ chối đề nghị dời lịch.',
        null => 'Đã thu hồi yêu cầu dời lịch.',
      }, type: AppToastType.success);
    } catch (error) {
      if (mounted) setState(() => _error = _message(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final order = widget.order;
    final eligibility = order.rescheduleEligibility;
    if (order.orderType != 'scheduled' || eligibility == null) {
      return const SizedBox.shrink();
    }
    final request = order.latestRescheduleRequest;
    final pending = request?.status == 'pending' ? request : null;
    final isExpired = pending?.expiresAt?.isAfter(DateTime.now()) == false;
    final initiatedByCustomer = pending?.initiatorRole == 'customer';
    final canRespond =
        !initiatedByCustomer && pending?.approvalRole == 'customer';
    final scheme = Theme.of(context).colorScheme;
    final cutoff = order.scheduledAt?.subtract(
      Duration(minutes: eligibility.minAdvanceMinutes),
    );
    final canRequest =
        eligibility.canRequest &&
        pending == null &&
        cutoff != null &&
        cutoff.isAfter(DateTime.now());
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Icon(Icons.event_repeat_outlined, color: scheme.primary),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Dời lịch hẹn',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            if (pending != null) ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: scheme.surfaceContainerLow,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      initiatedByCustomer
                          ? 'Đang chờ thợ phản hồi'
                          : 'Thợ đề nghị dời lịch',
                      style: Theme.of(context).textTheme.titleSmall,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Lịch hiện tại: ${_formatTime(pending.oldScheduledAt ?? order.scheduledAt)}',
                    ),
                    Text(
                      'Lịch đề xuất: ${_formatTime(pending.proposedScheduledAt)}',
                    ),
                    if (pending.reason?.isNotEmpty == true)
                      Text('Lý do: ${pending.reason}'),
                    if (pending.expiresAt != null)
                      Text('Phản hồi trước ${_formatTime(pending.expiresAt)}.'),
                  ],
                ),
              ),
              if (initiatedByCustomer || canRespond || isExpired)
                const SizedBox(height: 12),
              if (isExpired)
                OutlinedButton(
                  onPressed: _refresh,
                  child: const Text('Tải lại yêu cầu đã hết hạn'),
                ),
              if (initiatedByCustomer && !isExpired)
                OutlinedButton(
                  onPressed: _busy ? null : () => _updateRequest(pending),
                  child: const Text('Thu hồi yêu cầu'),
                ),
              if (canRespond && !isExpired) ...[
                FilledButton(
                  onPressed: _busy
                      ? null
                      : () => _updateRequest(pending, accept: true),
                  child: const Text('Đồng ý lịch mới'),
                ),
                TextButton(
                  onPressed: _busy
                      ? null
                      : () => _updateRequest(pending, accept: false),
                  child: const Text('Từ chối'),
                ),
              ],
            ] else ...[
              if (request != null)
                Text(switch (request.status) {
                  'applied' => 'Lịch hẹn đã được cập nhật.',
                  'rejected' => 'Đề nghị dời lịch gần nhất đã bị từ chối.',
                  'expired' => 'Đề nghị dời lịch gần nhất đã hết hạn.',
                  'cancelled' => 'Đề nghị dời lịch gần nhất đã được thu hồi.',
                  _ => 'Lịch hẹn hiện tại: ${_formatTime(order.scheduledAt)}',
                }),
              Text(
                canRequest
                    ? 'Bạn còn ${eligibility.remainingCount} lượt dời lịch. Vui lòng báo trước ít nhất ${eligibility.minAdvanceMinutes} phút.'
                    : eligibility.remainingCount == 0
                    ? 'Bạn đã sử dụng lượt dời lịch của đơn này.'
                    : 'Đơn hiện không đủ điều kiện dời lịch.',
              ),
              if (canRequest) ...[
                const SizedBox(height: 12),
                OutlinedButton(
                  onPressed: () => _openRequest(eligibility),
                  child: const Text('Yêu cầu dời lịch'),
                ),
              ],
            ],
            if (_busy)
              const LinearProgressIndicator(
                semanticsLabel: 'Đang cập nhật yêu cầu',
              ),
            if (_error != null)
              Text(_error!, style: TextStyle(color: scheme.error)),
          ],
        ),
      ),
    );
  }
}

class _RescheduleDialog extends ConsumerStatefulWidget {
  const _RescheduleDialog({required this.order, required this.eligibility});

  final OrderDetail order;
  final OrderRescheduleEligibility eligibility;

  @override
  ConsumerState<_RescheduleDialog> createState() => _RescheduleDialogState();
}

class _RescheduleDialogState extends ConsumerState<_RescheduleDialog> {
  String _reason = '';
  DateTime? _scheduledAt;
  bool? _requiresApproval;
  bool _checking = false, _sending = false;
  String? _error;

  Future<void> _pick() async {
    FocusScope.of(context).unfocus();
    final earliest = DateTime.now()
        .toUtc()
        .add(Duration(minutes: widget.eligibility.minAdvanceMinutes))
        .add(_vietnamOffset);
    final current = (_scheduledAt ?? widget.order.scheduledAt)?.toUtc().add(
      _vietnamOffset,
    );
    final firstDay = DateTime(earliest.year, earliest.month, earliest.day);
    final initial = current == null || current.isBefore(earliest)
        ? earliest
        : current;
    final date = await showDatePicker(
      context: context,
      firstDate: firstDay,
      initialDate: DateTime(initial.year, initial.month, initial.day),
      currentDate: DateTime.now().toUtc().add(_vietnamOffset),
      lastDate: DateTime(initial.year + 100, 12, 31),
      helpText: 'Chọn ngày hẹn mới',
    );
    if (!mounted || date == null) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay(
        hour: initial.hour.clamp(8, 21),
        minute: initial.hour >= 21 ? 0 : initial.minute,
      ),
      helpText: 'Chọn giờ hẹn mới (giờ Việt Nam)',
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(context).copyWith(alwaysUse24HourFormat: true),
        child: child!,
      ),
    );
    if (!mounted || time == null) return;
    setState(() {
      _scheduledAt = DateTime.utc(
        date.year,
        date.month,
        date.day,
        time.hour,
        time.minute,
      ).subtract(_vietnamOffset);
      _requiresApproval = null;
    });
    await _preview();
  }

  Future<void> _preview() async {
    final date = _scheduledAt;
    if (date == null || _checking) return;
    final time = date.add(_vietnamOffset);
    final minimum = DateTime.now().add(
      Duration(minutes: widget.eligibility.minAdvanceMinutes),
    );
    final validation =
        time.hour < 8 || time.hour > 21 || (time.hour == 21 && time.minute != 0)
        ? 'Vui lòng chọn giờ hẹn từ 08:00 đến 21:00.'
        : date.isBefore(minimum)
        ? 'Lịch mới phải cách hiện tại ít nhất ${widget.eligibility.minAdvanceMinutes} phút.'
        : date.isAtSameMomentAs(widget.order.scheduledAt ?? minimum)
        ? 'Vui lòng chọn thời gian khác lịch hiện tại.'
        : null;
    setState(() {
      _error = validation;
      _checking = validation == null;
    });
    if (validation != null) return;
    try {
      final requiresApproval = await ref
          .read(orderRepositoryProvider)
          .previewReschedule(widget.order.id, date);
      if (mounted) setState(() => _requiresApproval = requiresApproval);
    } catch (error) {
      if (mounted) setState(() => _error = _message(error));
    } finally {
      if (mounted) setState(() => _checking = false);
    }
  }

  Future<void> _send() async {
    final date = _scheduledAt;
    final requiresApproval = _requiresApproval;
    if (_sending ||
        date == null ||
        requiresApproval == null ||
        _reason.trim().length < 3) {
      return;
    }
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      await ref
          .read(orderRepositoryProvider)
          .requestReschedule(widget.order, date, _reason.trim());
      if (mounted) {
        Navigator.pop(
          context,
          requiresApproval
              ? 'Đã gửi yêu cầu dời lịch.'
              : 'Đã cập nhật lịch hẹn.',
        );
      }
    } catch (error) {
      if (mounted) setState(() => _error = _message(error));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return PopScope(
      canPop: !_sending,
      child: AlertDialog(
        scrollable: true,
        title: const Text('Yêu cầu dời lịch'),
        content: SizedBox(
          width: 420,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Lịch hiện tại: ${_formatTime(widget.order.scheduledAt)}'),
              const SizedBox(height: 4),
              Text(
                'Giờ Việt Nam · 08:00–21:00',
                style: theme.textTheme.bodySmall,
              ),
              const SizedBox(height: 12),
              OutlinedButton.icon(
                onPressed: _checking || _sending ? null : _pick,
                icon: const Icon(Icons.event_outlined),
                label: Text(
                  _scheduledAt == null
                      ? 'Chọn ngày và giờ mới'
                      : _formatTime(_scheduledAt),
                ),
              ),
              if (_checking) ...[
                const SizedBox(height: 8),
                const LinearProgressIndicator(
                  semanticsLabel: 'Đang kiểm tra lịch trống',
                ),
              ],
              if (_requiresApproval case final bool approval) ...[
                const SizedBox(height: 8),
                Text(
                  approval
                      ? 'Lịch phù hợp. Thợ cần đồng ý sau khi bạn gửi yêu cầu.'
                      : 'Lịch phù hợp và sẽ được cập nhật ngay khi gửi.',
                ),
              ],
              const SizedBox(height: 16),
              TextField(
                enabled: !_sending,
                minLines: 2,
                maxLines: 4,
                maxLength: 500,
                onChanged: (value) => setState(() => _reason = value),
                decoration: const InputDecoration(
                  labelText: 'Lý do dời lịch',
                  hintText: 'Nhập ít nhất 3 ký tự',
                ),
              ),
              if (_error != null) ...[
                Text(_error!, style: TextStyle(color: theme.colorScheme.error)),
                if (_requiresApproval == null && !_checking)
                  TextButton(
                    onPressed: _preview,
                    child: const Text('Kiểm tra lại lịch'),
                  ),
              ],
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: _sending ? null : () => Navigator.pop(context),
            child: const Text('Đóng'),
          ),
          FilledButton(
            onPressed:
                _checking ||
                    _sending ||
                    _requiresApproval == null ||
                    _reason.trim().length < 3
                ? null
                : _send,
            child: Text(_sending ? 'Đang gửi…' : 'Gửi yêu cầu'),
          ),
        ],
      ),
    );
  }
}

class _RejectDialog extends StatefulWidget {
  const _RejectDialog();

  @override
  State<_RejectDialog> createState() => _RejectDialogState();
}

class _RejectDialogState extends State<_RejectDialog> {
  String _reason = '';

  @override
  Widget build(BuildContext context) => AlertDialog(
    scrollable: true,
    title: const Text('Từ chối lịch mới'),
    content: TextField(
      minLines: 2,
      maxLines: 4,
      maxLength: 500,
      onChanged: (value) => setState(() => _reason = value.trim()),
      decoration: const InputDecoration(
        labelText: 'Lý do từ chối',
        hintText: 'Nhập ít nhất 3 ký tự',
      ),
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context),
        child: const Text('Đóng'),
      ),
      FilledButton(
        onPressed: _reason.length < 3
            ? null
            : () => Navigator.pop(context, _reason),
        child: const Text('Xác nhận từ chối'),
      ),
    ],
  );
}
