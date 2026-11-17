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
import '../../../shared/widgets/customer_page_header.dart';
import '../data/order_repository.dart';
import '../domain/order_summary.dart';
import 'order_cancel_sheet.dart';
import 'order_payment_panel.dart';
import 'order_followup_panel.dart';
import 'order_detail_overview.dart';
import 'order_rebook_button.dart';
import 'tracking_screen.dart';
import 'order_reschedule_panel.dart';
import '../../../core/network/paged_result.dart';
import '../../booking/data/pending_booking_store.dart';
import '../../provider/presentation/provider_schedule_preview.dart';

final orderRepositoryProvider = Provider<OrderRepository>(
  (ref) => OrderRepository(ref.watch(apiClientProvider)),
);
final orderListProvider = FutureProvider.autoDispose(
  (ref) => OrderRepository(
    ref.watch(apiClientProvider),
  ).list(ref.watch(authControllerProvider).user!),
);
final orderQuotationProvider = FutureProvider.autoDispose
    .family<RepairQuotation?, String>((ref, id) {
      if (id.startsWith('preview-')) {
        return Future<RepairQuotation?>.value(null);
      }
      return ref.watch(orderRepositoryProvider).quotation(id);
    });
final orderDetailProvider = FutureProvider.autoDispose
    .family<OrderDetail, String>((ref, id) {
      if (id.startsWith('preview-')) {
        final preview = ref.watch(providerUiPreviewProvider);
        final matches = preview?.where((order) => order.id == id);
        if (matches != null && matches.isNotEmpty) {
          return createPreviewOrderDetail(matches.first);
        }
        throw StateError('Không tìm thấy đơn xem thử.');
      }
      return ref.watch(orderRepositoryProvider).detail(id);
    });

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
  final _searchController = TextEditingController();
  int page = 1;
  String status = 'all', search = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final query = (page, status, search);
    final state = ref.watch(orderPageProvider(query));
    final pending = ref.watch(pendingOrderProvider).asData?.value;
    return Scaffold(
      appBar: CustomerPageHeader(
        toolbarHeight: 64 * MediaQuery.textScalerOf(context).scale(1),
        backgroundColor: Theme.of(context).colorScheme.surfaceContainerLowest,
        showBottomBorder: true,
        title: 'Lịch sử đơn hàng',
        centerTitle: false,
        leading: const Center(
          child: CustomerHeaderIcon(Icons.receipt_long_outlined),
        ),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: AppSearchField(
              controller: _searchController,
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
              error: (error, _) => Column(
                children: [
                  Expanded(
                    child: AppMessage(
                      message: _message(error),
                      onRetry: () => ref.invalidate(orderPageProvider(query)),
                    ),
                  ),
                  if (page > 1)
                    TextButton(
                      onPressed: () => setState(() => page--),
                      child: const Text('Về trang trước'),
                    ),
                ],
              ),
              data: (result) => RefreshIndicator(
                onRefresh: () => ref.refresh(orderPageProvider(query).future),
                child: ListView.builder(
                  key: PageStorageKey(query),
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.all(16),
                  itemCount:
                      (result.items.isEmpty ? 1 : result.items.length) +
                      (page > 1 || result.totalPages > 1 ? 1 : 0),
                  itemBuilder: (context, index) {
                    if (index < result.items.length) {
                      return OrderSummaryCard(order: result.items[index]);
                    }
                    if (index == 0) {
                      final isFiltered = status != 'all' || search.isNotEmpty;
                      return AppMessage(
                        icon: Icons.receipt_long_outlined,
                        message: page > 1
                            ? 'Trang này không còn đơn hàng.'
                            : isFiltered
                            ? 'Không có đơn hàng phù hợp.'
                            : 'Bạn chưa có đơn hàng nào.',
                        action: page > 1
                            ? null
                            : isFiltered
                            ? OutlinedButton(
                                onPressed: _clearFilters,
                                child: const Text('Xóa bộ lọc'),
                              )
                            : FilledButton(
                                onPressed: () =>
                                    context.go('/customer/services'),
                                child: const Text('Khám phá dịch vụ'),
                              ),
                      );
                    }
                    return Wrap(
                      alignment: WrapAlignment.center,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      spacing: 8,
                      children: [
                        IconButton(
                          tooltip: 'Trang trước',
                          onPressed: page > 1
                              ? () => setState(() => page--)
                              : null,
                          icon: const Icon(Icons.chevron_left),
                        ),
                        Text(
                          page > result.totalPages
                              ? 'Trang $page'
                              : 'Trang $page / ${result.totalPages}',
                        ),
                        IconButton(
                          tooltip: 'Trang sau',
                          onPressed: page < result.totalPages
                              ? () => setState(() => page++)
                              : null,
                          icon: const Icon(Icons.chevron_right),
                        ),
                      ],
                    );
                  },
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _clearFilters() {
    _searchController.clear();
    setState(() {
      search = '';
      status = 'all';
      page = 1;
    });
  }
}

class OrderSummaryCard extends StatelessWidget {
  const OrderSummaryCard({
    required this.order,
    this.providerView = false,
    this.providerInfo,
    this.statusLeading,
    super.key,
  });
  final bool providerView;
  final OrderSummary order;
  final Widget? providerInfo;
  final Widget? statusLeading;

  Widget _info(IconData icon, Widget child) => providerView
      ? Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, size: 18),
            const SizedBox(width: 8),
            Expanded(child: child),
          ],
        )
      : child;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final statusColor = customerOrderStatusColor(
      theme,
      providerView ? order.status : order.customerDisplayStatus,
    );
    final role = providerView ? 'provider' : 'customer';
    final canRebook = !providerView && canRebookOrder(order.status);
    final action = providerView
        ? switch (order.status) {
            'accepted' => 'Xem lịch hẹn',
            'in_progress' => 'Xem tiến trình',
            'completed' => 'Xem kết quả',
            'cancelled' => 'Xem chi tiết hủy',
            _ => 'Xem chi tiết',
          }
        : 'Xem chi tiết';
    final displayedAt = providerView
        ? order.scheduledAt ?? order.createdAt
        : order.scheduledAt;
    final createdAt = order.createdAt;
    final placedAtLabel = !providerView && createdAt != null
        ? DateFormat(
            'dd/MM/yyyy, HH:mm',
          ).format(createdAt.toUtc().add(const Duration(hours: 7)))
        : null;
    final displayedAmount = providerView
        ? order.providerAmount
        : order.totalAmount;
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => context.push('/$role/orders/${order.id}'),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Builder(
                builder: (context) {
                  final codeInfo = _info(
                    Icons.receipt_long_outlined,
                    Text(
                      'Mã đơn ${order.code}'
                      '${placedAtLabel == null ? '' : ' | $placedAtLabel'}',
                      style: theme.textTheme.labelMedium,
                    ),
                  );
                  final badge = OrderStatusBadge(
                    label: providerView
                        ? (order.status == 'created'
                              ? 'Chờ phản hồi'
                              : orderStatusLabel(order.status))
                        : customerOrderStatusLabel(order),
                    color: statusColor,
                  );
                  // Chữ phóng lớn: xếp huy hiệu xuống dòng riêng để không tràn ngang.
                  if (statusLeading != null &&
                      MediaQuery.textScalerOf(context).scale(1) > 1.3) {
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        codeInfo,
                        const SizedBox(height: 6),
                        Row(
                          children: [
                            statusLeading!,
                            const SizedBox(width: 8),
                            Flexible(child: badge),
                          ],
                        ),
                      ],
                    );
                  }
                  return Row(
                    children: [
                      Expanded(child: codeInfo),
                      if (statusLeading != null) ...[
                        statusLeading!,
                        const SizedBox(width: 8),
                      ],
                      badge,
                    ],
                  );
                },
              ),
              const SizedBox(height: 10),
              Stack(
                children: [
                  if (!providerView)
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
                    padding: EdgeInsets.only(left: providerView ? 0 : 106),
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(minHeight: 72),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _info(
                            Icons.handyman_outlined,
                            Text(
                              order.serviceName,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: theme.textTheme.titleSmall?.copyWith(
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                          const SizedBox(height: 4),
                          if (providerView)
                            _info(
                              Icons.event_outlined,
                              Text(
                                order.scheduledAt != null
                                    ? 'Lịch hẹn: ${DateFormat('HH:mm, dd/MM/yyyy').format(order.scheduledAt!.toLocal())}'
                                    : createdAt != null
                                    ? 'Lịch hẹn: Ngay lúc đặt (${DateFormat('HH:mm, dd/MM/yyyy').format(createdAt.toLocal())})'
                                    : 'Lịch hẹn: Chưa chọn thời gian',
                                style: theme.textTheme.bodySmall,
                              ),
                            )
                          else if (displayedAt != null)
                            Text(
                              'Dự kiến thực hiện: ${DateFormat('dd/MM/yyyy, HH:mm').format(displayedAt.toLocal())}',
                              style: theme.textTheme.bodySmall,
                            ),
                          if (order.addressLabel != null) ...[
                            const SizedBox(height: 3),
                            _info(
                              Icons.location_on_outlined,
                              Text(
                                order.addressLabel!,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: theme.textTheme.bodySmall,
                              ),
                            ),
                          ],
                          if (displayedAmount != null) ...[
                            const SizedBox(height: 4),
                            _info(
                              Icons.payments_outlined,
                              Text(
                                _money(displayedAmount),
                                style: theme.textTheme.titleSmall?.copyWith(
                                  color: theme.colorScheme.primary,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ] else if (providerView &&
                              order.inspectionRequired) ...[
                            const SizedBox(height: 4),
                            _info(
                              Icons.request_quote_outlined,
                              Text(
                                'Chưa báo giá',
                                style: theme.textTheme.titleSmall?.copyWith(
                                  color: theme.colorScheme.primary,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                ],
              ),
              if (providerView && providerInfo != null) ...[
                const SizedBox(height: 10),
                providerInfo!,
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
              if (canRebook) ...[
                const SizedBox(height: 8),
                SizedBox(
                  width: double.infinity,
                  child: OrderRebookButton(orderId: order.id),
                ),
              ],
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
        leading: Navigator.of(context).canPop()
            ? null
            : IconButton(
                tooltip: 'Về trang chủ',
                onPressed: () => context.go('/customer'),
                icon: const Icon(Icons.home_outlined),
              ),
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
                if (action == 'report') showOrderReport(context, order);
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
          return RefreshIndicator(
            onRefresh: () async {
              try {
                ref.invalidate(orderDetailProvider(orderId));
                await ref.read(orderDetailProvider(orderId).future);
              } catch (_) {
                // Màn hình hiển thị lỗi và nút thử lại từ trạng thái của đơn.
              }
            },
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              children: [
                if (order.canTrack) ...[
                  OrderTrackingScreen(
                    key: ValueKey('tracking-${order.id}'),
                    orderId: order.id,
                    embedded: true,
                  ),
                  const SizedBox(height: 12),
                ],
                OrderDetailOverview(order: order),
                if (canRebookOrder(order.status) &&
                    order.serviceId != null) ...[
                  const SizedBox(height: 12),
                  OrderRebookButton(orderId: order.id, order: order),
                ],
                const SizedBox(height: 16),
                OrderPaymentPanel(
                  order: order,
                  quotation: quotation.asData?.value,
                ),
                OrderFollowupPanel(order: order),
                if (order.showsCancelActions) _cancelActions(context, order),
                if (order.orderType == 'scheduled' &&
                    order.rescheduleEligibility != null)
                  OrderReschedulePanel(order: order),
                if (order.problemDescription?.trim().isNotEmpty == true ||
                    order.customerAttachments.isNotEmpty)
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: OrderProblemDescription(order: order),
                    ),
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
            ),
          );
        },
      ),
    );
  }

  /// Nút hủy đơn/chuỗi lịch hiển thị trực tiếp, đồng bộ với web.
  Widget _cancelActions(BuildContext context, OrderDetail order) {
    final scheme = Theme.of(context).colorScheme;
    final enabled = !busy && order.canCancelAt(DateTime.now());
    final recurring = order.orderType == 'recurring';
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          OutlinedButton.icon(
            style: OutlinedButton.styleFrom(
              foregroundColor: scheme.error,
              side: BorderSide(color: scheme.error.withValues(alpha: 0.3)),
              minimumSize: const Size.fromHeight(48),
            ),
            onPressed: enabled ? () => _cancel(context, ref, order) : null,
            icon: busy
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.close, size: 16),
            label: Text(recurring ? 'Hủy buổi này' : 'Hủy yêu cầu'),
          ),
          if (recurring) ...[
            const SizedBox(height: 8),
            FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: scheme.error,
                foregroundColor: scheme.onError,
                minimumSize: const Size.fromHeight(48),
              ),
              onPressed: enabled
                  ? () => _cancel(context, ref, order, series: true)
                  : null,
              child: const Text('Hủy buổi này và các buổi sau'),
            ),
          ],
        ],
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
    final repository = ref.read(orderRepositoryProvider);
    try {
      CancellationPreview preview;
      try {
        preview = await repository.cancellationPreview(
          orderId,
          series: series,
        );
      } catch (_) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text(
                'Không thể tải chính sách hoàn tiền. Vui lòng đóng và thử lại.',
              ),
            ),
          );
        }
        return;
      }
      if (!context.mounted) return;
      final cancelled = await showOrderCancelSheet(
        context,
        order: order,
        preview: preview,
        reload: () async {
          final fresh = await repository.cancellationPreview(
            orderId,
            series: series,
          );
          ref.invalidate(orderDetailProvider(orderId));
          return fresh;
        },
        submit: (reason, confirmed) => repository.cancel(
          orderId,
          reason,
          preview: confirmed,
          series: series,
        ),
      );
      if (cancelled != true) return;
      ref.invalidate(orderDetailProvider(orderId));
      ref.invalidate(orderListProvider);
      ref.invalidate(orderPageProvider);
      ref.invalidate(pendingOrderProvider);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Đã hủy lịch dịch vụ.')),
        );
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
          OrderImageGrid(urls: urls),
        ],
      ),
    ),
  );
}
