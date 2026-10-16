import '../../providers/domain/featured_provider.dart';
import '../../services/domain/service.dart';
import '../../services/domain/service_category.dart';

class CustomerHomeData {
  const CustomerHomeData({
    required this.categories,
    required this.services,
    required this.providers,
    required this.unreadNotificationCount,
  });

  final List<ServiceCategory> categories;
  final List<Service> services;
  final List<FeaturedProvider> providers;
  final int unreadNotificationCount;
}
