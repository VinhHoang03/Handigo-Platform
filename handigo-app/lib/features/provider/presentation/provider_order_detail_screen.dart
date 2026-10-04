import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import '../../../app/theme/app_theme.dart';
import '../../../core/network/api_exception.dart';
import '../../../shared/widgets/app_states.dart';
import '../../orders/presentation/order_screens.dart';
import 'provider_screens.dart';

class ProviderOrderDetailScreen extends ConsumerWidget {
  const ProviderOrderDetailScreen({required this.orderId, super.key});
  final String orderId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(orderDetailProvider(orderId));
    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Chi tiết đơn #${orderId.length > 6 ? orderId.substring(0, 6) : orderId}',
        ),
        actions: [
          IconButton(
            onPressed: () => ref.invalidate(orderDetailProvider(orderId)),
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
          padding: const EdgeInsets.all(16),
          children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            order.serviceName,
                            style: Theme.of(context).textTheme.titleLarge
                                ?.copyWith(fontWeight: FontWeight.w800),
                          ),
                        ),
                        _DetailStatus(
                          label: orderStatusLabel(order.status),
                          status: order.status,
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Text(
                      'Mã đơn: ${order.code}',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    if (order.scheduledAt != null) ...[
                      const SizedBox(height: 7),
                      Row(
                        children: [
                          const Icon(Icons.schedule_outlined, size: 18),
                          const SizedBox(width: 7),
                          Text(_date(order.scheduledAt!)),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
            ),
            if (order.addressLabel != null)
              _DetailSection(
                title: 'Địa chỉ thực hiện',
                icon: Icons.location_on_outlined,
                child: Text(order.addressLabel!),
              ),
            if (order.problemDescription?.isNotEmpty == true)
              _DetailSection(
                title: 'Nội dung dịch vụ yêu cầu',
                icon: Icons.notes_outlined,
                child: Text(order.problemDescription!),
              ),
            _DetailSection(
              title: 'Thông tin thanh toán',
              icon: Icons.payments_outlined,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    order.paymentMethod.isEmpty
                        ? 'Chưa cập nhật phương thức'
                        : order.paymentMethod,
                  ),
                  Text(
                    order.totalAmount == null
                        ? '—'
                        : _money(order.totalAmount!),
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Quy trình thực hiện của thợ',
              style: Theme.of(
                context,
              ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 8),
            _WorkProcess(status: order.status),
            const SizedBox(height: 8),
            if (order.status == 'accepted')
              FilledButton.icon(
                onPressed: () => _run(
                  context,
                  ref,
                  () =>
                      ref.read(providerRepositoryProvider).startOrder(orderId),
                  'Đã bắt đầu thực hiện đơn.',
                ),
                icon: const Icon(Icons.play_arrow),
                label: const Text('Bắt đầu thực hiện'),
              ),
            if (order.status == 'in_progress') ...[
              OutlinedButton.icon(
                onPressed: () => _quotation(context, ref),
                icon: const Icon(Icons.request_quote_outlined),
                label: const Text('Gửi báo giá vật tư'),
              ),
              OutlinedButton.icon(
                onPressed: () => _expectedEnd(context, ref),
                icon: const Icon(Icons.schedule),
                label: const Text('Cập nhật thời gian hoàn tất'),
              ),
              FilledButton.icon(
                onPressed: () => _complete(context, ref),
                icon: const Icon(Icons.task_alt),
                label: const Text('Hoàn tất đơn'),
              ),
            ],
          ],
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
    try {
      await action();
      ref.invalidate(orderDetailProvider(orderId));
      ref.invalidate(providerOrdersProvider);
      if (context.mounted)
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(success)));
    } catch (error) {
      if (context.mounted)
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(_message(error))));
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
    if (time == null) return;
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
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: title,
              decoration: const InputDecoration(labelText: 'Tên vật tư'),
            ),
            TextField(
              controller: quantity,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Số lượng'),
            ),
            TextField(
              controller: price,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Đơn giá'),
            ),
            TextField(
              controller: note,
              maxLines: 2,
              decoration: const InputDecoration(labelText: 'Ghi chú khảo sát'),
            ),
          ],
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
        if (context.mounted)
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text(
                'Vui lòng nhập vật tư, số lượng và đơn giá hợp lệ.',
              ),
            ),
          );
      } else {
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
      try {
        final url = await ref
            .read(providerRepositoryProvider)
            .uploadEvidence(file);
        await ref.read(providerRepositoryProvider).completeOrder(orderId, [
          url,
        ], note.text);
        ref.invalidate(orderDetailProvider(orderId));
        ref.invalidate(providerOrdersProvider);
        if (context.mounted)
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Đã gửi yêu cầu hoàn tất đơn.')),
          );
      } catch (error) {
        if (context.mounted)
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(SnackBar(content: Text(_message(error))));
      }
    }
    note.dispose();
  }
}

class _DetailStatus extends StatelessWidget {
  const _DetailStatus({required this.label, required this.status});
  final String label, status;
  @override
  Widget build(BuildContext context) {
    final color = status == 'completed'
        ? AppTheme.successGreen
        : Theme.of(context).colorScheme.primary;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: .12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 12,
          fontWeight: FontWeight.w700,
        ),
      ),
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
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: Theme.of(context).colorScheme.primary),
              const SizedBox(width: 8),
              Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
            ],
          ),
          const SizedBox(height: 10),
          child,
        ],
      ),
    ),
  );
}

class _WorkProcess extends StatelessWidget {
  const _WorkProcess({required this.status});
  final String status;
  @override
  Widget build(BuildContext context) {
    final done = status == 'completed';
    final active = status == 'in_progress';
    final steps = [
      'Kiểm tra hiện trạng',
      'Xác nhận với khách',
      'Tiến hành sửa chữa',
      'Nghiệm thu',
    ];
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          children: steps.asMap().entries.map((entry) {
            final complete = done || (active && entry.key < 2);
            return Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Column(
                  children: [
                    Icon(
                      complete
                          ? Icons.check_circle
                          : (entry.key == 2 && active
                                ? Icons.radio_button_checked
                                : Icons.radio_button_unchecked),
                      color: complete || (entry.key == 2 && active)
                          ? Theme.of(context).colorScheme.primary
                          : Theme.of(context).colorScheme.outline,
                    ),
                    if (entry.key < steps.length - 1)
                      Container(
                        width: 2,
                        height: 24,
                        color: Theme.of(context).colorScheme.outlineVariant,
                      ),
                  ],
                ),
                const SizedBox(width: 12),
                Padding(
                  padding: const EdgeInsets.only(top: 3),
                  child: Text(entry.value),
                ),
              ],
            );
          }).toList(),
        ),
      ),
    );
  }
}

String _date(DateTime value) =>
    '${value.day.toString().padLeft(2, '0')}/${value.month.toString().padLeft(2, '0')} ${value.hour.toString().padLeft(2, '0')}:${value.minute.toString().padLeft(2, '0')}';
String _money(double value) => '${value.toStringAsFixed(0)}đ';

String _message(Object error) => error is ApiException
    ? error.message
    : 'Không thể thực hiện thao tác. Vui lòng thử lại.';
