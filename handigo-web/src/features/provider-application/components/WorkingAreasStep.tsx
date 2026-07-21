import { useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "@/components/common/SearchableSelect";
import {
  getProvinces,
  getWardsByProvince,
  type AdministrativeUnit,
} from "@/features/customer/api/vietnamAddress.api";

interface Props {
  areas: string[];
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
}

const toSelectOptions = (
  items: AdministrativeUnit[],
): SearchableSelectOption[] =>
  items.map((item) => ({
    value: item.code,
    label: item.name,
    searchText: `${item.codeName} ${item.divisionType}`,
  }));

const getProvinceName = (area: string) => {
  const separatorIndex = area.lastIndexOf(",");
  return separatorIndex >= 0 ? area.slice(separatorIndex + 1).trim() : "";
};

const normalizeName = (value: string) =>
  value.normalize("NFC").trim().toLocaleLowerCase("vi");

export function WorkingAreasStep({ areas, onAdd, onRemove }: Props) {
  const [provinces, setProvinces] = useState<AdministrativeUnit[]>([]);
  const [wards, setWards] = useState<AdministrativeUnit[]>([]);
  const [provinceCode, setProvinceCode] = useState<number | undefined>();
  const [wardCode, setWardCode] = useState<number | undefined>();
  const [provinceName, setProvinceName] = useState("");
  const [wardName, setWardName] = useState("");
  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [loadingWards, setLoadingWards] = useState(false);
  const [error, setError] = useState("");

  const provinceOptions = useMemo(
    () => toSelectOptions(provinces),
    [provinces],
  );
  const wardOptions = useMemo(() => toSelectOptions(wards), [wards]);
  const lockedProvinceName = useMemo(
    () => getProvinceName(areas[0] || ""),
    [areas],
  );
  const lockedProvince = useMemo(
    () =>
      provinces.find(
        (province) =>
          normalizeName(province.name) === normalizeName(lockedProvinceName),
      ),
    [lockedProvinceName, provinces],
  );
  const effectiveProvinceCode = lockedProvince?.code ?? provinceCode;
  const effectiveProvinceName = lockedProvince?.name ?? provinceName;
  const selectedArea = [wardName, effectiveProvinceName]
    .filter(Boolean)
    .join(", ");
  const isSelectedProvinceValid =
    !lockedProvinceName ||
    normalizeName(effectiveProvinceName) === normalizeName(lockedProvinceName);
  const canAdd = Boolean(
    effectiveProvinceCode && wardCode && selectedArea && isSelectedProvinceValid,
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoadingProvinces(true);
        setError("");
        const data = await getProvinces();
        if (!cancelled) setProvinces(data);
      } catch {
        if (!cancelled) setError("Khong tai duoc danh sach tinh/thanh.");
      } finally {
        if (!cancelled) setLoadingProvinces(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!effectiveProvinceCode) {
      return undefined;
    }

    let cancelled = false;

    const load = async () => {
      try {
        setLoadingWards(true);
        setError("");
        const data = await getWardsByProvince(effectiveProvinceCode);
        if (!cancelled) setWards(data);
      } catch {
        if (!cancelled) setError("Khong tai duoc danh sach phuong/xa.");
      } finally {
        if (!cancelled) setLoadingWards(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [effectiveProvinceCode]);

  const handleAdd = () => {
    if (!canAdd) return;
    onAdd(selectedArea);
    setWardCode(undefined);
    setWardName("");
  };

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-headline-md font-bold">Khu vực hoạt động</h2>
        <p className="mt-1 text-on-surface-variant">
          Chọn tỉnh/thành và phường/xã nơi bạn có thể nhận việc.
        </p>
      </div>

      {(error || (lockedProvinceName && provinces.length > 0 && !lockedProvince)) && (
        <p className="rounded-2xl bg-error/10 p-3 text-sm text-error">
          {error || "Không tìm thấy tỉnh/thành phố của khu vực đã chọn."}
        </p>
      )}

      <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
        <SearchableSelect
          id="provider-working-province"
          label="Tỉnh /Thành phố"
          value={effectiveProvinceCode}
          options={provinceOptions}
          loading={loadingProvinces}
          disabled={Boolean(lockedProvinceName)}
          placeholder="Tìm tỉnh/thành"
          emptyText="Không tìm thấy tỉnh/thành."
          onChange={(option) => {
            setProvinceCode(option?.value);
            setProvinceName(option?.label || "");
            setWardCode(undefined);
            setWardName("");
            setWards([]);
          }}
        />
        <SearchableSelect
          id="provider-working-ward"
          label="Phường / Xã"
          value={wardCode}
          options={wardOptions}
          loading={loadingWards}
          disabled={!effectiveProvinceCode}
          placeholder="Tìm phường/xã"
          emptyText="Không tìm thấy phường/xã."
          onChange={(option) => {
            setWardCode(option?.value);
            setWardName(option?.label || "");
          }}
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!canAdd}
          className="btn-primary min-h-14 lg:self-end"
        >
          <Plus size={18} /> Thêm
        </button>
      </div>

      {lockedProvinceName && (
        <p className="rounded-xl bg-primary/5 px-4 py-3 text-sm text-on-surface-variant">
          Các khu vực phục vụ phải cùng tỉnh/thành phố. Bạn chỉ có thể chọn
          thêm phường/xã thuộc <strong className="text-primary">{lockedProvinceName}</strong>.
        </p>
      )}

      {areas.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {areas.map((item) => (
            <button
              type="button"
              key={item}
              onClick={() => onRemove(item)}
              className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary/15 hover:text-primary"
            >
              {item} <X size={15} />
            </button>
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-outline-variant/60 bg-surface-container-low p-4 text-sm text-on-surface-variant">
          Chưa có khu vực nào. Thêm ít nhất một khu vực để tiếp tục.
        </p>
      )}
    </section>
  );
}
