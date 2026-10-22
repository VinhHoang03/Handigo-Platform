import '../../../shared/utils/address_format.dart';

class OrderSummary {
  const OrderSummary({
    required this.id,
    required this.code,
    required this.serviceName,
    required this.status,
    this.scheduledAt,
    this.addressLabel,
    this.serviceImage,
    this.providerName,
    this.providerAvatar,
    this.customerName,
    this.customerAvatar,
    this.totalAmount,
    this.paymentStatus,
    this.bookingStatus,
    this.readyForMatching = false,
    this.hasPendingAssignment = false,
    this.depositPaidAt,
  });
  factory OrderSummary.fromJson(Map<String, dynamic> json) {
    final service = json['serviceId'];
    final provider = json['providerId'];
    final providerUser = provider is Map<String, dynamic>
        ? provider['userId']
        : null;
    final pricing = json['pricing'];
    return OrderSummary(
      id: (json['_id'] ?? json['id']) as String,
      code: json['orderCode'] as String? ?? '',
      serviceName: service is Map<String, dynamic>
          ? service['name'] as String? ?? 'Dịch vụ'
          : 'Dịch vụ',
      status: json['status'] as String? ?? 'created',
      paymentStatus: json['paymentStatus'] as String?,
      bookingStatus: json['bookingStatus'] as String?,
      readyForMatching: json['readyForMatching'] == true,
      hasPendingAssignment: json['hasPendingAssignment'] == true,
      depositPaidAt: _date(json['depositPaidAt']),
      scheduledAt: _date(json['scheduledAt']),
      addressLabel: json['addressId'] is Map<String, dynamic>
          ? formatAddressData(json['addressId'] as Map<String, dynamic>)
          : null,
      serviceImage: service is Map<String, dynamic>
          ? (service.containsKey('coverImage')
                    ? service['coverImage']
                    : service['image'])
                as String?
          : null,
      providerName: providerUser is Map<String, dynamic>
          ? providerUser['fullName'] as String?
          : null,
      providerAvatar: providerUser is Map<String, dynamic>
          ? providerUser['avatar'] as String?
          : null,
      customerName: json['customerId'] is Map<String, dynamic>
          ? (json['customerId'] as Map<String, dynamic>)['fullName'] as String?
          : null,
      customerAvatar: json['customerId'] is Map<String, dynamic>
          ? (json['customerId'] as Map<String, dynamic>)['avatar'] as String?
          : null,
      totalAmount: pricing is Map<String, dynamic>
          ? ((json['quotationFinalAmount'] ?? pricing['totalPaidAmount'])
                    as num?)
                ?.toDouble()
          : null,
    );
  }
  final String id;
  final String code;
  final String serviceName;
  final String status;
  final DateTime? scheduledAt;
  final String? addressLabel;
  final String? serviceImage;
  final String? providerName;
  final String? providerAvatar;
  final String? customerName;
  final String? customerAvatar;
  final double? totalAmount;
  final String? paymentStatus, bookingStatus;
  final bool readyForMatching, hasPendingAssignment;
  final DateTime? depositPaidAt;

  String get customerDisplayStatus {
    if (status != 'created') return status;
    if (bookingStatus == 'awaiting_payment') return 'awaiting_payment';
    if (hasPendingAssignment) return 'awaiting_confirmation';
    if (readyForMatching ||
        paymentStatus == 'paid' ||
        paymentStatus == 'partially_paid' ||
        depositPaidAt != null) {
      return 'finding_provider';
    }
    return 'awaiting_payment';
  }
}

