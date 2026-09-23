import type { LucideIcon } from "lucide-react";
export type DashboardRole = "CUSTOMER" | "PROVIDER" | "ADMIN";

export interface DashboardNavItem {
  icon: LucideIcon;
  label: string;
  path: string;
  matchPrefix?: boolean;
}

export interface DashboardSwitchConfig {
  label: string;
  path: string;
  variant: "outline" | "gradient";
}
