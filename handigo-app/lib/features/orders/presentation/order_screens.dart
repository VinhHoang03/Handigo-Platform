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

final orderRepositoryProvider = Provider<OrderRepository>((ref) => OrderRepository(ref.watch(apiClientProvider)));
final orderListProvider = FutureProvider.autoDispose((ref) => OrderRepository(ref.watch(apiClientProvider)).list(ref.watch(authControllerProvider).user!));
final orderDetailProvider = FutureProvider.autoDispose.family<OrderDetail, String>((ref, id) => ref.watch(orderRepositoryProvider).detail(id));

String orderStatusLabel(String value) => {
  'created': 'Đã tạo', 'accepted': 'Đã nhận', 'in_progress': 'Đang thực hiện',
  'completed': 'Hoàn thành', 'cancelled': 'Đã hủy',
}[value] ?? value;

class OrderListScreen extends ConsumerStatefulWidget {
  const OrderListScreen({super.key});
  @override
  ConsumerState<OrderListScreen> createState() => _OrderListScreenState();
}

class _OrderListScreenState extends ConsumerState<OrderListScreen> {
  String _selectedFilter = 'all';

  @override
  Widget build(BuildContext context) {
    final orders = ref.watch(orderListProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Lịch sử đơn hàng')),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(orderListProvider.future),
        child: orders.when(
          loading: () => const AppLoading(),
          error: (error, _) => AppMessage(message: _message(error), onRetry: () => ref.invalidate(orderListProvider)),
          data: (page) {
            if (page.items.isEmpty) return const AppMessage(message: 'Bạn chưa có đơn hàng nào.');
            final filtered = _selectedFilter == 'all'
                ? page.items
                : page.items.where((item) => _matchesFilter(item.status, _selectedFilter)).toList();
            return ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
              itemCount: filtered.isEmpty ? 2 : filtered.length + 1,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (_, index) {
                if (index == 0) return _OrderFilters(orders: page.items, selected: _selectedFilter, onSelected: (value) => setState(() => _selectedFilter = value));
                if (filtered.isEmpty) return const Padding(padding: EdgeInsets.symmetric(vertical: 32), child: Center(child: Text('Không có đơn hàng ở trạng thái này.')));
                return OrderSummaryCard(order: filtered[index - 1]);
              },
            );
          },
        ),
      ),
    );
  }
}

class _OrderFilters extends StatelessWidget {
  const _OrderFilters({required this.orders, required this.selected, required this.onSelected});
  final List<OrderSummary> orders;
  final String selected;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) => SizedBox(
    height: 42,
    child: ListView(
      scrollDirection: Axis.horizontal,
      children: [
        _OrderFilterChip(label: 'Tất cả', value: 'all', count: orders.length, selected: selected, onSelected: onSelected),
        _OrderFilterChip(label: 'Chờ xác nhận', value: 'created', count: _countFor(orders, 'created'), selected: selected, onSelected: onSelected),
        _OrderFilterChip(label: 'Đang thực hiện', value: 'in_progress', count: _countFor(orders, 'in_progress'), selected: selected, onSelected: onSelected),
        _OrderFilterChip(label: 'Đã hoàn thành', value: 'completed', count: _countFor(orders, 'completed'), selected: selected, onSelected: onSelected),
        _OrderFilterChip(label: 'Đã hủy', value: 'cancelled', count: _countFor(orders, 'cancelled'), selected: selected, onSelected: onSelected),
      ],
    ),
  );
}

