import 'package:flutter/material.dart';

import '../utils/media_url.dart';

const providerMaleAvatarAsset = 'assets/avatars/provider-male.jpg';
const providerFemaleAvatarAsset = 'assets/avatars/provider-female.jpg';

bool isGoogleAvatarUrl(String? value) {
  final normalized = usableMediaUrl(value);
  if (normalized == null) return false;
  final host = Uri.tryParse(normalized)?.host.toLowerCase() ?? '';
  return host.contains('googleusercontent.com') || host.endsWith('ggpht.com');
}

String providerFallbackAvatarAsset(String? gender) {
  final normalized = gender?.trim().toLowerCase();
  return const {'female', 'f', 'nu', 'nữ'}.contains(normalized)
      ? providerFemaleAvatarAsset
      : providerMaleAvatarAsset;
}

class ProviderAvatar extends StatelessWidget {
  const ProviderAvatar({
    this.url,
    this.gender,
    this.size = 48,
    this.borderRadius,
    this.semanticLabel = 'Ảnh đại diện thợ',
    super.key,
  });

  final String? url;
  final String? gender;
  final double size;
  final double? borderRadius;
  final String semanticLabel;

  @override
  Widget build(BuildContext context) {
    final imageUrl = usableMediaUrl(url);
    final fallback = Image.asset(
      providerFallbackAvatarAsset(gender),
      fit: BoxFit.cover,
      semanticLabel: semanticLabel,
      errorBuilder: (context, error, stackTrace) => ColoredBox(
        color: Theme.of(context).colorScheme.primaryContainer,
        child: Center(
          child: Icon(
            Icons.person_outline_rounded,
            size: size * .55,
            color: Theme.of(context).colorScheme.onPrimaryContainer,
          ),
        ),
      ),
    );
    final image = imageUrl == null || isGoogleAvatarUrl(imageUrl)
        ? fallback
        : Image.network(
            imageUrl.replaceFirst(
              'http://res.cloudinary.com',
              'https://res.cloudinary.com',
            ),
            fit: BoxFit.cover,
            semanticLabel: semanticLabel,
            errorBuilder: (context, error, stackTrace) => fallback,
          );
    return ClipRRect(
      borderRadius: BorderRadius.circular(borderRadius ?? size / 2),
      child: SizedBox.square(dimension: size, child: image),
    );
  }
}
