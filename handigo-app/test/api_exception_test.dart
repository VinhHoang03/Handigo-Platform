import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:handigo_app/core/network/api_exception.dart';
import 'package:handigo_app/core/network/http_error_messages.dart';

DioException failure(
  int? status, {
  dynamic data,
  DioExceptionType type = DioExceptionType.badResponse,
}) {
  final request = RequestOptions(path: '/locations/reverse-geocode');
  return DioException(
    requestOptions: request,
    type: type,
    response: status == null
        ? null
        : Response(requestOptions: request, statusCode: status, data: data),
  );
}

void main() {
  for (final entry in httpErrorMessages.entries) {
    test('HTTP ${entry.key}: có thông báo và mã phân biệt', () {
      final error = ApiException.fromDio(failure(entry.key));
      expect(error.statusCode, entry.key);
      expect(error.code, 'HTTP_${entry.key}');
      expect(error.message, entry.value);
      expect(error.diagnosticMessage, contains('HTTP ${entry.key}'));
    });
  }

  test('Thông báo máy chủ cũ được phân loại theo trạng thái HTTP', () {
    for (final status in [500, 502, 503, 504]) {
      for (final message in ['Lỗi máy chủ nội bộ', 'Internal server error']) {
        final error = ApiException.fromDio(
          failure(status, data: {'message': message}),
        );
        expect(error.message, httpErrorMessages[status]);
      }
    }
  });

  test('Giữ nguyên thông báo geo cụ thể cùng mã và HTTP', () {
    final error = ApiException.fromDio(
      failure(
        503,
        data: {
          'message': 'Dịch vụ xác định địa chỉ chưa được cấu hình.',
          'code': 'GEO_NOT_CONFIGURED',
        },
      ),
    );
    expect(error.code, 'GEO_NOT_CONFIGURED');
    expect(error.message, contains('chưa được cấu hình'));
    expect(error.diagnosticMessage, contains('HTTP 503 · GEO_NOT_CONFIGURED'));
  });

  for (final type in DioExceptionType.values.where(
    (type) => type != DioExceptionType.badResponse,
  )) {
    test('Lỗi kết nối ${type.name} không bị nhầm là lỗi HTTP', () {
      final error = ApiException.fromDio(failure(null, type: type));
      expect(error.statusCode, isNull);
      expect(error.code, isNotNull);
      expect(error.message, isNotEmpty);
      expect(error.diagnosticMessage, isNot(contains('HTTP')));
    });
  }

  test('Phân biệt các loại timeout, hủy và chứng chỉ', () {
    final errors = [
      DioExceptionType.connectionTimeout,
      DioExceptionType.sendTimeout,
      DioExceptionType.receiveTimeout,
      DioExceptionType.cancel,
      DioExceptionType.badCertificate,
    ].map((type) => ApiException.fromDio(failure(null, type: type)));
    expect(errors.map((e) => e.code).toSet().length, 5);
    expect(errors.map((e) => e.message).toSet().length, 5);
  });

  test(
    'Mã chưa biết, dữ liệu không phải JSON và mã lỗi sai kiểu vẫn xử lý được',
    () {
      expect(
        ApiException.fromDio(failure(599, data: '<html>Lỗi</html>')).code,
        'HTTP_599',
      );
      expect(
        ApiException.fromDio(failure(499, data: {'code': 23})).code,
        'HTTP_499',
      );
      expect(
        ApiException.fromDio(failure(503, data: {'message': ' '})).message,
        httpErrorMessages[503],
      );
    },
  );
}
