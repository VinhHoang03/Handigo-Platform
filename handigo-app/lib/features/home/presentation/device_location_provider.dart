import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geocoding/geocoding.dart';
import 'package:geolocator/geolocator.dart';

import '../../../shared/utils/address_format.dart';

class DeviceLocationData {
  const DeviceLocationData({required this.label, this.position});

  final String label;
  final Position? position;
}

final deviceLocationProvider = FutureProvider<DeviceLocationData>((ref) async {
  return _loadDeviceLocation().timeout(
    const Duration(seconds: 15),
    onTimeout: () => const DeviceLocationData(label: 'Không tải được vị trí'),
  );
});

Future<DeviceLocationData> _loadDeviceLocation() async {
  final serviceEnabled = await Geolocator.isLocationServiceEnabled().timeout(
    const Duration(seconds: 3),
    onTimeout: () => false,
  );
  if (!serviceEnabled) {
    return const DeviceLocationData(label: 'Chưa bật vị trí');
  }

  var permission = await Geolocator.checkPermission().timeout(
    const Duration(seconds: 3),
    onTimeout: () => LocationPermission.denied,
  );
  if (permission == LocationPermission.denied) {
    permission = await Geolocator.requestPermission().timeout(
      const Duration(seconds: 8),
      onTimeout: () => LocationPermission.denied,
    );
  }
  if (permission == LocationPermission.denied ||
      permission == LocationPermission.deniedForever) {
    return const DeviceLocationData(label: 'Chưa cấp quyền vị trí');
  }

  try {
    final position = await Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.medium,
      ),
    ).timeout(const Duration(seconds: 8));
    try {
      final places = await placemarkFromCoordinates(
        position.latitude,
        position.longitude,
      ).timeout(const Duration(seconds: 4));
      if (places.isNotEmpty) {
        final place = places.first;
        final ward = place.subLocality?.trim();
        final city = (place.administrativeArea ?? place.locality)?.trim();
        final parts = [
          if (ward != null && ward.isNotEmpty) ward,
          if (city != null && city.isNotEmpty) city,
        ];
        return DeviceLocationData(
          label: parts.isEmpty
              ? 'Chưa lấy được địa chỉ'
              : formatAddress(parts.join(', ')),
          position: position,
        );
      }
    } catch (_) {
      // Vẫn giữ vị trí GPS để tải dịch vụ gần đây.
    }
    return DeviceLocationData(
      label: 'Chưa lấy được địa chỉ',
      position: position,
    );
  } catch (_) {
    return const DeviceLocationData(label: 'Không xác định vị trí');
  }
}
