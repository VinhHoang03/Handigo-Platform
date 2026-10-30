import { Building2, House, MapPin, type LucideProps } from "lucide-react";
import { getAddressLabelKind } from "@/features/profile/utils/addressLabelPresentation";

interface AddressLabelIconProps extends LucideProps {
  label?: string;
}

export function AddressLabelIcon({ label, ...iconProps }: AddressLabelIconProps) {
  const kind = getAddressLabelKind(label);

  if (kind === "home") {
    return <House {...iconProps} />;
  }

  if (kind === "office") {
    return <Building2 {...iconProps} />;
  }

  return <MapPin {...iconProps} />;
}
