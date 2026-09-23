import { ReliableImage } from "@/components/common/ReliableImage";
import type { Service, ServiceOption } from "@/types/booking";
import type { ServiceOptionGroup } from "@/features/booking/utils/serviceOptionSelection";
import { getOptionPrice, money } from "../utils/serviceDisplay";

interface ServiceOptionsSectionProps {
  service: Service;
  options: ServiceOption[];
  optionGroups: ServiceOptionGroup[];
  selectedOptionIds: string[];
  selectedOptionQuantities: Record<string, number>;
  optionSelectionError: string;
  onToggleOption: (option: ServiceOption) => void;
  onQuantityChange: (optionId: string, quantity: number) => void;
}

/** Danh sách gói/tùy chọn dịch vụ theo nhóm, cho phép chọn và nhập số lượng. */
export function ServiceOptionsSection({
  service,
  options,
  optionGroups,
  selectedOptionIds,
  selectedOptionQuantities,
  optionSelectionError,
  onToggleOption,
  onQuantityChange,
}: ServiceOptionsSectionProps) {
  return (
    <section>
      <h2 className="mb-3 text-2xl font-bold">
        Gói dịch vụ
        {service.requiresOptionSelection ? <span className="text-error"> *</span> : null}
      </h2>
      {options.length === 0 ? (
        <div className="rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest p-6 text-on-surface-variant">
          Dịch vụ này chưa có tùy chọn bổ sung.
        </div>
      ) : (
        <div className="space-y-6">
          {optionGroups.map((group) => (
            <fieldset key={group.key}>
              <legend className="mb-3 font-bold text-on-surface">{group.label}</legend>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {group.options.map((option) => {
                  const checked = selectedOptionIds.includes(option._id);
                  return (
                    <div key={option._id} className="space-y-2">
                      <button
                        type="button"
                        role={group.selectionMode === "single" ? "radio" : "checkbox"}
                        aria-checked={checked}
                        onClick={() => onToggleOption(option)}
                        className={`w-full rounded-xl border-2 bg-surface-container-lowest p-5 text-left transition ${checked ? "border-primary bg-surface-container-low shadow-sm" : "border-outline-variant hover:border-primary/50"}`}
                      >
                        <div className="flex gap-4">
                          {/* Chỉ dựng khung ảnh khi tuỳ chọn thật sự có ảnh.
                              Toàn bộ tuỳ chọn hiện tại đều `image: null`, nên
                              trước đây mỗi thẻ hiện một ô xám kèm icon "ảnh
                              hỏng": đọc như trang đang lỗi tải. */}
                          {option.image && (
                            <ReliableImage
                              src={option.image}
                              alt={`Ảnh tùy chọn ${option.name}`}
                              className="h-24 w-24 shrink-0 rounded-lg object-cover"
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-4">
                              <h3 className="min-w-0 text-balance font-bold text-primary">
                                {option.name}
                              </h3>
                              {service.serviceType === "fixed_price" ? (
                                <span className="shrink-0 whitespace-nowrap font-bold tabular-nums text-on-surface">
                                  {getOptionPrice(option) > 0
                                    ? `+${money.format(getOptionPrice(option))}`
                                    : "Miễn phí"}
                                </span>
                              ) : null}
                            </div>
                            {/* Không có mô tả thì không render dòng nào. Trước
                                đây rơi về "Tùy chọn bổ sung cho dịch vụ này."
                                lặp ở mọi thẻ, chữ chiếm chỗ mà không nói gì. */}
                            {option.description && (
                              <p className="mt-2 text-sm text-on-surface-variant">
                                {option.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </button>
                      {checked && option.allowsQuantity && (
                        <label className="flex items-center justify-end gap-2 text-sm font-semibold">
                          Số lượng
                          <input
                            type="number"
                            min={1}
                            max={99}
                            value={selectedOptionQuantities[option._id] ?? 1}
                            onChange={(event) =>
                              onQuantityChange(
                                option._id,
                                Math.min(
                                  Math.max(Math.trunc(Number(event.target.value)) || 1, 1),
                                  99,
                                ),
                              )
                            }
                            className="w-20 rounded-lg border border-outline-variant px-3 py-2 text-center"
                          />
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>
      )}
      {optionSelectionError && (
        <p className="mt-3 rounded-lg bg-error/10 px-3 py-2 text-sm font-semibold text-error">
          {optionSelectionError}
        </p>
      )}
    </section>
  );
}
