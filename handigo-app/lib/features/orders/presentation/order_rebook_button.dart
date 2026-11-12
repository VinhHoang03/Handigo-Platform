import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_exception.dart';
import '../../../shared/widgets/app_feedback.dart';
import '../../../app/providers/app_providers.dart';
import '../../booking/data/booking_draft_store.dart';
import '../../booking/presentation/booking_provider.dart';
import '../../service_catalog/presentation/service_catalog_provider.dart';
import '../domain/order_summary.dart';
import 'order_screens.dart';

bool canRebookOrder(String status) =>
    status == 'completed' || status == 'cancelled';

class OrderRebookButton extends ConsumerStatefulWidget {
  const OrderRebookButton({required this.orderId, this.order, super.key});

  final String orderId;
  final OrderDetail? order;

  @override
  ConsumerState<OrderRebookButton> createState() => _OrderRebookButtonState();
}

class _OrderRebookButtonState extends ConsumerState<OrderRebookButton> {
  bool _busy = false;

  Future<void> _rebook() async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      final owner = ref.read(authControllerProvider).user?.id;
      if (owner == null) throw const ApiException('Vui lòng đăng nhập lại.');
      final order =
          widget.order ??
          await ref.read(orderRepositoryProvider).detail(widget.orderId);
      if (!mounted || ref.read(authControllerProvider).user?.id != owner)
        return;
      final serviceId = order.serviceId;
      if (!canRebookOrder(order.status) ||
          serviceId == null ||
          serviceId.isEmpty) {
        throw const ApiException(
          'Đơn hàng này không còn đủ điều kiện đặt lại.',
        );
      }

      final detail = await ref.refresh(serviceDetailProvider(serviceId).future);
      if (!mounted || ref.read(authControllerProvider).user?.id != owner)
        return;
      BookingDraft? restored;
      try {
        restored = await const BookingDraftStore().readRebooking(
          owner,
          order.id,
        );
      } catch (_) {
        /* Bản nháp cục bộ lỗi thì dùng tùy chọn của đơn gốc. */
      }
      if (!mounted || ref.read(authControllerProvider).user?.id != owner)
        return;

      final snapshots = {
        for (final entry in order.selectedOptions)
          if (entry['optionId'] case final String id) id: entry,
      };
      final selected = detail.options
          .where((option) => snapshots.containsKey(option.id))
          .toList();
      final selectionError = detail.selectionError(
        selected.map((option) => option.id).toList(),
      );
      final originalItem = detail.options.isEmpty
          ? order.selectedOptions
                .where((entry) => entry['optionId'] == null)
                .firstOrNull
          : null;
      final originalQuantity = originalItem?['quantity'];
      final savedOptions = restored?.selectedOptionIds ?? const <String>[];
      final draft = restored?.serviceId == serviceId
          ? restored!.copyWith(
              selectedOptionIds: [
                for (final option in detail.options)
                  if (savedOptions.contains(option.id)) option.id,
              ],
              quantities: {
                for (final option in detail.options)
                  if (savedOptions.contains(option.id) && option.allowsQuantity)
                    option.id: (restored.quantities[option.id] ?? 1).clamp(
                      1,
                      99,
                    ),
              },
            )
          : BookingDraft(
              serviceId: serviceId,
              selectedOptionIds: [
                if (selectionError == null)
                  for (final option in selected) option.id,
              ],
              quantities: {
                if (selectionError == null)
                  for (final option in selected)
                    if (option.allowsQuantity &&
                        snapshots[option.id]?['quantity'] is num)
                      option.id: (snapshots[option.id]!['quantity'] as num)
                          .toInt()
                          .clamp(1, 99),
              },
              uniformQuantity: originalQuantity is num
                  ? originalQuantity.toInt().clamp(1, 99)
                  : 1,
            );
      final RebookingSession session = (
        owner: owner,
        orderId: order.id,
        draft: draft,
      );
      context.push('/customer/bookings/new/$serviceId', extra: session);
    } catch (error) {
      if (!mounted) return;
      AppToast.show(
        context,
        error is ApiException
            ? error.message
            : 'Không thể chuẩn bị đơn đặt lại. Vui lòng thử lại.',
        type: AppToastType.error,
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => OutlinedButton.icon(
    onPressed: _busy ? null : _rebook,
    icon: const Icon(Icons.replay_rounded),
    label: Text(_busy ? 'Đang tải…' : 'Đặt lại dịch vụ'),
  );
}
