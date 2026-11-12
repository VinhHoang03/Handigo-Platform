import '../../../app/providers/app_providers.dart';
import 'slide_to_start_order.dart';
import 'provider_cancel_order_dialog.dart';
import 'provider_no_show_screen.dart';
import 'provider_account_screens.dart';
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
  bool editingQuotation = false;

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
                  enabled: _canCancel(order),
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
            if (_canReportNoShow(order) ||
                order.customerNoShowStatus != null) ...[
              const SizedBox(height: 12),
              _DetailSection(
                title: 'Liên hệ khách hàng',
                icon: Icons.person_off_outlined,
                child: order.customerNoShowStatus == null
                    ? OutlinedButton.icon(
                        onPressed: busy ? null : () => _reportNoShow(order),
                        icon: const Icon(Icons.phone_missed_outlined),
                        label: const Text('Không liên hệ được khách'),
                      )
                    : Text(switch (order.customerNoShowStatus) {
                        'pending' =>
                          'Báo cáo khách không có mặt đang chờ duyệt. Chưa thể lập báo giá hoặc bắt đầu làm việc.',
                        'approved' =>
                          'Báo cáo đã được chấp thuận. Kết quả xử lý đơn và ví đã được cập nhật.',
                        'rejected' =>
                          'Báo cáo không được chấp thuận. Bạn có thể tiếp tục làm việc hoặc liên hệ hỗ trợ.',
                        _ =>
                          'Báo cáo khách không có mặt đã được ghi nhận. Vui lòng tải lại để xem kết quả.',
                      }),
              ),
            ],
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
            if (order.inspectionRequired && !order.noShowBlocksWork)
              _quotationSummary(order),
            const SizedBox(height: 12),
            OrderProgressTimeline(order: order),
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
                      if (order.status == 'accepted' && !order.hasArrived)
                        SlideToStartOrder(
                          key: const ValueKey('arrival-slide'),
                          busy: busy,
                          enabled: order.appointmentConfirmed,
                          onConfirmed: () => _arrive(order),
                          label: 'Đã đến nơi',
                          semanticLabel:
                              'Vuốt sang phải để xác nhận đã đến nơi',
                        )
                      else if (order.status == 'accepted')
                        FilledButton.icon(
                          onPressed:
                              busy ||
                                  !order.canStart(quotation) ||
                                  (order.inspectionRequired && !quotationLoaded)
                              ? null
                              : () => _run(
                                  context,
                                  ref,
                                  () => ref
                                      .read(providerRepositoryProvider)
                                      .startOrder(orderId),
                                  'Đã bắt đầu thực hiện đơn.',
                                ),
                          icon: const Icon(Icons.play_arrow_rounded),
                          label: Text(
                            busy ? 'Đang xử lý...' : 'Bắt đầu thực hiện',
                          ),
                        )
                      else
                        SlideToStartOrder(
                          key: const ValueKey('completion-slide'),
                          busy: busy,
                          enabled:
                              !order.inspectionRequired ||
                              (quotationLoaded && quotation?.usable == true),
                          onConfirmed: () => _complete(context, ref),
                          label: 'Hoàn tất & nghiệm thu',
                          semanticLabel:
                              'Vuốt sang phải để mở nghiệm thu hoàn tất đơn',
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
      if (!mounted) return;
      ref.invalidate(orderDetailProvider(orderId));
      ref.invalidate(providerOrdersProvider);
      ref.invalidate(providerOrderPageProvider);
      ref.invalidate(providerOverviewProvider);
      await ref.read(orderDetailProvider(orderId).future);
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

  bool _canCancel(OrderDetail order) =>
      order.status == 'accepted' &&
      !order.noShowBlocksWork &&
      order.currentQuotationId == null &&
      quotationLoaded &&
      quotation == null;

  bool _canReportNoShow(OrderDetail order) =>
      order.status == 'accepted' &&
      order.currentQuotationId == null &&
      quotation == null &&
      order.hasArrived &&
      order.customerNoShowStatus == null;

  Future<void> _reportNoShow(OrderDetail order) async {
    if (busy || !_canReportNoShow(order)) return;
    final owner = ref.read(authControllerProvider).user?.id;
    setState(() => busy = true);
    try {
      await ref
          .read(providerRepositoryProvider)
          .checkNoShowEligibility(order.id);
      if (!mounted ||
          owner == null ||
          ref.read(authControllerProvider).user?.id != owner) {
        return;
      }
      final sent = await Navigator.of(context).push<bool>(
        MaterialPageRoute(
          builder: (_) => ProviderNoShowScreen(orderId: order.id),
        ),
      );
      if (!mounted || ref.read(authControllerProvider).user?.id != owner) {
        return;
      }
      ref.invalidate(orderDetailProvider(orderId));
      ref.invalidate(providerOrdersProvider);
      ref.invalidate(providerOrderPageProvider);
      ref.invalidate(providerScheduleOrdersProvider);
      ref.invalidate(providerAssignmentsProvider);
      ref.invalidate(providerOverviewProvider);
      ref.invalidate(providerWalletProvider);
      ref.invalidate(providerWalletTransactionsProvider);
      await ref.read(orderDetailProvider(orderId).future);
      await _loadQuotation();
      if (sent == true && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Đã gửi báo cáo khách không có mặt.')),
        );
      }
    } catch (error) {
      if (mounted) {
        ref.invalidate(orderDetailProvider(orderId));
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(_message(error))));
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _arrive(OrderDetail order) => _run(context, ref, () async {
    final owner = ref.read(authControllerProvider).user?.id;
    await ref
        .read(providerLocationServiceProvider)
        .synchronize(
          shouldUpload: () =>
              mounted &&
              owner != null &&
              ref.read(authControllerProvider).user?.id == owner,
        );
    if (!mounted ||
        owner == null ||
        ref.read(authControllerProvider).user?.id != owner) {
      return;
    }
    await ref.read(providerRepositoryProvider).arriveOrder(order.id);
  }, 'Đã xác nhận đến nơi và thông báo cho khách.');

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
            (order.status != 'accepted' || order.hasArrived) &&
            (quotation == null || editingQuotation) &&
            (quotation == null || quotation!.usable)
        ? QuotationEditorScreen(
            key: ValueKey((order.id, quotation?.id, quotation?.revision)),
            order: order,
            quotation: quotation,
            embedded: true,
            onCancel: quotation == null
                ? null
                : () => setState(() => editingQuotation = false),
            onBusyChanged: (value) {
              if (mounted) setState(() => busy = value);
            },
            onSaved: () async {
              try {
                ref.invalidate(orderDetailProvider(orderId));
                await _loadQuotation();
              } finally {
                if (mounted)
                  setState(() {
                    busy = false;
                    editingQuotation = false;
                  });
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
                Text(
                  order.status == 'accepted' && !order.hasArrived
                      ? 'Xác nhận đã đến nơi để lập báo giá.'
                      : 'Cần lưu báo giá trước khi bắt đầu thực hiện.',
                ),
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
                if (quotationLoaded &&
                    quotation!.usable &&
                    order.canEditQuotation &&
                    (order.status != 'accepted' || order.hasArrived)) ...[
                  const SizedBox(height: 12),
                  OutlinedButton.icon(
                    onPressed: busy
                        ? null
                        : () => setState(() => editingQuotation = true),
                    icon: const Icon(Icons.edit_outlined),
                    label: const Text('Chỉnh sửa'),
                  ),
                ],
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
    if (busy || !_canCancel(order)) return;
    final reason = await showDialog<String>(
      context: context,
      builder: (context) => ProviderCancelOrderDialog(order: order),
    );
    if (reason == null || !mounted) return;
    final current = ref.read(orderDetailProvider(orderId)).asData?.value;
    if (current == null ||
        !_canCancel(current) ||
        current.hasArrived != order.hasArrived) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Đơn đã thay đổi. Vui lòng kiểm tra và chọn lại lý do hủy.',
          ),
        ),
      );
      return;
    }
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
