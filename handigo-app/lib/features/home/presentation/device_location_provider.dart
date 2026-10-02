import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geocoding/geocoding.dart';
import 'package:geolocator/geolocator.dart';

final deviceLocationProvider = FutureProvider<String>((ref) async {
  if (!await Geolocator.isLocationServiceEnabled()) {
    return 'Chưa bật vị trí';
  }

  var permission = await Geolocator.checkPermission();
  if (permission == LocationPermission.denied) {
    permission = await Geolocator.requestPermission();
  }
  if (permission == LocationPermission.denied ||
      permission == LocationPermission.deniedForever) {
    return 'Chưa cấp quyền vị trí';
  }

  try {
    final position = await Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.medium,
      ),
    );
    final places = await placemarkFromCoordinates(
      position.latitude,
      position.longitude,
    );
    if (places.isEmpty) return _coordinates(position);

    final place = places.first;
    final district = place.subLocality?.trim();
    final city = (place.locality ?? place.administrativeArea)?.trim();
    final parts = [
      if (district != null && district.isNotEmpty) district,
      if (city != null && city.isNotEmpty) city,
    ];
    return parts.isEmpty ? _coordinates(position) : parts.join(', ');
  } catch (_) {
    return 'Không xác định vị trí';
  }
});

String _coordinates(Position position) =>
    '${position.latitude.toStringAsFixed(4)}, ${position.longitude.toStringAsFixed(4)}';
