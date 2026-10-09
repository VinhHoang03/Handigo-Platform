import 'package:flutter/material.dart';
import '../utils/media_url.dart';

class ServiceCoverImage extends StatelessWidget {
  const ServiceCoverImage({
    super.key,
    this.url,
    this.name = 'Ảnh dịch vụ',
    this.fit = BoxFit.contain,
  });
  final String? url;
  final String name;
  final BoxFit fit;

  @override
  Widget build(BuildContext context) {
    final imageUrl = usableMediaUrl(
      url,
    )?.replaceFirst('http://res.cloudinary.com', 'https://res.cloudinary.com');
    final placeholder = ColoredBox(
      color: Theme.of(context).colorScheme.surfaceContainerHighest,
      child: const Center(child: Icon(Icons.home_repair_service_outlined)),
    );
    return AspectRatio(
      aspectRatio: 16 / 9,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: imageUrl == null
            ? placeholder
            : Image.network(
                imageUrl,
                semanticLabel: name,
                fit: fit,
                loadingBuilder: (context, child, progress) => progress == null
                    ? child
                    : ColoredBox(
                        color: Theme.of(
                          context,
                        ).colorScheme.surfaceContainerHighest,
                        child: const Center(child: CircularProgressIndicator()),
                      ),
                errorBuilder: (context, error, stackTrace) => placeholder,
              ),
      ),
    );
  }
}

class ServiceImageGallery extends StatefulWidget {
  const ServiceImageGallery({
    super.key,
    required this.images,
    this.coverImage,
    required this.name,
  });
  final List<String> images;
  final String? coverImage;
  final String name;

  @override
  State<ServiceImageGallery> createState() => _ServiceImageGalleryState();
}

class _ServiceImageGalleryState extends State<ServiceImageGallery> {
  final _controller = PageController();
  int _index = 0;

  @override
  void didUpdateWidget(covariant ServiceImageGallery oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.coverImage != widget.coverImage ||
        oldWidget.images.join('|') != widget.images.join('|')) {
      _index = 0;
      if (_controller.hasClients) _controller.jumpToPage(0);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _move(int direction, int length) {
    final next = (_index + direction + length) % length;
    _controller.animateToPage(
      next,
      duration: MediaQuery.of(context).disableAnimations
          ? Duration.zero
          : const Duration(milliseconds: 200),
      curve: Curves.easeOut,
    );
  }

  @override
  Widget build(BuildContext context) {
    final images = <String>{
      if (usableMediaUrl(widget.coverImage) case final String cover) cover,
      ...widget.images.map(usableMediaUrl).whereType<String>(),
    }.toList();
    if (images.isEmpty) {
      return ServiceCoverImage(url: images.firstOrNull, name: widget.name);
    }
    return AspectRatio(
      aspectRatio: 16 / 9,
      child: Stack(
        children: [
          PageView.builder(
            controller: _controller,
            itemCount: images.length,
            onPageChanged: (index) => setState(() => _index = index),
            itemBuilder: (_, index) => ServiceCoverImage(
              url: images[index],
              name: '${widget.name} · ảnh ${index + 1}',
              fit: BoxFit.cover,
            ),
          ),
          if (images.length > 1)
            Positioned(
              bottom: 8,
              left: 8,
              right: 8,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (images.length > 1)
                    IconButton.filledTonal(
                      tooltip: 'Ảnh trước',
                      onPressed: () => _move(-1, images.length),
                      icon: const Icon(Icons.chevron_left),
                    ),
                  const SizedBox(width: 8),
                  if (images.length > 1)
                    IconButton.filledTonal(
                      tooltip: 'Ảnh tiếp theo',
                      onPressed: () => _move(1, images.length),
                      icon: const Icon(Icons.chevron_right),
                    ),
                ],
              ),
            ),
          Positioned(
            bottom: 8,
            right: 8,
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: Colors.black54,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                child: Text(
                  '${_index + 1}/${images.length}',
                  style: const TextStyle(color: Colors.white, fontSize: 11),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
