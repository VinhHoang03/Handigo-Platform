import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  getProvinces,
  getWardsByProvince,
  type AdministrativeUnit,
} from "@/features/customer/api/vietnamAddress.api";
import {
  findAdministrativeUnitByName,
  toSelectOptions,
  type AddressFormState,
} from "@/features/profile/utils/addressBookForm.utils";

interface UseAddressAdministrativeUnitsOptions {
  open: boolean;
  province: string;
  provinceCode?: number;
  ward: string;
  wardCode?: number;
  setAddressForm: Dispatch<SetStateAction<AddressFormState>>;
}

/** Tải và đồng bộ danh sách tỉnh/thành, phường/xã theo lựa chọn hiện tại của form. */
export function useAddressAdministrativeUnits({
  open,
  province,
  provinceCode,
  ward,
  wardCode,
  setAddressForm,
}: UseAddressAdministrativeUnitsOptions) {
  const [provinces, setProvinces] = useState<AdministrativeUnit[]>([]);
  const [wards, setWards] = useState<AdministrativeUnit[]>([]);
  const [isProvinceLoading, setIsProvinceLoading] = useState(false);
  const [isWardLoading, setIsWardLoading] = useState(false);
  const [administrativeError, setAdministrativeError] = useState("");

  const provinceOptions = useMemo(
    () => toSelectOptions(provinces),
    [provinces],
  );
  const wardOptions = useMemo(() => toSelectOptions(wards), [wards]);

  useEffect(() => {
    if (!open || provinces.length > 0) return undefined;

    let cancelled = false;

    const loadProvinces = async () => {
      try {
        setIsProvinceLoading(true);
        setAdministrativeError("");
        const data = await getProvinces();
        if (!cancelled) {
          setProvinces(data);

          if (province && !provinceCode) {
            const matchedProvince = findAdministrativeUnitByName(
              data,
              province,
            );
            if (matchedProvince) {
              setAddressForm((current) => ({
                ...current,
                province: matchedProvince.name,
                provinceCode: matchedProvince.code,
              }));
            }
          }
        }
      } catch {
        if (!cancelled) {
          setAdministrativeError("Không tải được danh sách tỉnh/thành.");
        }
      } finally {
        if (!cancelled) setIsProvinceLoading(false);
      }
    };

    void loadProvinces();
    return () => {
      cancelled = true;
    };
  }, [open, province, provinceCode, provinces.length, setAddressForm]);

  useEffect(() => {
    if (!open || !provinceCode) return undefined;

    let cancelled = false;

    const loadWards = async () => {
      try {
        setIsWardLoading(true);
        setAdministrativeError("");
        const data = await getWardsByProvince(provinceCode);
        if (!cancelled) {
          setWards(data);

          if (ward && !wardCode) {
            const matchedWard = findAdministrativeUnitByName(data, ward);
            if (matchedWard) {
              setAddressForm((current) => ({
                ...current,
                ward: matchedWard.name,
                wardCode: matchedWard.code,
              }));
            }
          }
        }
      } catch {
        if (!cancelled) {
          setAdministrativeError("Không tải được danh sách phường/xã.");
        }
      } finally {
        if (!cancelled) setIsWardLoading(false);
      }
    };

    void loadWards();
    return () => {
      cancelled = true;
    };
  }, [open, provinceCode, ward, wardCode, setAddressForm]);

  return {
    provinces,
    wards,
    provinceOptions,
    wardOptions,
    isProvinceLoading,
    isWardLoading,
    administrativeError,
    setProvinces,
    setWards,
  };
}
