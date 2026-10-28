import 'package:flutter_test/flutter_test.dart';
import 'package:handigo_app/core/network/api_exception.dart';
import 'package:handigo_app/features/provider/presentation/provider_order_directions_sheet.dart';

Map<String, dynamic> route(num distance, {List<dynamic>? coordinates}) => {
  'distance': distance,
  'duration': 600,
  'geometry': {
    'type': 'LineString',
    'coordinates':
        coordinates ??
        [
          [106.7, 10.7],
          [106.8, 10.8],
        ],
  },
};

void main() {
  test(
    'Chọn đường ngắn nhất trong các tuyến được trả về, giữ thứ tự tọa độ',
    () {
      final directions = ProviderDirections.fromJson({
        'routes': [route(3000), route(1200), route(2400)],
      });
      expect(directions.distanceMeters, 1200);
      expect(directions.durationSeconds, 600);
      expect(directions.points.first.latitude, 10.7);
      expect(directions.points.first.longitude, 106.7);
      expect(directions.points.last.latitude, 10.8);
    },
  );
  test(
    'Bỏ qua tuyến có tọa độ sai và không vẽ đường giả khi thiếu dữ liệu',
    () {
      final directions = ProviderDirections.fromJson({
        'routes': [
          route(
            100,
            coordinates: [
              [200, 91],
              [106, 10],
            ],
          ),
          route(2200),
        ],
      });
      expect(directions.distanceMeters, 2200);
      expect(
        () => ProviderDirections.fromJson({'routes': []}),
        throwsA(isA<ApiException>()),
      );
      expect(
        () => ProviderDirections.fromJson({
          'routes': [
            route(
              100,
              coordinates: [
                [106, 10],
              ],
            ),
          ],
        }),
        throwsA(isA<ApiException>()),
      );
    },
  );
}
