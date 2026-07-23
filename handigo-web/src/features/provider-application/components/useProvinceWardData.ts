import { useEffect, useState } from "react";
import {
  getProvinces,
  getWardsByProvince,
  type AdministrativeUnit,
} from "@/features/customer/api/vietnamAddress.api";

/**
 * Nạp danh sách tỉnh/thành khi mount. Tách khỏi `WorkingAreasStep` để giữ
 * file component dưới 200 dòng — hành vi giữ nguyên 100% so với bản gốc.
 */
export function useProvinces() {
  const [provinces, setProvinces] = useState<AdministrativeUnit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const data = await getProvinces();
        if (!cancelled) setProvinces(data);
      } catch {
        if (!cancelled) setError("Khong tai duoc danh sach tinh/thanh.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { provinces, loading, error };
}

/** Nạp danh sách phường/xã của tỉnh đang chọn — nạp lại mỗi khi mã tỉnh đổi. */
export function useWardsByProvince(provinceCode: number | undefined) {
  const [wards, setWards] = useState<AdministrativeUnit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!provinceCode) {
      return undefined;
    }

    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const data = await getWardsByProvince(provinceCode);
        if (!cancelled) setWards(data);
      } catch {
        if (!cancelled) setError("Khong tai duoc danh sach phuong/xa.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [provinceCode]);

  return { wards, setWards, loading, error };
}
