import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import '../../booking/presentation/booking_provider.dart';
import 'service_catalog_provider.dart';
import '../../../shared/widgets/app_feedback.dart';

class BookingNoteInput extends ConsumerStatefulWidget {
  const BookingNoteInput({required this.controller, super.key});
  final TextEditingController controller;

  @override
  ConsumerState<BookingNoteInput> createState() => _BookingNoteInputState();
}

class _BookingNoteInputState extends ConsumerState<BookingNoteInput> {
  bool _uploading = false;

  Future<void> _upload() async {
    if (_uploading || ref.read(bookingDraftProvider).attachments.length >= 4) {
      return;
    }
    setState(() => _uploading = true);
    try {
      final file = await ImagePicker().pickImage(
        source: ImageSource.gallery,
        imageQuality: 80,
      );
      if (file == null || !mounted) return;
      final url = await ref
          .read(serviceCatalogRepositoryProvider)
          .uploadAttachment(file);
      if (!mounted) return;
      final current = ref.read(bookingDraftProvider).attachments;
      if (current.length < 4) {
        ref.read(bookingDraftProvider.notifier).setAttachments([
          ...current,
          url,
        ]);
        AppToast.show(context, 'Đã tải ảnh sự cố.', type: AppToastType.success);
      }
    } catch (_) {
      if (mounted) {
        AppToast.show(context, 'Không thể tải ảnh sự cố. Vui lòng thử lại.', type: AppToastType.error);
      }
    } finally {
      if (mounted) setState(() => _uploading = false);
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
          if (attachments.isNotEmpty) ...[
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (var index = 0; index < attachments.length; index++)
                  SizedBox(
                    width: 76,
                    height: 76,
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
                            width: 28,
                            height: 28,
                            child: IconButton(
                              tooltip: 'Xóa ảnh sự cố ${index + 1}',
                              onPressed: () {
                                final updated = [
                                  ...ref.read(bookingDraftProvider).attachments,
                                ]..removeAt(index);
                                ref
                                    .read(bookingDraftProvider.notifier)
                                    .setAttachments(updated);
                              },
                              icon: const Icon(Icons.close, size: 16),
                              style: IconButton.styleFrom(
                                padding: EdgeInsets.zero,
                                backgroundColor: Colors.white,
                                foregroundColor: Colors.black,
                                shape: const CircleBorder(
                                  side: BorderSide(color: Colors.black),
                                ),
                                minimumSize: const Size(28, 28),
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
