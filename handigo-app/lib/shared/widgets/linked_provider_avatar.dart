import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/providers/app_providers.dart';
import 'app_feedback.dart';
import 'provider_avatar.dart';

final _publicProfile = FutureProvider.autoDispose
    .family<Map<String, dynamic>, String>((ref, id) async {
      final response = await ref
          .watch(apiClientProvider)
          .request(
            '/providers/${Uri.encodeComponent(id)}/public',
            authenticated: true,
          );
      return response['data'] as Map<String, dynamic>;
    });

class LinkedProviderAvatar extends StatelessWidget {
  const LinkedProviderAvatar({
    required this.name,
    this.providerId,
    this.url,
    this.gender,
    this.size = 44,
    super.key,
  });

  final String name;
  final String? providerId, url, gender;
  final double size;

  @override
  Widget build(BuildContext context) {
    final avatar = ProviderAvatar(url: url, gender: gender, size: size);
    final id = providerId?.trim();
    if (id == null || id.isEmpty) return avatar;
    return IconButton(
      tooltip: 'Xem hồ sơ thợ',
      padding: EdgeInsets.zero,
      icon: avatar,
      onPressed: () => AppBottomSheet.show<void>(
        context,
        builder: (context) => Consumer(
          builder: (context, ref, _) {
            final state = ref.watch(_publicProfile(id));
            final data = state.asData?.value;
            final user = data?['user'] as Map?;
            final profile = data?['provider'] as Map?;
            final bio = (profile?['bio'] as String?)?.trim();
            final description = (profile?['description'] as String?)?.trim();
            final services = (profile?['services'] as List? ?? const [])
                .whereType<Map>()
                .map((service) => service['name'])
                .whereType<String>()
                .take(5)
                .join(', ');
            final rating = profile?['averageRating'] as num?;
            return SafeArea(
              top: false,
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            'Hồ sơ thợ',
                            style: Theme.of(context).textTheme.titleLarge,
                          ),
                        ),
                        IconButton(
                          tooltip: 'Đóng',
                          onPressed: () => Navigator.pop(context),
                          icon: const Icon(Icons.close),
                        ),
                      ],
                    ),
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: ProviderAvatar(
                        url: user?['avatar'] as String? ?? url,
                        gender: gender,
                        size: 44,
                      ),
                      title: Text(user?['fullName'] as String? ?? name),
                      subtitle:
                          profile?['verified'] == true ||
                              profile?['identityVerified'] == true
                          ? const Text('Đã xác minh')
                          : null,
                    ),
                    if (state.isLoading)
                      const LinearProgressIndicator(
                        semanticsLabel: 'Đang tải hồ sơ thợ',
                      ),
                    if (state.hasError)
                      TextButton(
                        onPressed: () => ref.invalidate(_publicProfile(id)),
                        child: const Text('Không tải được hồ sơ. Thử lại'),
                      ),
                    if (profile != null) ...[
                      if (rating != null && rating > 0)
                        Text(
                          'Đánh giá ${rating.toStringAsFixed(1)}/5 · ${profile['totalFeedbacks'] ?? 0} lượt',
                        ),
                      if (profile['experienceYears'] case final num years
                          when years > 0)
                        Text('Kinh nghiệm ${years.toInt()} năm'),
                      if (profile['totalCompletedOrders'] case final num count)
                        Text('Đã hoàn thành ${count.toInt()} đơn'),
                      if (services.isNotEmpty) ...[
                        const SizedBox(height: 12),
                        Text('Dịch vụ: $services'),
                      ],
                      if ((bio?.isNotEmpty == true ? bio : description)
                          case final String intro when intro.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 12),
                          child: Text(intro),
                        ),
                    ],
                  ],
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}
