import 'package:flutter/material.dart';
import 'package:flutter/gestures.dart';

class BookingPolicyPanel extends StatelessWidget {
  const BookingPolicyPanel({required this.policies, super.key});
  final Map<String, dynamic> policies;
  @override
  Widget build(BuildContext context) {
    final matching = policies['matching'] is Map
        ? policies['matching'] as Map
        : const {};
    final paragraphs = [
      'Cung cấp đúng dịch vụ, số lượng, địa chỉ và thông tin liên hệ. Đặt dịch vụ từ 08:00 đến 21:00; lịch hẹn không sớm hơn phút hiện tại.',
      'Thời gian giữ thanh toán theo cấu hình hiện tại: ${policies['paymentHoldMinutes']} phút. Thời hạn cụ thể hiển thị trên từng đơn; quá hạn đơn có thể tự hủy.',
      if (matching.isNotEmpty)
        'Tìm thợ trong ${matching['initialRadiusKm']} km, mở rộng đến ${matching['expandedRadiusKm']} km sau ${matching['expandAfterMinutes']} phút và tìm thêm tối đa ${matching['expandedDurationMinutes']} phút. Thợ phản hồi trong tối đa ${matching['providerResponseSeconds']} giây.',
      'Không có thợ nhận khi hết vòng tìm tự động: hoàn toàn bộ khoản đã thanh toán. Thợ được chọn trực tiếp có thể phát sinh bước chọn lại hoặc xác nhận điều phối thay thế.',
      'Dịch vụ giá cố định thanh toán bằng ví, PayOS hoặc tiền mặt khi khả dụng. Dịch vụ khảo sát chỉ trả tiền cọc qua ví hoặc PayOS. Chi phí sửa chữa còn lại trả trực tiếp cho thợ, khấu trừ cọc thực trả.',
      'Khách hủy trước khi có thợ: hoàn 100% khoản thực trả. Sau khi thợ nhận, khách được hủy trong vòng ${policies['customerCancellationMinutes'] ?? 5} phút nếu thợ chưa đến nơi và chưa bắt đầu. Hết hạn hoặc đã bắt đầu thì không hủy theo luồng thông thường.',
      'Thợ hủy đơn khảo sát trước báo giá: giữ cọc để tìm thợ thay thế; hết vòng không có thợ nhận thì hoàn cọc. Thợ hủy sau báo giá: cọc thực trả được chuyển vào ví thợ theo chính sách.',
      'Ưu đãi không được hoàn thành tiền. Mỗi buổi định kỳ có trạng thái, thanh toán và hoàn tiền riêng; hủy các buổi còn lại được tính theo từng buổi.',
      'Số tiền hoàn và phí được hiển thị trong bước xác nhận hủy theo dữ liệu mới nhất. Nếu có vấn đề khi thực hiện hoặc sau hoàn thành, dùng chức năng báo cáo vấn đề đơn hàng.',
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final paragraph in paragraphs)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
            child: Text(paragraph),
          ),
      ],
    );
  }
}

class BookingPolicyConsent extends StatefulWidget {
  const BookingPolicyConsent({
    required this.accepted,
    required this.policies,
    required this.onChanged,
    super.key,
  });
  final bool accepted;
  final Map<String, dynamic>? policies;
  final ValueChanged<bool> onChanged;

  @override
  State<BookingPolicyConsent> createState() => _BookingPolicyConsentState();
}

class _BookingPolicyConsentState extends State<BookingPolicyConsent> {
  late final TapGestureRecognizer _link = TapGestureRecognizer()
    ..onTap = _showPolicies;

  @override
  void dispose() {
    _link.dispose();
    super.dispose();
  }

  void _showPolicies() {
    final policies = widget.policies;
    if (policies == null) return;
    showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: Theme.of(context).colorScheme.surfaceContainerLowest,
        surfaceTintColor: Colors.transparent,
        insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
        title: Row(
          children: [
            const Expanded(child: Text('Chính sách Handigo')),
            IconButton(
              tooltip: 'Đóng chính sách',
              onPressed: () => Navigator.pop(context),
              icon: const Icon(Icons.close),
            ),
          ],
        ),
        content: SizedBox(
          width: 440,
          child: SingleChildScrollView(
            child: BookingPolicyPanel(policies: policies),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) => Row(
    children: [
      Expanded(
        child: Text.rich(
          TextSpan(
            style: Theme.of(context).textTheme.bodyMedium,
            children: [
              const TextSpan(text: 'Tôi đã đọc và đồng ý với '),
              TextSpan(
                text: 'chính sách Handigo',
                recognizer: widget.policies == null ? null : _link,
                style: TextStyle(
                  color: Theme.of(context).colorScheme.primary,
                  decoration: TextDecoration.underline,
                ),
              ),
            ],
          ),
        ),
      ),
      Checkbox(
        value: widget.accepted,
        semanticLabel: 'Đồng ý với chính sách Handigo',
        onChanged: widget.policies == null
            ? null
            : (value) => widget.onChanged(value == true),
      ),
    ],
  );
}
