import '../../providers/domain/featured_provider.dart';
import '../../services/domain/service.dart';
import '../../services/domain/service_category.dart';

class CustomerHomeData {
  const CustomerHomeData({
    required this.categories,
    required this.services,
    required this.providers,
    required this.unreadNotificationCount,
    this.vouchers = const [],
    this.news = const [],
  });

  final List<ServiceCategory> categories;
  final List<Service> services;
  final List<FeaturedProvider> providers;
  final int unreadNotificationCount;
  final List<HomeVoucher> vouchers;
  final List<HomeNewsArticle> news;
}

class HomeRewards {
  const HomeRewards({required this.balance, required this.offers});

  factory HomeRewards.fromJson(Map<String, dynamic> json) {
    final policy = json['policy'] as Map<String, dynamic>;
    final offers = policy['offers'] as List<dynamic>;
    return HomeRewards(
      balance: (json['balance'] as num).toInt(),
      offers: offers
          .cast<Map<String, dynamic>>()
          .map(HomeRewardOffer.fromJson)
          .toList(),
    );
  }

  final int balance;
  final List<HomeRewardOffer> offers;
}

class HomeRewardOffer {
  const HomeRewardOffer({
    required this.id,
    required this.termsVersion,
    required this.name,
    required this.points,
    required this.discountType,
    required this.discountValue,
    this.minOrderAmount = 0,
    this.maxDiscountAmount,
    this.applicableOrderType,
  });

  factory HomeRewardOffer.fromJson(Map<String, dynamic> json) => HomeRewardOffer(
    id: json['id'] as String,
    termsVersion: json['termsVersion'] as String,
    name: json['name'] as String? ?? '',
    points: (json['points'] as num).toInt(),
    discountType: json['discountType'] as String? ?? 'AMOUNT',
    discountValue: (json['discountValue'] as num).toDouble(),
    minOrderAmount: (json['minOrderAmount'] as num?)?.toDouble() ?? 0,
    maxDiscountAmount: (json['maxDiscountAmount'] as num?)?.toDouble(),
    applicableOrderType: json['applicableOrderType'] as String?,
  );

  final String id;
  final String termsVersion;
  final String name;
  final int points;
  final String discountType;
  final double discountValue;
  final double minOrderAmount;
  final double? maxDiscountAmount;
  final String? applicableOrderType;
}

class HomeVoucher {
  const HomeVoucher({
    required this.code,
    required this.name,
    required this.discountType,
    required this.discountValue,
    this.description,
    this.minOrderAmount = 0,
    this.endAt,
  });

  factory HomeVoucher.fromJson(Map<String, dynamic> json) => HomeVoucher(
    code: '${json['code'] ?? ''}',
    name: '${json['name'] ?? json['code'] ?? 'Voucher'}',
    description: json['description'] as String?,
    discountType: '${json['discountType'] ?? ''}',
    discountValue: _number(json['discountValue']),
    minOrderAmount: _number(json['minOrderAmount']),
    endAt: json['endAt'] as String?,
  );

  final String code;
  final String name;
  final String? description;
  final String discountType;
  final double discountValue;
  final double minOrderAmount;
  final String? endAt;
}

class HomeNewsArticle {
  const HomeNewsArticle({
    required this.slug,
    required this.title,
    required this.excerpt,
    required this.category,
    required this.coverImage,
    this.publishedAt,
    this.content = const [],
  });

  factory HomeNewsArticle.fromJson(Map<String, dynamic> json) {
    final rawContent = json['content'] as List<dynamic>? ?? const [];
    return HomeNewsArticle(
      slug: '${json['slug'] ?? ''}',
      title: '${json['title'] ?? ''}',
      excerpt: '${json['excerpt'] ?? ''}',
      category: '${json['category'] ?? 'Tin tức'}',
      coverImage: '${json['coverImage'] ?? ''}',
      publishedAt: (json['publishedAt'] ?? json['createdAt']) as String?,
      content: rawContent
          .whereType<Map<String, dynamic>>()
          .map(HomeNewsBlock.fromJson)
          .toList(),
    );
  }

  final String slug;
  final String title;
  final String excerpt;
  final String category;
  final String coverImage;
  final String? publishedAt;
  final List<HomeNewsBlock> content;

  String get previewText {
    final summary = excerpt.trim();
    if (summary.isNotEmpty) return summary;

    for (final block in content) {
      final text = block.type == 'list'
          ? block.items.join(' ').trim()
          : block.text?.trim() ?? '';
      if (text.isNotEmpty) return text;
    }
    return '';
  }
}

class HomeNewsBlock {
  const HomeNewsBlock({required this.type, this.text, this.items = const []});

  factory HomeNewsBlock.fromJson(Map<String, dynamic> json) => HomeNewsBlock(
    type: '${json['type'] ?? 'paragraph'}',
    text: json['text'] as String?,
    items: (json['items'] as List<dynamic>? ?? const [])
        .map((item) => '$item')
        .toList(),
  );

  final String type;
  final String? text;
  final List<String> items;
}

double _number(dynamic value) =>
    value is num ? value.toDouble() : double.tryParse('$value') ?? 0;
