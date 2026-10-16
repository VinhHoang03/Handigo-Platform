import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
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

  @override
  Widget build(BuildContext context) {
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
                : () => ref.invalidate(orderDetailProvider(orderId)),
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: state.when(
        loading: () => const AppLoading(),
        error: (error, _) => AppMessage(
          message: _message(error),
          onRetry: () => ref.invalidate(orderDetailProvider(orderId)),
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
                      if (order.status == 'in_progress') ...[
                        OutlinedButton.icon(
                          onPressed: busy
                              ? null
                              : () => _quotation(context, ref),
                          icon: const Icon(
                            Icons.request_quote_outlined,
                            size: 20,
                          ),
                          label: const Text('Gửi báo giá vật tư'),
                        ),
                        const SizedBox(height: 8),
                      ],
                      FilledButton.icon(
                        onPressed: busy
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
      ref.invalidate(providerOverviewProvider);
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
    final title = TextEditingController();
    final price = TextEditingController();
    final quantity = TextEditingController(text: '1');
    final note = TextEditingController();
    final result = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Báo giá vật tư'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: title,
                decoration: const InputDecoration(labelText: 'Tên vật tư'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: quantity,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Số lượng'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: price,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Đơn giá'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: note,
                maxLines: 2,
                decoration: const InputDecoration(
                  labelText: 'Ghi chú khảo sát',
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Hủy'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Gửi'),
          ),
        ],
      ),
    );
    if (result == true) {
      final parsedPrice = double.tryParse(price.text.trim());
      final parsedQuantity = int.tryParse(quantity.text.trim());
      if (title.text.trim().isEmpty ||
          parsedPrice == null ||
          parsedQuantity == null ||
          parsedQuantity < 1 ||
          parsedPrice < 0) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text(
                'Vui lòng nhập vật tư, số lượng và đơn giá hợp lệ.',
              ),
            ),
          );
        }
      } else if (context.mounted) {
        await _run(
          context,
          ref,
          () => ref.read(providerRepositoryProvider).createQuotation(orderId, [
            {
              'title': title.text.trim(),
              'itemType': 'material',
              'quantity': parsedQuantity,
              'unitPrice': parsedPrice,
            },
          ], note: note.text),
          'Đã gửi báo giá cho khách hàng.',
        );
      }
    }
    title.dispose();
    price.dispose();
    quantity.dispose();
    note.dispose();
  }

  Future<void> _complete(BuildContext context, WidgetRef ref) async {
    final file = await ImagePicker().pickImage(source: ImageSource.gallery);
    if (file == null || !context.mounted) return;
    final note = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Hoàn tất đơn'),
        content: TextField(
          controller: note,
          maxLines: 3,
          decoration: const InputDecoration(labelText: 'Ghi chú nghiệm thu'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Hủy'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Gửi nghiệm thu'),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      if (!mounted || busy) {
        note.dispose();
        return;
      }
      setState(() => busy = true);
      try {
        final url = await ref
            .read(providerRepositoryProvider)
            .uploadEvidence(file);
        await ref.read(providerRepositoryProvider).completeOrder(orderId, [
          url,
        ], note.text);
        ref.invalidate(orderDetailProvider(orderId));
        ref.invalidate(providerOrdersProvider);
        ref.invalidate(providerOverviewProvider);
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Đã gửi yêu cầu hoàn tất đơn.')),
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
    note.dispose();
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
