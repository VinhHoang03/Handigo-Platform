import 'package:dio/dio.dart';

class ApiException implements Exception {
  const ApiException(this.message, {this.statusCode});
  final String message;
  final int? statusCode;

  factory ApiException.fromDio(DioException error) {
    final status = error.response?.statusCode;
    return ApiException(switch (status) {
      400 || 422 => 'Thông tin chưa hợp lệ. Vui lòng kiểm tra lại.',
      401 => 'Thông tin đăng nhập hoặc phiên làm việc không hợp lệ.',
      403 => 'Bạn chưa có quyền sử dụng chức năng này.',
      404 => 'Không tìm thấy dữ liệu yêu cầu.',
      409 => 'Dữ liệu đã thay đổi. Vui lòng tải lại.',
      429 => 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.',
      null => 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.',
      _ => 'Máy chủ chưa thể xử lý yêu cầu. Vui lòng thử lại sau.',
    }, statusCode: status);
  }
  @override
  String toString() => message;
}
