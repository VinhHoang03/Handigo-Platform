import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'quotation_editor_screen.dart';
import 'completion_screen.dart';
import 'provider_order_feedback_panel.dart';
import 'package:intl/intl.dart';
import '../../../shared/utils/media_url.dart';
import '../../../shared/widgets/service_images.dart';
import '../../orders/domain/order_summary.dart';
import '../../../core/network/api_exception.dart';
import '../../../shared/widgets/app_states.dart';
import '../../orders/presentation/order_screens.dart';
import 'provider_screens.dart';

class ProviderOrderDetailScreen extends ConsumerStatefulWidget {
  const ProviderOrderDetailScreen({required this.orderId, super.key});
  final String orderId;
  @override
  ConsumerState<ProviderOrderDetailScreen> createState() =>
      _ProviderOrderDetailScreenState();
}

class _ProviderOrderDetailScreenState
    extends ConsumerState<ProviderOrderDetailScreen> {
  String get orderId => widget.orderId;
  bool busy = false;
  RepairQuotation? quotation;
  bool quotationLoaded = false;

  @override
  void initState() {
    super.initState();
    Future.microtask(_loadQuotation);
  }

  Future<void> _loadQuotation() async {
    try {
      final value = await ref.refresh(orderQuotationProvider(orderId).future);
      if (mounted)
        setState(() {
          quotation = value;
          quotationLoaded = true;
        });
    } catch (_) {
      if (mounted) setState(() => quotationLoaded = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(orderQuotationProvider(orderId), (_, next) {
      next.whenData((value) {
        if (mounted)
          setState(() {
            quotation = value;
            quotationLoaded = true;
          });
      });
    });
    ref.watch(orderQuotationProvider(orderId));
    final state = ref.watch(orderDetailProvider(orderId));
    final order = state.asData?.value;
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(
        title: Text(
          order?.code.isNotEmpty == true
              ? 'Đơn ${order!.code}'
              : 'Chi tiết đơn',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: Theme.of(
            context,
          ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
        ),
        actions: [
          IconButton(
            tooltip: 'Tải lại đơn',
            onPressed: busy
                ? null
                : () {
                    ref.invalidate(orderDetailProvider(orderId));
                    _loadQuotation();
                  },
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: state.when(
        loading: () => const AppLoading(),
        error: (error, _) => AppMessage(
          message: _message(error),
          onRetry: () {
            ref.invalidate(orderDetailProvider(orderId));
            _loadQuotation();
          },
        ),
        data: (order) => ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          children: [
            Card(
              margin: EdgeInsets.zero,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: scheme.secondaryContainer,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Icon(
                        Icons.handyman_outlined,
                        color: scheme.onSecondaryContainer,
                        size: 20,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Trạng thái công việc',
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                          const SizedBox(height: 4),
                          ProviderStatusBadge(status: order.status),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
            if (order.customerName?.isNotEmpty == true ||
                order.addressLabel?.isNotEmpty == true)
              _DetailSection(
                title: 'Khách hàng & địa chỉ',
                icon: Icons.person_outline,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (order.customerName?.isNotEmpty == true)
                      Row(
                        children: [
                          ProviderAvatar(url: order.customerAvatar),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              order.customerName!,
                              style: const TextStyle(
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ],
                      ),
                    if (order.addressLabel?.isNotEmpty == true)
                      Padding(
                        padding: const EdgeInsets.only(top: 12),
                        child: Text(order.addressLabel!),
                      ),
                  ],
                ),
              ),
            _DetailSection(
              title: 'Nội dung dịch vụ',
              icon: Icons.home_repair_service_outlined,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (usableMediaUrl(order.serviceImage) != null) ...[
                    ServiceCoverImage(
                      url: order.serviceImage,
                      name: order.serviceName,
                      fit: BoxFit.cover,
                    ),
                    const SizedBox(height: 12),
                  ],
                  Text(
                    order.serviceName,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  if (order.scheduledAt != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Text(
                        'Lịch hẹn: ${_date(order.scheduledAt!)}',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ),
                  if (order.problemDescription?.isNotEmpty == true)
                    Container(
                      width: double.infinity,
                      margin: const EdgeInsets.only(top: 12),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: scheme.surfaceContainerLow,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(order.problemDescription!),
                    ),
                ],
              ),
            ),
            _DetailSection(
              title: 'Thông tin thanh toán',
              icon: Icons.payments_outlined,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    {
                          'cash': 'Tiền mặt',
                          'wallet': 'Ví Handigo',
                          'bank': 'Chuyển khoản',
                        }[order.paymentMethod] ??
                        (order.paymentMethod.isEmpty
                            ? 'Chưa cập nhật phương thức'
                            : order.paymentMethod),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    order.totalAmount == null
                        ? 'Chưa có tổng tiền'
                        : _money(order.totalAmount!),
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      color: scheme.primary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
            if (order.status == 'completed')
              ProviderOrderFeedbackPanel(orderId: orderId),
            if (order.customerAttachments.isNotEmpty)
              _images('Ảnh sự cố', order.customerAttachments),
            if (order.completionEvidenceImages.isNotEmpty)
              _images('Ảnh nghiệm thu', order.completionEvidenceImages),
            if (order.completionNote != null) Text(order.completionNote!),
            if (order.inspectionRequired) _quotationSummary(order),
            OutlinedButton.icon(
              onPressed: () => context.push('/provider/chat/order/$orderId'),
              icon: const Icon(Icons.chat_outlined),
              label: const Text('Nhắn tin với khách hàng'),
            ),
            if (order.canTrack)
              OutlinedButton.icon(
                onPressed: () =>
                    context.push('/provider/orders/$orderId/tracking'),
                icon: const Icon(Icons.map_outlined),
                label: const Text('Theo dõi và chia sẻ vị trí'),
              ),
            if (order.status == 'accepted')
              TextButton(
                onPressed: busy ? null : () => _cancelOrder(order),
                child: const Text('Hủy nhận đơn'),
              ),
            _DetailSection(
              title: 'Tiến độ công việc',
              icon: Icons.timeline_outlined,
              child: _WorkProcess(order: order),
            ),
            if (order.status == 'in_progress')
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: OutlinedButton.icon(
                  onPressed: busy ? null : () => _expectedEnd(context, ref),
                  icon: const Icon(Icons.schedule, size: 20),
                  label: const Text('Cập nhật thời gian hoàn tất'),
                ),
              ),
          ],
        ),
      ),
      bottomNavigationBar:
          order == null || !['accepted', 'in_progress'].contains(order.status)
          ? null
          : Container(
              decoration: BoxDecoration(
                color: scheme.surfaceContainerLowest,
                border: Border(
                  top: BorderSide(
                    color: scheme.outlineVariant.withValues(alpha: .3),
                  ),
                ),
              ),
              child: SafeArea(
                top: false,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (order.canEditQuotation &&
                          quotationLoaded &&
                          (quotation == null || quotation!.usable)) ...[
                        OutlinedButton.icon(
                          onPressed: busy
                              ? null
                              : () => _quotation(context, ref),
                          icon: const Icon(
                            Icons.request_quote_outlined,
                            size: 20,
                          ),
                          label: Text(
                            quotation == null
                                ? 'Lập báo giá sửa chữa'
                                : 'Chỉnh sửa báo giá',
                          ),
                        ),
                        const SizedBox(height: 8),
                      ],
                      FilledButton.icon(
                        onPressed:
                            busy ||
                                (order.inspectionRequired &&
                                    (!quotationLoaded ||
                                        (order.status == 'in_progress' &&
                                            quotation?.usable != true))) ||
                                (order.status == 'accepted' &&
                                    (!order.canStart(quotation) ||
                                        (order.inspectionRequired &&
                                            !quotationLoaded)))
                            ? null
                            : () {
                                if (order.status == 'accepted') {
                                  _run(
                                    context,
                                    ref,
                                    () => ref
                                        .read(providerRepositoryProvider)
                                        .startOrder(orderId),
                                    'Đã bắt đầu thực hiện đơn.',
                                  );
                                } else {
                                  _complete(context, ref);
                                }
                              },
                        icon: busy
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : Icon(
                                order.status == 'accepted'
                                    ? Icons.play_arrow
                                    : Icons.task_alt,
                                size: 20,
                              ),
                        label: Text(
                          busy
                              ? 'Đang xử lý...'
                              : order.status == 'accepted'
                              ? 'Bắt đầu thực hiện'
                              : 'Hoàn tất & nghiệm thu',
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
    );
  }

  Future<void> _run(
    BuildContext context,
    WidgetRef ref,
    Future<void> Function() action,
    String success,
  ) async {
    if (busy || !mounted) return;
    setState(() => busy = true);
    try {
      await action();
      ref.invalidate(orderDetailProvider(orderId));
      ref.invalidate(providerOrdersProvider);
      ref.invalidate(providerOrderPageProvider);
      ref.invalidate(providerOverviewProvider);
      await _loadQuotation();
      if (context.mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(success)));
      }
    } catch (error) {
      if (context.mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(_message(error))));
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _expectedEnd(BuildContext context, WidgetRef ref) async {
    final date = await showDatePicker(
      context: context,
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 30)),
      initialDate: DateTime.now(),
    );
    if (!context.mounted || date == null) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.now(),
    );
    if (time == null || !context.mounted) return;
    await _run(
      context,
      ref,
      () => ref
          .read(providerRepositoryProvider)
          .updateExpectedEnd(
            orderId,
            DateTime(date.year, date.month, date.day, time.hour, time.minute),
          ),
      'Đã cập nhật thời gian hoàn tất.',
    );
  }

  Future<void> _quotation(BuildContext context, WidgetRef ref) async {
    final order = ref.read(orderDetailProvider(orderId)).asData?.value;
    if (order == null || !order.canEditQuotation) return;
    final saved = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) =>
            QuotationEditorScreen(order: order, quotation: quotation),
      ),
    );
    if (!mounted) return;
    if (saved == true) ref.invalidate(orderDetailProvider(orderId));
    ref.invalidate(orderQuotationProvider(orderId));
    await _loadQuotation();
  }

  Future<void> _complete(BuildContext context, WidgetRef ref) async {
    final result = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) =>
            CompletionScreen(orderId: orderId, quotation: quotation),
      ),
    );
    if (result == true) {
      ref.invalidate(orderDetailProvider(orderId));
      ref.invalidate(providerOrdersProvider);
      ref.invalidate(providerOrderPageProvider);
      ref.invalidate(providerOverviewProvider);
      await _loadQuotation();
    }
  }

  Widget _images(String title, List<String> urls) => _DetailSection(
    title: title,
    icon: Icons.image_outlined,
    child: Wrap(
      spacing: 8,
      runSpacing: 8,
      children: urls
          .map(
            (url) => SizedBox(
              width: 100,
              height: 100,
              child: Image.network(
                url,
                fit: BoxFit.cover,
                cacheWidth: 300,
                errorBuilder: (_, error, stack) =>
                    const Icon(Icons.broken_image_outlined),
              ),
            ),
          )
          .toList(),
    ),
  );

  Widget _quotationSummary(OrderDetail order) => _DetailSection(
    title: 'Báo giá sửa chữa',
    icon: Icons.request_quote_outlined,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (!quotationLoaded)
          OutlinedButton(
            onPressed: _loadQuotation,
            child: const Text('Tải lại báo giá'),
          ),
        if (quotationLoaded && quotation == null)
          const Text('Cần lưu báo giá trước khi bắt đầu thực hiện.'),
        if (!order.appointmentConfirmed)
          const Text('Đang chờ thanh toán và xác nhận lịch hẹn.'),
        if (order.depositPaidAt == null)
          const Text('Chưa ghi nhận thanh toán tiền cọc.'),
        if (quotation != null) ...[
          for (final item in quotation!.items)
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(item.title),
              subtitle: Text('${item.quantity} × ${_money(item.unitPrice)}'),
            ),
          Text('Tổng báo giá: ${_money(quotation!.finalAmount)}'),
          Text('Cọc đã áp dụng: ${_money(order.appliedDeposit)}'),
          Text(
            'Thu trực tiếp: ${_money((quotation!.finalAmount - order.appliedDeposit).clamp(0, double.infinity))}',
          ),
          if (order.status == 'completed' && quotation!.usable) ...[
            if (quotation!.directPaymentConfirmedAt != null &&
                order.paymentStatus == 'paid')
              const Text('Đã xác nhận nhận tiền trực tiếp')
            else
              FilledButton(
                onPressed: busy ? null : () => _confirmPayment(order),
                child: const Text('Xác nhận đã nhận tiền trực tiếp'),
              ),
          ],
        ],
      ],
    ),
  );

  Future<void> _confirmPayment(OrderDetail order) async {
    final current = quotation;
    if (current == null) return;
    final accepted = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Xác nhận tiền đã nhận'),
        content: Text(
          'Bạn đã nhận đủ ${_money((current.finalAmount - order.appliedDeposit).clamp(0, double.infinity))} theo báo giá phiên bản ${current.revision}?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Quay lại'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Đã nhận đủ'),
          ),
        ],
      ),
    );
    if (accepted == true && mounted)
      await _run(
        context,
        ref,
        () => ref
            .read(providerRepositoryProvider)
            .confirmQuotationPayment(orderId, current),
        'Đã xác nhận thanh toán báo giá.',
      );
  }

  Future<void> _cancelOrder(OrderDetail order) async {
    final controller = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Hủy nhận đơn'),
        content: TextField(
          controller: controller,
          minLines: 2,
          maxLines: 4,
          decoration: const InputDecoration(labelText: 'Lý do hủy'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Quay lại'),
          ),
          FilledButton(
            onPressed: () {
              if (controller.text.trim().isNotEmpty)
                Navigator.pop(context, controller.text.trim());
            },
            child: const Text('Xác nhận hủy'),
          ),
        ],
      ),
    );
    controller.dispose();
    if (reason != null && mounted)
      await _run(
        context,
        ref,
        () => ref.read(orderRepositoryProvider).cancel(order.id, reason),
        'Đã hủy nhận đơn.',
      );
  }
}

