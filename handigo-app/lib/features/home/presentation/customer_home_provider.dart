import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../app/providers/app_providers.dart';
import '../data/customer_home_repository.dart';
import '../domain/customer_home_data.dart';
import 'device_location_provider.dart';

final customerHomeRepositoryProvider = Provider<CustomerHomeRepository>(
  (ref) => CustomerHomeRepository(ref.watch(apiClientProvider)),
);

final customerHomeProvider = FutureProvider<CustomerHomeData>(
  (ref) async {
    final locationState = ref.watch(deviceLocationProvider);
    return ref.watch(customerHomeRepositoryProvider).load(
      currentPosition: locationState.asData?.value.position,
    );
  },
);
