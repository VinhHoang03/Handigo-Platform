import '../../chat/presentation/order_chat_button.dart';
import '../../../shared/widgets/app_search_field.dart';
import '../../../shared/widgets/service_images.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../app/providers/app_providers.dart';
import '../../../core/network/api_exception.dart';
import '../../../shared/widgets/app_states.dart';
import '../../../shared/widgets/provider_avatar.dart';
import '../../../shared/widgets/customer_page_header.dart';
import '../data/order_repository.dart';
import '../domain/order_summary.dart';
import 'order_payment_panel.dart';
import 'order_followup_panel.dart';
import 'order_detail_overview.dart';
import '../../../core/network/paged_result.dart';
import '../../booking/data/pending_booking_store.dart';

final orderRepositoryProvider = Provider<OrderRepository>(
  (ref) => OrderRepository(ref.watch(apiClientProvider)),
);
final orderListProvider = FutureProvider.autoDispose(
  (ref) => OrderRepository(
    ref.watch(apiClientProvider),
  ).list(ref.watch(authControllerProvider).user!),
);
final orderQuotationProvider = FutureProvider.autoDispose
    .family<RepairQuotation?, String>(
      (ref, id) => ref.watch(orderRepositoryProvider).quotation(id),
    );
final orderDetailProvider = FutureProvider.autoDispose
    .family<OrderDetail, String>(
      (ref, id) => ref.watch(orderRepositoryProvider).detail(id),
    );

final orderPageProvider = FutureProvider.autoDispose
    .family<PagedResult<OrderSummary>, (int, String, String)>(
      (ref, query) => ref
          .watch(orderRepositoryProvider)
          .list(
            ref.watch(authControllerProvider).user!,
            page: query.$1,
            status: query.$2,
            search: query.$3,
          ),
    );
final pendingOrderProvider = FutureProvider.autoDispose<String?>((ref) async {
  final id = ref.watch(authControllerProvider).user?.id;
  return id == null ? null : const PendingBookingStore().read(id);
});

String orderStatusLabel(String value) =>
    {
      'created': 'Đã tạo',
      'accepted': 'Đã nhận',
      'in_progress': 'Đang thực hiện',
      'completed': 'Hoàn thành',
      'cancelled': 'Đã hủy',
    }[value] ??
    value;

String customerOrderStatusLabel(OrderSummary order) =>
    switch (order.customerDisplayStatus) {
      'awaiting_payment' => 'Chờ thanh toán',
      'finding_provider' => 'Đang tìm thợ',
      'awaiting_confirmation' => 'Chờ xác nhận',
      'accepted' => 'Chờ xử lý',
      'in_progress' => 'Đang xử lý',
      'completed' => 'Hoàn thành',
      'cancelled' => 'Đã hủy',
      _ => orderStatusLabel(order.status),
    };

class OrderListScreen extends ConsumerStatefulWidget {
  const OrderListScreen({super.key});
  @override
  ConsumerState<OrderListScreen> createState() => _OrderListScreenState();
}