class _DetailSection extends StatelessWidget {
  const _DetailSection({
    required this.title,
    required this.icon,
    required this.child,
  });
  final String title;
  final IconData icon;
  final Widget child;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  icon,
                  size: 20,
                  color: Theme.of(context).colorScheme.primary,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    title,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            child,
          ],
        ),
      ),
    ),
  );
}

class _WorkProcess extends StatelessWidget {
  const _WorkProcess({required this.order});
  final OrderDetail order;
  @override
  Widget build(BuildContext context) {
    if (order.status == 'cancelled') {
      return const ProviderStatusBadge(status: 'cancelled');
    }
    const steps = ['accepted', 'in_progress', 'completed'];
    final rank = steps.indexOf(order.status);
    final scheme = Theme.of(context).colorScheme;
    return Column(
      children: [
        for (var index = 0; index < steps.length; index++)
          Padding(
            padding: EdgeInsets.only(
              bottom: index == steps.length - 1 ? 0 : 12,
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  index <= rank
                      ? Icons.check_circle
                      : Icons.radio_button_unchecked,
                  color: index <= rank ? scheme.primary : scheme.outline,
                  size: 20,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        orderStatusLabel(steps[index]),
                        style: TextStyle(
                          fontWeight: index == rank
                              ? FontWeight.w600
                              : FontWeight.w400,
                        ),
                      ),
                      for (final event in order.statusHistory.where(
                        (event) =>
                            event.status == steps[index] &&
                            event.createdAt != null,
                      ))
                        Text(
                          _date(event.createdAt!),
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

String _date(DateTime value) =>
    DateFormat('HH:mm, dd/MM/yyyy').format(value.toLocal());
String _money(double value) => NumberFormat.currency(
  locale: 'vi_VN',
  symbol: 'đ',
  decimalDigits: 0,
).format(value);

String _message(Object error) => error is ApiException
    ? error.message
    : 'Không thể thực hiện thao tác. Vui lòng thử lại.';