class OrderDetail {
  const OrderDetail({
    required this.id,
    required this.code,
    required this.serviceName,
    required this.status,
    required this.paymentStatus,
    required this.paymentMethod,
    this.orderType,
    this.scheduledAt,
    this.problemDescription,
    this.totalAmount,
    this.providerName,
    this.addressLabel,
    this.hasAdditionalQuotation = false,
    this.currentQuotationId,
    this.serviceImage,
    this.customerName,
    this.customerAvatar,
    List<OrderStatusEvent>? statusHistory,
    this.customerCancellationDeadline,
    this.inspectionRequired = false,
    this.bookingStatus = 'not_required',
    this.providerId,
    this.depositPaidAt,
    this.depositAmount = 0,
    this.hasPricingSnapshot = false,
    this.durationMinutes,
    this.hasSchedule = false,
    this.customerAttachments = const [],
    this.completionEvidenceImages = const [],
    this.completionNote,
    this.paymentDueAt,
    this.reassignment = const {},
    this.recurringGroupId,
    this.serviceId,
    this.addressId,
    this.selectedOptions = const [],
    this.pricing = const {},
  }) : _statusHistory = statusHistory;

  factory OrderDetail.fromJson(Map<String, dynamic> json) {
    final service = json['serviceId'];
    final provider = json['providerId'];
    final address = json['addressId'];
    final pricing = json['pricing'];
    final providerUser = provider is Map<String, dynamic>
        ? provider['userId']
        : null;
    return OrderDetail(
      id: (json['_id'] ?? json['id']) as String,
      code: json['orderCode'] as String? ?? '',
      serviceName: service is Map<String, dynamic>
          ? (service['name'] as String? ?? 'Dịch vụ')
          : 'Dịch vụ',
      status: json['status'] as String? ?? 'created',
      paymentStatus: json['paymentStatus'] as String? ?? 'unpaid',
      paymentMethod: json['paymentMethod'] as String? ?? '',
      orderType: json['orderType'] as String?,
      scheduledAt: _date(json['scheduledAt']),
      problemDescription: json['problemDescription'] as String?,
      totalAmount: pricing is Map<String, dynamic>
          ? (pricing['totalPaidAmount'] as num?)?.toDouble()
          : null,
      providerName: providerUser is Map<String, dynamic>
          ? providerUser['fullName'] as String?
          : null,
      addressLabel: (json['addressSnapshot'] ?? address) is Map<String, dynamic>
          ? formatAddressData(
              (json['addressSnapshot'] ?? address) as Map<String, dynamic>,
            )
          : null,
      hasAdditionalQuotation: json['hasAdditionalQuotation'] as bool? ?? false,
      currentQuotationId: _stringValue(json['currentQuotationId']),
      serviceImage: service is Map<String, dynamic>
          ? (service['coverImage'] ?? service['image']) as String?
          : null,
      customerName: json['customerId'] is Map<String, dynamic>
          ? (json['customerId'] as Map<String, dynamic>)['fullName'] as String?
          : null,
      customerAvatar: json['customerId'] is Map<String, dynamic>
          ? (json['customerId'] as Map<String, dynamic>)['avatar'] as String?
          : null,
      statusHistory: (json['statusHistory'] as List? ?? [])
          .whereType<Map<String, dynamic>>()
          .map(OrderStatusEvent.fromJson)
          .toList(growable: false),
      customerCancellationDeadline: _date(json['customerCancellationDeadline']),
      inspectionRequired:
          json['inspectionRequired'] as bool? ??
          (service is Map && service['serviceType'] == 'variable_price'),
      bookingStatus: json['bookingStatus'] as String? ?? 'not_required',
      providerId: provider is Map
          ? _stringValue(provider['_id'] ?? provider['id'])
          : provider as String?,
      depositPaidAt: _date(json['depositPaidAt']),
      depositAmount: _number(json['depositAmount']),
      hasPricingSnapshot: pricing is Map && pricing['baseAmount'] != null,
      hasSchedule: json['schedule'] is Map,
      durationMinutes: json['schedule'] is Map
          ? ((json['schedule'] as Map)['durationMinutes'] as num?)?.toInt()
          : null,
      customerAttachments: (json['customerAttachments'] as List? ?? [])
          .whereType<String>()
          .toList(),
      completionEvidenceImages:
          (json['completionEvidenceImages'] as List? ?? [])
              .whereType<String>()
              .toList(),
      completionNote: json['completionNote'] as String?,
      paymentDueAt: _date(json['paymentDueAt']),
      reassignment: json['reassignment'] is Map
          ? Map<String, dynamic>.from(json['reassignment'] as Map)
          : const {},
      recurringGroupId: _stringValue(json['recurringGroupId']),
      serviceId: service is Map
          ? _stringValue(service['_id'] ?? service['id'])
          : service as String?,
      addressId: address is Map
          ? _stringValue(address['_id'] ?? address['id'])
          : address as String?,
      selectedOptions: (json['selectedOptionsSnapshot'] as List? ?? [])
          .whereType<Map<String, dynamic>>()
          .toList(),
      pricing: pricing is Map ? Map<String, dynamic>.from(pricing) : const {},
    );
  }