class _OrderFilterChip extends StatelessWidget {
  const _OrderFilterChip({required this.label, required this.value, required this.count, required this.selected, required this.onSelected});
  final String label, value, selected;
  final int count;
  final ValueChanged<String> onSelected;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(right: 8),
    child: ChoiceChip(label: Text('$label  $count'), selected: selected == value, onSelected: (_) => onSelected(value)),
  );
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
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: Text('Đơn ${order.code}', style: theme.textTheme.labelMedium)),
            _StatusBadge(label: orderStatusLabel(order.status), color: statusColor),
          ]),
          const SizedBox(height: 10),
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            SizedBox(width: 88, child: ServiceCoverImage(url: order.serviceImage, name: order.serviceName)),
            const SizedBox(width: 10),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(order.serviceName, maxLines: 2, overflow: TextOverflow.ellipsis, style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
              const SizedBox(height: 4),
              if (order.scheduledAt != null)
                Text('Dự kiến: ${DateFormat('HH:mm, dd/MM/yyyy').format(order.scheduledAt!.toLocal())}', style: theme.textTheme.bodySmall),
              if (order.addressLabel != null) ...[
                const SizedBox(height: 3),
                Text(order.addressLabel!, maxLines: 1, overflow: TextOverflow.ellipsis, style: theme.textTheme.bodySmall),
              ],
              if (order.totalAmount != null) ...[
                const SizedBox(height: 4),
                Text(_money(order.totalAmount!), style: theme.textTheme.titleSmall?.copyWith(color: theme.colorScheme.primary, fontWeight: FontWeight.w800)),
              ],
            ])),
          ]),
          if (order.providerName != null) ...[
            const SizedBox(height: 10),
            Row(children: [
              CircleAvatar(
                radius: 14,
                backgroundImage: usableMediaUrl(order.providerAvatar) == null
                    ? null
                    : NetworkImage(usableMediaUrl(order.providerAvatar)!),
                child: usableMediaUrl(order.providerAvatar) == null
                    ? const Icon(Icons.person, size: 16)
                    : null,
              ),
              const SizedBox(width: 8),
              Expanded(child: Text(order.providerName!, style: theme.textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w600))),
              Icon(Icons.verified, size: 16, color: theme.colorScheme.primary),
            ]),
          ],
          const SizedBox(height: 10),
          Row(children: [
            Expanded(child: OutlinedButton.icon(
              onPressed: () => context.push('/customer/chat/order/${order.id}'),
              icon: const Icon(Icons.chat_bubble_outline, size: 17),
              label: const Text('Nhắn tin'),
            )),
            const SizedBox(width: 8),
            Expanded(child: FilledButton.icon(
              onPressed: () => context.push('/customer/orders/${order.id}/tracking'),
              icon: const Icon(Icons.track_changes, size: 17),
              label: const Text('Xem tiến trình'),
            )),
          ]),
        ]),
      ),
    );
  }
}

bool _matchesFilter(String status, String filter) {
  if (filter == 'in_progress') return status == 'accepted' || status == 'in_progress';
  return status == filter;
}

int _countFor(List<OrderSummary> orders, String filter) =>
    orders.where((order) => _matchesFilter(order.status, filter)).length;


class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.label, required this.color});
  final String label;
  final Color color;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
    decoration: BoxDecoration(color: color.withValues(alpha: .12), borderRadius: BorderRadius.circular(999)),
    child: Text(label, style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w700)),
  );
}

Color _statusColor(ThemeData theme, String status) => switch (status) {
  'completed' => theme.colorScheme.secondary,
  'cancelled' => theme.colorScheme.error,
  'in_progress' || 'accepted' => theme.colorScheme.primary,
  _ => theme.colorScheme.secondary,
};

class OrderDetailScreen extends ConsumerWidget {
  const OrderDetailScreen({required this.orderId, super.key});
  final String orderId;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(orderDetailProvider(orderId));
    return Scaffold(appBar: AppBar(title: const Text('Chi tiết đơn hàng')),
      body: state.when(
        loading: () => const AppLoading(),
        error: (error, _) => AppMessage(message: _message(error), onRetry: () => ref.invalidate(orderDetailProvider(orderId))),
        data: (order) => ListView(padding: const EdgeInsets.all(16), children: [
          Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(order.serviceName, style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8), Text('Mã đơn: ${order.code}'),
            Text('Trạng thái: ${orderStatusLabel(order.status)}'),
            Text('Thanh toán: ${order.paymentStatus}'),
            if (order.totalAmount != null) Text('Tổng tiền: ${_money(order.totalAmount!)}'),
          ]))),
          if (order.providerName != null) _InfoTile(icon: Icons.person_outline, title: 'Nhà cung cấp', value: order.providerName!),
          if (order.addressLabel != null) _InfoTile(icon: Icons.location_on_outlined, title: 'Địa chỉ', value: order.addressLabel!),
          if (order.statusHistory.isNotEmpty) ...[
            const SizedBox(height: 16),
            Text('Lịch sử trạng thái', style: Theme.of(context).textTheme.titleMedium),
            for (final event in order.statusHistory) ListTile(
              leading: const Icon(Icons.history), title: Text(orderStatusLabel(event.status)),
              subtitle: event.createdAt == null ? null : Text(DateFormat('dd/MM/yyyy HH:mm').format(event.createdAt!.toLocal())),
            ),
          ],
          if (order.problemDescription?.isNotEmpty == true) _InfoTile(icon: Icons.notes_outlined, title: 'Mô tả', value: order.problemDescription!),
          const SizedBox(height: 8),
          if (order.status != 'cancelled' && order.status != 'completed') FilledButton.icon(
            onPressed: () => _cancel(context, ref), icon: const Icon(Icons.cancel_outlined), label: const Text('Hủy đơn')),
          if (order.providerName != null && ['accepted', 'in_progress', 'completed'].contains(order.status)) OutlinedButton.icon(
            onPressed: () => context.push('/customer/chat/order/${order.id}'), icon: const Icon(Icons.chat_outlined), label: const Text('Nhắn tin với nhà cung cấp')),
          if (order.status == 'accepted' || order.status == 'in_progress') OutlinedButton.icon(
            onPressed: () => context.push('/customer/orders/${order.id}/tracking'), icon: const Icon(Icons.location_searching), label: const Text('Theo dõi đơn')),
          if (order.hasAdditionalQuotation) OutlinedButton.icon(
            onPressed: () => _openQuotation(context, ref, order), icon: const Icon(Icons.request_quote_outlined), label: const Text('Xem báo giá phát sinh')),
        ]),
      ),
    );
  }

  Future<void> _cancel(BuildContext context, WidgetRef ref) async {
    final reason = await _reasonDialog(context);
    if (reason == null) return;
    try {
      final preview = await ref.read(orderRepositoryProvider).cancellationPreview(orderId);
      if (!context.mounted) return;
      final approved = await showDialog<bool>(context: context, builder: (_) => AlertDialog(
        title: const Text('Xác nhận hủy đơn'), content: Text('Số tiền hoàn dự kiến: ${_money(preview.refundAmount)}\nPhí hủy: ${_money(preview.cancellationFee)}\n${preview.policyReason ?? ''}'),
        actions: [TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Quay lại')), FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Xác nhận'))],
      ));
      if (approved != true) return;
      await ref.read(orderRepositoryProvider).cancel(orderId, reason);
      ref.invalidate(orderDetailProvider(orderId)); ref.invalidate(orderListProvider);
      if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Đã gửi yêu cầu hủy đơn.')));
    } catch (error) { if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(_message(error)))); }
  }

  Future<void> _openQuotation(BuildContext context, WidgetRef ref, OrderDetail order) async {
    final quotation = await ref.read(orderRepositoryProvider).quotation(orderId);
    if (!context.mounted || quotation == null) return;
    final action = await showModalBottomSheet<String>(context: context, builder: (_) => _QuotationSheet(quotation: quotation));
    try {
      if (action == 'confirm') await ref.read(orderRepositoryProvider).confirmQuotation(quotation.id);
      if (action == 'reject') await ref.read(orderRepositoryProvider).rejectQuotation(quotation.id, 'Khách hàng chưa đồng ý báo giá.');
      if (action != null) { ref.invalidate(orderDetailProvider(orderId)); if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Đã cập nhật báo giá.'))); }
    } catch (error) { if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(_message(error)))); }
  }
}

