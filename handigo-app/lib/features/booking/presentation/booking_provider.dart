import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../domain/booking_models.dart';

class BookingDraft {
  const BookingDraft({
    this.serviceId,
    this.selectedOptionIds = const [],
    this.quantities = const {},
    this.addressId,
    this.type = BookingType.scheduled,
    this.paymentMethod = PaymentMethod.cash,
    this.scheduledAt,
    this.recurrenceUnit,
    this.recurrenceCount,
    this.problemDescription = '',
    this.attachments = const [],
    this.voucherCode,
  });

  final String? serviceId;
  final List<String> selectedOptionIds;
  final Map<String, int> quantities;
  final String? addressId;
  final BookingType type;
  final PaymentMethod paymentMethod;
  final DateTime? scheduledAt;
  final String? recurrenceUnit;
  final int? recurrenceCount;
  final String problemDescription;
  final List<String> attachments;
  final String? voucherCode;

  BookingDraft copyWith({
    String? serviceId,
    List<String>? selectedOptionIds,
    Map<String, int>? quantities,
    String? addressId,
    BookingType? type,
    PaymentMethod? paymentMethod,
    DateTime? scheduledAt,
    String? recurrenceUnit,
    int? recurrenceCount,
    String? problemDescription,
    List<String>? attachments,
    String? voucherCode,
    bool clearVoucherCode = false,
  }) => BookingDraft(
        serviceId: serviceId ?? this.serviceId,
        selectedOptionIds: selectedOptionIds ?? this.selectedOptionIds,
        quantities: quantities ?? this.quantities,
        addressId: addressId ?? this.addressId,
        type: type ?? this.type,
        paymentMethod: paymentMethod ?? this.paymentMethod,
        scheduledAt: scheduledAt ?? this.scheduledAt,
        recurrenceUnit: recurrenceUnit ?? this.recurrenceUnit,
        recurrenceCount: recurrenceCount ?? this.recurrenceCount,
        problemDescription: problemDescription ?? this.problemDescription,
        attachments: attachments ?? this.attachments,
        voucherCode: clearVoucherCode ? null : voucherCode ?? this.voucherCode,
      );
}

class BookingDraftController extends Notifier<BookingDraft> {
  @override
  BookingDraft build() => const BookingDraft();

  void startService(String id) => state = state.copyWith(serviceId: id);
  void toggleOption(String id) {
    final ids = [...state.selectedOptionIds];
    if (ids.contains(id)) {
      ids.remove(id);
    } else {
      ids.add(id);
    }
    state = state.copyWith(selectedOptionIds: ids);
  }

  void setQuantity(String id, int quantity) => state = state.copyWith(
        quantities: {...state.quantities, id: quantity.clamp(1, 99).toInt()},
      );
  void setAddress(String id) => state = state.copyWith(addressId: id);
  void setType(BookingType type) => state = state.copyWith(type: type);
  void setPaymentMethod(PaymentMethod method) => state = state.copyWith(paymentMethod: method);
  void setScheduledAt(DateTime value) => state = state.copyWith(scheduledAt: value);
  void setRecurrence(String unit, int count) => state = state.copyWith(recurrenceUnit: unit, recurrenceCount: count);
  void setProblemDescription(String value) => state = state.copyWith(problemDescription: value);
  void setAttachments(List<String> values) => state = state.copyWith(attachments: values);
  void setVoucherCode(String value) {
    final normalized = value.trim();
    state = state.copyWith(
      voucherCode: normalized.isEmpty ? null : normalized.toUpperCase(),
      clearVoucherCode: normalized.isEmpty,
    );
  }
  void reset() => state = build();
}

final bookingDraftProvider = NotifierProvider<BookingDraftController, BookingDraft>(BookingDraftController.new);