  final String id;
  final String code;
  final String serviceName;
  final String status;
  final String paymentStatus;
  final String paymentMethod;
  final String? orderType;
  final DateTime? scheduledAt;
  final String? problemDescription;
  final double? totalAmount;
  final String? providerName;
  final String? addressLabel;
  final bool hasAdditionalQuotation;
  final String? currentQuotationId;
  final String? serviceImage;
  final String? customerName;
  final String? customerAvatar;
  final List<OrderStatusEvent>? _statusHistory;
  final DateTime? customerCancellationDeadline;
  final bool inspectionRequired, hasPricingSnapshot;
  final String bookingStatus;
  final String? providerId, completionNote, recurringGroupId;
  final DateTime? depositPaidAt, paymentDueAt;
  final double depositAmount;
  final int? durationMinutes;
  final bool hasSchedule;
  final List<String> customerAttachments, completionEvidenceImages;
  final Map<String, dynamic> reassignment;
  final String? serviceId, addressId;
  final List<Map<String, dynamic>> selectedOptions;
  final Map<String, dynamic> pricing;
  bool get isAppointment => ['scheduled', 'recurring'].contains(orderType);
  bool get appointmentConfirmed =>
      !isAppointment || bookingStatus == 'confirmed';
  bool get canTrack =>
      providerId != null && ['accepted', 'in_progress'].contains(status);
  bool get canEditQuotation =>
      inspectionRequired &&
      appointmentConfirmed &&
      depositPaidAt != null &&
      ['accepted', 'in_progress'].contains(status);
  double get appliedDeposit => depositPaidAt == null
      ? 0
      : hasPricingSnapshot
      ? totalAmount ?? 0
      : depositAmount;
  bool canStart(RepairQuotation? quotation) =>
      status == 'accepted' &&
      appointmentConfirmed &&
      (inspectionRequired
          ? depositPaidAt != null &&
                quotation?.usable == true &&
                (!hasSchedule && durationMinutes == null ||
                    quotation?.estimatedDurationMinutes != null)
          : paymentMethod == 'cash' || paymentStatus == 'paid');
  bool get canMakeInitialPayment =>
      status != 'cancelled' &&
      paymentStatus == 'unpaid' &&
      ((!inspectionRequired && status == 'in_progress') ||
          (['created', 'accepted'].contains(status) &&
              ['not_required', 'awaiting_payment'].contains(bookingStatus) &&
              paymentMethod != 'cash' &&
              !hasAdditionalQuotation));
  bool canCancelAt(DateTime now) {
    if (status == 'created') return true;
    if (status != 'accepted') return false;
    return customerCancellationDeadline != null &&
        !now.isAfter(customerCancellationDeadline!);
  }

  List<OrderStatusEvent> get statusHistory => _statusHistory ?? const [];
}

class OrderStatusEvent {
  const OrderStatusEvent({required this.status, this.createdAt});
  factory OrderStatusEvent.fromJson(Map<String, dynamic> json) =>
      OrderStatusEvent(
        status: json['status'] as String,
        createdAt: _date(json['createdAt']),
      );
  final String status;
  final DateTime? createdAt;
}

