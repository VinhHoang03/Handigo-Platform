export const normalizeAgentAddressPart = (value: string) => value.toLocaleLowerCase("vi-VN").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/[^a-z0-9]+/g, " ").trim();
export const agentAdministrativeUnitName = (value: string) => normalizeAgentAddressPart(value).replace(/^(?:thanh pho|tinh|tp|phuong|xa|thi tran|quan|huyen|p|tt)\s+/, "");
export const agentProvinceAliases = (name: string) => {
  const base = agentAdministrativeUnitName(name);
  return base === "ho chi minh" ? [base, "tp hcm", "tphcm", "hcm", "sai gon"] : [base];
};
const sameUnit = (name: string, value: string) => agentAdministrativeUnitName(name) === agentAdministrativeUnitName(value);
// Chỉ bỏ đơn vị đã xác thực ở cuối chuỗi; giữ nguyên cách viết phần số nhà/tên đường.
function stripAdministrativeSuffix(text: string, names: string[], allowInline: boolean) {
  const tokens = [...text.matchAll(/[\p{L}\p{M}\p{N}]+/gu)];
  for (const name of [...names].sort((a, b) => normalizeAgentAddressPart(b).length - normalizeAgentAddressPart(a).length)) {
    const expected = normalizeAgentAddressPart(name).split(" ");
    const tail = tokens.slice(-expected.length);
    if (tail.length !== expected.length || tail.some((token, index) => normalizeAgentAddressPart(token[0]) !== expected[index])) continue;
    const start = tail[0]!.index!;
    const before = text.slice(0, start);
    if (!allowInline && before.trim() && !/[,;\n]\s*$/.test(before)) continue;
    return before.replace(/[,;\s]+$/, "");
  }
  return text;
}

export function extractAgentAddressDetail(addressLine: string, wardName: string, provinceName: string) {
  const ward = { name: wardName };
  const province = { name: provinceName };
  let detail = addressLine.trim();
  const provinceNames = [province.name, ...agentProvinceAliases(province.name)].flatMap((name) =>
    [name, `thành phố ${name}`, `tỉnh ${name}`, `tp ${name}`]);
  const wardNames = [ward.name, `phường ${agentAdministrativeUnitName(ward.name)}`, `xã ${agentAdministrativeUnitName(ward.name)}`,
    `thị trấn ${agentAdministrativeUnitName(ward.name)}`, `p ${agentAdministrativeUnitName(ward.name)}`, `tt ${agentAdministrativeUnitName(ward.name)}`];
  // Tách lặp theo đơn vị đã xác thực, không xóa từ trùng nằm trong tên đường/tòa nhà.
  let previous: string;
  do {
    previous = detail;
    detail = stripAdministrativeSuffix(detail, ["Việt Nam", "Vietnam"], false);
    const directWard = stripAdministrativeSuffix(detail, wardNames, true);
    const directArea = directWard !== detail ? directWard
      : stripAdministrativeSuffix(detail, [agentAdministrativeUnitName(ward.name)], false);
    if (directArea !== detail) { detail = directArea; continue; }
    let withoutProvince = detail;
    let previousProvince: string;
    let removedPair = false;
    do {
      previousProvince = withoutProvince;
      withoutProvince = stripAdministrativeSuffix(withoutProvince, provinceNames, true);
      if (withoutProvince === previousProvince) break;
      const explicitWard = stripAdministrativeSuffix(withoutProvince, wardNames, true);
      const withoutWard = explicitWard !== withoutProvince ? explicitWard
        : stripAdministrativeSuffix(withoutProvince, [agentAdministrativeUnitName(ward.name)], false);
      if (withoutWard !== withoutProvince) {
        detail = withoutWard;
        removedPair = true;
        break;
      }
    } while (withoutProvince !== previousProvince);
    // Tỉnh viết liền chỉ được tách khi đi cùng phường; nếu đứng riêng phải có ranh giới.
    if (!removedPair) detail = stripAdministrativeSuffix(detail, provinceNames, false);
  } while (detail !== previous);
  const parts = detail.split(/[,;\n]/).map((part) => part.trim()).filter(Boolean)
    .filter((part) => !sameUnit(part, ward.name) && !agentProvinceAliases(province.name).includes(agentAdministrativeUnitName(part))
      && !["viet nam", "vietnam"].includes(normalizeAgentAddressPart(part)));
  return parts.join(", ");
}

export function formatAgentAddress(address: { fullAddress: string; ward: string; province: string }) {
  return [extractAgentAddressDetail(address.fullAddress, address.ward, address.province), address.ward.trim(), address.province.trim()]
    .filter(Boolean).join(", ");
}

/** Bản xác nhận cũ chỉ có nhãn đầy đủ; chỉ tách khi có tên hành chính rõ ràng ở cuối. */
export function normalizeAgentAddressLabel(value: string) {
  const parts = value.split(",").map(part => part.trim()).filter(Boolean);
  const province = parts[parts.length - 1] ?? "";
  const ward = parts[parts.length - 2] ?? "";
  if (!/^(?:thanh pho|tinh|tp) /.test(normalizeAgentAddressPart(province))
    || !/^(?:phuong|xa|thi tran|p|tt) /.test(normalizeAgentAddressPart(ward))) return value;
  return formatAgentAddress({ fullAddress: value, ward, province });
}
