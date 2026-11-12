import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:material_symbols_icons/symbols.dart';

import '../../../shared/widgets/account_overview_widgets.dart';
import '../../../core/network/api_exception.dart';
import '../../../shared/widgets/app_feedback.dart';
import '../domain/order_reschedule.dart';
import '../domain/order_summary.dart';
import 'order_screens.dart';
import 'order_reschedule_date_time_picker.dart';

const _vietnamOffset = Duration(hours: 7);

String _formatTime(DateTime? time) => time == null
    ? 'Chưa xác định'
    : DateFormat('HH:mm · dd/MM/yyyy').format(time.toUtc().add(_vietnamOffset));

String _message(Object error) => error is ApiException
    ? error.message
    : 'Chưa thể cập nhật lịch hẹn. Vui lòng thử lại.';

class OrderReschedulePanel extends ConsumerStatefulWidget {
  const OrderReschedulePanel({
    required this.order,
    this.providerView = false,
    this.onChanged,
    super.key,
  });

  final OrderDetail order;
  final bool providerView;
  final VoidCallback? onChanged;

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
    widget.onChanged?.call();
  }

  Future<void> _openRequest(OrderRescheduleEligibility eligibility) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      final message = await showDialog<String>(
        context: context,
        barrierDismissible: false,
        builder: (_) => _RescheduleDialog(
          order: widget.order,
          eligibility: eligibility,
          providerView: widget.providerView,
        ),
      );
      if (message == null || !mounted) return;
      _refresh();
      AppToast.show(context, message, type: AppToastType.success);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _updateRequest(
    OrderRescheduleRequest request, {
    bool? accept,
  }) async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final reason = accept == false
          ? await showDialog<String>(
              context: context,
              builder: (_) => const _RejectDialog(),
            )
          : null;
      if (!mounted || (accept == false && reason == null)) return;
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
    final viewer = widget.providerView ? 'provider' : 'customer';
    final isInitiator = pending?.initiatorRole == viewer;
    final canRespond = !isInitiator && pending?.approvalRole == viewer;
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
                      isInitiator
                          ? widget.providerView
                                ? 'Đang chờ khách hàng phản hồi'
                                : 'Đang chờ thợ phản hồi'
                          : widget.providerView
                          ? 'Khách hàng yêu cầu dời lịch'
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
              if (isInitiator || canRespond || isExpired)
                const SizedBox(height: 12),
              if (isExpired)
                OutlinedButton(
                  onPressed: _refresh,
                  child: const Text('Tải lại yêu cầu đã hết hạn'),
                ),
              if (isInitiator && !isExpired)
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
                  onPressed: _busy ? null : () => _openRequest(eligibility),
                  child: Text(
                    widget.providerView
                        ? 'Đề nghị dời lịch'
                        : 'Yêu cầu dời lịch',
                  ),
                ),
              ],
            ],
            if (_busy && ModalRoute.of(context)?.isCurrent != false)
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
  const _RescheduleDialog({
    required this.order,
    required this.eligibility,
    required this.providerView,
  });

  final OrderDetail order;
  final OrderRescheduleEligibility eligibility;
  final bool providerView;

  @override
  ConsumerState<_RescheduleDialog> createState() => _RescheduleDialogState();
}

class _RescheduleDialogState extends ConsumerState<_RescheduleDialog> {
  String _reason = '';
  DateTime? _scheduledAt;
  OrderReschedulePreview? _previewResult;
  bool _warningAcknowledged = false;
  bool _checking = false, _sending = false;
  String? _error;
  Timer? _previewTimer, _clockTimer;
  int _previewVersion = 0;

  DateTime get _earliest => DateTime.now().toUtc().add(
    Duration(minutes: widget.eligibility.minAdvanceMinutes),
  );

