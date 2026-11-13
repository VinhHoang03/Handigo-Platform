import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import '../../../app/providers/app_providers.dart';
import '../../../core/network/api_exception.dart';
import 'provider_screens.dart';

class _EvidenceImage {
  _EvidenceImage(this.file, this.bytes);
  final XFile file;
  final Uint8List bytes;
  String? id;
}

class ProviderNoShowScreen extends ConsumerStatefulWidget {
  const ProviderNoShowScreen({required this.orderId, super.key});
  final String orderId;
  @override
  ConsumerState<ProviderNoShowScreen> createState() =>
      _ProviderNoShowScreenState();
}

class _ProviderNoShowScreenState extends ConsumerState<ProviderNoShowScreen> {
  final _form = GlobalKey<FormState>();
  final _description = TextEditingController();
  final _arrival = <_EvidenceImage>[];
  final _contact = <_EvidenceImage>[];
  bool _contacted = false, _busy = false, _picking = false;
  String? _error, _progress;
  late final String? _owner;
  int get _count => _arrival.length + _contact.length;
  @override
  void initState() {
    super.initState();
    _owner = ref.read(authControllerProvider).user?.id;
  }

  @override
  void dispose() {
    _description.dispose();
    super.dispose();
  }

  Future<void> _pick(String kind, ImageSource source) async {
    final images = kind == 'arrival' ? _arrival : _contact;
    if (_busy || _picking || _count >= 5 || images.length >= 4) return;
    setState(() {
      _picking = true;
      _error = null;
    });
    try {
      final file = await ImagePicker().pickImage(
        source: source,
        imageQuality: 85,
      );
      if (file == null || !mounted) return;
      final mime = file.mimeType?.toLowerCase();
      final extension = file.name.split('.').last.toLowerCase();
      if (mime == null
          ? !['jpg', 'jpeg', 'png', 'webp'].contains(extension)
          : !['image/jpeg', 'image/png', 'image/webp'].contains(mime)) {
        throw const ApiException('Vui lòng chọn ảnh JPG, PNG hoặc WebP.');
      }
      if (await file.length() > 5 * 1024 * 1024) {
        throw const ApiException('Mỗi ảnh không được vượt quá 5 MB.');
      }
      final bytes = await file.readAsBytes();
      if (!mounted) return;
      if (bytes.isEmpty) {
        throw const ApiException(
          'Ảnh không có dữ liệu. Vui lòng chọn ảnh khác.',
        );
      }
      if ([
        ..._arrival,
        ..._contact,
      ].any((image) => listEquals(image.bytes, bytes))) {
        throw const ApiException(
          'Ảnh này đã được chọn. Vui lòng chọn ảnh khác.',
        );
      }
      setState(() => images.add(_EvidenceImage(file, bytes)));
    } catch (error) {
      if (mounted) setState(() => _error = _message(error));
    } finally {
      if (mounted) setState(() => _picking = false);
    }
  }

