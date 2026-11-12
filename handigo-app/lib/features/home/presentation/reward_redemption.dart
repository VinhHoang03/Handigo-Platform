import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../core/network/api_exception.dart';
import '../../../shared/widgets/app_feedback.dart';
import '../domain/customer_home_data.dart';
import 'customer_home_provider.dart';

Future<bool> confirmRewardRedemption(
  BuildContext context,
  WidgetRef ref,
  HomeRewardOffer offer,
  int balance,
) async {
  final repository = ref.read(customerHomeRepositoryProvider);
  final numbers = NumberFormat.decimalPattern('vi');
  final canRedeem = balance >= offer.points;
  final validityDays = ref
      .read(customerHomeRewardsProvider)
      .asData
      ?.value
      .validityDays;
  String? requestId;
  String? errorMessage;
  var busy = false;
  final redeemed = await showDialog<bool>(
    context: context,
    barrierDismissible: false,
    builder: (context) => StatefulBuilder(
      builder: (context, setState) => PopScope(
        canPop: !busy,
        child: AlertDialog(
          backgroundColor: Theme.of(context).colorScheme.surfaceContainerLowest,
          surfaceTintColor: Colors.transparent,
          scrollable: true,
          title: Text('Đổi voucher ${rewardOfferName(offer, numbers)}'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(rewardOfferConditions(offer, numbers)),
              if (validityDays != null) ...[
                const SizedBox(height: 4),
                Text('Hiệu lực $validityDays ngày kể từ khi đổi.'),
              ],
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.surfaceContainerLow,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Điểm cần dùng: ${numbers.format(offer.points)}',
                      style: Theme.of(context).textTheme.titleSmall,
                    ),
                    const SizedBox(height: 4),
                    Text('Điểm hiện có: ${numbers.format(balance)}'),
                  ],
                ),
              ),
              if (!canRedeem || errorMessage != null) ...[
                const SizedBox(height: 8),
                Text(
                  errorMessage ?? 'Bạn chưa đủ điểm để đổi voucher này.',
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ],
            ],
          ),
          actions: [
            TextButton(
              onPressed: busy ? null : () => Navigator.of(context).pop(),
              child: const Text('Đóng'),
            ),
            FilledButton(
              onPressed: busy || !canRedeem
                  ? null
                  : () async {
                      setState(() {
                        busy = true;
                        errorMessage = null;
                      });
                      try {
                        await repository.redeemReward(
                          offer,
                          requestId ??= _rewardRequestId(),
                        );
                        if (context.mounted) Navigator.of(context).pop(true);
                      } catch (error) {
                        if (!context.mounted) return;
                        setState(() {
                          busy = false;
                          errorMessage = error is ApiException
                              ? error.message
                              : 'Chưa thể xác nhận kết quả đổi voucher. Vui lòng thử lại.';
                        });
                      }
                    },
              child: Text(busy ? 'Đang đổi…' : 'Xác nhận đổi'),
            ),
          ],
        ),
      ),
    ),
  );
  if (redeemed != true || !context.mounted) return false;
  ref.invalidate(customerHomeRewardsProvider);
  ref.invalidate(customerHomeProvider);
  AppToast.show(
    context,
    'Đã đổi voucher thành công.',
    type: AppToastType.success,
  );
  return true;
}

String _rewardRequestId() {
  final random = math.Random.secure();
  final bytes = List.generate(16, (_) => random.nextInt(256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  final hex = bytes
      .map((byte) => byte.toRadixString(16).padLeft(2, '0'))
      .join();
  return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
}

Color rewardSurface(BuildContext context) {
  final theme = Theme.of(context);
  return theme.brightness == Brightness.light
      ? Colors.white
      : theme.colorScheme.surfaceContainerLowest;
}

String rewardOfferName(HomeRewardOffer offer, NumberFormat numbers) {
  final name = offer.name.trim();
  if (name.isNotEmpty) return name;
  final unit = offer.discountType == 'PERCENT' ? '%' : ' đ';
  return 'giảm ${numbers.format(offer.discountValue)}$unit';
}

String rewardOfferConditions(HomeRewardOffer offer, NumberFormat numbers) {
  final maximum = offer.maxDiscountAmount;
  final orderExample = offer.applicableOrderType == 'variable_price'
      ? 'đơn báo giá (ví dụ: sửa chữa)'
      : 'đơn giá cố định (ví dụ: vệ sinh)';
  final minimum = offer.minOrderAmount > 0
      ? ' từ ${numbers.format(offer.minOrderAmount)} đ'
      : '';
  final discountLimit = maximum != null && maximum > 0
      ? ' Giảm tối đa ${numbers.format(maximum)} đ.'
      : '';
  return 'Áp dụng cho $orderExample$minimum.$discountLimit';
}
