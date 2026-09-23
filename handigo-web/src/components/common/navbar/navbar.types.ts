import type { User } from "@/features/auth/types/auth.types";

export type AppRole = "CUSTOMER" | "PROVIDER" | "ADMIN";

export interface NavbarItem {
  label: string;
  path: string;
  activePrefix?: string;
}

export const normalizeRole = (
  role?: User["role"] | string | null,
): AppRole | undefined => {
  const value = role?.toUpperCase();
  if (value === "CUSTOMER" || value === "PROVIDER" || value === "ADMIN") {
    return value;
  }
  return undefined;
};

export const getProfilePath = (role?: AppRole) => {
  if (role === "PROVIDER") return "/provider/profile";
  if (role === "CUSTOMER") return "/customer/profile";
  return "/admin";
};

export const getWalletPath = (role?: AppRole) => {
  if (role === "PROVIDER") return "/provider/wallet";
  if (role === "CUSTOMER") return "/customer/wallet";
  return "#";
};

export const getRoleLabel = (role?: AppRole) => {
  if (role === "CUSTOMER") return "Khách hàng";
  if (role === "PROVIDER") return "Nhà cung cấp";
  if (role === "ADMIN") return "Quản trị viên";
  return "Khách";
};

export const createNavbarItems = (role?: AppRole): NavbarItem[] => {
  const items: NavbarItem[] = [
    { label: "Trang chủ", path: "/" },
    {
      label: "Dịch vụ",
      path: "/customer/services",
      activePrefix: "/customer/services",
    },
    { label: "Giới thiệu", path: "/gioi-thieu" },
    { label: "Tin tức", path: "/tin-tuc", activePrefix: "/tin-tuc" },
    { label: "Hỗ trợ", path: "/ho-tro" },
  ];

  if (role === "PROVIDER") {
    return [
      ...items,
      {
        label: "Kênh nhà cung cấp dịch vụ",
        path: "/provider",
        activePrefix: "/provider",
      },
    ];
  }

  if (role === "ADMIN") {
    return [
      ...items,
      {
        label: "Quản lý hệ thống",
        path: "/admin",
        activePrefix: "/admin",
      },
    ];
  }

  return items;
};
