import { getProvinces, getWardsByProvince, type AdministrativeUnit } from "./vietnamAddress.service";
import { searchAddressLocations, type AddressSearchCandidate } from "./reverseGeocoding.service";
import { AppError } from "../utils/appError";

export const AGENT_AREA_PLACE_PREFIX = "agent-area:";
export const AGENT_AREA_LOCATION_NOTE = "Vị trí trên bản đồ là vị trí tham chiếu của phường/xã. Thợ cần liên hệ người nhận để xác định điểm đến cụ thể.";
export const AGENT_UNLOCATED_NOTE = "Phường/xã và tỉnh/thành phố đã được xác thực. Địa chỉ vẫn được lưu khi chưa tra được tọa độ; cần tra lại vị trí hoặc chọn ghim trên bản đồ trước khi tìm thợ.";
type AddressInput = { addressText?: string; fullAddress?: string; province?: string; ward?: string };

const normalize = (value: string) => value.toLocaleLowerCase("vi-VN").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/[^a-z0-9]+/g, " ").trim();
const unitName = (value: string) => normalize(value).replace(/^(?:thanh pho|tinh|tp|phuong|xa|thi tran|quan|huyen|p|tt)\s+/, "");
export const normalizeAgentAdministrativeName = (value: string) => {
  const name = unitName(value);
  return ["hcm", "tphcm", "sai gon"].includes(name) ? "ho chi minh" : name;
};
const provinceAliases = (name: string) => {
  const base = unitName(name);
  return base === "ho chi minh" ? [base, "tp hcm", "tphcm", "hcm", "sai gon"] : [base];
};
const sameUnit = (name: string, value: string) => unitName(name) === unitName(value);
const unique = (units: AdministrativeUnit[]) => units.filter((unit, index) => units.findIndex((item) => item.code === unit.code) === index);
function fromText(units: AdministrativeUnit[], text: string, province = false) {
  const aliases = (unit: AdministrativeUnit) => province ? provinceAliases(unit.name) : [unitName(unit.name)];
  // Phần cuối chuỗi địa chỉ đáng tin hơn tên tỉnh có thể xuất hiện trong tên một trường/tòa nhà.
  for (const part of text.split(/[,;\n]/).reverse()) {
    const exact = units.filter((unit) => aliases(unit).includes(unitName(part)));
    if (exact.length) return exact;
  }
  const normalized = ` ${normalize(text)} `;
  const matches = units.filter((unit) => aliases(unit).some((name) => normalized.includes(` ${name} `)));
  return matches.filter((unit) => !matches.some((other) => other.code !== unit.code
    && unitName(other.name).length > unitName(unit.name).length
    && ` ${unitName(other.name)} `.includes(` ${unitName(unit.name)} `)));
}
const provinceOf = (candidate: AddressSearchCandidate, provinces: AdministrativeUnit[]) =>
  provinces.filter((province) => provinceAliases(province.name).includes(unitName(candidate.province)));
const isPlace = (item: AddressSearchCandidate) => item.matchLevel === "building" || item.matchLevel === "venue"
  || ["amenity", "building", "shop", "tourism", "office"].includes(item.category ?? "");

