import 'dart:typed_data';
import 'package:flutter/material.dart';

class PayosQrPreview extends StatelessWidget {
  const PayosQrPreview({required this.bytes, super.key});
  final Uint8List bytes;

  @override
  Widget build(BuildContext context) => Column(
    children: [
      Center(
        child: Container(
          color: Colors.white,
          padding: const EdgeInsets.all(8),
          constraints: const BoxConstraints(maxWidth: 300),
          child: AspectRatio(
            aspectRatio: 1,
            child: Image.memory(
              bytes,
              semanticLabel: 'Mã QR thanh toán PayOS',
              errorBuilder: (_, _, _) =>
                  const Text('Không thể hiển thị mã QR. Vui lòng tải lại.'),
            ),
          ),
        ),
      ),
      const SizedBox(height: 8),
      const Text(
        'Bạn có thể chụp màn hình mã QR và chọn ảnh trong ứng dụng ngân hàng có hỗ trợ.',
        textAlign: TextAlign.center,
      ),
    ],
  );
}
