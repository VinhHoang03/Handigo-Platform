import '../../../shared/widgets/service_images.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../app/providers/app_providers.dart';
import '../../../core/network/api_exception.dart';
import '../../../shared/utils/media_url.dart';
import '../../../shared/widgets/app_states.dart';
import '../data/order_repository.dart';
import '../domain/order_summary.dart';
import 'order_payment_panel.dart';
import 'order_followup_panel.dart';
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
      appBar: AppBar(title: const Text('Lịch sử đơn hàng')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: TextField(
              maxLength: 100,
              textInputAction: TextInputAction.search,
              decoration: const InputDecoration(
                labelText: 'Tìm đơn hàng',
                prefixIcon: Icon(Icons.search),
                counterText: '',
              ),
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
                  'created': 'Chờ xác nhận',
                  'accepted': 'Đã nhận',
                  'in_progress': 'Đang thực hiện',
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
          if (state.asData != null)
            SafeArea(
              top: false,
              child: Wrap(
                alignment: WrapAlignment.spaceAround,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  TextButton(
                    onPressed: page > 1 ? () => setState(() => page--) : null,
                    child: const Text('Trang trước'),
                  ),
                  Text(
                    'Trang $page / ${state.asData!.value.totalPages.clamp(1, 100000)}',
                  ),
                  TextButton(
                    onPressed: page < state.asData!.value.totalPages
                        ? () => setState(() => page++)
                        : null,
                    child: const Text('Trang sau'),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class OrderSummaryCard extends StatelessWidget {
  const OrderSummaryCard({required this.order, super.key});
  final OrderSummary order;
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final statusColor = _statusColor(theme, order.status);
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => context.push('/customer/orders/${order.id}'),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      'Đơn ${order.code}',
                      style: theme.textTheme.labelMedium,
                    ),
                  ),
                  _StatusBadge(
                    label: orderStatusLabel(order.status),
                    color: statusColor,
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    width: 88,
                    child: ServiceCoverImage(
                      url: order.serviceImage,
                      name: order.serviceName,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          order.serviceName,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.titleSmall?.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 4),
                        if (order.scheduledAt != null)
                          Text(
                            'Dự kiến: ${DateFormat('HH:mm, dd/MM/yyyy').format(order.scheduledAt!.toLocal())}',
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
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
              if (order.providerName != null) ...[
                const SizedBox(height: 10),
                Row(
                  children: [
                    CircleAvatar(
                      radius: 14,
                      backgroundImage:
                          usableMediaUrl(order.providerAvatar) == null
                          ? null
                          : NetworkImage(usableMediaUrl(order.providerAvatar)!),
                      child: usableMediaUrl(order.providerAvatar) == null
                          ? const Icon(Icons.person, size: 16)
                          : null,
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
                    child: OutlinedButton.icon(
                      onPressed: order.providerName == null
                          ? null
                          : () => context.push(
                              '/customer/chat/order/${order.id}',
                            ),
                      icon: const Icon(Icons.chat_bubble_outline, size: 17),
                      label: const Text('Nhắn tin'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: () =>
                          context.push('/customer/orders/${order.id}'),
                      icon: const Icon(Icons.track_changes, size: 17),
                      label: const Text('Xem chi tiết'),
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

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.label, required this.color});
  final String label;
  final Color color;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
    decoration: BoxDecoration(
      color: color.withValues(alpha: .12),
      borderRadius: BorderRadius.circular(999),
    ),
    child: Text(
      label,
      style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w700),
    ),
  );
}

Color _statusColor(ThemeData theme, String status) => switch (status) {
  'completed' => theme.colorScheme.secondary,
  'cancelled' => theme.colorScheme.error,
  'in_progress' || 'accepted' => theme.colorScheme.primary,
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
      appBar: AppBar(title: const Text('Chi tiết đơn hàng')),
      body: state.when(
        loading: () => const AppLoading(),
        error: (error, _) => AppMessage(
          message: _message(error),
          onRetry: () => ref.invalidate(orderDetailProvider(orderId)),
        ),
        data: (order) => ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      order.serviceName,
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 8),
                    Text('Mã đơn: ${order.code}'),
                    Text('Trạng thái: ${orderStatusLabel(order.status)}'),
                    Text(
                      'Lịch hẹn: ${{'not_required': 'Không yêu cầu giữ lịch', 'awaiting_provider': 'Đang tìm thợ', 'awaiting_payment': 'Chờ thanh toán giữ lịch', 'confirmed': 'Đã xác nhận', 'reserved': 'Đã giữ lịch', 'rejected': 'Cần chọn lại thợ'}[order.bookingStatus] ?? order.bookingStatus}',
                    ),
                    if (order.totalAmount != null)
                      Text(
                        '${order.inspectionRequired ? 'Giá trị cọc sau ưu đãi' : 'Giá trị đơn'}: ${_money(order.totalAmount!)}',
                      ),
                  ],
                ),
              ),
            ),
            if (order.providerName != null)
              _InfoTile(
                icon: Icons.person_outline,
                title: 'Nhà cung cấp',
                value: order.providerName!,
              ),
            for (final option in order.selectedOptions)
              ListTile(
                title: Text('${option['name'] ?? 'Gói dịch vụ'}'),
                subtitle: Text('Số lượng: ${option['quantity'] ?? 1}'),
              ),
            OrderPaymentPanel(order: order),
            OrderFollowupPanel(order: order),
            if (order.customerAttachments.isNotEmpty)
              _OrderImages(title: 'Ảnh sự cố', urls: order.customerAttachments),
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
            if (order.addressLabel != null)
              _InfoTile(
                icon: Icons.location_on_outlined,
                title: 'Địa chỉ',
                value: order.addressLabel!,
              ),
            if (order.statusHistory.isNotEmpty) ...[
              const SizedBox(height: 16),
              Text(
                'Lịch sử trạng thái',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              for (final event in order.statusHistory)
                ListTile(
                  leading: const Icon(Icons.history),
                  title: Text(orderStatusLabel(event.status)),
                  subtitle: event.createdAt == null
                      ? null
                      : Text(
                          DateFormat(
                            'dd/MM/yyyy HH:mm',
                          ).format(event.createdAt!.toLocal()),
                        ),
                ),
            ],
            if (order.problemDescription?.isNotEmpty == true)
              _InfoTile(
                icon: Icons.notes_outlined,
                title: 'Mô tả',
                value: order.problemDescription!,
              ),
            const SizedBox(height: 8),
            if (order.status != 'cancelled' && order.status != 'completed')
              StreamBuilder<int>(
                stream: Stream<int>.periodic(
                  const Duration(seconds: 1),
                  (index) => index,
                ),
                builder: (context, snapshot) => FilledButton.icon(
                  onPressed: !busy && order.canCancelAt(DateTime.now())
                      ? () => _cancel(context, ref, order)
                      : null,
                  icon: const Icon(Icons.cancel_outlined),
                  label: const Text('Hủy đơn'),
                ),
              ),
            if (order.orderType == 'recurring' &&
                ['created', 'accepted'].contains(order.status))
              OutlinedButton(
                onPressed: busy
                    ? null
                    : () => _cancel(context, ref, order, series: true),
                child: const Text('Hủy buổi này và các buổi sau'),
              ),
            if (order.providerName != null &&
                ['accepted', 'in_progress', 'completed'].contains(order.status))
              OutlinedButton.icon(
                onPressed: () =>
                    context.push('/customer/chat/order/${order.id}'),
                icon: const Icon(Icons.chat_outlined),
                label: const Text('Nhắn tin với nhà cung cấp'),
              ),
            if (order.canTrack)
              OutlinedButton.icon(
                onPressed: () =>
                    context.push('/customer/orders/${order.id}/tracking'),
                icon: const Icon(Icons.location_searching),
                label: const Text('Theo dõi đơn'),
              ),
            if (order.hasAdditionalQuotation)
              OutlinedButton.icon(
                onPressed: busy
                    ? null
                    : () => _openQuotation(context, ref, order),
                icon: const Icon(Icons.request_quote_outlined),
                label: const Text('Xem báo giá sửa chữa'),
              ),
          ],
        ),
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

  Future<void> _openQuotation(
    BuildContext context,
    WidgetRef ref,
    OrderDetail order,
  ) async {
    if (busy) return;
    setState(() => busy = true);
    try {
      final quotation = await ref
          .read(orderRepositoryProvider)
          .quotation(orderId);
      if (!context.mounted) return;
      if (quotation == null) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Chưa có báo giá.')));
        return;
      }
      final action = await showModalBottomSheet<String>(
        context: context,
        isScrollControlled: true,
        builder: (_) => _QuotationSheet(
          quotation: quotation,
          deposit: order.appliedDeposit,
        ),
      );
      if (!context.mounted || action == null) return;
      if (action == 'confirm')
        await ref.read(orderRepositoryProvider).confirmQuotation(quotation.id);
      if (action == 'reject') {
        final reason = await _reasonDialog(
          context,
          title: 'Lý do từ chối báo giá',
        );
        if (reason == null || reason.trim().isEmpty) return;
        await ref
            .read(orderRepositoryProvider)
            .rejectQuotation(quotation.id, reason);
      }
      ref.invalidate(orderDetailProvider(orderId));
      ref.invalidate(orderQuotationProvider(orderId));
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

class _QuotationSheet extends StatelessWidget {
  const _QuotationSheet({required this.quotation, required this.deposit});
  final double deposit;
  final RepairQuotation quotation;
  @override
  Widget build(BuildContext context) => SafeArea(
    child: SingleChildScrollView(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Báo giá phát sinh',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            ...quotation.items.map(
              (item) => ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(item.title),
                subtitle: Text('${item.quantity} x ${_money(item.unitPrice)}'),
                trailing: Text(_money(item.quantity * item.unitPrice)),
              ),
            ),
            Text(
              'Tổng báo giá: ${_money(quotation.finalAmount)}',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            Text('Cọc đã áp dụng: ${_money(deposit)}'),
            Text(
              'Còn thanh toán trực tiếp: ${_money((quotation.finalAmount - deposit).clamp(0, double.infinity))}',
            ),
            Text(
              quotation.directPaymentConfirmedAt == null
                  ? 'Thanh toán phần sửa chữa trực tiếp với chuyên gia.'
                  : 'Chuyên gia đã xác nhận nhận tiền trực tiếp.',
            ),
            if (quotation.inspectionNote != null)
              Text(quotation.inspectionNote!),
            if (quotation.recommendation != null)
              Text(quotation.recommendation!),
            const SizedBox(height: 12),
            if (quotation.status == 'pending')
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Navigator.pop(context, 'reject'),
                      child: const Text('Từ chối'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: FilledButton(
                      onPressed: () => Navigator.pop(context, 'confirm'),
                      child: const Text('Đồng ý'),
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
