import '../../services/domain/service.dart';
import 'service_option.dart';

class ServiceDetail {
  const ServiceDetail({required this.service, required this.options});

  factory ServiceDetail.fromJson(
    Map<String, dynamic> json,
    List<ServiceOption> options,
  ) => ServiceDetail(service: Service.fromJson(json), options: options);

  final Service service;
  final List<ServiceOption> options;
}
