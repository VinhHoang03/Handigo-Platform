import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import '../../booking/presentation/booking_provider.dart';
import 'service_catalog_provider.dart';
import '../../../shared/widgets/app_feedback.dart';
import '../../../core/network/api_exception.dart';
import 'dart:typed_data';

class BookingNoteInput extends ConsumerStatefulWidget {
  const BookingNoteInput({
    required this.controller,
    this.onUploadingChanged,
    super.key,
  });
  final ValueChanged<bool>? onUploadingChanged;
  final TextEditingController controller;

  @override
  ConsumerState<BookingNoteInput> createState() => _BookingNoteInputState();
}

class _BookingNoteInputState extends ConsumerState<BookingNoteInput> {
  bool _uploading = false;
  Uint8List? _pendingImage;
  XFile? _pendingFile;
  String? _uploadError;
  double? _uploadProgress;

  Future<void> _upload() async {
    if (_uploading || ref.read(bookingDraftProvider).attachments.length >= 4) {
      return;
    }
    final source = await showModalBottomSheet<ImageSource>(
      useRootNavigator: true,
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.camera_alt_outlined),
              title: const Text('Chụp ảnh'),
              onTap: () => Navigator.pop(context, ImageSource.camera),
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('Chọn từ thư viện'),
              onTap: () => Navigator.pop(context, ImageSource.gallery),
            ),
          ],
        ),
      ),
    );
    if (source == null || !mounted) return;
    setState(() => _uploading = true);
    widget.onUploadingChanged?.call(true);
    try {
      final file = await ImagePicker().pickImage(
        source: source,
        maxWidth: 1280,
        maxHeight: 1280,
        imageQuality: 80,
      );
      if (file == null || !mounted) return;
      if (await file.length() > 5 * 1024 * 1024) {
        throw const ApiException('Ảnh không được vượt quá 5 MB.');
      }
      final bytes = await file.readAsBytes();
      if (!mounted) return;
      setState(() {
        _pendingImage = bytes;
        _pendingFile = file;
        _uploadError = null;
        _uploadProgress = null;
      });
      await _sendPendingImage();
    } catch (error) {
      if (mounted) {
        AppToast.show(
          context,
          error is ApiException
              ? error.message
              : 'Không thể chọn hoặc tải ảnh sự cố. Vui lòng thử lại.',
          type: AppToastType.error,
        );
      }
    } finally {
      if (mounted && _uploading) {
        setState(() => _uploading = false);
        widget.onUploadingChanged?.call(false);
      }
    }
  }

  Future<void> _sendPendingImage() async {
    final file = _pendingFile;
    if (file == null) return;
    if (!_uploading) widget.onUploadingChanged?.call(true);
    setState(() {
      _uploading = true;
      _uploadError = null;
      _uploadProgress = null;
    });
    try {
      final url = await ref
          .read(serviceCatalogRepositoryProvider)
          .uploadAttachment(
            file,
            onSendProgress: (sent, total) {
              if (!mounted || total <= 0) return;
              setState(() => _uploadProgress = (sent / total).clamp(0, 1));
            },
          );
      if (!mounted) return;
      final current = ref.read(bookingDraftProvider).attachments;
      if (current.length < 4) {
        ref.read(bookingDraftProvider.notifier).setAttachments([
          ...current,
          url,
        ]);
      }
      setState(() {
        _pendingImage = null;
        _pendingFile = null;
      });
      AppToast.show(context, 'Đã tải ảnh sự cố.', type: AppToastType.success);
    } catch (error) {
      if (mounted) {
        setState(
          () => _uploadError = error is ApiException
              ? error.message
              : 'Không thể tải ảnh sự cố. Vui lòng thử lại.',
        );
      }
    } finally {
      if (mounted) {
        setState(() => _uploading = false);
        widget.onUploadingChanged?.call(false);
      }
    }
  }

  Widget _image(String url, BoxFit fit) => Image.network(
    url.replaceFirst('http://res.cloudinary.com', 'https://res.cloudinary.com'),
    fit: fit,
    loadingBuilder: (_, child, progress) => progress == null
        ? child
        : const Center(
            child: SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
          ),
    errorBuilder: (_, _, _) =>
        const Center(child: Icon(Icons.broken_image_outlined)),
  );

  void _preview(String url) => showDialog<void>(
    context: context,
    builder: (context) => Dialog(
      clipBehavior: Clip.antiAlias,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding: const EdgeInsets.only(left: 16, right: 4),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    'Ảnh sự cố',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
                IconButton(
                  tooltip: 'Đóng ảnh',
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close),
                ),
              ],
            ),
          ),
          SizedBox(
            width: MediaQuery.sizeOf(context).width * .8,
            height: MediaQuery.sizeOf(context).height * .55,
            child: InteractiveViewer(
              maxScale: 4,
              child: _image(url, BoxFit.contain),
            ),
          ),
        ],
      ),
    ),
  );

  @override
  Widget build(BuildContext context) {
    final attachments = ref.watch(bookingDraftProvider).attachments;
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerLow,
        border: Border.all(color: theme.colorScheme.outlineVariant),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (attachments.isNotEmpty || _pendingImage != null) ...[
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                if (_pendingImage != null)
                  ClipRRect(
                    borderRadius: BorderRadius.circular(10),
                    child: SizedBox(
                      width: 112,
                      height: 112,
                      child: Stack(
                        fit: StackFit.expand,
                        children: [
                          Image.memory(_pendingImage!, fit: BoxFit.cover),
                          if (_uploadError != null && !_uploading) ...[
                            Center(
                              child: IconButton.filled(
                                tooltip: 'Thử lại tải ảnh',
                                onPressed: _sendPendingImage,
                                style: IconButton.styleFrom(
                                  backgroundColor: Colors.white.withValues(
                                    alpha: 0.8,
                                  ),
                                  foregroundColor: theme.colorScheme.primary,
                                  shape: const CircleBorder(),
                                ),
                                icon: const Icon(Icons.refresh_rounded),
                              ),
                            ),
                            Positioned(
                              top: 2,
                              right: 2,
                              child: IconButton(
                                tooltip: 'Bỏ ảnh chưa tải',
                                alignment: Alignment.topRight,
                                onPressed: () => setState(() {
                                  _pendingImage = null;
                                  _pendingFile = null;
                                  _uploadError = null;
                                }),
                                style: IconButton.styleFrom(
                                  padding: EdgeInsets.zero,
                                  minimumSize: const Size(48, 48),
                                  tapTargetSize:
                                      MaterialTapTargetSize.shrinkWrap,
                                ),
                                icon: Container(
                                  width: 24,
                                  height: 24,
                                  decoration: BoxDecoration(
                                    color: Colors.white.withValues(alpha: 0.75),
                                    shape: BoxShape.circle,
                                    border: Border.all(
                                      color: Colors.black.withValues(
                                        alpha: 0.18,
                                      ),
                                    ),
                                  ),
                                  child: Icon(
                                    Icons.close,
                                    size: 14,
                                    color: Colors.black.withValues(alpha: 0.65),
                                  ),
                                ),
                              ),
                            ),
                          ],
                          if (_uploading)
                            ColoredBox(
                              color: Colors.black.withValues(alpha: 0.3),
                              child: const Center(
                                child: CircularProgressIndicator(
                                  color: Colors.white,
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                for (var index = 0; index < attachments.length; index++)
                  SizedBox(
                    width: 112,
                    height: 112,
                    child: Stack(
                      children: [
                        Positioned.fill(
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(10),
                            child: Material(
                              child: InkWell(
                                onTap: () => _preview(attachments[index]),
                                child: Semantics(
                                  label: 'Xem ảnh sự cố ${index + 1}',
                                  button: true,
                                  child: _image(
                                    attachments[index],
                                    BoxFit.cover,
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),
                        Positioned(
                          top: 2,
                          right: 2,
                          child: SizedBox(
                            width: 48,
                            height: 48,
                            child: IconButton(
                              tooltip: 'Xóa ảnh sự cố ${index + 1}',
                              alignment: Alignment.topRight,
                              onPressed: () {
                                final updated = [
                                  ...ref.read(bookingDraftProvider).attachments,
                                ]..removeAt(index);
                                ref
                                    .read(bookingDraftProvider.notifier)
                                    .setAttachments(updated);
                              },
                              icon: Container(
                                width: 24,
                                height: 24,
                                decoration: BoxDecoration(
                                  color: Colors.white.withValues(alpha: 0.75),
                                  shape: BoxShape.circle,
                                  border: Border.all(
                                    color: Colors.black.withValues(alpha: 0.18),
                                  ),
                                ),
                                child: Icon(
                                  Icons.close,
                                  size: 14,
                                  color: Colors.black.withValues(alpha: 0.65),
                                ),
                              ),
                              style: IconButton.styleFrom(
                                padding: EdgeInsets.zero,
                                minimumSize: const Size(48, 48),
                                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 8),
          ],
          if (_pendingImage != null && _uploading) ...[
            Text(
              _uploadProgress == 1
                  ? 'Đang kiểm tra và lưu ảnh…'
                  : 'Đang tải ảnh${_uploadProgress == null ? '…' : ' ${(_uploadProgress! * 100).round()}%'}',
              style: theme.textTheme.bodySmall,
            ),
            const SizedBox(height: 8),
          ],
          if (_uploadError != null) ...[
            Text(
              _uploadError!,
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.error,
              ),
            ),
            const SizedBox(height: 8),
          ],
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: TextField(
                  controller: widget.controller,
                  onChanged: ref
                      .read(bookingDraftProvider.notifier)
                      .setProblemDescription,
                  minLines: 1,
                  maxLines: null,
                  maxLength: 2000,
                  decoration: const InputDecoration(
                    hintText: 'Ghi chú gì đó cho thợ',
                    border: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    focusedBorder: InputBorder.none,
                    filled: false,
                    contentPadding: EdgeInsets.symmetric(
                      horizontal: 4,
                      vertical: 8,
                    ),
                    counterText: '',
                  ),
                ),
              ),
              IconButton(
                tooltip: 'Thêm ảnh sự cố (${attachments.length}/4)',
                onPressed: _uploading || attachments.length >= 4
                    ? null
                    : _upload,
                color: theme.colorScheme.primary,
                icon: _uploading
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.photo_camera_outlined, size: 22),
              ),
            ],
          ),
          ValueListenableBuilder<TextEditingValue>(
            valueListenable: widget.controller,
            builder: (_, value, _) => Align(
              alignment: Alignment.centerRight,
              child: Text(
                '${value.text.characters.length}/2000',
                style: theme.textTheme.labelSmall,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
