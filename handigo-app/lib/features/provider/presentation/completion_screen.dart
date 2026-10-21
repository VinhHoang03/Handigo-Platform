import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import '../../../core/network/api_exception.dart';
import '../../orders/domain/order_summary.dart';
import 'provider_screens.dart';

class CompletionScreen extends ConsumerStatefulWidget {
  const CompletionScreen({required this.orderId, this.quotation, super.key});
  final String orderId;
  final RepairQuotation? quotation;
  @override
  ConsumerState<CompletionScreen> createState() => _CompletionScreenState();
}

class _CompletionScreenState extends ConsumerState<CompletionScreen> {
  final note = TextEditingController();
  final files = <XFile>[];
  final uploaded = <String, String>{};
  bool busy = false;
  String? error;

  @override
  void dispose() {
    note.dispose();
    super.dispose();
  }

  Future<void> pick(ImageSource source) async {
    if (busy || files.length >= 5) return;
    final file = await ImagePicker().pickImage(
      source: source,
      imageQuality: 80,
    );
    if (file == null || !mounted) return;
    if (await file.length() > 5 * 1024 * 1024) {
      if (mounted) setState(() => error = 'Mỗi ảnh không được vượt quá 5 MB.');
      return;
    }
    if (mounted)
      setState(() {
        files.add(file);
        error = null;
      });
  }

  Future<void> complete() async {
    if (busy) return;
    if (files.isEmpty) {
      setState(() => error = 'Chọn ít nhất một ảnh bằng chứng hoàn thành.');
      return;
    }
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final repository = ref.read(providerRepositoryProvider);
      for (final file in files) {
        if (!uploaded.containsKey(file.path))
          uploaded[file.path] = await repository.uploadEvidence(file);
      }
      await repository.completeOrder(
        widget.orderId,
        files.map((file) => uploaded[file.path]!).toList(),
        note.text,
        quotation: widget.quotation,
      );
      if (mounted) Navigator.pop(context, true);
    } catch (failure) {
      if (mounted)
        setState(
          () => error = failure is ApiException
              ? failure.message
              : 'Chưa thể hoàn thành. Ảnh và ghi chú được giữ lại để thử lại.',
        );
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Hoàn tất & nghiệm thu')),
    body: ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(
          'Bằng chứng hoàn thành (${files.length}/5)',
          style: Theme.of(context).textTheme.titleLarge,
        ),
        const SizedBox(height: 12),
        const Text('Chọn từ 1 đến 5 ảnh, mỗi ảnh tối đa 5 MB.'),
        if (error != null)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Text(
              error!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ),
        for (final file in files)
          FutureBuilder<Uint8List>(
            key: ObjectKey(file),
            future: file.readAsBytes(),
            builder: (context, snapshot) => Card(
              child: ListTile(
                leading: snapshot.hasData
                    ? Image.memory(
                        snapshot.data!,
                        width: 56,
                        height: 56,
                        fit: BoxFit.cover,
                        cacheWidth: 160,
                      )
                    : const Icon(Icons.image),
                title: Text(
                  file.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                subtitle: Text(
                  uploaded.containsKey(file.path)
                      ? 'Đã tải lên'
                      : 'Sẵn sàng tải lên',
                ),
                trailing: IconButton(
                  tooltip: 'Xóa ảnh',
                  onPressed: busy
                      ? null
                      : () => setState(() => files.remove(file)),
                  icon: const Icon(Icons.close),
                ),
              ),
            ),
          ),
        if (busy) const LinearProgressIndicator(),
        Wrap(
          spacing: 12,
          children: [
            OutlinedButton.icon(
              onPressed: busy || files.length >= 5
                  ? null
                  : () => pick(ImageSource.gallery),
              icon: const Icon(Icons.photo_library_outlined),
              label: const Text('Thư viện'),
            ),
            OutlinedButton.icon(
              onPressed: busy || files.length >= 5
                  ? null
                  : () => pick(ImageSource.camera),
              icon: const Icon(Icons.camera_alt_outlined),
              label: const Text('Chụp ảnh'),
            ),
          ],
        ),
        const SizedBox(height: 16),
        TextField(
          controller: note,
          enabled: !busy,
          maxLength: 1000,
          minLines: 3,
          maxLines: 6,
          decoration: const InputDecoration(labelText: 'Ghi chú nghiệm thu'),
        ),
        if (widget.quotation != null)
          Text(
            'Nghiệm thu theo báo giá phiên bản ${widget.quotation!.revision}. Nếu báo giá thay đổi, vui lòng quay lại và rà soát trước khi gửi.',
          ),
      ],
    ),
    bottomNavigationBar: SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: FilledButton(
          onPressed: busy ? null : complete,
          child: Text(busy ? 'Đang tải ảnh và gửi...' : 'Xác nhận hoàn thành'),
        ),
      ),
    ),
  );
}