  Future<void> _submit() async {
    if (_busy || _picking || !_form.currentState!.validate()) return;
    if (!_contacted || _arrival.isEmpty || _contact.isEmpty) {
      setState(
        () => _error =
            'Vui lòng chọn đủ ảnh đã đến nơi, ảnh liên hệ và xác nhận đã liên hệ khách.',
      );
      return;
    }
    final owner = _owner;
    bool active() =>
        mounted &&
        owner != null &&
        ref.read(authControllerProvider).user?.id == owner;
    if (!active()) return;
    setState(() {
      _busy = true;
      _error = null;
      _progress = 'Đang kiểm tra điều kiện…';
    });
    try {
      final repository = ref.read(providerRepositoryProvider);
      await repository.checkNoShowEligibility(widget.orderId);
      for (final group in [('arrival', _arrival), ('contact', _contact)]) {
        for (var index = 0; index < group.$2.length; index++) {
          if (!active()) return;
          final image = group.$2[index];
          if (image.id != null) continue;
          setState(
            () => _progress =
                'Đang tải ${group.$1 == 'arrival' ? 'ảnh đã đến nơi' : 'ảnh liên hệ'} ${index + 1}/${group.$2.length}…',
          );
          image.id = await repository.uploadNoShowEvidence(
            widget.orderId,
            group.$1,
            image.file,
          );
        }
      }
      if (!active()) return;
      final arrivalIds = _arrival.map((image) => image.id!).toList();
      final contactIds = _contact.map((image) => image.id!).toList();
      if ({...arrivalIds, ...contactIds}.length != _count) {
        throw const ApiException(
          'Bằng chứng bị trùng. Vui lòng chọn các ảnh khác nhau.',
        );
      }
      setState(() => _progress = 'Đang gửi báo cáo…');
      await repository.reportCustomerNoShow(
        widget.orderId,
        _description.text.trim(),
        arrivalIds,
        contactIds,
      );
      if (mounted && active()) Navigator.pop(context, true);
    } catch (error) {
      if (active()) setState(() => _error = _message(error));
    } finally {
      if (mounted) {
        setState(() {
          _busy = false;
          _progress = null;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final owner = ref.watch(
      authControllerProvider.select((auth) => auth.user?.id),
    );
    if (owner == null || owner != _owner) {
      return const Scaffold(
        body: Center(
          child: Text('Phiên đăng nhập đã thay đổi. Vui lòng mở lại đơn.'),
        ),
      );
    }
    return PopScope(
      canPop: !_busy && !_picking,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Báo khách không có mặt'),
          leading: IconButton(
            tooltip: 'Quay lại',
            onPressed: _busy || _picking ? null : () => Navigator.pop(context),
            icon: const Icon(Icons.arrow_back_rounded),
          ),
        ),
        body: Form(
          key: _form,
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              const Text(
                'Báo cáo sẽ được hệ thống kiểm tra. Kết quả xử lý và khoản hỗ trợ (nếu có) chỉ được xác nhận sau khi báo cáo được chấp thuận.',
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _description,
                enabled: !_busy,
                minLines: 3,
                maxLines: 6,
                maxLength: 2000,
                decoration: const InputDecoration(
                  labelText: 'Mô tả việc liên hệ khách',
                ),
                validator: (text) => (text?.trim().length ?? 0) < 10
                    ? 'Vui lòng mô tả ít nhất 10 ký tự.'
                    : null,
              ),
              const SizedBox(height: 12),
              _images(
                'arrival',
                'Ảnh đã đến nơi',
                _arrival,
                'Chọn ảnh thể hiện địa điểm đã đến; không bắt buộc có biển số nhà.',
              ),
              const SizedBox(height: 20),
              _images(
                'contact',
                'Ảnh liên hệ khách hàng',
                _contact,
                'Để hệ thống có thể tự duyệt, cần ảnh chat Handigo và ảnh chi tiết ít nhất 3 cuộc gọi đi tới đúng số khách, rõ giờ từng cuộc.',
              ),
              const SizedBox(height: 16),
              Text(
                'Đã chọn $_count/5 ảnh. Mỗi nhóm tối đa 4 ảnh, mỗi ảnh tối đa 5 MB.',
              ),
              CheckboxListTile(
                contentPadding: EdgeInsets.zero,
                controlAffinity: ListTileControlAffinity.leading,
                value: _contacted,
                onChanged: _busy
                    ? null
                    : (value) => setState(() => _contacted = value ?? false),
                title: const Text(
                  'Tôi đã gọi hoặc nhắn tin nhưng không liên hệ được khách.',
                ),
              ),
            ],
          ),
        ),
        bottomNavigationBar: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (_error != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Text(
                      _error!,
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.error,
                      ),
                    ),
                  ),
                if (_busy) ...[
                  const LinearProgressIndicator(),
                  const SizedBox(height: 8),
                  Text(_progress!),
                  const SizedBox(height: 8),
                ],
                FilledButton(
                  onPressed: _busy || _picking ? null : _submit,
                  child: Text(_busy ? 'Đang xử lý…' : 'Gửi báo cáo'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _images(
    String kind,
    String title,
    List<_EvidenceImage> images,
    String help,
  ) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Text('$title (bắt buộc)', style: Theme.of(context).textTheme.titleMedium),
      const SizedBox(height: 8),
      Text(help),
      for (var index = 0; index < images.length; index++)
        Card(
          key: ObjectKey(images[index]),
          child: ListTile(
            leading: Image.memory(
              images[index].bytes,
              width: 56,
              height: 56,
              fit: BoxFit.cover,
              cacheWidth: 160,
              errorBuilder: (_, _, _) =>
                  const Icon(Icons.image_not_supported_outlined),
            ),
            title: Text(
              images[index].file.name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            subtitle: Text(
              images[index].id == null ? 'Sẵn sàng tải lên' : 'Đã tải lên',
            ),
            trailing: IconButton(
              tooltip: 'Xóa $title ${index + 1}',
              onPressed: _busy || _picking
                  ? null
                  : () => setState(() {
                      images.removeAt(index);
                      _error = null;
                    }),
              icon: const Icon(Icons.close),
            ),
          ),
        ),
      Wrap(
        spacing: 12,
        runSpacing: 8,
        children: [
          OutlinedButton.icon(
            key: ValueKey('no-show-gallery-$kind'),
            onPressed: _busy || _picking || _count >= 5 || images.length >= 4
                ? null
                : () => _pick(kind, ImageSource.gallery),
            icon: const Icon(Icons.photo_library_outlined),
            label: const Text('Thư viện'),
          ),
          OutlinedButton.icon(
            key: ValueKey('no-show-camera-$kind'),
            onPressed: _busy || _picking || _count >= 5 || images.length >= 4
                ? null
                : () => _pick(kind, ImageSource.camera),
            icon: const Icon(Icons.camera_alt_outlined),
            label: const Text('Chụp ảnh'),
          ),
        ],
      ),
    ],
  );
}

String _message(Object error) => error is ApiException
    ? error.message
    : 'Không thể gửi báo cáo. Ảnh và nội dung đã nhập được giữ lại để thử lại.';
