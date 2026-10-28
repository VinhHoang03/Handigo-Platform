import 'slide_to_start_order.dart';
import '../../orders/presentation/order_payment_panel.dart';
import '../../orders/presentation/order_detail_overview.dart';
import '../../orders/presentation/order_followup_panel.dart';
import '../../../shared/widgets/app_feedback.dart';
import 'provider_order_directions_sheet.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'quotation_editor_screen.dart';
import 'completion_screen.dart';
import 'provider_order_feedback_panel.dart';
import 'package:intl/intl.dart';
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
          ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
        ),
        actions: [
          PopupMenuButton<String>(
            tooltip: 'Tác vụ đơn hàng',
            icon: const Icon(Icons.more_vert),
            enabled: !busy,
            itemBuilder: (_) => [
              const PopupMenuItem(value: 'reload', child: Text('Tải lại đơn')),
              if (order != null)
                const PopupMenuItem(
                  value: 'report',
                  child: Text('Báo cáo đơn'),
                ),
              if (order != null)
                PopupMenuItem(
                  value: 'cancel',
                  enabled: order.status == 'accepted',
                  child: const Text('Hủy đơn'),
                ),
            ],
            onSelected: (action) {
              final current = ref
                  .read(orderDetailProvider(orderId))
                  .asData
                  ?.value;
              if (action == 'reload') {
                ref.invalidate(orderDetailProvider(orderId));
                _loadQuotation();
              } else if (current != null && action == 'report') {
                showOrderReport(context, current);
              } else if (current?.status == 'accepted' && action == 'cancel') {
                _cancelOrder(current!);
              }
            },
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
              clipBehavior: Clip.antiAlias,
              child: InkWell(
                onTap: () => AppBottomSheet.show<void>(
                  context,
                  builder: (_) => ProviderOrderDirectionsSheet(order: order),
                ),
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 12,
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: scheme.secondaryContainer,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Icon(
                          Icons.location_on_outlined,
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
                              'Địa chỉ',
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                            const SizedBox(height: 4),
                            Text(
                              order.addressLabel?.isNotEmpty == true
                                  ? order.addressLabel!
                                  : 'Chưa có thông tin địa chỉ',
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      const Icon(Icons.chevron_right),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(height: 12),
            OrderDetailOverview(order: order, providerView: true),
            const SizedBox(height: 12),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    OrderPaymentHeader(order: order),
                    const SizedBox(height: 12),
                    OrderPaymentSummary(
                      order: order,
                      quotation: quotation,
                      providerView: true,
                    ),
                  ],
                ),
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
            const SizedBox(height: 12),
            OrderProgressTimeline(order: order),
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
                      if (order.status == 'accepted')
                        SlideToStartOrder(
                          busy: busy,
                          enabled:
                              order.canStart(quotation) &&
                              (!order.inspectionRequired || quotationLoaded),
                          onConfirmed: () => _run(
                            context,
                            ref,
                            () => ref
                                .read(providerRepositoryProvider)
                                .startOrder(orderId),
                            'Đã bắt đầu thực hiện đơn.',
                          ),
                        )
                      else
                        FilledButton.icon(
                          onPressed:
                              busy ||
                                  (order.inspectionRequired &&
                                      (!quotationLoaded ||
                                          quotation?.usable != true))
                              ? null
                              : () => _complete(context, ref),
                          icon: busy
                              ? const SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                              : const Icon(Icons.task_alt, size: 20),
                          label: Text(
                            busy ? 'Đang xử lý...' : 'Hoàn tất & nghiệm thu',
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
    child:
        quotationLoaded &&
            order.canEditQuotation &&
            (quotation == null || quotation!.usable)
        ? QuotationEditorScreen(
            key: ValueKey((order.id, quotation?.id, quotation?.revision)),
            order: order,
            quotation: quotation,
            embedded: true,
            onBusyChanged: (value) {
              if (mounted) setState(() => busy = value);
            },
            onSaved: () async {
              try {
                ref.invalidate(orderDetailProvider(orderId));
                await _loadQuotation();
              } finally {
                if (mounted) setState(() => busy = false);
              }
            },
          )
        : Column(
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
                    subtitle: Text(
                      '${item.quantity} × ${_money(item.unitPrice)}',
                    ),
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
                      fontWeight: FontWeight.w600,
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

String _money(double value) => NumberFormat.currency(
  locale: 'vi_VN',
  symbol: 'đ',
  decimalDigits: 0,
).format(value);

String _message(Object error) => error is ApiException
    ? error.message
    : 'Không thể thực hiện thao tác. Vui lòng thử lại.';