/** Gợi ý ghim để khách xác nhận; khi thiếu địa chỉ cụ thể thì dùng khu vực đã chọn. */
export async function suggestAddressMapLocation(address: { fullAddress: string; province: string; ward: string }) {
  const matchesProvince = (item: AddressSearchCandidate) => provinceAliases(address.province).includes(unitName(item.province));
  const matchesWard = (item: AddressSearchCandidate) => item.administrativeNames.some(name => sameUnit(name, address.ward))
    || item.fullAddress.split(",").some(part => sameUnit(part, address.ward));
  const parts = address.fullAddress.split(",").map(part => part.trim()).filter(Boolean);
  for (const part of [address.ward, address.province, "Việt Nam"]) {
    if (!parts.some(value => sameUnit(value, part))) parts.push(part);
  }
  const places = await searchAddressLocations(parts.join(", "));
  let location = places.find(item => item.matchCode === "exact" && matchesProvince(item) && matchesWard(item)
    && (isPlace(item) || item.matchLevel === "street" || item.category === "highway"));
  if (!location) {
    const matchesArea = (item: AddressSearchCandidate) => matchesProvince(item) && matchesWard(item)
      && ["boundary", "place"].includes(item.category ?? "");
    const areas = await searchAddressLocations(`${address.ward}, ${address.province}, Việt Nam`);
    location = areas.find(matchesArea);
    if (!location) {
      const simplified = await searchAddressLocations(`${unitName(address.ward)}, ${unitName(address.province)}, Việt Nam`);
      location = simplified.find(matchesArea);
    }
  }
  if (!location) throw new AppError("Chưa tìm được vị trí của phường/xã đã chọn. Vui lòng kéo bản đồ để chọn ghim.", 422);
  return {
    ...address, latitude: location.latitude, longitude: location.longitude,
    attribution: "© OpenStreetMap contributors | Search by LocationIQ.com",
  };
}