class CancellationPreview {
  const CancellationPreview({
    required this.paidAmount,
    required this.refundAmount,
    required this.cancellationFee,
    this.policyReason,
    this.canCancel = true,
    this.providerCompensation = 0,
    this.items = const [],
  });
  factory CancellationPreview.fromJson(Map<String, dynamic> json) =>
      CancellationPreview(
        paidAmount: _number(json['paidAmount']),
        refundAmount: _number(json['refundAmount']),
        cancellationFee: _number(json['cancellationFee']),
        policyReason: json['policyReason'] as String?,
        canCancel: json['canCancel'] as bool? ?? false,
        providerCompensation: _number(json['providerCompensation']),
        items: (json['items'] as List? ?? [])
            .whereType<Map<String, dynamic>>()
            .toList(),
      );
  final double paidAmount;
  final double refundAmount;
  final double cancellationFee;
  final String? policyReason;
  final bool canCancel;
  final double providerCompensation;
  final List<Map<String, dynamic>> items;
  Map<String, dynamic> get expectation => {
    'paidAmount': paidAmount,
    'refundAmount': refundAmount,
    'cancellationFee': cancellationFee,
    'providerCompensation': providerCompensation,
  };
}

class RepairQuotation {
  const RepairQuotation({
    required this.id,
    required this.status,
    required this.finalAmount,
    this.rejectionReason,
    this.items = const [],
    this.revision = 0,
    this.estimatedDurationMinutes,
    this.discountAmount = 0,
    this.inspectionNote,
    this.recommendation,
    this.directPaymentConfirmedAt,
    this.customerConfirmed = false,
  });
  factory RepairQuotation.fromJson(Map<String, dynamic> json) {
    final quotation = json['quotation'] is Map<String, dynamic>
        ? json['quotation'] as Map<String, dynamic>
        : json;
    final rawItems = json['items'] is List ? json['items'] as List : const [];
    return RepairQuotation(
      id: (quotation['_id'] ?? quotation['id']) as String,
      status: quotation['status'] as String? ?? 'pending',
      finalAmount: _number(
        quotation['finalAmount'] ?? quotation['totalAmount'],
      ),
      rejectionReason: quotation['rejectionReason'] as String?,
      revision: (quotation['revision'] as num?)?.toInt() ?? 0,
      estimatedDurationMinutes: (quotation['estimatedDurationMinutes'] as num?)
          ?.toInt(),
      discountAmount: _number(quotation['discountAmount']),
      inspectionNote: quotation['inspectionNote'] as String?,
      recommendation: quotation['recommendation'] as String?,
      directPaymentConfirmedAt: _date(quotation['directPaymentConfirmedAt']),
      customerConfirmed: quotation['customerConfirmed'] as bool? ?? false,
      items: rawItems
          .whereType<Map<String, dynamic>>()
          .map(QuotationItem.fromJson)
          .toList(),
    );
  }
  final String id;
  final String status;
  final double finalAmount;
  final String? rejectionReason;
  final List<QuotationItem> items;
  final int revision;
  final int? estimatedDurationMinutes;
  final double discountAmount;
  final String? inspectionNote, recommendation;
  final DateTime? directPaymentConfirmedAt;
  final bool customerConfirmed;
  bool get usable =>
      status == 'saved' || (status == 'approved' && customerConfirmed);
}

class QuotationItem {
  const QuotationItem({
    required this.title,
    required this.quantity,
    required this.unitPrice,
    this.itemType = 'material',
    this.description,
    this.note,
  });
  factory QuotationItem.fromJson(Map<String, dynamic> json) => QuotationItem(
    title: json['title'] as String? ?? 'Hạng mục',
    quantity: (json['quantity'] as num?)?.toInt() ?? 1,
    unitPrice: _number(json['unitPrice']),
    itemType: json['itemType'] as String? ?? 'material',
    description: json['description'] as String?,
    note: json['note'] as String?,
  );
  final String title;
  final int quantity;
  final double unitPrice;
  final String itemType;
  final String? description, note;
  Map<String, dynamic> toJson() => {
    'title': title,
    'quantity': quantity,
    'unitPrice': unitPrice,
    'itemType': itemType,
    if (description != null) 'description': description,
    if (note != null) 'note': note,
  };
}

DateTime? _date(dynamic value) =>
    value is String ? DateTime.tryParse(value) : null;
String? _stringValue(dynamic value) =>
    value is String ? value : value?.toString();
double _number(dynamic value) => (value as num?)?.toDouble() ?? 0;
