import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../domain/booking_models.dart';
import 'dart:async';
import '../../../app/providers/app_providers.dart';
import '../data/booking_draft_store.dart';

class BookingDraft {
  const BookingDraft({
    this.serviceId,
    this.selectedOptionIds = const [],
    this.quantities = const {},
    this.addressId,
    this.type = BookingType.normal,
    this.paymentMethod = PaymentMethod.cash,
    this.scheduledAt,
    this.recurrenceUnit,
    this.recurrenceCount,
    this.problemDescription = '',
    this.attachments = const [],
    this.voucherCode,
    this.preferredProviderId,
    this.uniformQuantity = 1,
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
  final String? preferredProviderId;
  final int uniformQuantity;

  BookingDraft copyWith({
    String? serviceId,
    List<String>? selectedOptionIds,
    Map<String, int>? quantities,
    String? addressId,
    BookingType? type,
    PaymentMethod? paymentMethod,
    DateTime? scheduledAt,
    bool clearScheduledAt = false,
    String? recurrenceUnit,
    int? recurrenceCount,
    String? problemDescription,
    List<String>? attachments,
    String? voucherCode,
    bool clearVoucherCode = false,
    String? preferredProviderId,
    bool clearProvider = false,
    int? uniformQuantity,
  }) => BookingDraft(
    serviceId: serviceId ?? this.serviceId,
    selectedOptionIds: selectedOptionIds ?? this.selectedOptionIds,
    quantities: quantities ?? this.quantities,
    addressId: addressId ?? this.addressId,
    type: type ?? this.type,
    paymentMethod: paymentMethod ?? this.paymentMethod,
    scheduledAt: clearScheduledAt ? null : scheduledAt ?? this.scheduledAt,
    recurrenceUnit: recurrenceUnit ?? this.recurrenceUnit,
    recurrenceCount: recurrenceCount ?? this.recurrenceCount,
    problemDescription: problemDescription ?? this.problemDescription,
    attachments: attachments ?? this.attachments,
    voucherCode: clearVoucherCode ? null : voucherCode ?? this.voucherCode,
    preferredProviderId: clearProvider
        ? null
        : preferredProviderId ?? this.preferredProviderId,
    uniformQuantity: uniformQuantity ?? this.uniformQuantity,
  );
}

class BookingDraftController extends Notifier<BookingDraft> {
  String? _owner;
  int _revision = 0;
  Timer? _debounce;
  @override
  BookingDraft build() {
    final removeListener = listenSelf((previous, next) {
      _revision++;
      _debounce?.cancel();
      final owner = _owner;
      if (owner == null) return;
      _debounce = Timer(const Duration(milliseconds: 250), () async {
        try {
          await const BookingDraftStore().save(owner, next);
        } catch (_) {
          /* Giữ bản nháp trong phiên nếu thiết bị chưa lưu được. */
        }
      });
    });
    ref.onDispose(() {
      _debounce?.cancel();
      removeListener();
    });
    return const BookingDraft();
  }

  Future<void> attachOwner(String? id) async {
    if (_owner == id) return;
    _debounce?.cancel();
    _owner = null;
    state = const BookingDraft();
    _owner = id;
    if (id == null) return;
    final revision = _revision;
    try {
      final restored = await const BookingDraftStore().read(id);
      if (ref.mounted &&
          _owner == id &&
          _revision == revision &&
          restored != null)
        state = restored;
    } catch (_) {
      /* Bản nháp lỗi không chặn đặt dịch vụ. */
    }
  }

  void startService(String id) {
    if (state.serviceId == id) return;
    state = BookingDraft(serviceId: id, addressId: state.addressId);
  }

  void toggleOption(
    String id, {
    Iterable<String> siblings = const [],
    bool multiple = true,
  }) {
    final ids = [...state.selectedOptionIds];
    if (ids.contains(id)) {
      ids.remove(id);
    } else {
      if (!multiple) ids.removeWhere(siblings.contains);
      ids.add(id);
    }
    state = state.copyWith(selectedOptionIds: ids, clearProvider: true);
  }

  void setQuantity(String id, int quantity) => state = state.copyWith(
    quantities: {...state.quantities, id: quantity.clamp(1, 99).toInt()},
    clearProvider: true,
  );
  void setAddress(String id) =>
      state = state.copyWith(addressId: id, clearProvider: true);
  void setType(BookingType type) =>
      state = state.copyWith(type: type, clearProvider: true);
  void setPreferredProvider(String? id) => state = state.copyWith(
    preferredProviderId: id,
    clearProvider: id == null,
  );
  void setUniformQuantity(int value) =>
      state = state.copyWith(uniformQuantity: value.clamp(1, 99));
  void setPaymentMethod(PaymentMethod method) =>
      state = state.copyWith(paymentMethod: method);
  void setScheduledAt(DateTime value) => state = state.copyWith(
    type: BookingType.scheduled,
    scheduledAt: value,
    clearProvider: true,
  );
  void clearSchedule() => state = state.copyWith(
    type: BookingType.normal,
    clearScheduledAt: true,
    clearProvider: true,
  );
  void setRecurrence(String unit, int count) =>
      state = state.copyWith(recurrenceUnit: unit, recurrenceCount: count);
  void setProblemDescription(String value) =>
      state = state.copyWith(problemDescription: value);
  void setAttachments(List<String> values) =>
      state = state.copyWith(attachments: values);
  void setVoucherCode(String value) {
    final normalized = value.trim();
    state = state.copyWith(
      voucherCode: normalized.isEmpty ? null : normalized.toUpperCase(),
      clearVoucherCode: normalized.isEmpty,
    );
  }

  void reset() => state = const BookingDraft();
}

final bookingDraftProvider =
    NotifierProvider<BookingDraftController, BookingDraft>(
      BookingDraftController.new,
    );

final bookingDraftPersistenceProvider = Provider<void>((ref) {
  final id = ref.watch(authControllerProvider.select((auth) => auth.user?.id));
  final controller = ref.read(bookingDraftProvider.notifier);
  Future.microtask(() {
    if (ref.mounted) controller.attachOwner(id);
  });
});
