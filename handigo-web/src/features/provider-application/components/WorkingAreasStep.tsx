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

  const provinceOptions = useMemo(() => toSelectOptions(provinces), [provinces]);
  const wardOptions = useMemo(() => toSelectOptions(wards), [wards]);
  const selectedArea = [wardName, provinceName].filter(Boolean).join(", ");
  const canAdd = Boolean(provinceCode && wardCode && selectedArea);

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
    if (!provinceCode) {
      return undefined;
    }

    let cancelled = false;

    const load = async () => {
      try {
        setLoadingWards(true);
        setError("");
        const data = await getWardsByProvince(provinceCode);
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
  }, [provinceCode]);

  const handleAdd = () => {
    if (!canAdd) return;
    onAdd(selectedArea);
    setWardCode(undefined);
    setWardName("");
  };

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-headline-md font-bold">Khu vuc hoat dong</h2>
        <p className="mt-1 text-on-surface-variant">
          Chon tinh/thanh va phuong/xa noi ban co the nhan viec.
        </p>
      </div>

      {error && (
        <p className="rounded-2xl bg-error/10 p-3 text-sm text-error">{error}</p>
      )}

      <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
        <SearchableSelect
          id="provider-working-province"
          label="Tinh / Thanh pho"
          value={provinceCode}
          options={provinceOptions}
          loading={loadingProvinces}
          placeholder="Tim tinh/thanh"
          emptyText="Khong tim thay tinh/thanh."
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
          label="Phuong / Xa"
          value={wardCode}
          options={wardOptions}
          loading={loadingWards}
          disabled={!provinceCode}
          placeholder="Tim phuong/xa"
          emptyText="Khong tim thay phuong/xa."
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
          <Plus size={18} /> Them
        </button>
      </div>

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
          Chua co khu vuc nao. Them it nhat mot khu vuc de tiep tuc.
        </p>
      )}
    </section>
  );
}