class _OrderListScreenState extends ConsumerState<OrderListScreen> {
  int page = 1;
  String status = 'all', search = '';
  @override
  Widget build(BuildContext context) {
    final query = (page, status, search);
    final state = ref.watch(orderPageProvider(query));
    final pending = ref.watch(pendingOrderProvider).asData?.value;
    return Scaffold(
      appBar: CustomerPageHeader(
        toolbarHeight: 64 * MediaQuery.textScalerOf(context).scale(1),
        backgroundColor: Colors.white,
        title: 'Lịch sử đơn hàng',
        centerTitle: false,
        leading: Center(
          child: Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.primaryFixed,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              Icons.receipt_long_outlined,
              color: Theme.of(context).colorScheme.primary,
              size: 24,
            ),
          ),
        ),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: AppSearchField(
              maxLength: 100,
              hintText: 'Tìm đơn hàng',
              onSubmitted: (value) => setState(() {
                search = value.trim();
                page = 1;
              }),
            ),
          ),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Row(
              children: [
                for (final entry in const {
                  'all': 'Tất cả',
                  'created': 'Đang chờ',
                  'accepted': 'Chờ xử lý',
                  'in_progress': 'Đang xử lý',
                  'completed': 'Hoàn thành',
                  'cancelled': 'Đã hủy',
                }.entries)
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      label: Text(entry.value),
                      selected: status == entry.key,
                      onSelected: (_) => setState(() {
                        status = entry.key;
                        page = 1;
                      }),
                    ),
                  ),
              ],
            ),
          ),
          if (pending != null)
            ListTile(
              title: const Text('Tiếp tục kiểm tra đơn vừa đặt'),
              trailing: const Icon(Icons.arrow_forward),
              onTap: () => context.push('/customer/orders/$pending'),
            ),
          Expanded(
            child: state.when(
              loading: () => const AppLoading(),
              error: (error, stack) => AppMessage(
                message: _message(error),
                onRetry: () => ref.invalidate(orderPageProvider(query)),
              ),
              data: (result) => RefreshIndicator(
                onRefresh: () => ref.refresh(orderPageProvider(query).future),
                child: ListView.builder(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.all(16),
                  itemCount: result.items.isEmpty ? 1 : result.items.length,
                  itemBuilder: (context, index) => result.items.isEmpty
                      ? const Padding(
                          padding: EdgeInsets.all(24),
                          child: Text('Không có đơn hàng phù hợp.'),
                        )
                      : OrderSummaryCard(order: result.items[index]),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class OrderSummaryCard extends StatelessWidget {
  const OrderSummaryCard({
    required this.order,
    this.providerView = false,
    super.key,
  });
  final bool providerView;
  final OrderSummary order;
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final statusColor = customerOrderStatusColor(
      theme,
      providerView ? order.status : order.customerDisplayStatus,
    );
    final role = providerView ? 'provider' : 'customer';
    final action = providerView
        ? switch (order.status) {
            'accepted' => 'Xem lịch hẹn',
            'in_progress' => 'Xem tiến trình',
            'completed' => 'Xem kết quả',
            'cancelled' => 'Xem chi tiết hủy',
            _ => 'Xem chi tiết',
          }
        : 'Xem chi tiết';
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => context.push('/$role/orders/${order.id}'),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      'Mã đơn ${order.code}',
                      style: theme.textTheme.labelMedium,
                    ),
                  ),
                  OrderStatusBadge(
                    label: providerView
                        ? (order.status == 'created'
                              ? 'Chờ phản hồi'
                              : orderStatusLabel(order.status))
                        : customerOrderStatusLabel(order),
                    color: statusColor,
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Stack(
                children: [
                  Positioned(
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: 96,
                    child: ServiceCoverImage(
                      url: order.serviceImage,
                      name: order.serviceName,
                      fit: BoxFit.cover,
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.only(left: 106),
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(minHeight: 72),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            order.serviceName,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: theme.textTheme.titleSmall?.copyWith(
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(height: 4),
                          if (order.scheduledAt != null)
                            Text(
                              'Dự kiến: ${DateFormat('HH:mm, dd/MM/yyyy').format(order.scheduledAt!.toLocal())}',
                              style: theme.textTheme.bodySmall,
                            ),
                          if (providerView && order.scheduledAt == null)
                            Text(
                              'Chưa có lịch hẹn',
                              style: theme.textTheme.bodySmall,
                            ),
                          if (order.addressLabel != null) ...[
                            const SizedBox(height: 3),
                            Text(
                              order.addressLabel!,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: theme.textTheme.bodySmall,
                            ),
                          ],
                          if (order.totalAmount != null) ...[
                            const SizedBox(height: 4),
                            Text(
                              _money(order.totalAmount!),
                              style: theme.textTheme.titleSmall?.copyWith(
                                color: theme.colorScheme.primary,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                ],
              ),
              if (!providerView && order.providerName != null) ...[
                const SizedBox(height: 10),
                Row(
                  children: [
                    ProviderAvatar(
                      url: order.providerAvatar,
                      gender: order.providerGender,
                      size: 28,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        order.providerName!,
                        style: theme.textTheme.bodySmall?.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    Icon(
                      Icons.verified,
                      size: 16,
                      color: theme.colorScheme.primary,
                    ),
                  ],
                ),
              ],
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: OrderChatButton(
                      orderId: order.id,
                      status: order.status,
                      hasProvider: providerView || order.providerName != null,
                      providerView: providerView,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: () =>
                          context.push('/$role/orders/${order.id}'),
                      icon: const Icon(Icons.track_changes, size: 17),
                      label: Text(action),
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

class OrderStatusBadge extends StatelessWidget {
  const OrderStatusBadge({
    required this.label,
    required this.color,
    this.trailingIcon,
    super.key,
  });
  final String label;
  final Color color;
  final IconData? trailingIcon;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
    decoration: BoxDecoration(
      color: color.withValues(alpha: .12),
      borderRadius: BorderRadius.circular(999),
    ),
    child: trailingIcon == null
        ? Text(
            label,
            style: TextStyle(
              color: color,
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          )
        : Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Flexible(
                child: Text(
                  label,
                  style: TextStyle(
                    color: color,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              const SizedBox(width: 6),
              Icon(trailingIcon, color: color, size: 16),
            ],
          ),
  );
}

Color customerOrderStatusColor(ThemeData theme, String status) =>
    switch (status) {
      'completed' => theme.colorScheme.secondary,
      'cancelled' => theme.colorScheme.error,
      'in_progress' || 'accepted' => theme.colorScheme.primary,
      'awaiting_payment' => theme.colorScheme.tertiary,
      'finding_provider' ||
      'awaiting_confirmation' => theme.colorScheme.primary,
      _ => theme.colorScheme.secondary,
    };

class OrderDetailScreen extends ConsumerStatefulWidget {
  const OrderDetailScreen({required this.orderId, super.key});
  final String orderId;
  @override
  ConsumerState<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends ConsumerState<OrderDetailScreen> {
  String get orderId => widget.orderId;
  bool busy = false;
  @override
  Widget build(BuildContext context) {
    final state = ref.watch(orderDetailProvider(orderId));
    return Scaffold(
      appBar: AppBar(
        title: const Text('Chi tiết đơn hàng'),
        actions: [
          if (state.asData?.value != null)
            PopupMenuButton<String>(
              tooltip: 'Tác vụ đơn hàng',
              icon: const Icon(Icons.more_vert),
              itemBuilder: (context) {
                final order = ref
                    .read(orderDetailProvider(orderId))
                    .asData
                    ?.value;
                if (order == null) return [];
                return [
                  if (order.canCancelAt(DateTime.now()))
                    const PopupMenuItem(
                      value: 'cancel',
                      child: Text('Hủy đơn'),
                    ),
                  if (order.orderType == 'recurring' &&
                      order.canCancelAt(DateTime.now()))
                    const PopupMenuItem(
                      value: 'cancelSeries',
                      child: Text('Hủy buổi này và các buổi sau'),
                    ),
                  const PopupMenuItem(
                    value: 'report',
                    child: Text('Báo cáo đơn hàng'),
                  ),
                ];
              },
              onSelected: (action) {
                final order = ref
                    .read(orderDetailProvider(orderId))
                    .asData
                    ?.value;
                if (order == null || busy) return;
                if (action == 'report') {
                  showOrderReport(context, order);
                } else if (order.canCancelAt(DateTime.now())) {
                  _cancel(
                    context,
                    ref,
                    order,
                    series: action == 'cancelSeries',
                  );
                }
              },
            ),
        ],
      ),
      body: state.when(
        loading: () => const AppLoading(),
        error: (error, _) => AppMessage(
          message: _message(error),
          onRetry: () => ref.invalidate(orderDetailProvider(orderId)),
        ),
        data: (order) {
          final hasQuotation =
              order.hasAdditionalQuotation ||
              order.currentQuotationId != null ||
              order.inspectionRequired;
          final quotation = hasQuotation
              ? ref.watch(orderQuotationProvider(order.id))
              : const AsyncData<RepairQuotation?>(null);
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              OrderDetailOverview(order: order),
              const SizedBox(height: 16),
              OrderPaymentPanel(
                order: order,
                quotation: quotation.asData?.value,
              ),
              OrderFollowupPanel(order: order),
              if (order.customerAttachments.isNotEmpty)
                _OrderImages(
                  title: 'Ảnh sự cố',
                  urls: order.customerAttachments,
                ),
              if (order.completionEvidenceImages.isNotEmpty)
                _OrderImages(
                  title: 'Ảnh nghiệm thu',
                  urls: order.completionEvidenceImages,
                ),
              if (order.completionNote != null)
                _InfoTile(
                  icon: Icons.task_alt,
                  title: 'Ghi chú nghiệm thu',
                  value: order.completionNote!,
                ),
              if (order.problemDescription?.isNotEmpty == true)
                _InfoTile(
                  icon: Icons.notes_outlined,
                  title: 'Mô tả',
                  value: order.problemDescription!,
                ),
              const SizedBox(height: 8),
              const SizedBox(height: 16),
              OrderProgressTimeline(order: order),
              if (hasQuotation) ...[
                const SizedBox(height: 16),
                quotation.when(
                  loading: () =>
                      const Center(child: CircularProgressIndicator()),
                  error: (_, _) => AppMessage(
                    message: 'Chưa thể tải báo giá của thợ.',
                    onRetry: () =>
                        ref.invalidate(orderQuotationProvider(order.id)),
                  ),
                  data: (value) => value == null
                      ? const SizedBox.shrink()
                      : OrderQuotationSection(quotation: value),
                ),
              ],
            ],
          );
        },
      ),
    );
  }

  Future<void> _cancel(
    BuildContext context,
    WidgetRef ref,
    OrderDetail order, {
    bool series = false,
  }) async {
    if (busy) return;
    setState(() => busy = true);
    final reason = await _reasonDialog(context);
    if (reason == null || reason.trim().isEmpty) {
      if (mounted) setState(() => busy = false);
      return;
    }
    try {
      final preview = await ref
          .read(orderRepositoryProvider)
          .cancellationPreview(orderId, series: series);
      if (!context.mounted) return;
      if (!preview.canCancel) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(preview.policyReason ?? 'Đã hết thời hạn hủy đơn.'),
          ),
        );
        return;
      }
      final approved = await showDialog<bool>(
        context: context,
        builder: (_) => AlertDialog(
          title: const Text('Xác nhận hủy đơn'),
          content: Text(
            'Số tiền hoàn dự kiến: ${_money(preview.refundAmount)}\nPhí hủy: ${_money(preview.cancellationFee)}\n${preview.policyReason ?? ''}',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Quay lại'),
            ),
            StreamBuilder<int>(
              stream: Stream<int>.periodic(
                const Duration(seconds: 1),
                (index) => index,
              ),
              builder: (context, snapshot) => FilledButton(
                onPressed: order.canCancelAt(DateTime.now())
                    ? () => Navigator.pop(context, true)
                    : null,
                child: const Text('Xác nhận'),
              ),
            ),
          ],
        ),
      );
      if (approved != true) return;
      await ref
          .read(orderRepositoryProvider)
          .cancel(orderId, reason, preview: preview, series: series);
      ref.invalidate(orderDetailProvider(orderId));
      ref.invalidate(orderListProvider);
      ref.invalidate(orderPageProvider);
      ref.invalidate(pendingOrderProvider);
      if (context.mounted)
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Đã gửi yêu cầu hủy đơn.')),
        );
    } catch (error) {
      if (context.mounted)
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(_message(error))));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }
}

class _InfoTile extends StatelessWidget {
  const _InfoTile({
    required this.icon,
    required this.title,
    required this.value,
  });
  final IconData icon;
  final String title, value;
  @override
  Widget build(BuildContext context) => Card(
    child: ListTile(
      leading: Icon(icon),
      title: Text(title),
      subtitle: Text(value),
    ),
  );
}

class _ReasonDialog extends StatefulWidget {
  const _ReasonDialog({this.title = 'Lý do hủy đơn'});
  final String title;
  @override
  State<_ReasonDialog> createState() => _ReasonDialogState();
}

class _ReasonDialogState extends State<_ReasonDialog> {
  final controller = TextEditingController();
  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: Text(widget.title),
    content: TextField(
      controller: controller,
      maxLines: 3,
      decoration: const InputDecoration(hintText: 'Nhập lý do'),
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context),
        child: const Text('Bỏ qua'),
      ),
      FilledButton(
        onPressed: () => Navigator.pop(context, controller.text.trim()),
        child: const Text('Tiếp tục'),
      ),
    ],
  );
}

Future<String?> _reasonDialog(
  BuildContext context, {
  String title = 'Lý do hủy đơn',
}) => showDialog<String>(
  context: context,
  builder: (_) => _ReasonDialog(title: title),
);
String _money(double value) => NumberFormat.currency(
  locale: 'vi_VN',
  symbol: 'đ',
  decimalDigits: 0,
).format(value);
String _message(Object error) => error is ApiException
    ? error.message
    : 'Không thể thực hiện thao tác. Vui lòng thử lại.';

class _OrderImages extends StatelessWidget {
  const _OrderImages({required this.title, required this.urls});
  final String title;
  final List<String> urls;
  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: urls
                .map(
                  (url) => Image.network(
                    url,
                    width: 96,
                    height: 96,
                    fit: BoxFit.cover,
                    cacheWidth: 288,
                    errorBuilder: (_, error, stack) =>
                        const Icon(Icons.broken_image_outlined),
                  ),
                )
                .toList(),
          ),
        ],
      ),
    ),
  );
}