  @override
  void initState() {
    super.initState();
    final earliest = _earliest;
    final current = widget.order.scheduledAt;
    final local = earliest.add(_vietnamOffset);
    _scheduledAt = current != null && isAllowedRescheduleTime(current, earliest)
        ? current
        : firstAvailableRescheduleTime(local, earliest) ??
              firstAvailableRescheduleTime(
                local.add(const Duration(days: 1)),
                earliest,
              );
    _clockTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      if (_sending) return;
      if ((_scheduledAt?.isBefore(_earliest) ?? false) ||
          (widget.order.scheduledAt?.isBefore(_earliest) ?? false)) {
        _preview();
      } else {
        setState(() {});
      }
    });
    Future.microtask(_preview);
  }

  @override
  void dispose() {
    _previewTimer?.cancel();
    _clockTimer?.cancel();
    super.dispose();
  }

  void _changeSchedule(DateTime value) {
    if (_sending) return;
    setState(() => _scheduledAt = value);
    _preview();
  }

  void _preview() {
    if (!mounted || _sending) return;
    _previewTimer?.cancel();
    final version = ++_previewVersion;
    final date = _scheduledAt;
    if (date == null) return;
    final validation =
        date.isAtSameMomentAs(widget.order.scheduledAt ?? _earliest)
        ? 'Vui lòng chọn thời gian khác lịch hiện tại.'
        : widget.order.scheduledAt?.isBefore(_earliest) == true
        ? 'Đã quá thời hạn báo trước để dời lịch đơn này.'
        : !isAllowedRescheduleTime(date, _earliest)
        ? 'Chọn lịch từ 08:00 đến 21:00 và báo trước ít nhất ${widget.eligibility.minAdvanceMinutes} phút.'
        : null;
    setState(() {
      _error = validation;
      _previewResult = null;
      _warningAcknowledged = false;
      _checking = validation == null;
    });
    if (validation != null) return;
    _previewTimer = Timer(
      const Duration(milliseconds: 300),
      () => _loadPreview(date, version),
    );
  }

  Future<void> _loadPreview(DateTime date, int version) async {
    try {
      final preview = await ref
          .read(orderRepositoryProvider)
          .previewReschedule(widget.order.id, date);
      if (mounted && version == _previewVersion) {
        setState(() => _previewResult = preview);
      }
    } catch (error) {
      if (mounted && version == _previewVersion) {
        setState(() => _error = _message(error));
      }
    } finally {
      if (mounted && version == _previewVersion) {
        setState(() => _checking = false);
      }
    }
  }

  Future<void> _send() async {
    final date = _scheduledAt;
    final preview = _previewResult;
    if (_sending ||
        _checking ||
        date == null ||
        preview == null ||
        (preview.warningRequired && !_warningAcknowledged) ||
        _reason.trim().length < 3) {
      return;
    }
    if (!isAllowedRescheduleTime(date, _earliest) ||
        widget.order.scheduledAt?.isBefore(_earliest) == true) {
      _preview();
      return;
    }
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      await ref
          .read(orderRepositoryProvider)
          .requestReschedule(
            widget.order,
            date,
            _reason.trim(),
            warningAcknowledged: _warningAcknowledged,
          );
      if (mounted) {
        Navigator.pop(
          context,
          preview.approvalRequired
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
        backgroundColor: accountSurface,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
        contentPadding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
        actionsPadding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
        title: Row(
          children: [
            const Icon(Symbols.calendar_clock, color: accountPrimary),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                widget.providerView ? 'Đề nghị dời lịch' : 'Yêu cầu dời lịch',
                style: theme.textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        ),
        content: SizedBox(
          width: 640,
          height: MediaQuery.sizeOf(context).height * .6,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _RescheduleSection(
                  icon: Symbols.schedule,
                  title: 'Lịch hiện tại',
                  child: Text(
                    _formatTime(widget.order.scheduledAt),
                    style: theme.textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                _RescheduleSection(
                  icon: Symbols.calendar_month,
                  title: 'Chọn ngày và giờ mới',
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        'Báo trước ít nhất ${widget.eligibility.minAdvanceMinutes} phút.',
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: accountMuted,
                        ),
                      ),
                      if (_scheduledAt case final selected?)
                        AbsorbPointer(
                          absorbing: _sending,
                          child: OrderRescheduleDateTimePicker(
                            value: selected,
                            earliest: _earliest,
                            onChanged: _changeSchedule,
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                _RescheduleSection(
                  icon: Symbols.event_available,
                  title: 'Lịch đề xuất',
                  primary: true,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        _formatTime(_scheduledAt),
                        style: theme.textTheme.titleMedium?.copyWith(
                          color: accountPrimary,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 8),
                      if (_checking) ...[
                        const LinearProgressIndicator(
                          semanticsLabel: 'Đang kiểm tra lịch trống',
                        ),
                        const SizedBox(height: 8),
                        const Text('Đang kiểm tra lịch trống…'),
                      ] else if (_error case final error?)
                        Text(
                          error,
                          style: TextStyle(color: theme.colorScheme.error),
                        )
                      else if (_previewResult case final preview?)
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Icon(
                              Symbols.check_circle,
                              fill: 1,
                              color: accountPrimary,
                              size: 18,
                            ),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                preview.approvalRequired
                                    ? widget.providerView
                                          ? 'Lịch phù hợp. Khách hàng cần đồng ý sau khi bạn gửi đề nghị.'
                                          : 'Lịch phù hợp. Thợ cần đồng ý sau khi bạn gửi yêu cầu.'
                                    : 'Lịch phù hợp và sẽ được cập nhật ngay khi gửi.',
                                style: theme.textTheme.bodySmall,
                              ),
                            ),
                          ],
                        ),
                      if (_error != null &&
                          _previewResult == null &&
                          !_checking &&
                          _scheduledAt != widget.order.scheduledAt)
                        TextButton.icon(
                          onPressed: _preview,
                          icon: const Icon(Symbols.refresh, size: 18),
                          label: const Text('Kiểm tra lại lịch'),
                        ),
                    ],
                  ),
                ),
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
                    alignLabelWithHint: true,
                    filled: true,
                    fillColor: accountBackground,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.all(Radius.circular(14)),
                    ),
                  ),
                ),
                if (_previewResult case final preview?
                    when preview.warningRequired)
                  Material(
                    color: const Color(0xFFFFF7E6),
                    borderRadius: BorderRadius.circular(14),
                    child: CheckboxListTile(
                      contentPadding: EdgeInsets.zero,
                      controlAffinity: ListTileControlAffinity.leading,
                      value: _warningAcknowledged,
                      onChanged: _sending
                          ? null
                          : (value) => setState(
                              () => _warningAcknowledged = value == true,
                            ),
                      title: Text(
                        'Bạn đã dời lịch thành công ${preview.providerMonthlyAppliedCount} lần trong tháng. '
                        'Đề nghị này có thể trở thành lần thứ ${preview.providerMonthlyAppliedCount + 1}. '
                        'Tôi đã kiểm tra kỹ thời gian mới.',
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
        actions: [
          OutlinedButton(
            onPressed: _sending ? null : () => Navigator.pop(context),
            child: const Text('Đóng'),
          ),
          FilledButton(
            onPressed:
                _checking ||
                    _sending ||
                    _previewResult == null ||
                    (_previewResult!.warningRequired &&
                        !_warningAcknowledged) ||
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

class _RescheduleSection extends StatelessWidget {
  const _RescheduleSection({
    required this.icon,
    required this.title,
    required this.child,
    this.primary = false,
  });

  final IconData icon;
  final String title;
  final Widget child;
  final bool primary;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: primary ? accountPrimarySoft : accountBackground,
      borderRadius: BorderRadius.circular(16),
      border: Border.all(
        color: primary ? accountPrimary.withValues(alpha: .15) : accountDivider,
      ),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Icon(icon, size: 18, color: accountPrimary),
            const SizedBox(width: 7),
            Expanded(
              child: Text(
                title,
                style: Theme.of(
                  context,
                ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        child,
      ],
    ),
  );
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