/** Tên địa điểm được giữ nguyên; đơn vị hành chính và tọa độ luôn đối chiếu dữ liệu hệ thống. */
export async function resolveAgentAddress(input: AddressInput) {
  const text = input.addressText?.trim() || input.fullAddress?.trim() || [input.ward, input.province].filter(Boolean).join(", ");
  if (!text) throw new AppError("Vui lòng cho biết địa chỉ hoặc phường/xã và tỉnh/thành phố cần thêm.", 400);
  let provinces: AdministrativeUnit[];
  try { provinces = await getProvinces(); }
  catch { throw new AppError("Chưa thể kiểm tra tỉnh/thành phố lúc này. Vui lòng thử lại sau.", 503); }
  if (!provinces.length) throw new AppError("Chưa tải được danh sách tỉnh/thành phố. Vui lòng thử lại sau.", 503);
  let matches = input.province
    ? provinces.filter((province) => provinceAliases(province.name).includes(unitName(input.province!)))
    : fromText(provinces, text, true);
  if (input.province && matches.length !== 1) throw new AppError("Chưa nhận diện được tỉnh/thành phố đã nhập. Vui lòng kiểm tra tên tỉnh/thành phố.", 422);
  const textProvinces = input.addressText ? fromText(provinces, input.addressText, true) : [];
  if (matches.length === 1 && textProvinces.length === 1 && matches[0].code !== textProvinces[0].code) {
    throw new AppError("Tỉnh/thành phố được chọn chưa khớp với địa chỉ đã nhập. Vui lòng chọn đúng tỉnh/thành phố.", 422);
  }
  let places: AddressSearchCandidate[] | undefined;
  if (!matches.length) {
    places = await searchAddressLocations(text);
    matches = unique(places.flatMap((item) => provinceOf(item, provinces)));
  }
  if (matches.length !== 1) throw new AppError(matches.length
    ? `Địa chỉ có thể thuộc nhiều tỉnh/thành phố: ${matches.slice(0, 6).map((unit) => unit.name).join(", ")}. Bạn muốn chọn nơi nào?`
    : "Chưa xác định được tỉnh/thành phố của địa chỉ. Bạn bổ sung tỉnh/thành phố giúp mình nhé.", 422);
  const province = matches[0];
  let wards: AdministrativeUnit[];
  try { wards = await getWardsByProvince(province.code); }
  catch { throw new AppError("Chưa thể kiểm tra phường/xã lúc này. Vui lòng thử lại sau.", 503); }
  if (!wards.length) throw new AppError("Chưa tải được danh sách phường/xã của tỉnh/thành phố này. Vui lòng thử lại sau.", 503);
  let wardMatches = input.ward ? wards.filter((ward) => sameUnit(ward.name, input.ward!)) : fromText(wards, text);
  if (input.ward && wardMatches.length !== 1) throw new AppError(`Chưa tìm thấy phường/xã “${input.ward}” trong ${province.name}. Vui lòng kiểm tra lại tên phường/xã.`, 422);
  const textWards = input.addressText ? fromText(wards, input.addressText) : [];
  if (input.ward && textWards.length === 1 && wardMatches[0].code !== textWards[0].code) {
    throw new AppError("Phường/xã được chọn chưa khớp với địa chỉ đã nhập. Vui lòng chọn đúng phường/xã.", 422);
  }
  if (!wardMatches.length) {
    places ??= await searchAddressLocations(`${text}, ${province.name}, Việt Nam`);
    wardMatches = unique(places.filter((item) => isPlace(item) && provinceOf(item, provinces).some((unit) => unit.code === province.code))
      .flatMap((item) => wards.filter((ward) => item.wardNames.some((name) => sameUnit(ward.name, name)))));
  }
  if (wardMatches.length !== 1) throw new AppError(wardMatches.length
    ? `Mình tìm thấy nhiều phường/xã trong ${province.name}: ${wardMatches.slice(0, 6).map((unit) => unit.name).join(", ")}. Bạn chọn phường/xã nào?`
    : `Chưa xác định được phường/xã của địa chỉ trong ${province.name}. Bạn bổ sung tên phường/xã giúp mình nhé; không cần số nhà.`, 422);
  const ward = wardMatches[0];
  const parts = (input.fullAddress?.trim() || text).split(/[,;\n]/).map((part) => part.trim()).filter(Boolean)
    .filter((part) => !sameUnit(part, ward.name) && !provinceAliases(province.name).includes(unitName(part)) && normalize(part) !== "viet nam");
  const description = parts.join(", ");
  const fullAddress = description.length >= 5 ? description : [description, ward.name, province.name].filter(Boolean).join(", ");
  const query = [fullAddress, ward.name, province.name, "Việt Nam"].join(", ");
  let mapUnavailable = false;
  const lookup = async (queryText: string) => {
    if (mapUnavailable) return [];
    try { return await searchAddressLocations(queryText); }
    catch { mapUnavailable = true; return []; }
  };
  places ??= await lookup(query);
  const localPlaces = places.filter((item) => provinceOf(item, provinces).some((unit) => unit.code === province.code)
    && item.wardNames.some((name) => sameUnit(ward.name, name))
    && isPlace(item));
  const distinctPlaces = localPlaces.filter((place, index) => localPlaces.findIndex((item) =>
    item.latitude.toFixed(5) === place.latitude.toFixed(5) && item.longitude.toFixed(5) === place.longitude.toFixed(5)) === index);
  let location = parts.length > 0 && distinctPlaces.length === 1 ? distinctPlaces[0] : undefined;
  let precision: "place" | "ward" | "unlocated" = "place";
  if (!location) {
    const matchesArea = (item: AddressSearchCandidate) => provinceOf(item, provinces).some((unit) => unit.code === province.code)
      && ["boundary", "place"].includes(item.category ?? "")
      && (item.administrativeNames.some((name) => sameUnit(ward.name, name))
        || fromText([ward], item.fullAddress).length === 1);
    const areas = await lookup(`${ward.name}, ${province.name}, Việt Nam`);
    location = areas.find(matchesArea);
    if (!location) {
      const simplified = await lookup(`${unitName(ward.name)}, ${unitName(province.name)}, Việt Nam`);
      location = simplified.find(matchesArea);
    }
    precision = "ward";
  }
  if (!location) precision = "unlocated";
  return { fullAddress, province: province.name, provinceCode: province.code, ward: ward.name, wardCode: ward.code,
    latitude: location?.latitude, longitude: location?.longitude,
    placeId: precision !== "place" ? `${AGENT_AREA_PLACE_PREFIX}${province.code}:${ward.code}` : location?.placeId,
    precision,
  };
}
