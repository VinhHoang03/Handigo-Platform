import { ReliableImage } from '@/components/common/ReliableImage';
import { formatCurrency } from '@/utils/currency';
import type { ServiceOption } from '../../../types/booking';
import type { ServiceOptionGroup } from '../utils/serviceOptionSelection';

const getOptionPrice = (option: ServiceOption): number => option.price ?? option.fixedPrice ?? 0;

interface ServiceOptionsPanelProps {
  optionGroups: ServiceOptionGroup[];
  selectedOptionIds: string[];
  selectedOptionQuantities?: Record<string, number>;
  isVariablePrice: boolean;
  requiresOptionSelection?: boolean;
  onToggleOption: (option: ServiceOption) => void;
  onQuantityChange: (optionId: string, quantity: number) => void;
}

export const ServiceOptionsPanel = ({
  optionGroups,
  selectedOptionIds,
  selectedOptionQuantities,
  isVariablePrice,
  requiresOptionSelection,
  onToggleOption,
  onQuantityChange,
}: ServiceOptionsPanelProps) => (
  <div className="mt-md p-md bg-surface-container-low rounded-xl">
    <p className="mb-md font-label-md font-bold text-on-surface">
      Tùy chọn dịch vụ
      {requiresOptionSelection ? <span className="text-error"> *</span> : null}
    </p>
    <div className="space-y-md">
      {optionGroups.map((group) => (
        <fieldset key={group.key}>
          <legend className="font-label-md mb-sm">{group.label}</legend>
          <div className="flex flex-wrap gap-sm">
            {group.options.map((option) => (
              <label
                key={option._id}
                className={`flex items-center gap-2 px-4 py-2 bg-surface-container-lowest rounded-full border cursor-pointer hover:border-primary transition-colors ${selectedOptionIds.includes(option._id) ? 'border-primary bg-primary/5' : 'border-outline-variant'}`}
              >
                <input
                  className="rounded text-primary focus:ring-primary"
                  type={group.selectionMode === 'single' ? 'radio' : 'checkbox'}
                  name={`option-group-${group.key}`}
                  checked={selectedOptionIds.includes(option._id)}
                  onChange={() => onToggleOption(option)}
                />
                <ReliableImage
                  src={option.image}
                  alt=""
                  aria-hidden="true"
                  className="h-8 w-8 rounded-md object-cover"
                />
                <span className="text-label-md">
                  {option.name}
                  {!isVariablePrice && ` (+${formatCurrency(getOptionPrice(option))})`}
                </span>
                {option.allowsQuantity && selectedOptionIds.includes(option._id) && (
                  <span className="ml-1 flex items-center gap-1 border-l border-outline-variant pl-2">
                    <span className="text-xs text-on-surface-variant">SL</span>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={selectedOptionQuantities?.[option._id] ?? 1}
                      onChange={(event) => onQuantityChange(option._id, Number(event.target.value))}
                      onClick={(event) => event.stopPropagation()}
                      aria-label={`Số lượng ${option.name}`}
                      className="w-14 rounded-md border border-outline-variant px-2 py-1 text-center tabular-nums"
                    />
                  </span>
                )}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  </div>
);
