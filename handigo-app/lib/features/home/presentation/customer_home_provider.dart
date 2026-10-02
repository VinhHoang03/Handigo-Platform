import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../app/providers/app_providers.dart';
import '../data/customer_home_repository.dart';
import '../domain/customer_home_data.dart';

final customerHomeRepositoryProvider = Provider<CustomerHomeRepository>(
  (ref) => CustomerHomeRepository(ref.watch(apiClientProvider)),
);

final customerHomeProvider = FutureProvider<CustomerHomeData>(
  (ref) => ref.watch(customerHomeRepositoryProvider).load(),
);