class _QuotationSheet extends StatelessWidget {
  const _QuotationSheet({required this.quotation});
  final RepairQuotation quotation;
  @override
  Widget build(BuildContext context) => SafeArea(child: Padding(padding: const EdgeInsets.all(20), child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
    Text('Báo giá phát sinh', style: Theme.of(context).textTheme.titleLarge),
    ...quotation.items.map((item) => ListTile(contentPadding: EdgeInsets.zero, title: Text(item.title), subtitle: Text('${item.quantity} x ${_money(item.unitPrice)}'), trailing: Text(_money(item.quantity * item.unitPrice)))),
    Text('Tổng báo giá: ${_money(quotation.finalAmount)}', style: Theme.of(context).textTheme.titleMedium),
    const SizedBox(height: 12),
    if (quotation.status == 'pending') Row(children: [Expanded(child: OutlinedButton(onPressed: () => Navigator.pop(context, 'reject'), child: const Text('Từ chối'))), const SizedBox(width: 12), Expanded(child: FilledButton(onPressed: () => Navigator.pop(context, 'confirm'), child: const Text('Đồng ý')))]),
  ])));
}

class _InfoTile extends StatelessWidget { const _InfoTile({required this.icon, required this.title, required this.value}); final IconData icon; final String title, value; @override Widget build(BuildContext context) => Card(child: ListTile(leading: Icon(icon), title: Text(title), subtitle: Text(value))); }
class _ReasonDialog extends StatefulWidget { const _ReasonDialog(); @override State<_ReasonDialog> createState() => _ReasonDialogState(); }
class _ReasonDialogState extends State<_ReasonDialog> { final controller = TextEditingController(); @override void dispose() { controller.dispose(); super.dispose(); } @override Widget build(BuildContext context) => AlertDialog(title: const Text('Lý do hủy đơn'), content: TextField(controller: controller, maxLines: 3, decoration: const InputDecoration(hintText: 'Nhập lý do')), actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('Bỏ qua')), FilledButton(onPressed: () => Navigator.pop(context, controller.text.trim()), child: const Text('Tiếp tục'))]); }
Future<String?> _reasonDialog(BuildContext context) => showDialog<String>(context: context, builder: (_) => const _ReasonDialog());
String _money(double value) => NumberFormat.currency(locale: 'vi_VN', symbol: 'đ', decimalDigits: 0).format(value);
String _message(Object error) => error is ApiException ? error.message : 'Không thể thực hiện thao tác. Vui lòng thử lại.';
